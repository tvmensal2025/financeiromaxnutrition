code = '''
// ======================================================================
// MOTOR CONVERSACIONAL DE VOZ (VAD, BARGE-IN & DESPACHO DE ÁUDIO WAV)
// ======================================================================

// ConversationalSink consome o áudio decodificado do WhatsApp VoIP (16 kHz mono float32, 60ms por frame).
// Implementa Voice Activity Detection (VAD), interrupção natural (barge-in) e despacho de áudio do usuário.
type ConversationalSink struct {
	callID           string
	engine           *Engine
	mu               sync.Mutex
	isSpeaking       bool
	speechSamples    []int16
	silenceFrames    int
	consecutiveVoice int
	rmsThreshold     float64
	silenceThreshold int
	minSpeechSamples int
	closed           bool
}

func (e *Engine) registerConversationalSink(callID string, call *meowcaller.Call) *ConversationalSink {
	sink := &ConversationalSink{
		callID:           callID,
		engine:           e,
		rmsThreshold:     0.012, // Limiar de energia RMS de voz humana
		silenceThreshold: 14,    // 14 frames * 60ms ≈ 840ms de silêncio para fechar o turno
		minSpeechSamples: 4800,  // Mínimo de 300ms de fala (4800 amostras a 16kHz) para evitar ruídos curtos
		speechSamples:    make([]int16, 0, 16000*5),
	}
	e.callsMu.Lock()
	e.callSinks[callID] = sink
	e.callsMu.Unlock()
	return sink
}

func (s *ConversationalSink) WriteFrame(frame []float32) error {
	if len(frame) == 0 {
		return nil
	}

	s.mu.Lock()
	if s.closed {
		s.mu.Unlock()
		return nil
	}

	// 1. Calcula energia RMS do frame de 60ms (960 amostras a 16kHz)
	var sum float64
	for _, sample := range frame {
		sum += float64(sample * sample)
	}
	rms := math.Sqrt(sum / float64(len(frame)))

	// 2. Classifica presença de fala ou silêncio
	if rms >= s.rmsThreshold {
		s.consecutiveVoice++
		s.silenceFrames = 0

		// Se o cliente falou por pelo menos 2 frames consecutivos (120ms):
		if s.consecutiveVoice >= 2 {
			if !s.isSpeaking {
				s.isSpeaking = true
				log.Info().Str("call_id", s.callID).Float64("rms", rms).Msg("🎙️ Voz do cliente detectada na chamada!")
			}

			// Interrupção natural (Barge-in): se o atendente estava falando, interrompe a fala imediatamente
			s.engine.stopActivePlayer(s.callID)
		}

		if s.isSpeaking {
			for _, sample := range frame {
				v := sample * 32768.0
				if v > 32767 {
					v = 32767
				} else if v < -32768 {
					v = -32768
				}
				s.speechSamples = append(s.speechSamples, int16(v))
			}
		}
	} else {
		s.consecutiveVoice = 0
		if s.isSpeaking {
			s.silenceFrames++
			// Mantém as amostras do silêncio para preservar o final suave das palavras
			for _, sample := range frame {
				v := sample * 32768.0
				if v > 32767 {
					v = 32767
				} else if v < -32768 {
					v = -32768
				}
				s.speechSamples = append(s.speechSamples, int16(v))
			}

			// Silêncio suficiente detectado (fim do turno de fala do usuário)
			if s.silenceFrames >= s.silenceThreshold {
				samplesToDispatch := s.speechSamples
				callID := s.callID
				s.speechSamples = make([]int16, 0, 16000*5)
				s.isSpeaking = false
				s.silenceFrames = 0

				s.mu.Unlock()

				if len(samplesToDispatch) >= s.minSpeechSamples {
					log.Info().Str("call_id", callID).Int("samples", len(samplesToDispatch)).Msg("🗣️ Turno de fala do cliente finalizado. Codificando WAV e despachando para Helena Gateway...")
					wavBytes := encodePCMToWAV(samplesToDispatch, 16000)
					go s.engine.notifyUserSpeech(callID, wavBytes)
				}
				return nil
			}
		}
	}

	s.mu.Unlock()
	return nil
}

func (s *ConversationalSink) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.closed = true
	s.speechSamples = nil
	return nil
}

func (e *Engine) stopActivePlayer(callID string) {
	e.callsMu.RLock()
	player, ok := e.callPlayers[callID]
	e.callsMu.RUnlock()

	if ok && player != nil && player.State() == meowcaller.PlayerPlaying {
		log.Info().Str("call_id", callID).Msg("🛑 Interrompendo fala do Pedro (barge-in do cliente)")
		player.Stop()
	}
}

func (e *Engine) setActivePlayer(callID string, player *meowcaller.Player) {
	e.callsMu.Lock()
	e.callPlayers[callID] = player
	e.callsMu.Unlock()
}

// encodePCMToWAV gera um buffer WAV canônico com cabeçalho RIFF de 44 bytes para 16-bit mono PCM
func encodePCMToWAV(samples []int16, sampleRate uint32) []byte {
	dataLen := uint32(len(samples) * 2)
	buf := bytes.NewBuffer(make([]byte, 0, 44+dataLen))

	var h [44]byte
	copy(h[0:4], "RIFF")
	binary.LittleEndian.PutUint32(h[4:8], 36+dataLen)
	copy(h[8:12], "WAVE")
	copy(h[12:16], "fmt ")
	binary.LittleEndian.PutUint32(h[16:20], 16)
	binary.LittleEndian.PutUint16(h[20:22], 1) // PCM
	binary.LittleEndian.PutUint16(h[22:24], 1) // Mono
	binary.LittleEndian.PutUint32(h[24:28], sampleRate)
	binary.LittleEndian.PutUint32(h[28:32], sampleRate*2) // Byte rate (16000 * 2 bytes = 32000)
	binary.LittleEndian.PutUint16(h[32:34], 2)            // Block align
	binary.LittleEndian.PutUint16(h[34:36], 16)           // Bits per sample
	copy(h[36:40], "data")
	binary.LittleEndian.PutUint32(h[40:44], dataLen)

	_, _ = buf.Write(h[:])
	for _, s := range samples {
		var b [2]byte
		binary.LittleEndian.PutUint16(b[:], uint16(s))
		_, _ = buf.Write(b[:])
	}

	return buf.Bytes()
}

// notifyUserSpeech envia o áudio da fala do cliente (WAV 16kHz) para o Helena Gateway
func (e *Engine) notifyUserSpeech(callID string, wavBytes []byte) {
	gatewayURL := "https://helena-automation-helena-gateway.d9v63q.easypanel.host/api/integrations/voice-agent/user-speech"
	b64 := base64.StdEncoding.EncodeToString(wavBytes)
	payload, err := json.Marshal(map[string]interface{}{
		"call_id":      callID,
		"audio_base64": b64,
		"format":       "wav",
		"sample_rate":  16000,
		"timestamp":    time.Now().UTC().Format(time.RFC3339),
	})
	if err != nil {
		return
	}

	client := &http.Client{Timeout: 45 * time.Second}
	req, err := http.NewRequest("POST", gatewayURL, bytes.NewBuffer(payload))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	if e.cfg.InternalAPIKey != "" {
		req.Header.Set("X-API-Key", e.cfg.InternalAPIKey)
	}

	resp, err := client.Do(req)
	if err != nil {
		log.Warn().Err(err).Str("call_id", callID).Msg("Erro ao enviar fala do usuário para Helena Gateway")
		return
	}
	defer resp.Body.Close()
	log.Info().Str("call_id", callID).Int("status", resp.StatusCode).Msg("Turno de fala do cliente processado pelo Helena Gateway!")
}
'''

filePath = 'services/meowcaller-service/internal/voice/engine.go'
with open(filePath, 'r', encoding='utf-8') as f:
    current = f.read()

if 'type ConversationalSink struct' not in current:
    with open(filePath, 'a', encoding='utf-8') as f:
        f.write(code)
    print('Anexado com sucesso!')
else:
    print('Ja existe!')
