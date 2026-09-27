package api

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/tvmensal2025/financeiromaxnutrition/services/meowcaller-service/internal/voice"
)

func (s *Server) handleStreamCallAudio(w http.ResponseWriter, r *http.Request) {
	if !strings.HasPrefix(r.Header.Get("Content-Type"), "audio/pcm") || r.Header.Get("X-Audio-Sample-Rate") != "16000" {
		s.fail(w, "Expected mono PCM s16le at 16000 Hz", http.StatusUnsupportedMediaType)
		return
	}
	epoch, err := strconv.ParseUint(r.Header.Get("X-Speech-Epoch"), 10, 64)
	if err != nil {
		s.fail(w, "Missing or invalid speech epoch", http.StatusBadRequest)
		return
	}
	// Allow a cancellation response before the upstream upload ends.
	responseController := http.NewResponseController(w)
	_ = responseController.EnableFullDuplex()
	_ = responseController.SetReadDeadline(time.Now().Add(40 * time.Second))
	_ = responseController.SetWriteDeadline(time.Now().Add(42 * time.Second))
	defer responseController.SetReadDeadline(time.Time{})
	ctx, cancel := context.WithTimeout(r.Context(), 40*time.Second)
	defer cancel()
	result, err := s.engine.PlayPCMStream(ctx, r.PathValue("id"), epoch, r.Body, func() {
		_ = responseController.SetReadDeadline(time.Now())
	})
	if err != nil {
		status := http.StatusBadGateway
		if errors.Is(err, voice.ErrStreamInterrupted) {
			status = http.StatusConflict
		}
		if errors.Is(err, voice.ErrStreamCallMissing) {
			status = http.StatusNotFound
		}
		if errors.Is(err, context.DeadlineExceeded) {
			status = http.StatusGatewayTimeout
		}
		s.fail(w, err.Error(), status)
		return
	}
	s.ok(w, map[string]interface{}{"ok": true, "streaming": true, "metrics": result}, http.StatusOK)
}
