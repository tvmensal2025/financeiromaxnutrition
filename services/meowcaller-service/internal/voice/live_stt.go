package voice

import (
	"context"
	"encoding/binary"
	"io"
	"net/http"
	"os"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"github.com/rs/zerolog/log"
)

// Audio is queued away from the RTP callback so a slow network never blocks ReadFrame.
type liveSpeechStream struct {
	frames chan []byte
	result chan bool
	cancel context.CancelFunc
	once   sync.Once
	failed atomic.Bool
}

func (e *Engine) startLiveSpeech(callID string, epoch uint64) *liveSpeechStream {
	if os.Getenv("CALL_STT_STREAMING_ENABLED") == "false" {
		return nil
	}
	if e.cfg == nil || e.cfg.InternalAPIKey == "" {
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	stream := &liveSpeechStream{frames: make(chan []byte, 256), result: make(chan bool, 1), cancel: cancel}
	reader, writer := io.Pipe()
	go func() {
		defer writer.Close()
		for frame := range stream.frames {
			if _, err := writer.Write(frame); err != nil {
				stream.failed.Store(true)
				return
			}
		}
	}()
	go func() {
		defer cancel()
		url := "https://helena-automation-helena-gateway.d9v63q.easypanel.host/api/integrations/voice-agent/user-speech-stream"
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, reader)
		if err != nil {
			stream.result <- false
			return
		}
		req.Header.Set("Content-Type", "audio/pcm")
		req.Header.Set("X-Call-ID", callID)
		req.Header.Set("X-Speech-Epoch", strconv.FormatUint(epoch, 10))
		if e.cfg.InternalAPIKey != "" {
			req.Header.Set("X-API-Key", e.cfg.InternalAPIKey)
		}
		resp, err := (&http.Client{Timeout: 45 * time.Second}).Do(req)
		if err != nil {
			log.Warn().Err(err).Str("call_id", callID).Msg("STT ao vivo indisponível; turno usará recuperação em WAV")
			stream.result <- false
			return
		}
		defer resp.Body.Close()
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 4096))
		stream.result <- resp.StatusCode == http.StatusOK && !stream.failed.Load()
	}()
	return stream
}

func (s *liveSpeechStream) push(samples []int16) {
	if s == nil || s.failed.Load() {
		return
	}
	pcm := make([]byte, len(samples)*2)
	for i, sample := range samples {
		binary.LittleEndian.PutUint16(pcm[i*2:], uint16(sample))
	}
	select {
	case s.frames <- pcm:
	default:
		s.failed.Store(true)
		s.cancel()
	}
}

func (s *liveSpeechStream) finish() {
	if s != nil {
		s.once.Do(func() { close(s.frames) })
	}
}

func (s *liveSpeechStream) stop() {
	if s != nil {
		s.cancel()
		s.finish()
	}
}

func (e *Engine) dispatchLiveOrBatch(stream *liveSpeechStream, callID string, samples []int16, epoch uint64) {
	if stream == nil {
		e.notifyUserSpeech(callID, encodePCMToWAV(samples, 16000), epoch)
		return
	}
	stream.finish()
	if !<-stream.result {
		e.notifyUserSpeech(callID, encodePCMToWAV(samples, 16000), epoch)
	}
}
