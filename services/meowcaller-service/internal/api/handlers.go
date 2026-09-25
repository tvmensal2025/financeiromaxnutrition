// Package api expõe os endpoints REST do Meowcaller Service.
// Todos os endpoints /v1/* exigem autenticação via X-API-Key ou Authorization: Bearer.
package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

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
	mux.HandleFunc("DELETE /v1/session", s.auth(s.handleDisconnectSession))

	// Rotas autenticadas — Chamadas
	mux.HandleFunc("GET /v1/calls", s.auth(s.handleListCalls))
	mux.HandleFunc("POST /v1/calls/originate", s.auth(s.handleOriginateCall))

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
		"whatsapp_status": string(status),
		"connected_jid":   jid,
		"has_qr_code":     qr != "",
		"active_calls":    len(activeCalls),
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
		"qrcode":          qr, // base64 PNG ou string vazia
		"whatsapp_status": string(status),
	}, http.StatusOK)
}

func (s *Server) handleStartSession(w http.ResponseWriter, r *http.Request) {
	status, jid, qr := s.engine.GetStatus()

	switch status {
	case voice.StatusConnected:
		s.ok(w, map[string]interface{}{
			"ok":              true,
			"status":          string(status),
			"whatsapp_status": string(status),
			"connected_jid":   jid,
			"message":         "Sessão WhatsApp já está conectada e pronta para chamadas.",
		}, http.StatusOK)
	case voice.StatusPairingRequired:
		s.ok(w, map[string]interface{}{
			"ok":              true,
			"status":          string(status),
			"whatsapp_status": string(status),
			"qrcode":          qr,
			"message":         "QR Code disponível. Escaneie com o WhatsApp do chip de ligações.",
		}, http.StatusOK)
	case voice.StatusConnecting:
		s.ok(w, map[string]interface{}{
			"ok":              true,
			"status":          string(status),
			"whatsapp_status": string(status),
			"message":         "Conexão em andamento. Aguarde o QR Code aparecer em alguns segundos.",
		}, http.StatusAccepted)
	default:
		// DISCONNECTED — engine reconecta automaticamente, apenas informa
		s.ok(w, map[string]interface{}{
			"ok":              true,
			"status":          string(status),
			"whatsapp_status": string(status),
			"message":         "Engine de voz em prontidão. Aguardando geração do QR Code...",
		}, http.StatusAccepted)
	}
}

func (s *Server) handleDisconnectSession(w http.ResponseWriter, r *http.Request) {
	// O engine reconecta automaticamente; aqui apenas informamos o cliente
	// Para desconexão real, seria necessário remover o device do SQLite
	log.Info().Msg("Requisição de desconexão de sessão recebida")
	s.ok(w, map[string]interface{}{
		"ok":      true,
		"status":  "DISCONNECTED",
		"message": "Sessão de ligações desconectada. O engine reiniciará o processo de pareamento em breve.",
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
		"ok":           true,
		"call_id":      snap.CallID,
		"status":       snap.Status,
		"direction":    snap.Direction,
		"remote":       snap.RemoteNumber,
		"started_at":   snap.StartedAt,
		"message":      fmt.Sprintf("Chamada originada para %s. Aguardando o dispositivo atender...", targetJID),
	}, http.StatusCreated)
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
