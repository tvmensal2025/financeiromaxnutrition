package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/tvmensal2025/financeiromaxnutrition/services/meowcaller-service/internal/calls"
	"github.com/tvmensal2025/financeiromaxnutrition/services/meowcaller-service/internal/config"
	"github.com/tvmensal2025/financeiromaxnutrition/services/meowcaller-service/internal/events"
	"github.com/tvmensal2025/financeiromaxnutrition/services/meowcaller-service/internal/session"
)

type Server struct {
	cfg        *config.Config
	callMgr    *calls.CallManager
	sessMgr    *session.WhatsAppSessionManager
	eventBus   *events.EventBus
	httpServer *http.Server
}

func NewServer(cfg *config.Config, callMgr *calls.CallManager, sessMgr *session.WhatsAppSessionManager, bus *events.EventBus) *Server {
	return &Server{
		cfg:      cfg,
		callMgr:  callMgr,
		sessMgr:  sessMgr,
		eventBus: bus,
	}
}

func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()

	// Rotas públicas
	mux.HandleFunc("GET /", s.handleRoot)
	mux.HandleFunc("GET /health", s.handleHealth)

	// Rotas autenticadas da API v1
	mux.HandleFunc("GET /v1/session", s.authMiddleware(s.handleSessionStatus))
	mux.HandleFunc("GET /v1/calls", s.authMiddleware(s.handleListCalls))
	mux.HandleFunc("POST /v1/calls", s.authMiddleware(s.handleCreateCall))
	mux.HandleFunc("GET /v1/calls/{id}", s.authMiddleware(s.handleGetCall))
	mux.HandleFunc("POST /v1/calls/{id}/answer", s.authMiddleware(s.handleAnswerCall))
	mux.HandleFunc("POST /v1/calls/{id}/reject", s.authMiddleware(s.handleRejectCall))
	mux.HandleFunc("POST /v1/calls/{id}/hangup", s.authMiddleware(s.handleHangupCall))
	mux.HandleFunc("GET /v1/events", s.authMiddleware(s.handleSSEEvents))

	return mux
}

func (s *Server) authMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if s.cfg.InternalAPIKey != "" {
			apiKey := r.Header.Get("X-API-Key")
			if apiKey == "" {
				authHeader := r.Header.Get("Authorization")
				apiKey = strings.TrimPrefix(authHeader, "Bearer ")
			}
			if apiKey != s.cfg.InternalAPIKey {
				s.jsonError(w, "Não autorizado. Chave de API inválida.", http.StatusUnauthorized)
				return
			}
		}
		next(w, r)
	}
}

func (s *Server) handleRoot(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	s.jsonResponse(w, map[string]interface{}{
		"service":     "meowcaller-service",
		"status":      "online",
		"version":     "1.0.0",
		"description": "Helena Meowcaller Service — WhatsApp Voice Transport",
		"endpoints": map[string]string{
			"health":  "/health",
			"session": "/v1/session",
			"calls":   "/v1/calls",
			"events":  "/v1/events",
		},
	}, http.StatusOK)
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	status, jid, _ := s.sessMgr.GetStatus()
	activeCalls := len(s.callMgr.ListActiveCalls())

	resp := map[string]interface{}{
		"status":          "healthy",
		"service":         "meowcaller-service",
		"version":         "1.0.0",
		"whatsapp_status": status,
		"connected_jid":   jid,
		"active_calls":    activeCalls,
	}
	s.jsonResponse(w, resp, http.StatusOK)
}

func (s *Server) handleSessionStatus(w http.ResponseWriter, r *http.Request) {
	status, jid, qr := s.sessMgr.GetStatus()
	resp := map[string]interface{}{
		"status":        status,
		"connected_jid": jid,
		"has_qr_code":   qr != "",
	}
	s.jsonResponse(w, resp, http.StatusOK)
}

func (s *Server) handleListCalls(w http.ResponseWriter, r *http.Request) {
	callsList := s.callMgr.ListActiveCalls()
	s.jsonResponse(w, map[string]interface{}{"calls": callsList}, http.StatusOK)
}

type CreateCallRequest struct {
	BusinessID string `json:"business_id"`
	AgentID    string `json:"agent_id"`
	TargetJID  string `json:"target_jid"`
}

func (s *Server) handleCreateCall(w http.ResponseWriter, r *http.Request) {
	var req CreateCallRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.jsonError(w, "Payload JSON inválido", http.StatusBadRequest)
		return
	}

	if req.TargetJID == "" {
		s.jsonError(w, "target_jid é obrigatório", http.StatusBadRequest)
		return
	}
	if req.BusinessID == "" {
		req.BusinessID = "BIZ-003"
	}
	if req.AgentID == "" {
		req.AgentID = "AGT-20"
	}

	call := s.callMgr.RegisterCall(req.BusinessID, req.AgentID, req.TargetJID, calls.DirectionOutbound)
	s.jsonResponse(w, call.GetSnapshot(), http.StatusCreated)
}

func (s *Server) handleGetCall(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	call, err := s.callMgr.GetCall(id)
	if err != nil {
		s.jsonError(w, "Chamada não encontrada", http.StatusNotFound)
		return
	}
	s.jsonResponse(w, call.GetSnapshot(), http.StatusOK)
}

func (s *Server) handleAnswerCall(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := s.callMgr.AnswerCall(id); err != nil {
		s.jsonError(w, err.Error(), http.StatusNotFound)
		return
	}
	s.jsonResponse(w, map[string]string{"status": "accepted", "call_id": id}, http.StatusOK)
}

func (s *Server) handleRejectCall(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := s.callMgr.RejectCall(id, "USER_REJECTED"); err != nil {
		s.jsonError(w, err.Error(), http.StatusNotFound)
		return
	}
	s.jsonResponse(w, map[string]string{"status": "rejected", "call_id": id}, http.StatusOK)
}

func (s *Server) handleHangupCall(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := s.callMgr.HangupCall(id, "LOCAL_HANGUP"); err != nil {
		s.jsonError(w, err.Error(), http.StatusNotFound)
		return
	}
	s.jsonResponse(w, map[string]string{"status": "ended", "call_id": id}, http.StatusOK)
}

func (s *Server) handleSSEEvents(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	ch := s.eventBus.Subscribe()
	defer s.eventBus.Unsubscribe(ch)

	for {
		select {
		case <-r.Context().Done():
			return
		case ev := <-ch:
			data, _ := json.Marshal(ev)
			fmt.Fprintf(w, "data: %s\n\n", data)
			flusher.Flush()
		}
	}
}

func (s *Server) jsonResponse(w http.ResponseWriter, data interface{}, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(data)
}

func (s *Server) jsonError(w http.ResponseWriter, message string, statusCode int) {
	s.jsonResponse(w, map[string]string{"error": message}, statusCode)
}
