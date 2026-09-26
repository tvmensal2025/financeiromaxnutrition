package events

import (
	"sync"
	"time"
)

type EventType string

const (
	CallIncoming EventType = "CALL_INCOMING"
	CallRinging  EventType = "CALL_RINGING"
	CallAccepted EventType = "CALL_ACCEPTED"
	CallReady    EventType = "CALL_READY"
	CallEnded    EventType = "CALL_ENDED"
	CallFailed   EventType = "CALL_FAILED"
)

type CallEvent struct {
	EventID   string                 `json:"event_id"`
	CallID    string                 `json:"call_id"`
	Type      EventType              `json:"type"`
	Timestamp int64                  `json:"timestamp"`
	Payload   map[string]interface{} `json:"payload,omitempty"`
}

type EventBus struct {
	mu          sync.RWMutex
	subscribers []chan CallEvent
}

func NewEventBus() *EventBus {
	return &EventBus{
		subscribers: make([]chan CallEvent, 0),
	}
}

func (b *EventBus) Subscribe() chan CallEvent {
	b.mu.Lock()
	defer b.mu.Unlock()
	ch := make(chan CallEvent, 50)
	b.subscribers = append(b.subscribers, ch)
	return ch
}

func (b *EventBus) Unsubscribe(ch chan CallEvent) {
	b.mu.Lock()
	defer b.mu.Unlock()
	for i, sub := range b.subscribers {
		if sub == ch {
			b.subscribers = append(b.subscribers[:i], b.subscribers[i+1:]...)
			close(ch)
			break
		}
	}
}

func (b *EventBus) Publish(callID string, eventType EventType, payload map[string]interface{}) {
	b.mu.RLock()
	defer b.mu.RUnlock()

	ev := CallEvent{
		EventID:   time.Now().Format("20060102150405.000000"),
		CallID:    callID,
		Type:      eventType,
		Timestamp: time.Now().UnixMilli(),
		Payload:   payload,
	}

	for _, ch := range b.subscribers {
		select {
		case ch <- ev:
		default:
			// Não bloqueia caso o subscriber esteja ocupado
		}
	}
}
