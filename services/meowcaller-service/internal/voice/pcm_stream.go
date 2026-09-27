package voice

import (
	"context"
	"encoding/binary"
	"errors"
	"io"
	"sync"
	"sync/atomic"
	"time"
)

var ErrStreamInterrupted = errors.New("speech stream interrupted or superseded")
var ErrStreamCallMissing = errors.New("stream call not found")

// Google streaming PCM: signed little-endian 16-bit, mono, 16000 Hz, no WAV header.
// The bounded queue applies backpressure to HTTP. ReadFrame must never block RTP.
type pcmStreamSource struct {
	frames        chan []float32
	done          chan struct{}
	once          sync.Once
	finished      atomic.Bool
	firstFrameAt  atomic.Int64
	playedFrames  atomic.Int64
	underruns     atomic.Int64
	interruptRead func()
}

func newPCMStreamSource() *pcmStreamSource {
	return &pcmStreamSource{frames: make(chan []float32, 24), done: make(chan struct{})}
}

func (s *pcmStreamSource) push(ctx context.Context, pcm []byte) error {
	if len(pcm)%2 != 0 || len(pcm) > 1920 {
		return errors.New("invalid PCM frame")
	}
	frame := make([]float32, 960)
	for i := 0; i < len(pcm)/2; i++ {
		frame[i] = float32(int16(binary.LittleEndian.Uint16(pcm[2*i:]))) / 32768
	}
	select {
	case <-s.done:
		return ErrStreamInterrupted
	default:
	}
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-s.done:
		return ErrStreamInterrupted
	case s.frames <- frame:
		return nil
	}
}

func (s *pcmStreamSource) ReadFrame() ([]float32, error) {
	select {
	case <-s.done:
		return nil, io.EOF
	default:
	}
	select {
	case frame, ok := <-s.frames:
		if !ok {
			s.finished.Store(true)
			_ = s.Close()
			return nil, io.EOF
		}
		s.firstFrameAt.CompareAndSwap(0, time.Now().UnixMilli())
		s.playedFrames.Add(1)
		return frame, nil
	default:
		s.underruns.Add(1)
		return make([]float32, 960), nil
	}
}

func (s *pcmStreamSource) Close() error {
	s.once.Do(func() {
		if !s.finished.Load() && s.interruptRead != nil {
			s.interruptRead()
		}
		close(s.done)
	})
	return nil
}

// Every confirmed customer utterance invalidates both playing and pending audio.
func (e *Engine) advanceSpeechEpoch(callID string) uint64 {
	e.callsMu.Lock()
	if e.callSpeechEpochs == nil {
		e.callSpeechEpochs = make(map[string]uint64)
	}
	e.callSpeechEpochs[callID]++
	epoch := e.callSpeechEpochs[callID]
	if source := e.callStreams[callID]; source != nil {
		_ = source.Close()
	}
	e.callsMu.Unlock()
	e.stopActivePlayer(callID)
	return epoch
}

type PCMStreamResult struct {
	AudioBytes     int   `json:"audio_bytes"`
	FirstFrameMS   int64 `json:"first_frame_ms"`
	PlayedFrames   int64 `json:"played_frames"`
	UnderrunFrames int64 `json:"underrun_frames"`
}

// Returns only when playback finishes or is interrupted, so the gateway can cancel
// the LLM/TTS even after upload completed. No temporary files or full-audio buffering.
func (e *Engine) PlayPCMStream(ctx context.Context, callID string, epoch uint64, body io.ReadCloser, interruptRead func()) (PCMStreamResult, error) {
	start := time.Now().UnixMilli()
	result := PCMStreamResult{}
	source := newPCMStreamSource()
	source.interruptRead = interruptRead
	e.callsMu.Lock()
	call := e.callHandles[callID]
	if call == nil {
		e.callsMu.Unlock()
		return result, ErrStreamCallMissing
	}
	if e.callSpeechEpochs[callID] != epoch || e.callStreams[callID] != nil {
		e.callsMu.Unlock()
		return result, ErrStreamInterrupted
	}
	if e.callStreams == nil {
		e.callStreams = make(map[string]*pcmStreamSource)
	}
	e.callStreams[callID] = source
	e.callsMu.Unlock()
	defer func() {
		_ = source.Close()
		e.callsMu.Lock()
		if e.callStreams[callID] == source {
			delete(e.callStreams, callID)
		}
		e.callsMu.Unlock()
	}()
	// Unblock network reads on barge-in, disconnect, or deadline.
	stopContext := context.AfterFunc(ctx, func() { _ = source.Close() })
	defer stopContext()
	started := false
	startPlayback := func() error {
		e.callsMu.Lock()
		defer e.callsMu.Unlock()
		select {
		case <-source.done:
			return ErrStreamInterrupted
		default:
		}
		if e.callSpeechEpochs[callID] != epoch || e.callHandles[callID] != call {
			return ErrStreamInterrupted
		}
		if old := e.callPlayers[callID]; old != nil {
			old.Stop()
		}
		player := call.Play(source)
		e.callPlayers[callID] = player
		started = true
		return nil
	}
	for {
		pcm := make([]byte, 1920)
		n, err := io.ReadFull(body, pcm)
		if n > 0 {
			result.AudioBytes += n
			if result.AudioBytes > 16000*2*30 {
				return result, errors.New("PCM stream exceeds 30 seconds")
			}
			if pushErr := source.push(ctx, pcm[:n]); pushErr != nil {
				return result, pushErr
			}
			// 120ms initial cushion against network jitter, then continuous playback.
			if !started && len(source.frames) >= 2 {
				if playErr := startPlayback(); playErr != nil {
					return result, playErr
				}
			}
		}
		if err == io.EOF || err == io.ErrUnexpectedEOF {
			break
		}
		if err != nil {
			select {
			case <-source.done:
				return result, ErrStreamInterrupted
			default:
				return result, err
			}
		}
	}
	if result.AudioBytes == 0 {
		return result, errors.New("empty PCM stream")
	}
	close(source.frames) // Only the upload producer closes the queue.
	if !started {
		if err := startPlayback(); err != nil {
			return result, err
		}
	}
	select {
	case <-ctx.Done():
		return result, ctx.Err()
	case <-source.done:
	}
	result.PlayedFrames = source.playedFrames.Load()
	result.UnderrunFrames = source.underruns.Load()
	if first := source.firstFrameAt.Load(); first > 0 {
		result.FirstFrameMS = first - start
	}
	if !source.finished.Load() {
		return result, ErrStreamInterrupted
	}
	return result, nil
}
