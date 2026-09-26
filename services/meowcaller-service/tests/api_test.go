package tests

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/tvmensal2025/financeiromaxnutrition/services/meowcaller-service/internal/api"
	"github.com/tvmensal2025/financeiromaxnutrition/services/meowcaller-service/internal/calls"
	"github.com/tvmensal2025/financeiromaxnutrition/services/meowcaller-service/internal/config"
	"github.com/tvmensal2025/financeiromaxnutrition/services/meowcaller-service/internal/events"
	"github.com/tvmensal2025/financeiromaxnutrition/services/meowcaller-service/internal/session"
)

func setupTestServer() http.Handler {
	cfg := &config.Config{
		Port:                   "8002",
		InternalAPIKey:         "secret-test-key",
		CallMaxDurationSeconds: 60,
	}
	bus := events.NewEventBus()
	callMgr := calls.NewCallManager(60, bus)
	sessMgr := session.NewWhatsAppSessionManager("/tmp/test_wa.db")

	server := api.NewServer(cfg, callMgr, sessMgr, bus)
	return server.Routes()
}

func TestHealthEndpoint(t *testing.T) {
	router := setupTestServer()

	req := httptest.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Esperado status 200, obtido %d", w.Code)
	}

	var data map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &data); err != nil {
		t.Fatalf("Erro ao decodificar JSON: %v", err)
	}
	if data["service"] != "meowcaller-service" {
		t.Fatalf("Esperado service meowcaller-service, obtido %v", data["service"])
	}
}

func TestCallsAPIAuthAndCreation(t *testing.T) {
	router := setupTestServer()

	// Tentativa sem autenticação deve retornar 401
	body := bytes.NewBufferString(`{"business_id":"BIZ-003","agent_id":"AGT-15","target_jid":"5511999991111@s.whatsapp.net"}`)
	req := httptest.NewRequest("POST", "/v1/calls", body)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("Esperado 401 Unauthorized sem API key, obtido %d", w.Code)
	}

	// Com autenticação válida
	body = bytes.NewBufferString(`{"business_id":"BIZ-003","agent_id":"AGT-15","target_jid":"5511999991111@s.whatsapp.net"}`)
	req = httptest.NewRequest("POST", "/v1/calls", body)
	req.Header.Set("X-API-Key", "secret-test-key")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("Esperado 201 Created, obtido %d: %s", w.Code, w.Body.String())
	}

	var callData map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &callData); err != nil {
		t.Fatalf("Erro ao decodificar JSON: %v", err)
	}
	callID, ok := callData["call_id"].(string)
	if !ok || callID == "" {
		t.Fatal("call_id ausente na resposta")
	}

	// Consulta a chamada criada
	getReq := httptest.NewRequest("GET", "/v1/calls/"+callID, nil)
	getReq.Header.Set("X-API-Key", "secret-test-key")
	getW := httptest.NewRecorder()
	router.ServeHTTP(getW, getReq)

	if getW.Code != http.StatusOK {
		t.Fatalf("Esperado 200 OK ao buscar chamada, obtido %d", getW.Code)
	}
}
