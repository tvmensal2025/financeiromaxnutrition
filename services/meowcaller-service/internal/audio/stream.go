package audio

import (
	"sync"
	"time"
)

type AudioStreamStats struct {
	mu           sync.RWMutex
	RxBytes      int64     `json:"rx_bytes"`
	TxBytes      int64     `json:"tx_bytes"`
	RxPackets    int64     `json:"rx_packets"`
	TxPackets    int64     `json:"tx_packets"`
	SampleRate   int       `json:"sample_rate"`
	Channels     int       `json:"channels"`
	Codec        string    `json:"codec"`
	LastRxAt     time.Time `json:"last_rx_at"`
	LastTxAt     time.Time `json:"last_tx_at"`
}

func NewAudioStreamStats(sampleRate, channels int, codec string) *AudioStreamStats {
	return &AudioStreamStats{
		SampleRate: sampleRate,
		Channels:   channels,
		Codec:      codec,
	}
}

func (s *AudioStreamStats) RecordRx(bytesCount int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.RxBytes += int64(bytesCount)
	s.RxPackets++
	s.LastRxAt = time.Now()
}

func (s *AudioStreamStats) RecordTx(bytesCount int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.TxBytes += int64(bytesCount)
	s.TxPackets++
	s.LastTxAt = time.Now()
}

func (s *AudioStreamStats) Snapshot() AudioStreamStats {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return AudioStreamStats{
		RxBytes:    s.RxBytes,
		TxBytes:    s.TxBytes,
		RxPackets:  s.RxPackets,
		TxPackets:  s.TxPackets,
		SampleRate: s.SampleRate,
		Channels:   s.Channels,
		Codec:      s.Codec,
		LastRxAt:   s.LastRxAt,
		LastTxAt:   s.LastTxAt,
	}
}
