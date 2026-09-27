package tests

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/tvmensal2025/financeiromaxnutrition/services/meowcaller-service/internal/api"
	"github.com/tvmensal2025/financeiromaxnutrition/services/meowcaller-service/internal/config"
	"github.com/tvmensal2025/financeiromaxnutrition/services/meowcaller-service/internal/voice"
)

func setupTestServer() http.Handler {
	cfg := &config.Config{
		Port:                   "8002",
		InternalAPIKey:         "secret-test-key",
		CallMaxDurationSeconds: 60,
	}
	// Disconnected engine: do not start WhatsApp connections in unit tests.
	server := api.NewServer(cfg, &voice.Engine{})
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

func TestCallsAPIAuthAndDisconnectedSession(t *testing.T) {
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

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("Expected 503 for a disconnected session, got %d: %s", w.Code, w.Body.String())
	}
	if !bytes.Contains(w.Body.Bytes(), []byte("não conectada")) {
		t.Fatal("Expected an explicit disconnected-session error")
	}
	getReq := httptest.NewRequest("GET", "/v1/calls", nil)
	getReq.Header.Set("X-API-Key", "secret-test-key")
	getW := httptest.NewRecorder()
	router.ServeHTTP(getW, getReq)
	var data struct {
		Total int `json:"total"`
	}
	if err := json.Unmarshal(getW.Body.Bytes(), &data); err != nil {
		t.Fatal(err)
	}
	if getW.Code != http.StatusOK || data.Total != 0 {
		t.Fatal("Failed origination must not create a phantom call")
	}
}
