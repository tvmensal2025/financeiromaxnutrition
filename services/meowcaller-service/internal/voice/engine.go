// Package voice implementa o engine real de WhatsApp VoIP usando
// hypermeow (cliente WhatsApp Web) + meowcaller (stack VoIP).
// Responsabilidades:
//   - Gerenciar sessão WhatsApp (QR Code via channel, pareamento, reconexão contínua)
//   - Controlar o ciclo de vida de chamadas (Originar, Atender, Encerrar)
//   - Expor estado via GetStatus() para a camada HTTP
package voice

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	waClient "github.com/polymorfa/hypermeow"
	"github.com/polymorfa/hypermeow/proto/waCompanionReg"
	"github.com/polymorfa/hypermeow/store"
	"github.com/polymorfa/hypermeow/store/sqlstore"
	"github.com/polymorfa/hypermeow/types"
	"github.com/polymorfa/hypermeow/types/events"
	waLog "github.com/polymorfa/hypermeow/util/log"
	"github.com/purpshell/meowcaller"
	"github.com/purpshell/meowcaller/diag"
	"github.com/rs/zerolog/log"
	"github.com/skip2/go-qrcode"
	"github.com/tvmensal2025/financeiromaxnutrition/services/meowcaller-service/internal/config"
	"google.golang.org/protobuf/proto"

	_ "modernc.org/sqlite"
)

// SessionStatus representa o estado de conexão WhatsApp
type SessionStatus string

const (
	StatusDisconnected    SessionStatus = "DISCONNECTED"
	StatusConnecting      SessionStatus = "CONNECTING"
	StatusPairingRequired SessionStatus = "PAIRING_REQUIRED"
	StatusConnected       SessionStatus = "CONNECTED"
)

// CallSnapshot representa o estado atual de uma chamada
type CallSnapshot struct {
	CallID       string    `json:"call_id"`
	Direction    string    `json:"direction"`
	RemoteNumber string    `json:"remote_number"`
	Status       string    `json:"status"`
	StartedAt    time.Time `json:"started_at"`
}

// VoiceDiagnostics armazena métricas e telemetria da última chamada para diagnóstico em tempo real
type VoiceDiagnostics struct {
	RemoteMuted          *bool     `json:"remote_muted"`
	LastAudioFrameAt     time.Time `json:"last_audio_frame_at"`
	TotalSamplesReceived int64     `json:"total_samples_received"`
	LastCallID           string    `json:"last_call_id"`
	LastPeer             string    `json:"last_peer"`
	LastCallDirection    string    `json:"last_call_direction"`
	LastCallStartedAt    time.Time `json:"last_call_started_at"`
	TotalFramesReceived  int       `json:"total_frames_received"`
	LastRMS              float64   `json:"last_rms"`
	MaxRMS               float64   `json:"max_rms"`
	NoiseFloor           float64   `json:"noise_floor"`
	EffectiveThreshold   float64   `json:"effective_threshold"`
	SpeechEventsCount    int       `json:"speech_events_count"`
	WavsDispatchedCount  int       `json:"wavs_dispatched_count"`
	LastDispatchedBytes  int       `json:"last_dispatched_bytes"`
	LastGatewayStatus    int       `json:"last_gateway_status"`
	LastGatewayResponse  string    `json:"last_gateway_response"`
	LastBargeInAt        time.Time `json:"last_barge_in_at"`
	RecentEvents         []string  `json:"recent_events"`
}

// Engine gerencia a sessão WhatsApp e o engine de chamadas VoIP
type Engine struct {
	cfg           *config.Config
	mu            sync.RWMutex
	status        SessionStatus
	jid           string
	qrCodeB64     string // QR Code em base64 PNG com prefixo data:image/png;base64,...
	qrGeneratedAt time.Time
	lastRestart   time.Time
	stopped       bool
	forceReset    bool

	wa        *waClient.Client
	meo       *meowcaller.Client
	cancelCtx context.CancelFunc

	activeCalls      map[string]*CallSnapshot
	callHandles      map[string]*meowcaller.Call
	callSinks        map[string]*ConversationalSink
	callPlayers      map[string]*meowcaller.Player
	callStreams      map[string]*pcmStreamSource
	callSpeechEpochs map[string]uint64
	callsMu          sync.RWMutex

	diag   VoiceDiagnostics
	diagMu sync.RWMutex
}

func (e *Engine) recordDiagEventLocked(event string) {
	entry := fmt.Sprintf("[%s] %s", time.Now().Format("15:04:05.000"), event)
	e.diag.RecentEvents = append(e.diag.RecentEvents, entry)
	if len(e.diag.RecentEvents) > 50 {
		e.diag.RecentEvents = e.diag.RecentEvents[len(e.diag.RecentEvents)-50:]
	}
}

func (e *Engine) recordDiagEvent(event string) {
	e.diagMu.Lock()
	defer e.diagMu.Unlock()
	e.recordDiagEventLocked(event)
}

func (e *Engine) updateDiagCallStart(callID, peer, direction string) {
	e.diagMu.Lock()
	defer e.diagMu.Unlock()
	e.diag.LastCallID = callID
	e.diag.LastPeer = peer
	e.diag.LastCallDirection = direction
	e.diag.LastCallStartedAt = time.Now()
	e.diag.TotalFramesReceived = 0
	e.diag.RemoteMuted = nil
	e.diag.LastAudioFrameAt = time.Time{}
	e.diag.TotalSamplesReceived = 0
	e.diag.LastGatewayStatus = 0
	e.diag.LastGatewayResponse = ""
	e.diag.LastDispatchedBytes = 0
	e.diag.LastRMS = 0
	e.diag.MaxRMS = 0
	e.diag.NoiseFloor = 0
	e.diag.SpeechEventsCount = 0
	e.diag.WavsDispatchedCount = 0
	e.recordDiagEventLocked(fmt.Sprintf("Chamada iniciada: id=%s, peer=%s, dir=%s", callID, peer, direction))
}

func (e *Engine) updateDiagAudio(callID string, frames, samples int, rms, floor, threshold float64) {
	e.diagMu.Lock()
	defer e.diagMu.Unlock()
	e.diag.TotalFramesReceived = frames
	e.diag.LastAudioFrameAt = time.Now()
	e.diag.TotalSamplesReceived += int64(samples)
	e.diag.LastRMS = rms
	e.diag.NoiseFloor = floor
	e.diag.EffectiveThreshold = threshold
	if rms > e.diag.MaxRMS {
		e.diag.MaxRMS = rms
	}
}

func (e *Engine) updateDiagDispatch(bytes int) {
	e.diagMu.Lock()
	defer e.diagMu.Unlock()
	e.diag.WavsDispatchedCount++
	e.diag.LastDispatchedBytes = bytes
}

func (e *Engine) updateDiagGatewayResponse(status int, body string) {
	e.diagMu.Lock()
	defer e.diagMu.Unlock()
	e.diag.LastGatewayStatus = status
	e.diag.LastGatewayResponse = body
}

func (e *Engine) GetDiagnostics() VoiceDiagnostics {
	e.diagMu.RLock()
	defer e.diagMu.RUnlock()
	return e.diag
}

// NewEngine inicializa o engine de voz WhatsApp real
func NewEngine(cfg *config.Config) (*Engine, error) {
	e := &Engine{
		cfg:         cfg,
		status:      StatusDisconnected,
		activeCalls: make(map[string]*CallSnapshot),
		callHandles: make(map[string]*meowcaller.Call),
		callSinks:   make(map[string]*ConversationalSink),
		callPlayers: make(map[string]*meowcaller.Player),
		diag: VoiceDiagnostics{
			RecentEvents: make([]string, 0, 50),
		},
	}

	// Garante que o diretório de sessão existe
	dir := filepath.Dir(cfg.WhatsAppSessionPath)
	if err := os.MkdirAll(dir, 0700); err != nil {
		log.Warn().Err(err).Str("dir", dir).Msg("Não foi possível criar diretório de sessão")
	}

	// Inicia o loop de conexão em background
	go e.connectLoop()

	return e, nil
}

// connectLoop tenta conectar/reconectar continuamente mantendo o WhatsApp online e QR Code ativo
func (e *Engine) connectLoop() {
	for {
		e.mu.RLock()
		isStopped := e.stopped
		e.mu.RUnlock()
		if isStopped {
			log.Info().Msg("Loop de conexão WhatsApp encerrado (serviço parado).")
			return
		}

		ctx, cancel := context.WithCancel(context.Background())
		e.mu.Lock()
		e.cancelCtx = cancel
		e.mu.Unlock()

		err := e.runSession(ctx)
		cancel()

		e.mu.RLock()
		isStopped = e.stopped
		e.mu.RUnlock()
		if isStopped {
			return
		}

		if err != nil {
			log.Warn().Err(err).Msg("Ciclo de sessão WhatsApp finalizado. Reiniciando ciclo em 2s para manter QR Code fresco...")
		}
		time.Sleep(2 * time.Second)
	}
}

// runSession cria e gerencia uma sessão WhatsApp completa
func (e *Engine) runSession(ctx context.Context) error {
	e.setStatus(StatusConnecting, "", "")

	// Configura o device como Mac OS / Chrome
	store.DeviceProps.Os = proto.String("Mac OS")
	store.DeviceProps.PlatformType = waCompanionReg.DeviceProps_CHROME.Enum()

	// Abre o store SQLite (persiste sessão entre reinicializações)
	dbPath := "file:" + e.cfg.WhatsAppSessionPath + "?_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)"
	container, err := sqlstore.New(ctx, "sqlite", dbPath, waLog.Zerolog(log.Logger).Sub("wa-db"))
	if err != nil {
		log.Warn().Err(err).Msg("Erro ao abrir SQLite de sessão. Tentando recriar banco...")
		_ = os.Remove(e.cfg.WhatsAppSessionPath)
		_ = os.Remove(e.cfg.WhatsAppSessionPath + "-shm")
		_ = os.Remove(e.cfg.WhatsAppSessionPath + "-wal")
		container, err = sqlstore.New(ctx, "sqlite", dbPath, waLog.Zerolog(log.Logger).Sub("wa-db"))
		if err != nil {
			return fmt.Errorf("erro fatal ao abrir SQLite de sessão WhatsApp: %w", err)
		}
	}
	defer container.Close()

	// Se houve requisição de reset explícito, limpa todos os devices do banco
	e.mu.Lock()
	forceReset := e.forceReset
	e.forceReset = false
	e.mu.Unlock()

	if forceReset {
		log.Info().Msg("Reset explícito solicitado: deletando dispositivos anteriores do banco...")
		devices, err := container.GetAllDevices(ctx)
		if err == nil {
			for _, d := range devices {
				_ = d.Delete(ctx)
			}
		}
	}

	device, err := container.GetFirstDevice(ctx)
	if err != nil {
		return fmt.Errorf("erro ao carregar dispositivo WhatsApp: %w", err)
	}

	// Cria o cliente WhatsApp
	wa := waClient.NewClient(device, waLog.Zerolog(log.Logger).Sub("wa"))

	// Instala o meowcaller ANTES de conectar (obrigatório para interceptar chamadas VoIP)
	// WithLogger: surfaça logs internos do stack VoIP (SRTP, relay, RTP, codec) para zerolog
	// WithDiagnostics: grava JSONL detalhado por categoria (srtp, rtp, relay, media_in, media_out)
	meowLogger := log.Logger.With().Str("component", "meowcaller").Logger()
	var diagRec *diag.Recorder
	diagDir := filepath.Join(os.TempDir(), "meowcaller-diag")
	if rec, err := diag.NewRecorder(diagDir); err == nil {
		diagRec = rec
		log.Info().Str("diag_dir", diagDir).Msg("Diagnóstico meowcaller habilitado (JSONL por categoria)")
	} else {
		log.Warn().Err(err).Msg("Não foi possível habilitar diagnóstico meowcaller")
	}
	var meowOpts []meowcaller.Option
	meowOpts = append(meowOpts, meowcaller.WithLogger(meowLogger))
	if diagRec != nil {
		meowOpts = append(meowOpts, meowcaller.WithDiagnostics(diagRec))
	}
	// Capture the authenticated phone/LID mapping before the VoIP offer handler.
	wa.AddEventHandler(func(evt any) {
		if offer, ok := evt.(*events.CallOffer); ok && offer.CallCreator.Server == types.HiddenUserServer && offer.CallCreatorAlt.Server == types.DefaultUserServer {
			if err := wa.Store.LIDs.PutLIDMapping(context.Background(), offer.CallCreator, offer.CallCreatorAlt); err != nil {
				log.Warn().Msg("Não foi possível registrar identificação do chamador")
			}
		}
	})
	meo := meowcaller.NewClient(wa, meowOpts...)

	e.mu.Lock()
	e.wa = wa
	e.meo = meo
	e.mu.Unlock()

	// Handler de logout remoto
	wa.AddEventHandler(func(evt any) {
		if _, ok := evt.(*events.LoggedOut); ok {
			log.Warn().Msg("WhatsApp desconectado pelo celular (LoggedOut). Limpando credenciais antigas...")
			_ = device.Delete(context.Background())
			e.RestartSession()
		}
	})

	// Handler de chamadas recebidas (Inbound VoIP)
	meo.OnIncomingCall(func(call *meowcaller.Call) {
		callID := call.ID()
		peer := call.Peer().String()
		snap := &CallSnapshot{
			CallID:       callID,
			Direction:    "INBOUND",
			RemoteNumber: peer,
			Status:       "RINGING",
			StartedAt:    time.Now(),
		}
		e.callsMu.Lock()
		e.activeCalls[callID] = snap
		e.callHandles[callID] = call
		e.callsMu.Unlock()

		e.updateDiagCallStart(callID, peer, "INBOUND")
		e.observeRemoteMute(callID, call)

		// Hook de encerramento da chamada recebida
		call.OnEnd(func(reason string) {
			log.Info().Str("call_id", callID).Str("reason", reason).Msg("Chamada recebida encerrada")
			e.recordDiagEvent(fmt.Sprintf("Chamada encerrada. Motivo: %s", reason))
			snap.Status = "ENDED"
			e.closeCallAudio(callID)
			go e.notifyGatewayWebhook("CALL_ENDED", callID, "")

			time.AfterFunc(5*time.Second, func() {
				e.callsMu.Lock()
				delete(e.activeCalls, callID)
				delete(e.callHandles, callID)
				e.callsMu.Unlock()
			})
		})

		// Disparador de mídia e saudação idempotente (garante execução única via OnReady ou Fallback)
		var onceGreeting sync.Once
		startGreetingAndMedia := func(trigger string) {
			onceGreeting.Do(func() {
				log.Info().Str("call_id", callID).Str("trigger", trigger).Msg("📞 Mídia RTP pronta e fluindo na chamada inbound! Registrando sink conversacional e disparando saudação do Pedro...")
				e.recordDiagEvent(fmt.Sprintf("Mídia conectada via %s: registrando sink e disparando saudação", trigger))

				// Garante que o sink conversacional contínuo esteja atrelado à chamada ativa com mídia pronta
				sink := e.registerConversationalSink(callID, call)
				call.Receive(sink)

				// Dispara a saudação do Pedro em goroutine desacoplada (não bloqueia pipeline de escuta)
				go e.playInitialGreeting(callID, call, "INBOUND")
			})
		}

		// Quando a mídia RTP estiver fluindo (após primeiro RTP recebido), dispara o fluxo de mídia e saudação
		call.OnReady(func() {
			startGreetingAndMedia("OnReady")
		})

		// ATENDIMENTO IMEDIATO OBRIGATÓRIO (Handshake VoIP WhatsApp):
		// O WhatsApp envia o stanza "mute_v2" (com chaves de mídia) nos primeiros milissegundos.
		// O meowcaller precisa que call.Answer() já tenha setado acceptPending = true para enviar <accept>.
		if err := call.Answer(); err != nil {
			log.Error().Err(err).Str("call_id", callID).Msg("Erro ao atender chamada VoIP")
			snap.Status = "FAILED"
			e.recordDiagEvent(fmt.Sprintf("Falha ao atender chamada: %v", err))
			return
		}
		snap.Status = "CONNECTED"
		log.Info().Str("caller", peer).Str("call_id", callID).Msg("✅ Chamada VoIP atendida imediatamente! Registrando sink conversacional...")
		e.recordDiagEvent("Chamada atendida com sucesso (Answer executado, aguardando pacotes RTP)")

		// Conecta o sink conversacional contínuo IMEDIATAMENTE pós-atendimento para capturar primeiros frames
		sink := e.registerConversationalSink(callID, call)
		call.Receive(sink)

		// Fallback de segurança: Se OnReady demorar ou não disparar em 1.2 segundos, inicia a saudação
		time.AfterFunc(1200*time.Millisecond, func() {
			startGreetingAndMedia("FallbackTimer")
		})
	})

	// Conecta ao WhatsApp
	if device.ID == nil {
		// Novo dispositivo — precisa escanear QR Code
		return e.connectWithQR(ctx, wa)
	}

	// Dispositivo com credenciais salvas — tenta restabelecer conexão
	log.Info().Str("jid", device.ID.String()).Msg("Tentando reconectar sessão salva...")
	if err := wa.Connect(); err != nil {
		log.Warn().Err(err).Msg("Falha ao discar conexão com sessão salva")
	}

	// Aguarda conexão autenticada por no máximo 8s
	if err := waitUntilConnected(ctx, wa, 8*time.Second); err != nil {
		log.Warn().Err(err).Msg("Sessão salva expirada ou inválida. Limpando credenciais antigas para gerar novo QR Code...")
		_ = device.Delete(context.Background())
		newDevice := container.NewDevice()
		newWa := waClient.NewClient(newDevice, waLog.Zerolog(log.Logger).Sub("wa"))
		newMeowLogger := log.Logger.With().Str("component", "meowcaller").Logger()
		newMeo := meowcaller.NewClient(newWa, meowcaller.WithLogger(newMeowLogger))

		e.mu.Lock()
		e.wa = newWa
		e.meo = newMeo
		e.mu.Unlock()

		return e.connectWithQR(ctx, newWa)
	}

	jid := wa.Store.GetJID().String()
	log.Info().Str("jid", jid).Msg("✅ WhatsApp de Voz conectado com sucesso!")
	e.setStatus(StatusConnected, jid, "")

	// Anuncia presença para receber chamadas
	if wa.Store.PushName == "" {
		wa.Store.PushName = "Helena VoIP"
	}
	if err := wa.SendPresence(ctx, types.PresenceAvailable); err != nil {
		log.Warn().Err(err).Msg("Falha ao enviar presença (não crítico)")
	}

	// Aguarda o contexto ser cancelado (shutdown ou reconexão)
	<-ctx.Done()
	wa.Disconnect()
	return nil
}

// connectWithQR gerencia o fluxo de primeiro pareamento via QR Code
func (e *Engine) connectWithQR(ctx context.Context, wa *waClient.Client) error {
	log.Info().Msg("Novo dispositivo detectado. Gerando QR Code de Ligações...")
	e.setStatus(StatusPairingRequired, "", "")

	if wa.IsConnected() {
		wa.Disconnect()
	}

	qrChan, err := wa.GetQRChannel(ctx)
	if err != nil {
		return fmt.Errorf("erro ao obter canal QR: %w", err)
	}

	if err := wa.Connect(); err != nil {
		return fmt.Errorf("erro ao conectar para QR: %w", err)
	}

	var lastEvent string
	// Processa eventos do canal QR emitidos pelo WhatsApp Web
	for evt := range qrChan {
		lastEvent = evt.Event
		if evt.Event == "code" {
			// Gera imagem PNG do QR Code
			png, err := qrcode.Encode(evt.Code, qrcode.Medium, 256)
			if err != nil {
				log.Error().Err(err).Msg("Erro ao gerar imagem QR Code")
				// Usa texto puro como fallback
				e.mu.Lock()
				e.qrCodeB64 = "data:text/plain;base64," + base64.StdEncoding.EncodeToString([]byte(evt.Code))
				e.qrGeneratedAt = time.Now()
				e.mu.Unlock()
			} else {
				b64 := "data:image/png;base64," + base64.StdEncoding.EncodeToString(png)
				e.mu.Lock()
				e.qrCodeB64 = b64
				e.qrGeneratedAt = time.Now()
				e.mu.Unlock()
				log.Info().Msg("📱 QR Code de Ligações gerado! Escaneie no WhatsApp: Aparelhos Conectados.")
			}
		} else if evt.Event == "success" {
			log.Info().Msg("✅ Pareamento via QR Code concluído com sucesso!")
			break
		} else if evt.Event == "timeout" {
			log.Warn().Msg("⏰ QR Code expirou por inatividade. O canal será reciclado automaticamente.")
			break
		} else {
			log.Info().Str("event", evt.Event).Msg("Evento de login WhatsApp")
		}
	}

	// QR Channel fechado (timeout ou pareamento falhou)
	e.mu.Lock()
	e.qrCodeB64 = "" // Limpa QR Code expirado imediatamente
	e.mu.Unlock()

	// Se não logou e não teve sucesso explícito, retorna erro para reiniciar o ciclo
	if !wa.IsLoggedIn() && lastEvent != "success" {
		return fmt.Errorf("sessão QR finalizada sem login (evento: %s)", lastEvent)
	}

	// Pareamento concluído (ou em finalização)
	if err := waitUntilConnected(ctx, wa, 30*time.Second); err != nil {
		return fmt.Errorf("timeout após pareamento QR: %w", err)
	}

	jid := wa.Store.GetJID().String()
	log.Info().Str("jid", jid).Msg("✅ WhatsApp de Voz pareado e conectado!")
	e.setStatus(StatusConnected, jid, "")

	// Anuncia presença
	if wa.Store.PushName == "" {
		wa.Store.PushName = "Helena VoIP"
	}
	if err := wa.SendPresence(ctx, types.PresenceAvailable); err != nil {
		log.Warn().Err(err).Msg("Falha ao enviar presença (não crítico)")
	}

	// Aguarda shutdown
	<-ctx.Done()
	wa.Disconnect()
	return nil
}

// waitUntilConnected aguarda com ticker até o cliente estar conectado e autenticado
func waitUntilConnected(ctx context.Context, wa *waClient.Client, timeout time.Duration) error {
	deadline := time.After(timeout)
	ticker := time.NewTicker(200 * time.Millisecond)
	defer ticker.Stop()

	for {
		if wa.IsConnected() && wa.IsLoggedIn() {
			return nil
		}
		select {
		case <-ticker.C:
			if wa.IsConnected() && wa.IsLoggedIn() {
				return nil
			}
		case <-deadline:
			return fmt.Errorf("timeout aguardando conexão WhatsApp (%s)", timeout)
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

// setStatus atualiza o estado de forma thread-safe
func (e *Engine) setStatus(s SessionStatus, jid, qr string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.status = s
	if jid != "" {
		e.jid = jid
	}
	if s == StatusConnected {
		e.qrCodeB64 = "" // Limpa QR Code ao conectar
	}
	if qr != "" {
		e.qrCodeB64 = qr
	}
}

// GetStatus retorna o estado atual da sessão (thread-safe)
func (e *Engine) GetStatus() (SessionStatus, string, string) {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.status, e.jid, e.qrCodeB64
}

// RestartSession força uma reconexão imediata gerando um QR Code 100% fresco
func (e *Engine) RestartSession() {
	e.mu.Lock()
	if time.Since(e.lastRestart) < 8*time.Second {
		e.mu.Unlock()
		log.Info().Msg("RestartSession ignorado: reinício recente já em andamento")
		return
	}
	e.lastRestart = time.Now()
	e.qrCodeB64 = ""
	e.status = StatusConnecting
	cancel := e.cancelCtx
	wa := e.wa
	e.mu.Unlock()

	if wa != nil {
		wa.Disconnect()
	}
	if cancel != nil {
		cancel()
	}
	log.Info().Msg("🔄 Sessão WhatsApp reiniciada sob demanda. Gerando QR Code fresco...")
}

// ResetSession limpa completamente o banco SQLite de sessão e força geração de QR Code do zero
func (e *Engine) ResetSession(ctx context.Context) error {
	e.mu.Lock()
	e.lastRestart = time.Now()
	e.qrCodeB64 = ""
	e.jid = ""
	e.status = StatusConnecting
	e.forceReset = true
	cancel := e.cancelCtx
	wa := e.wa
	e.mu.Unlock()

	if wa != nil {
		wa.Disconnect()
	}
	if cancel != nil {
		cancel()
	}

	log.Info().Msg("Sinal de reset de sessão enviado. Dispositivos serão removidos com segurança.")
	return nil
}

// PairPhone solicita código de pareamento por número de telefone (8 dígitos)
func (e *Engine) PairPhone(ctx context.Context, phone string) (string, error) {
	cleaned := ""
	for _, ch := range phone {
		if ch >= '0' && ch <= '9' {
			cleaned += string(ch)
		}
	}
	if len(cleaned) < 10 {
		return "", fmt.Errorf("número de telefone inválido: %s", phone)
	}
	if len(cleaned) == 10 || len(cleaned) == 11 {
		cleaned = "55" + cleaned
	}

	e.mu.RLock()
	wa := e.wa
	status := e.status
	e.mu.RUnlock()

	if wa == nil {
		return "", fmt.Errorf("cliente WhatsApp ainda não inicializado. Aguarde alguns segundos e tente novamente")
	}
	if status == StatusConnected {
		return "", fmt.Errorf("dispositivo já está conectado")
	}

	code, err := wa.PairPhone(ctx, cleaned, true, waClient.PairClientChrome, "Chrome (Linux)")
	if err != nil {
		return "", fmt.Errorf("erro ao gerar código de pareamento: %w", err)
	}

	log.Info().Str("phone", cleaned).Str("code", code).Msg("📲 Código de pareamento WhatsApp gerado!")
	return code, nil
}

// OriginateCall inicia uma chamada de saída via meowcaller
func (e *Engine) OriginateCall(ctx context.Context, target string) (*CallSnapshot, error) {
	e.mu.RLock()
	status := e.status
	meo := e.meo
	e.mu.RUnlock()

	if status != StatusConnected {
		return nil, fmt.Errorf(
			"sessão WhatsApp não conectada (status: %s). Escaneie o QR Code de Ligações para conectar o chip de voz",
			status,
		)
	}
	if meo == nil {
		return nil, fmt.Errorf("engine de voz não inicializado")
	}

	log.Info().Str("target", target).Msg("🔔 Originando chamada WhatsApp VoIP...")

	call, err := meo.Call(ctx, target)
	if err != nil {
		return nil, fmt.Errorf("erro ao originar chamada para %s: %w", target, err)
	}

	callID := uuid.New().String()
	snap := &CallSnapshot{
		CallID:       callID,
		Direction:    "OUTBOUND",
		RemoteNumber: target,
		Status:       "RINGING",
		StartedAt:    time.Now(),
	}

	e.callsMu.Lock()
	e.activeCalls[callID] = snap
	e.callHandles[callID] = call
	e.callsMu.Unlock()

	// Monitora a chamada em background com encerramento limpo
	go func() {
		doneChan := make(chan struct{})
		var onceClose sync.Once
		closeDone := func() {
			onceClose.Do(func() {
				close(doneChan)
			})
		}

		call.OnReady(func() {
			snap.Status = "CONNECTED"
			log.Info().Str("call_id", callID).Msg("📞 Chamada conectada — mídia fluindo! Iniciando escuta conversacional e fala do Pedro...")
			// Conecta o sink conversacional contínuo para ouvir o cliente
			sink := e.registerConversationalSink(callID, call)
			call.Receive(sink)
			e.updateDiagCallStart(callID, target, "OUTBOUND")
			// Dispara a saudação do Pedro na chamada de saída
			go e.playInitialGreeting(callID, call, "OUTBOUND")
		})

		call.OnEnd(func(reason string) {
			snap.Status = "ENDED"
			closeDone()
			e.closeCallAudio(callID)
			go e.notifyGatewayWebhook("CALL_ENDED", callID, "")
			log.Info().Str("call_id", callID).Str("reason", reason).Msg("Chamada discada encerrada")
			time.AfterFunc(5*time.Second, func() {
				e.callsMu.Lock()
				delete(e.activeCalls, callID)
				delete(e.callHandles, callID)
				e.callsMu.Unlock()
			})
		})

		// Timeout máximo de segurança
		select {
		case <-doneChan:
			return
		case <-time.After(time.Duration(e.cfg.CallMaxDurationSeconds) * time.Second):
			if snap.Status == "RINGING" || snap.Status == "CONNECTED" {
				snap.Status = "ENDED"
				log.Warn().Str("call_id", callID).Msg("Chamada encerrada por timeout máximo")
				_ = call.Hangup()
			}
		}
	}()

	return snap, nil
}

// playInitialGreeting estabiliza o RTP e notifica o Gateway para sintetizar a saudação oficial com Google Chirp 3 HD
func (e *Engine) playInitialGreeting(callID string, call *meowcaller.Call, direction string) {
	// Aguarda 400ms para estabilização dos pacotes RTP do WhatsApp VoIP
	time.Sleep(400 * time.Millisecond)

	e.callsMu.RLock()
	snapshot := e.activeCalls[callID]
	active := snapshot != nil && snapshot.Status != "ENDED"
	e.callsMu.RUnlock()
	if !active {
		return
	}

	// Notifica o Helena Gateway via Webhook assíncrono para sintetizar e tocar abertura oficial (Google Chirp 3 HD)
	log.Info().Str("call_id", callID).Str("direction", direction).Msg("📞 Notificando Helena Gateway para tocar saudação com Google Cloud Chirp 3 HD...")
	e.recordDiagEvent("Notificando Gateway para sintetizar e tocar abertura oficial (Google Chirp 3 HD)")
	go e.notifyGatewayWebhook("CALL_ANSWERED", callID, direction)
}

// notifyGatewayWebhook envia evento de ligação atendida para o Helena Gateway
func (e *Engine) notifyGatewayWebhook(event, callID, direction string) {
	e.callsMu.RLock()
	remote := ""
	if snapshot := e.activeCalls[callID]; snapshot != nil {
		remote = snapshot.RemoteNumber
	}
	e.callsMu.RUnlock()
	if jid, err := types.ParseJID(remote); err == nil && jid.Server != "" {
		if jid.Server == types.HiddenUserServer {
			e.mu.RLock()
			wa := e.wa
			e.mu.RUnlock()
			if wa != nil && wa.Store != nil {
				ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
				pn, lookupErr := wa.Store.LIDs.GetPNForLID(ctx, jid)
				cancel()
				if lookupErr == nil {
					jid = pn
				}
			}
		}
		remote = "" // A LID is never a telephone number.
		if jid.Server == types.DefaultUserServer {
			remote = jid.User
		}
	}
	gatewayURL := "https://helena-automation-helena-gateway.d9v63q.easypanel.host/api/integrations/voice-agent/webhook"
	if event == "CALL_ENDED" {
		gatewayURL = strings.TrimSuffix(gatewayURL, "/webhook") + "/ended"
	}
	payload, err := json.Marshal(map[string]interface{}{
		"event":                   event,
		"call_id":                 callID,
		"direction":               direction,
		"remote_number":           remote,
		"greeting_already_played": false,
		"timestamp":               time.Now().UTC().Format(time.RFC3339),
	})
	if err != nil {
		return
	}

	client := &http.Client{Timeout: 5 * time.Second}
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
		log.Warn().Err(err).Msg("Não foi possível enviar webhook para Helena Gateway (não impeditivo)")
		return
	}
	_ = resp.Body.Close()
	log.Info().Str("event", event).Str("call_id", callID).Int("status", resp.StatusCode).Msg("Webhook de chamada enviado ao Helena Gateway")
}

// notifyUserSilence aciona o Gateway quando o usuário permanece em silêncio prolongado
func (e *Engine) notifyUserSilence(callID string) {
	e.recordDiagEvent("Silêncio do cliente detectado: solicitando verificação ao Gateway")
	gatewayURL := "https://helena-automation-helena-gateway.d9v63q.easypanel.host/api/integrations/voice-agent/user-silence"
	payload, err := json.Marshal(map[string]interface{}{
		"call_id":   callID,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
	if err != nil {
		return
	}

	client := &http.Client{Timeout: 5 * time.Second}
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
		log.Warn().Err(err).Msg("Falha ao notificar silêncio do usuário ao Helena Gateway")
		return
	}
	_ = resp.Body.Close()
	log.Info().Str("call_id", callID).Int("status", resp.StatusCode).Msg("Notificação de silêncio enviada com sucesso ao Helena Gateway")
}

// PlayAudioFile reproduz um arquivo local de áudio na chamada
func (e *Engine) PlayAudioFile(callID, filePath string) error {
	e.callsMu.RLock()
	call, ok := e.callHandles[callID]
	e.callsMu.RUnlock()
	if !ok || call == nil {
		return fmt.Errorf("chamada %s não encontrada ou já encerrada", callID)
	}

	ext := strings.ToLower(filepath.Ext(filePath))
	if ext == ".mp3" {
		src, err := meowcaller.MP3File(filePath)
		if err != nil {
			return fmt.Errorf("erro ao carregar MP3: %w", err)
		}
		player := call.Play(src)
		e.setActivePlayer(callID, player)
		return nil
	}

	src, err := meowcaller.WAVFile(filePath)
	if err != nil {
		return fmt.Errorf("erro ao carregar WAV: %w", err)
	}
	player := call.Play(src)
	e.setActivePlayer(callID, player)
	return nil
}

// PlayAudioBytes salva bytes em arquivo temporário e reproduz na chamada
func (e *Engine) PlayAudioBytes(callID string, data []byte, format string) error {
	if format == "" {
		format = "mp3"
	}
	ext := "." + strings.TrimPrefix(format, ".")
	tmp, err := os.CreateTemp("", "voice-call-*"+ext)
	if err != nil {
		return fmt.Errorf("erro ao criar arquivo temporário de áudio: %w", err)
	}
	tmpName := tmp.Name()

	// O arquivo só deve ser removido após a reprodução assíncrona terminar (10 minutos de segurança)
	time.AfterFunc(10*time.Minute, func() {
		_ = os.Remove(tmpName)
	})

	if _, err := tmp.Write(data); err != nil {
		_ = tmp.Close()
		_ = os.Remove(tmpName)
		return fmt.Errorf("erro ao gravar áudio temporário: %w", err)
	}
	_ = tmp.Close()

	return e.PlayAudioFile(callID, tmpName)
}

// PlayAudioURL faz download do áudio e reproduz na chamada
func (e *Engine) PlayAudioURL(callID, audioURL string) error {
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Get(audioURL)
	if err != nil {
		return fmt.Errorf("erro ao baixar áudio da URL %s: %w", audioURL, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("falha ao baixar áudio (HTTP %d)", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("erro ao ler stream de áudio: %w", err)
	}

	format := "mp3"
	if strings.Contains(strings.ToLower(audioURL), ".wav") {
		format = "wav"
	}
	return e.PlayAudioBytes(callID, body, format)
}

// HangupCall encerra explicitamente a chamada
func (e *Engine) HangupCall(callID string) error {
	e.callsMu.RLock()
	call, ok := e.callHandles[callID]
	e.callsMu.RUnlock()
	if !ok || call == nil {
		return nil // Já encerrada
	}
	call.Hangup()
	return nil
}

// ListActiveCalls retorna lista de chamadas ativas
func (e *Engine) ListActiveCalls() []CallSnapshot {
	e.callsMu.RLock()
	defer e.callsMu.RUnlock()
	calls := make([]CallSnapshot, 0, len(e.activeCalls))
	for _, c := range e.activeCalls {
		if c.Status != "ENDED" {
			calls = append(calls, *c)
		}
	}
	return calls
}

// Shutdown encerra o engine graciosamente
func (e *Engine) Shutdown() {
	e.mu.Lock()
	e.stopped = true
	cancel := e.cancelCtx
	wa := e.wa
	e.mu.Unlock()

	if wa != nil {
		wa.Disconnect()
	}
	if cancel != nil {
		cancel()
	}
	log.Info().Msg("Engine de voz WhatsApp encerrado.")
}

// ======================================================================
// MOTOR CONVERSACIONAL DE VOZ (VAD, BARGE-IN & DESPACHO DE ÁUDIO WAV)
// ======================================================================

// ConversationalSink consome o áudio decodificado do WhatsApp VoIP (16 kHz mono float32, 60ms por frame).
// Implementa Voice Activity Detection (VAD) de alta sensibilidade adaptativa, interrupção natural instantânea (barge-in),
// buffer circular de pré-fala (para não perder o início da palavra), telemetria ativa e despacho de áudio WAV.
type ConversationalSink struct {
	callID               string
	engine               *Engine
	mu                   sync.Mutex
	isSpeaking           bool
	speechSamples        []int16
	preSpeechRing        [][]int16 // Buffer circular de pré-fala (últimos 6 frames = 360ms)
	silenceFrames        int
	totalFrames          int
	speechEpoch          uint64
	liveStream           *liveSpeechStream
	consecutiveSpeech    int // Frames consecutivos de voz para validar início de fala
	noiseFloor           float64
	rmsThreshold         float64
	silenceThreshold     int  // Base endpoint for longer utterances; brief phrases allow a thinking pause.
	minSpeechSamples     int  // Mínimo de 200ms de fala (3200 amostras a 16kHz)
	initialSilenceFrames int  // Contador de frames em silêncio antes da primeira fala
	nudgeSent            bool // Flag para cutucada cortês enviada uma única vez
	closed               bool
}

func (e *Engine) registerConversationalSink(callID string, call *meowcaller.Call) *ConversationalSink {
	e.callsMu.Lock()
	defer e.callsMu.Unlock()
	if existing, ok := e.callSinks[callID]; ok && existing != nil && !existing.closed {
		return existing
	}
	sink := &ConversationalSink{
		callID:           callID,
		engine:           e,
		noiseFloor:       0.00008,
		rmsThreshold:     0.003, // Separate quiet room noise from conversational speech.
		silenceThreshold: 12,    // 12 frames * 60ms = ~720ms de silêncio pós-fala (pausa conversacional humana natural)
		minSpeechSamples: 2400,  // Mínimo de 150ms de fala sustentada (rejeita cliques e respirações curtas)
		speechSamples:    make([]int16, 0, 16000*5),
		preSpeechRing:    make([][]int16, 0, 6),
	}
	e.callSinks[callID] = sink
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
	s.totalFrames++

	// 1. Converte frame float32 para PCM int16
	pcmFrame := make([]int16, len(frame))
	var sum float64
	for i, sample := range frame {
		sum += float64(sample * sample)
		v := sample * 32768.0
		if v > 32767 {
			v = 32767
		} else if v < -32768 {
			v = -32768
		}
		pcmFrame[i] = int16(v)
	}

	// 2. Calcula energia RMS do frame de 60ms (960 amostras a 16kHz)
	rms := math.Sqrt(sum / float64(len(frame)))

	activePlayer := s.engine.isPlayerActive(s.callID)
	// Do not train the noise floor on the assistant playback.
	// Atualiza piso de ruído adaptativo quando não está falando
	if s.noiseFloor == 0 {
		s.noiseFloor = rms
	} else if !s.isSpeaking && !activePlayer && rms < math.Max(s.rmsThreshold, s.noiseFloor*2.5) {
		s.noiseFloor = s.noiseFloor*0.95 + rms*0.05
	}

	// Learn only quiet frames; speech must not raise the ambient noise estimate.
	effectiveThreshold := math.Max(s.rmsThreshold, s.noiseFloor*2.5)
	if effectiveThreshold > 0.02 {
		effectiveThreshold = 0.02 // Bound adaptation while keeping background noise below speech.
	}

	requiredFrames := 2
	if activePlayer {
		effectiveThreshold *= 2
		requiredFrames = 3
	}

	// Registra telemetria contínua
	s.engine.updateDiagAudio(s.callID, s.totalFrames, len(frame), rms, s.noiseFloor, effectiveThreshold)

	// Evento de diagnóstico imediato no primeiro frame para auditoria em tempo real
	if s.totalFrames == 1 {
		s.engine.recordDiagEvent(fmt.Sprintf("Primeiro frame RTP recebido pelo ConversationalSink (rms=%.6f)", rms))
		log.Info().Str("call_id", s.callID).Float64("rms", rms).Msg("📥 Primeiro frame RTP recebido pelo ConversationalSink!")
	} else if s.totalFrames == 10 {
		s.engine.recordDiagEvent(fmt.Sprintf("Fluxo RTP estabelecido (10 frames recebidos, rms=%.6f)", rms))
	}

	// Telemetria periódica a cada 50 frames (~3 segundos) para monitorar áudio recebido
	if s.totalFrames%50 == 0 {
		log.Info().
			Str("call_id", s.callID).
			Int("total_frames", s.totalFrames).
			Float64("current_rms", rms).
			Float64("noise_floor", s.noiseFloor).
			Float64("threshold", effectiveThreshold).
			Bool("is_speaking", s.isSpeaking).
			Msg("📡 Telemetria de áudio WhatsApp VoIP (frames recebidos e processados)")
	}

	// 3. Classificação de voz
	if rms >= effectiveThreshold {
		s.consecutiveSpeech++
		s.initialSilenceFrames = 0 // Reseta silêncio inicial já que detectou voz

		// Require sustained speech before interrupting playback (3 x 60ms).
		if activePlayer && s.consecutiveSpeech >= requiredFrames {
			s.engine.stopActivePlayer(s.callID)
		}

		// Confirma início da fala com 2 frames consecutivos (>120ms) de energia
		if !s.isSpeaking && s.consecutiveSpeech >= requiredFrames {
			s.speechEpoch = s.engine.advanceSpeechEpoch(s.callID)
			s.isSpeaking = true
			s.silenceFrames = 0
			log.Info().
				Str("call_id", s.callID).
				Float64("rms", rms).
				Float64("threshold", effectiveThreshold).
				Int("frame", s.totalFrames).
				Msg("🎙️ Voz do cliente detectada no WhatsApp VoIP (cortando playback e gravando pergunta)!")
			s.engine.recordDiagEvent(fmt.Sprintf("Voz detectada: rms=%.4f (limiar=%.4f)", rms, effectiveThreshold))

			// Incorpora o buffer de pré-fala para preservar a primeira sílaba ("Oi", "Qual", "Pedro")
			for _, preFrame := range s.preSpeechRing {
				s.speechSamples = append(s.speechSamples, preFrame...)
			}
			s.liveStream = s.engine.startLiveSpeech(s.callID, s.speechEpoch)
			for _, preFrame := range s.preSpeechRing {
				s.liveStream.push(preFrame)
			}
			s.preSpeechRing = s.preSpeechRing[:0]
		}

		// Preserve candidate frames too, including the first syllable during confirmation.
		if !s.isSpeaking {
			if len(s.preSpeechRing) >= 6 {
				s.preSpeechRing = s.preSpeechRing[1:]
			}
			s.preSpeechRing = append(s.preSpeechRing, pcmFrame)
		}

		if s.isSpeaking {
			s.speechSamples = append(s.speechSamples, pcmFrame...)
			s.liveStream.push(pcmFrame)
			s.silenceFrames = 0

			// Guardrail de duração máxima: 12 segundos contínuos de fala para despachar sem travar
			if len(s.speechSamples) >= 16000*12 {
				samplesToDispatch := s.speechSamples
				callID := s.callID
				epoch := s.speechEpoch
				stream := s.liveStream
				s.liveStream = nil
				s.speechSamples = make([]int16, 0, 16000*5)
				s.isSpeaking = false
				s.silenceFrames = 0
				s.consecutiveSpeech = 0
				s.mu.Unlock()

				log.Info().Str("call_id", callID).Msg("🗣️ Turno de fala atingiu limite máximo (12s). Despachando áudio...")
				go s.engine.dispatchLiveOrBatch(stream, callID, samplesToDispatch, epoch)
				return nil
			}
		}
	} else {
		s.consecutiveSpeech = 0

		if s.isSpeaking {
			s.silenceFrames++
			// Mantém as amostras do silêncio para preservar a cauda natural das palavras
			s.speechSamples = append(s.speechSamples, pcmFrame...)
			s.liveStream.push(pcmFrame)

			// Short clauses often continue after a one-second thinking pause.
			// Keep the faster endpoint for longer utterances.
			endpointFrames := s.silenceThreshold
			spokenSamples := len(s.speechSamples) - s.silenceFrames*len(pcmFrame)
			if spokenSamples < 16000*4 && endpointFrames < 20 {
				endpointFrames = 20 // 1.2 seconds, only for short clauses.
			}
			if s.silenceFrames >= endpointFrames {
				samplesToDispatch := s.speechSamples
				callID := s.callID
				epoch := s.speechEpoch
				stream := s.liveStream
				s.liveStream = nil
				s.speechSamples = make([]int16, 0, 16000*5)
				s.isSpeaking = false
				s.silenceFrames = 0
				s.consecutiveSpeech = 0

				s.mu.Unlock()

				if len(samplesToDispatch) >= s.minSpeechSamples {
					durationMs := len(samplesToDispatch) * 1000 / 16000
					log.Info().
						Str("call_id", callID).
						Int("samples", len(samplesToDispatch)).
						Int("duration_ms", durationMs).
						Msg("🗣️ Turno de fala do cliente finalizado. Gerando WAV e enviando para Helena Gateway...")
					go s.engine.dispatchLiveOrBatch(stream, callID, samplesToDispatch, epoch)
				} else {
					stream.stop()
				}
				return nil
			}
		} else {
			// Não está falando: mantém os últimos 6 frames no buffer circular de pré-fala (360ms)
			if len(s.preSpeechRing) >= 6 {
				s.preSpeechRing = s.preSpeechRing[1:]
			}
			s.preSpeechRing = append(s.preSpeechRing, pcmFrame)

			// Detecção de Silêncio do Cliente pós-saudação
			// Enquanto o Pedro estiver falando (tocando saudação ou resposta), reseta o silêncio do cliente
			if s.engine.isPlayerActive(s.callID) {
				s.initialSilenceFrames = 0
			} else if !s.nudgeSent {
				// Pedro já terminou de falar: conta silêncio real do cliente
				s.initialSilenceFrames++
				// ~130 frames * 60ms = ~7.8 segundos de silêncio contínuo após a fala do Pedro
				if s.initialSilenceFrames >= 130 {
					s.nudgeSent = true
					callID := s.callID
					log.Info().Str("call_id", callID).Msg("⏳ Silêncio do cliente detectado (>7s após término da fala). Notificando Gateway para cutucada cortês...")
					go s.engine.notifyUserSilence(callID)
				}
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
	s.liveStream.stop()
	s.liveStream = nil
	s.speechSamples = nil
	return nil
}

func (e *Engine) isPlayerActive(callID string) bool {
	e.callsMu.RLock()
	defer e.callsMu.RUnlock()
	if player, ok := e.callPlayers[callID]; ok && player != nil {
		return player.State() == meowcaller.PlayerPlaying
	}
	return false
}

func (e *Engine) stopActivePlayer(callID string) {
	e.callsMu.Lock()
	player, ok := e.callPlayers[callID]
	delete(e.callPlayers, callID)
	e.callsMu.Unlock()

	if ok && player != nil && player.State() == meowcaller.PlayerPlaying {
		log.Info().Str("call_id", callID).Msg("🛑 Interrompendo fala do Pedro imediatamente (barge-in do cliente)!")
		player.Stop()
		e.recordDiagEvent("Barge-in: fala do atendente interrompida pelo usuário")
	}
}

func (e *Engine) setActivePlayer(callID string, player *meowcaller.Player) {
	e.callsMu.Lock()
	// Se já havia um player tocando, encerra antes de iniciar novo
	if old, exists := e.callPlayers[callID]; exists && old != nil && old.State() == meowcaller.PlayerPlaying {
		old.Stop()
	}
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
func (e *Engine) notifyUserSpeech(callID string, wavBytes []byte, epoch uint64) {
	e.updateDiagDispatch(len(wavBytes))
	e.recordDiagEvent(fmt.Sprintf("Turno finalizado: despachando WAV (%d bytes)", len(wavBytes)))

	gatewayURL := "https://helena-automation-helena-gateway.d9v63q.easypanel.host/api/integrations/voice-agent/user-speech"
	b64 := base64.StdEncoding.EncodeToString(wavBytes)
	payload, err := json.Marshal(map[string]interface{}{
		"call_id":      callID,
		"audio_base64": b64,
		"format":       "wav",
		"sample_rate":  16000,
		"speech_epoch": epoch,
		"timestamp":    time.Now().UTC().Format(time.RFC3339),
	})
	if err != nil {
		log.Error().Err(err).Msg("Erro ao serializar payload de voz do cliente")
		e.updateDiagGatewayResponse(500, err.Error())
		return
	}

	log.Info().
		Str("call_id", callID).
		Int("wav_bytes", len(wavBytes)).
		Int("b64_len", len(b64)).
		Msg("📤 Despachando áudio do cliente para o Helena Gateway...")

	client := &http.Client{Timeout: 45 * time.Second}
	req, err := http.NewRequest("POST", gatewayURL, bytes.NewBuffer(payload))
	if err != nil {
		log.Error().Err(err).Msg("Erro ao criar requisição HTTP para o Helena Gateway")
		e.updateDiagGatewayResponse(500, err.Error())
		return
	}
	req.Header.Set("Content-Type", "application/json")
	if e.cfg.InternalAPIKey != "" {
		req.Header.Set("X-API-Key", e.cfg.InternalAPIKey)
	}

	resp, err := client.Do(req)
	if err != nil {
		log.Error().Err(err).Str("call_id", callID).Msg("Erro ao enviar fala do usuário para Helena Gateway")
		e.updateDiagGatewayResponse(500, err.Error())
		return
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	e.updateDiagGatewayResponse(resp.StatusCode, string(respBody))
	log.Info().
		Str("call_id", callID).
		Int("status", resp.StatusCode).
		Str("response", string(respBody)).
		Msg("📥 Resposta do Helena Gateway para a fala do cliente!")
}

func (e *Engine) closeCallAudio(callID string) {
	e.callsMu.Lock()
	sink, player, source := e.callSinks[callID], e.callPlayers[callID], e.callStreams[callID]
	delete(e.callSinks, callID)
	delete(e.callPlayers, callID)
	delete(e.callStreams, callID)
	delete(e.callSpeechEpochs, callID)
	delete(e.callHandles, callID)
	e.callsMu.Unlock()
	if source != nil {
		_ = source.Close()
	}
	if player != nil {
		player.Stop()
	}
	if sink != nil {
		_ = sink.Close()
	}
}

// Observe the peer microphone state without changing call signaling or media.
func (e *Engine) observeRemoteMute(callID string, call *meowcaller.Call) {
	call.OnMuteState(func(muted bool) {
		e.diagMu.Lock()
		if e.diag.LastCallID == callID {
			value := muted
			e.diag.RemoteMuted = &value
			e.recordDiagEventLocked(fmt.Sprintf("Microfone remoto: muted=%t", muted))
		}
		e.diagMu.Unlock()
	})
}
