package bridge

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/rs/zerolog/log"
	"github.com/tvmensal2025/financeiromaxnutrition/services/meowcaller-service/internal/calls"
)

type ControlMessage struct {
	Event            string `json:"event"`
	CallID           string `json:"call_id,omitempty"`
	BusinessID       string `json:"business_id,omitempty"`
	AssignedAgentID  string `json:"assigned_agent_id,omitempty"`
	VoiceProfile     string `json:"voice_profile,omitempty"`
	Action           string `json:"action,omitempty"`
	Reason           string `json:"reason,omitempty"`
	DurationSeconds  int    `json:"duration_seconds,omitempty"`
	TurnCount        int    `json:"turn_count,omitempty"`
}

type VoiceAdapter struct {
	voiceURL string
	apiKey   string
	dialer   websocket.Dialer
	mu       sync.Mutex
}

func NewVoiceAdapter(voiceURL, apiKey string) *VoiceAdapter {
	return &VoiceAdapter{
		voiceURL: voiceURL,
		apiKey:   apiKey,
		dialer: websocket.Dialer{
			HandshakeTimeout: 5 * time.Second,
		},
	}
}

// StreamCall estabelece a ponte bidirecional de streaming entre a chamada Meowcaller e a Voice Platform.
func (a *VoiceAdapter) StreamCall(ctx context.Context, session *calls.CallSession) error {
	log.Info().
		Str("call_id", session.CallID).
		Str("business_id", session.BusinessID).
		Str("agent_id", session.AgentID).
		Msg("Iniciando streaming com Voice Platform")

	header := make(http.Header)
	if a.apiKey != "" {
		header.Set("Authorization", "Bearer "+a.apiKey)
	}
	header.Set("X-Service-Source", "meowcaller-service")
	header.Set("X-Call-ID", session.CallID)
	header.Set("X-Business-ID", session.BusinessID)
	header.Set("X-Agent-ID", session.AgentID)

	conn, _, err := a.dialer.DialContext(ctx, a.voiceURL, header)
	if err != nil {
		log.Warn().
			Err(err).
			Str("voice_url", a.voiceURL).
			Msg("Voice Platform indisponível ou em modo mock. Operando em modo de teste local.")
		return a.runMockStreaming(ctx, session)
	}
	defer conn.Close()

	// Envia handshake de início de sessão
	handshake := ControlMessage{
		Event:           "session_start",
		CallID:          session.CallID,
		BusinessID:      session.BusinessID,
		AssignedAgentID: session.AgentID,
		VoiceProfile:    fmt.Sprintf("%s_ptbr_v1", session.AgentID),
	}
	if err := conn.WriteJSON(handshake); err != nil {
		return err
	}

	session.SetReady()

	errChan := make(chan error, 2)

	// Goroutine 1: RX (Meowcaller -> Voice Platform)
	go func() {
		buf := make([]byte, 640) // 20ms @ 16kHz 16-bit mono = 320 samples = 640 bytes
		for {
			select {
			case <-ctx.Done():
				return
			default:
				n, _ := session.RxBuffer.Read(buf)
				if n > 0 {
					session.Stats.RecordRx(n)
					if err := conn.WriteMessage(websocket.BinaryMessage, buf[:n]); err != nil {
						errChan <- err
						return
					}
				} else {
					time.Sleep(10 * time.Millisecond)
				}
			}
		}
	}()

	// Goroutine 2: TX (Voice Platform -> Meowcaller) e Mensagens de Controle
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			default:
				msgType, data, err := conn.ReadMessage()
				if err != nil {
					errChan <- err
					return
				}

				if msgType == websocket.BinaryMessage {
					// Áudio TTS sintetizado chegando da Voice Platform
					session.TxBuffer.Write(data)
					session.Stats.RecordTx(len(data))
				} else if msgType == websocket.TextMessage {
					var ctrl ControlMessage
					if err := json.Unmarshal(data, &ctrl); err == nil {
						if ctrl.Event == "barge_in_detected" || ctrl.Action == "CLEAR_OUTPUT_BUFFER" {
							log.Info().Str("call_id", session.CallID).Msg("Barge-in recebido da Voice Platform: limpando buffer TX")
							session.TxBuffer.Clear()
						} else if ctrl.Event == "agent_handoff" {
							log.Info().
								Str("call_id", session.CallID).
								Str("new_agent", ctrl.AssignedAgentID).
								Msg("Handoff de agente recebido")
							session.AgentID = ctrl.AssignedAgentID
						}
					}
				}
			}
		}
	}()

	select {
	case <-ctx.Done():
		// Envia encerramento limpo
		_ = conn.WriteJSON(ControlMessage{
			Event:  "session_end",
			CallID: session.CallID,
			Reason: "SESSION_CONTEXT_DONE",
		})
		return nil
	case err := <-errChan:
		return err
	}
}

// runMockStreaming simula a ponte para testes locais sem quebrar quando a Voice Platform externa estiver offline
func (a *VoiceAdapter) runMockStreaming(ctx context.Context, session *calls.CallSession) error {
	session.SetReady()
	ticker := time.NewTicker(50 * time.Millisecond)
	defer ticker.Stop()

	rxBuf := make([]byte, 640)
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			// Drena RX buffer para simular transporte
			n, _ := session.RxBuffer.Read(rxBuf)
			if n > 0 {
				session.Stats.RecordRx(n)
			}
			snap := session.GetSnapshot()
			if snap.Status == calls.StatusEnded || snap.Status == calls.StatusFailed || snap.Status == calls.StatusRejected {
				return nil
			}
		}
	}
}
