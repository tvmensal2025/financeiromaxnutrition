package session

import (
	"os"
	"path/filepath"
	"sync"

	"github.com/rs/zerolog/log"
)

type SessionStatus string

const (
	StatusDisconnected   SessionStatus = "DISCONNECTED"
	StatusPairingRequired SessionStatus = "PAIRING_REQUIRED"
	StatusConnected      SessionStatus = "CONNECTED"
)

type WhatsAppSessionManager struct {
	mu          sync.RWMutex
	sessionPath string
	status      SessionStatus
	connectedJID string
	qrCodeText  string
}

func NewWhatsAppSessionManager(sessionPath string) *WhatsAppSessionManager {
	if sessionPath == "" {
		sessionPath = "/data/whatsapp.db"
	}

	dir := filepath.Dir(sessionPath)
	if err := os.MkdirAll(dir, 0700); err != nil {
		log.Warn().Err(err).Str("dir", dir).Msg("Não foi possível criar diretório de sessão segura")
	}

	return &WhatsAppSessionManager{
		sessionPath: sessionPath,
		status:      StatusDisconnected,
	}
}

func (s *WhatsAppSessionManager) GetStatus() (SessionStatus, string, string) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.status, s.connectedJID, s.qrCodeText
}

func (s *WhatsAppSessionManager) SetConnected(jid string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.status = StatusConnected
	s.connectedJID = jid
	s.qrCodeText = ""
	log.Info().Str("jid", jid).Msg("Sessão WhatsApp conectada com sucesso")
}

func (s *WhatsAppSessionManager) SetPairingRequired(qrCode string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.status = StatusPairingRequired
	s.qrCodeText = qrCode
	log.Info().Msg("Pareamento de WhatsApp necessário. QR Code disponível internamente.")
}

func (s *WhatsAppSessionManager) SetDisconnected() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.status = StatusDisconnected
	s.qrCodeText = ""
	log.Warn().Msg("Sessão WhatsApp desconectada")
}
