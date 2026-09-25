package calls

import (
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/tvmensal2025/financeiromaxnutrition/services/meowcaller-service/internal/events"
)

var (
	ErrCallNotFound    = errors.New("chamada não encontrada")
	ErrCallAlreadyEnded = errors.New("chamada já finalizada")
)

type CallManager struct {
	mu             sync.RWMutex
	calls          map[string]*CallSession
	eventBus       *events.EventBus
	maxDurationSec int
}

func NewCallManager(maxDurationSec int, bus *events.EventBus) *CallManager {
	if maxDurationSec <= 0 {
		maxDurationSec = 300
	}
	mgr := &CallManager{
		calls:          make(map[string]*CallSession),
		eventBus:       bus,
		maxDurationSec: maxDurationSec,
	}

	// Rotina em background para limpeza periódica de sessões finalizadas
	go mgr.reaperRoutine()

	return mgr
}

func (m *CallManager) RegisterCall(businessID, agentID, callerJID string, direction CallDirection) *CallSession {
	m.mu.Lock()
	defer m.mu.Unlock()

	callID := "call-" + uuid.New().String()
	session := NewCallSession(callID, businessID, agentID, callerJID, direction, m.maxDurationSec, m.eventBus)

	// Timer de timeout rígido para evitar chamada zumbi presa na memória
	session.timeoutTimer = time.AfterFunc(time.Duration(m.maxDurationSec)*time.Second, func() {
		session.Hangup("MAX_DURATION_EXCEEDED")
	})

	m.calls[callID] = session
	return session
}

func (m *CallManager) GetCall(callID string) (*CallSession, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	session, exists := m.calls[callID]
	if !exists {
		return nil, ErrCallNotFound
	}
	return session, nil
}

func (m *CallManager) ListActiveCalls() []CallSession {
	m.mu.RLock()
	defer m.mu.RUnlock()

	active := make([]CallSession, 0)
	for _, call := range m.calls {
		snap := call.GetSnapshot()
		if snap.Status != StatusEnded && snap.Status != StatusFailed && snap.Status != StatusRejected {
			active = append(active, snap)
		}
	}
	return active
}

func (m *CallManager) HangupCall(callID, reason string) error {
	call, err := m.GetCall(callID)
	if err != nil {
		return err
	}
	call.Hangup(reason)
	return nil
}

func (m *CallManager) AnswerCall(callID string) error {
	call, err := m.GetCall(callID)
	if err != nil {
		return err
	}
	call.Answer()
	return nil
}

func (m *CallManager) RejectCall(callID, reason string) error {
	call, err := m.GetCall(callID)
	if err != nil {
		return err
	}
	call.Reject(reason)
	return nil
}

// reaperRoutine remove periodicamente chamadas encerradas há mais de 10 minutos
func (m *CallManager) reaperRoutine() {
	ticker := time.NewTicker(2 * time.Minute)
	for range ticker.C {
		m.mu.Lock()
		cutoff := time.Now().Add(-10 * time.Minute)
		for id, call := range m.calls {
			snap := call.GetSnapshot()
			if (snap.Status == StatusEnded || snap.Status == StatusFailed || snap.Status == StatusRejected) &&
				snap.EndedAt != nil && snap.EndedAt.Before(cutoff) {
				delete(m.calls, id)
			}
		}
		m.mu.Unlock()
	}
}
