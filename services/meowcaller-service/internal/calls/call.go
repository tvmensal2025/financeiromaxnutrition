package calls

import (
	"sync"
	"time"

	"github.com/tvmensal2025/financeiromaxnutrition/services/meowcaller-service/internal/audio"
	"github.com/tvmensal2025/financeiromaxnutrition/services/meowcaller-service/internal/events"
)

type CallDirection string
type CallStatus string

const (
	DirectionInbound  CallDirection = "INBOUND"
	DirectionOutbound CallDirection = "OUTBOUND"

	StatusRinging  CallStatus = "RINGING"
	StatusAccepted CallStatus = "ACCEPTED"
	StatusActive   CallStatus = "ACTIVE"
	StatusEnded    CallStatus = "ENDED"
	StatusFailed   CallStatus = "FAILED"
	StatusRejected CallStatus = "REJECTED"
)

type CallSession struct {
	mu              sync.RWMutex
	CallID          string                 `json:"call_id"`
	BusinessID      string                 `json:"business_id"`
	AgentID         string                 `json:"agent_id"`
	CallerJID       string                 `json:"caller_jid"`
	Direction       CallDirection          `json:"direction"`
	Status          CallStatus             `json:"status"`
	StartedAt       time.Time              `json:"started_at"`
	EndedAt         *time.Time             `json:"ended_at,omitempty"`
	DurationSeconds int                    `json:"duration_seconds"`
	RxBuffer        *audio.AudioBuffer     `json:"-"`
	TxBuffer        *audio.AudioBuffer     `json:"-"`
	Stats           *audio.AudioStreamStats `json:"stats"`
	Metadata        map[string]interface{} `json:"metadata,omitempty"`
	timeoutTimer    *time.Timer            `json:"-"`
	eventBus        *events.EventBus       `json:"-"`
}

func NewCallSession(callID, businessID, agentID, callerJID string, direction CallDirection, maxDurationSec int, bus *events.EventBus) *CallSession {
	session := &CallSession{
		CallID:          callID,
		BusinessID:      businessID,
		AgentID:         agentID,
		CallerJID:       callerJID,
		Direction:       direction,
		Status:          StatusRinging,
		StartedAt:       time.Now(),
		DurationSeconds: 0,
		RxBuffer:        audio.NewAudioBuffer(64000), // 2s buffer @ 16kHz
		TxBuffer:        audio.NewAudioBuffer(64000),
		Stats:           audio.NewAudioStreamStats(16000, 1, "mlow"),
		Metadata:        make(map[string]interface{}),
		eventBus:        bus,
	}

	if bus != nil {
		bus.Publish(callID, events.CallIncoming, map[string]interface{}{
			"business_id": businessID,
			"caller_jid":  callerJID,
			"direction":   direction,
		})
	}

	return session
}

func (c *CallSession) Answer() {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.Status != StatusRinging {
		return
	}

	c.Status = StatusAccepted
	if c.eventBus != nil {
		c.eventBus.Publish(c.CallID, events.CallAccepted, map[string]interface{}{
			"business_id": c.BusinessID,
			"agent_id":    c.AgentID,
		})
	}
}

func (c *CallSession) SetReady() {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.Status == StatusAccepted || c.Status == StatusRinging {
		c.Status = StatusActive
		if c.eventBus != nil {
			c.eventBus.Publish(c.CallID, events.CallReady, map[string]interface{}{
				"sample_rate": c.Stats.SampleRate,
				"codec":       c.Stats.Codec,
			})
		}
	}
}

func (c *CallSession) Reject(reason string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.Status == StatusEnded || c.Status == StatusFailed || c.Status == StatusRejected {
		return
	}

	c.Status = StatusRejected
	now := time.Now()
	c.EndedAt = &now
	c.DurationSeconds = int(now.Sub(c.StartedAt).Seconds())

	if c.timeoutTimer != nil {
		c.timeoutTimer.Stop()
	}

	if c.eventBus != nil {
		c.eventBus.Publish(c.CallID, events.CallEnded, map[string]interface{}{
			"reason": reason,
		})
	}
}

func (c *CallSession) Hangup(reason string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.Status == StatusEnded || c.Status == StatusFailed {
		return
	}

	c.Status = StatusEnded
	now := time.Now()
	c.EndedAt = &now
	c.DurationSeconds = int(now.Sub(c.StartedAt).Seconds())

	// Limpa buffers de áudio
	c.RxBuffer.Clear()
	c.TxBuffer.Clear()

	if c.timeoutTimer != nil {
		c.timeoutTimer.Stop()
	}

	if c.eventBus != nil {
		c.eventBus.Publish(c.CallID, events.CallEnded, map[string]interface{}{
			"reason":           reason,
			"duration_seconds": c.DurationSeconds,
		})
	}
}

func (c *CallSession) GetSnapshot() CallSession {
	c.mu.RLock()
	defer c.mu.RUnlock()

	var ended *time.Time
	if c.EndedAt != nil {
		t := *c.EndedAt
		ended = &t
	}

	metaCopy := make(map[string]interface{})
	for k, v := range c.Metadata {
		metaCopy[k] = v
	}

	return CallSession{
		CallID:          c.CallID,
		BusinessID:      c.BusinessID,
		AgentID:         c.AgentID,
		CallerJID:       c.CallerJID,
		Direction:       c.Direction,
		Status:          c.Status,
		StartedAt:       c.StartedAt,
		EndedAt:         ended,
		DurationSeconds: c.DurationSeconds,
		Stats:           &audio.AudioStreamStats{
			RxBytes:    c.Stats.RxBytes,
			TxBytes:    c.Stats.TxBytes,
			RxPackets:  c.Stats.RxPackets,
			TxPackets:  c.Stats.TxPackets,
			SampleRate: c.Stats.SampleRate,
			Channels:   c.Stats.Channels,
			Codec:      c.Stats.Codec,
			LastRxAt:   c.Stats.LastRxAt,
			LastTxAt:   c.Stats.LastTxAt,
		},
		Metadata: metaCopy,
	}
}
