// Package api expõe os endpoints REST do Meowcaller Service.
// Todos os endpoints /v1/* exigem autenticação via X-API-Key ou Authorization: Bearer.
package api

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/rs/zerolog/log"
	"github.com/tvmensal2025/financeiromaxnutrition/services/meowcaller-service/internal/config"
	"github.com/tvmensal2025/financeiromaxnutrition/services/meowcaller-service/internal/voice"
)

// Server agrupa as dependências do servidor HTTP
type Server struct {
	cfg    *config.Config
	engine *voice.Engine
}

// NewServer cria o servidor com o engine de voz
func NewServer(cfg *config.Config, engine *voice.Engine) *Server {
	return &Server{cfg: cfg, engine: engine}
}

// Routes define as rotas HTTP do servidor
func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()

	// Rotas públicas (sem autenticação)
	mux.HandleFunc("GET /", s.handleRoot)
	mux.HandleFunc("GET /health", s.handleHealth)

	// Rotas autenticadas — Sessão WhatsApp
	mux.HandleFunc("GET /v1/session", s.auth(s.handleGetSession))
	mux.HandleFunc("POST /v1/session/start", s.auth(s.handleStartSession))
	mux.HandleFunc("POST /v1/session/pair-phone", s.auth(s.handlePairPhone))
	mux.HandleFunc("DELETE /v1/session", s.auth(s.handleDisconnectSession))

	// Rotas autenticadas — Chamadas (compatibilidade plena)
	mux.HandleFunc("GET /v1/calls", s.auth(s.handleListCalls))
	mux.HandleFunc("GET /v1/calls/diagnostics", s.auth(s.handleDiagnostics))
	mux.HandleFunc("GET /v1/diagnostics", s.auth(s.handleDiagnostics))
	mux.HandleFunc("POST /v1/calls", s.auth(s.handleOriginateCall))
	mux.HandleFunc("POST /v1/calls/originate", s.auth(s.handleOriginateCall))
	mux.HandleFunc("POST /v1/calls/{id}/play/stream", s.auth(s.handleStreamCallAudio))
	mux.HandleFunc("POST /v1/calls/{id}/play", s.auth(s.handlePlayCallAudio))
	mux.HandleFunc("POST /v1/calls/{id}/answer", s.auth(s.handleAnswerCall))
	mux.HandleFunc("POST /v1/calls/{id}/hangup", s.auth(s.handleHangupCall))
	mux.HandleFunc("DELETE /v1/calls/{id}", s.auth(s.handleHangupCall))

	// Diagnóstico profundo do meowcaller (lê JSONL interno do stack VoIP)
	mux.HandleFunc("GET /v1/diag/meowcaller", s.auth(s.handleMeowcallerDiag))

	return mux
}

// ──────────────────────────────────────────
// Middleware de autenticação
// ──────────────────────────────────────────

func (s *Server) auth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if s.cfg.InternalAPIKey == "" {
			next(w, r)
			return
		}
		key := r.Header.Get("X-API-Key")
		if key == "" {
			key = strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		}
		if strings.Contains(key, ",") {
			parts := strings.Split(key, ",")
			key = strings.TrimSpace(parts[0])
		}
		if key != s.cfg.InternalAPIKey {
			s.fail(w, "Não autorizado. Chave de API inválida.", http.StatusUnauthorized)
			return
		}
		next(w, r)
	}
}

// ──────────────────────────────────────────
// Handlers Públicos
// ──────────────────────────────────────────

func (s *Server) handleRoot(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	s.ok(w, map[string]interface{}{
		"service":     "meowcaller-service",
		"status":      "online",
		"version":     "2.0.0",
		"description": "Helena Meowcaller Service — WhatsApp Voice Transport (Engine Real)",
		"endpoints": map[string]string{
			"health":    "/health",
			"session":   "/v1/session",
			"originate": "/v1/calls/originate",
			"calls":     "/v1/calls",
		},
	}, http.StatusOK)
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	status, jid, qr := s.engine.GetStatus()
	activeCalls := s.engine.ListActiveCalls()
	s.ok(w, map[string]interface{}{
		"status":          "healthy",
		"service":         "meowcaller-service",
		"version":         "2.0.0",
		"voice_revision":  "20261003-noise-r1",
		"whatsapp_status": string(status),
		"connected_jid":   jid,
		"has_qr_code":     qr != "",
		"active_calls":    len(activeCalls),
		"pcm_streaming":   true,
		"stream_protocol": 1,
	}, http.StatusOK)
}

// ──────────────────────────────────────────
// Handlers de Sessão WhatsApp
// ──────────────────────────────────────────

func (s *Server) handleGetSession(w http.ResponseWriter, r *http.Request) {
	status, jid, qr := s.engine.GetStatus()
	s.ok(w, map[string]interface{}{
		"status":          string(status),
		"connected_jid":   jid,
		"has_qr_code":     qr != "",
		"qrcode":          qr,
		"whatsapp_status": string(status),
	}, http.StatusOK)
}

func (s *Server) handleStartSession(w http.ResponseWriter, r *http.Request) {
	status, jid, qr := s.engine.GetStatus()

	if status == voice.StatusConnected {
		s.ok(w, map[string]interface{}{
			"ok":              true,
			"status":          string(status),
			"whatsapp_status": string(status),
			"connected_jid":   jid,
			"message":         "Sessão WhatsApp já está conectada e pronta para chamadas.",
		}, http.StatusOK)
		return
	}

	// Se já temos um QR code ativo e válido, retorna imediatamente sem reiniciar conexão
	if qr != "" {
		s.ok(w, map[string]interface{}{
			"ok":              true,
			"status":          string(status),
			"whatsapp_status": string(status),
			"qrcode":          qr,
			"message":         "QR Code ativo disponível! Escaneie nos próximos 20 segundos.",
		}, http.StatusOK)
		return
	}

	// Força reinício limpo (limpa qualquer sessão antiga e inicia ciclo de QR fresco)
	_ = s.engine.ResetSession(r.Context())
	for i := 0; i < 50; i++ {
		time.Sleep(100 * time.Millisecond)
		st, _, newQr := s.engine.GetStatus()
		if newQr != "" {
			qr = newQr
			status = st
			break
		}
	}

	s.ok(w, map[string]interface{}{
		"ok":              true,
		"status":          string(status),
		"whatsapp_status": string(status),
		"qrcode":          qr,
		"message":         "QR Code renovado com sucesso! Escaneie nos próximos 20 segundos.",
	}, http.StatusOK)
}

func (s *Server) handlePairPhone(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Phone string `json:"phone"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		s.err(w, "JSON inválido", http.StatusBadRequest)
		return
	}
	if body.Phone == "" {
		s.err(w, "phone é obrigatório", http.StatusBadRequest)
		return
	}

	// Aguarda até 3 segundos se o cliente estiver conectando o socket
	for i := 0; i < 15; i++ {
		st, _, _ := s.engine.GetStatus()
		if st != voice.StatusConnecting {
			break
		}
		time.Sleep(200 * time.Millisecond)
	}

	code, err := s.engine.PairPhone(r.Context(), body.Phone)
	if err != nil {
		s.err(w, fmt.Sprintf("Erro ao gerar pairing code: %v", err), http.StatusBadRequest)
		return
	}

	s.ok(w, map[string]interface{}{
		"ok":           true,
		"pairing_code": code,
		"phone":        body.Phone,
		"message":      "Código gerado! Digite este código de 8 dígitos no WhatsApp do seu celular em Aparelhos Conectados > Conectar com número de telefone.",
	}, http.StatusOK)
}

func (s *Server) handleDisconnectSession(w http.ResponseWriter, r *http.Request) {
	log.Info().Msg("Requisição de desconexão de sessão recebida. Limpando credenciais...")
	_ = s.engine.ResetSession(r.Context())
	s.ok(w, map[string]interface{}{
		"ok":      true,
		"status":  "DISCONNECTED",
		"message": "Sessão de ligações desconectada e credenciais removidas com sucesso.",
	}, http.StatusOK)
}

// ──────────────────────────────────────────
// Handlers de Chamadas
// ──────────────────────────────────────────

func (s *Server) handleListCalls(w http.ResponseWriter, r *http.Request) {
	calls := s.engine.ListActiveCalls()
	s.ok(w, map[string]interface{}{
		"calls": calls,
		"total": len(calls),
	}, http.StatusOK)
}

type OriginateRequest struct {
	TargetJID  string `json:"target_jid"`
	Phone      string `json:"phone"`
	BusinessID string `json:"business_id"`
	AgentID    string `json:"agent_id"`
}

func (s *Server) handleOriginateCall(w http.ResponseWriter, r *http.Request) {
	var req OriginateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.fail(w, "Payload JSON inválido", http.StatusBadRequest)
		return
	}

	// Normaliza o JID destino
	targetJID := req.TargetJID
	if targetJID == "" && req.Phone != "" {
		phone := strings.ReplaceAll(req.Phone, " ", "")
		phone = strings.ReplaceAll(phone, "-", "")
		phone = strings.ReplaceAll(phone, "+", "")
		if !strings.HasSuffix(phone, "@s.whatsapp.net") {
			targetJID = phone + "@s.whatsapp.net"
		} else {
			targetJID = phone
		}
	}

	if targetJID == "" {
		s.fail(w, "É obrigatório fornecer 'target_jid' ou 'phone'", http.StatusBadRequest)
		return
	}

	log.Info().Str("target", targetJID).Msg("Originando chamada VoIP...")

	snap, err := s.engine.OriginateCall(context.Background(), targetJID)
	if err != nil {
		log.Error().Err(err).Str("target", targetJID).Msg("Erro ao originar chamada")
		s.fail(w, err.Error(), http.StatusServiceUnavailable)
		return
	}

	s.ok(w, map[string]interface{}{
		"ok":         true,
		"call_id":    snap.CallID,
		"status":     snap.Status,
		"direction":  snap.Direction,
		"remote":     snap.RemoteNumber,
		"started_at": snap.StartedAt,
		"message":    fmt.Sprintf("Chamada originada para %s. Aguardando o dispositivo atender...", targetJID),
	}, http.StatusCreated)
}

type PlayAudioRequest struct {
	AudioURL    string `json:"audio_url"`
	AudioBase64 string `json:"audio_base64"`
	Format      string `json:"format"`
	FilePath    string `json:"file_path"`
}

func (s *Server) handlePlayCallAudio(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		s.fail(w, "ID da chamada é obrigatório", http.StatusBadRequest)
		return
	}

	var req PlayAudioRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.fail(w, "Payload JSON inválido", http.StatusBadRequest)
		return
	}

	var err error
	if req.AudioURL != "" {
		log.Info().Str("call_id", id).Str("url", req.AudioURL).Msg("Reproduzindo áudio por URL na chamada VoIP")
		err = s.engine.PlayAudioURL(id, req.AudioURL)
	} else if req.AudioBase64 != "" {
		raw, decErr := base64.StdEncoding.DecodeString(req.AudioBase64)
		if decErr != nil {
			s.fail(w, "Áudio base64 inválido", http.StatusBadRequest)
			return
		}
		format := req.Format
		if format == "" {
			format = "mp3"
		}
		log.Info().Str("call_id", id).Str("format", format).Int("bytes", len(raw)).Msg("Reproduzindo áudio base64 na chamada VoIP")
		err = s.engine.PlayAudioBytes(id, raw, format)
	} else if req.FilePath != "" {
		log.Info().Str("call_id", id).Str("path", req.FilePath).Msg("Reproduzindo arquivo local na chamada VoIP")
		err = s.engine.PlayAudioFile(id, req.FilePath)
	} else {
		s.fail(w, "Requisição de reprodução sem áudio: forneça audio_base64, audio_url ou file_path", http.StatusBadRequest)
		return
	}

	if err != nil {
		log.Error().Err(err).Str("call_id", id).Msg("Erro ao reproduzir áudio na chamada")
		s.fail(w, fmt.Sprintf("Erro ao reproduzir áudio: %v", err), http.StatusInternalServerError)
		return
	}

	s.ok(w, map[string]interface{}{
		"ok":      true,
		"call_id": id,
		"message": "Áudio transmitido com sucesso na chamada VoIP.",
	}, http.StatusOK)
}

func (s *Server) handleAnswerCall(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	log.Info().Str("call_id", id).Msg("Chamada atendida explicitamente via API")
	s.ok(w, map[string]interface{}{
		"ok":      true,
		"call_id": id,
		"status":  "CONNECTED",
		"message": "Chamada atendida com sucesso.",
	}, http.StatusOK)
}

func (s *Server) handleHangupCall(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	_ = s.engine.HangupCall(id)
	log.Info().Str("call_id", id).Msg("Chamada encerrada sob requisição")
	s.ok(w, map[string]interface{}{
		"ok":      true,
		"call_id": id,
		"status":  "ENDED",
		"message": "Chamada encerrada com sucesso.",
	}, http.StatusOK)
}

func (s *Server) handleDiagnostics(w http.ResponseWriter, r *http.Request) {
	diag := s.engine.GetDiagnostics()
	s.ok(w, map[string]interface{}{
		"ok":   true,
		"diag": diag,
	}, http.StatusOK)
}

// ──────────────────────────────────────────
// Helpers de resposta JSON
// ──────────────────────────────────────────

func (s *Server) ok(w http.ResponseWriter, data interface{}, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(data)
}

func (s *Server) fail(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

func (s *Server) err(w http.ResponseWriter, msg string, code int) {
	s.fail(w, msg, code)
}

// handleMeowcallerDiag lê os arquivos JSONL de diagnóstico interno do meowcaller
// e retorna as últimas linhas de cada stream (srtp, rtp, relay, media_in, meta, etc.)
func (s *Server) handleMeowcallerDiag(w http.ResponseWriter, r *http.Request) {
	diagDir := filepath.Join(os.TempDir(), "meowcaller-diag")
	result := map[string]interface{}{
		"diag_dir": diagDir,
		"streams":  map[string]interface{}{},
	}

	entries, err := os.ReadDir(diagDir)
	if err != nil {
		result["error"] = fmt.Sprintf("Diretório de diagnóstico não acessível: %v", err)
		s.ok(w, result, http.StatusOK)
		return
	}

	streams := result["streams"].(map[string]interface{})
	maxLines := 50 // últimas 50 linhas por stream

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".jsonl") {
			continue
		}
		streamName := strings.TrimSuffix(entry.Name(), ".jsonl")
		fpath := filepath.Join(diagDir, entry.Name())

		data, readErr := os.ReadFile(fpath)
		if readErr != nil {
			streams[streamName] = map[string]interface{}{
				"error": readErr.Error(),
			}
			continue
		}

		lines := strings.Split(strings.TrimSpace(string(data)), "\n")
		totalLines := len(lines)

		// Pega apenas as últimas N linhas
		start := 0
		if totalLines > maxLines {
			start = totalLines - maxLines
		}
		tail := lines[start:]

		// Parse cada linha como JSON
		var events []interface{}
		for _, line := range tail {
			line = strings.TrimSpace(line)
			if line == "" {
				continue
			}
			var obj interface{}
			if jsonErr := json.Unmarshal([]byte(line), &obj); jsonErr == nil {
				events = append(events, obj)
			} else {
				events = append(events, line)
			}
		}

		info, _ := entry.Info()
		streams[streamName] = map[string]interface{}{
			"total_lines": totalLines,
			"shown":       len(events),
			"file_bytes":  info.Size(),
			"events":      events,
		}
	}

	result["stream_count"] = len(streams)
	s.ok(w, result, http.StatusOK)
}
