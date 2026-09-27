package voice

import (
	"context"
	"encoding/binary"
	"io"
	"testing"
	"time"
)

func TestPCMFramesPreserveSamplesAndPadOnlyLastFrame(t *testing.T) {
	s := newPCMStreamSource()
	pcm := make([]byte, 4)
	binary.LittleEndian.PutUint16(pcm, 16384)
	binary.LittleEndian.PutUint16(pcm[2:], 49152)
	if err := s.push(context.Background(), pcm); err != nil {
		t.Fatal(err)
	}
	close(s.frames)
	frame, err := s.ReadFrame()
	if err != nil || len(frame) != 960 || frame[0] != 0.5 || frame[1] != -0.5 || frame[2] != 0 {
		t.Fatal("invalid PCM conversion")
	}
	if s.firstFrameAt.Load() == 0 {
		t.Fatal("first frame was not measured")
	}
	if _, err = s.ReadFrame(); err != io.EOF || !s.finished.Load() {
		t.Fatal("missing clean EOF")
	}
}

func TestPCMUnderrunDoesNotBlockRTP(t *testing.T) {
	s := newPCMStreamSource()
	done := make(chan struct{})
	go func() { defer close(done); _, _ = s.ReadFrame() }()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("RTP blocked waiting for network")
	}
	if s.underruns.Load() != 1 {
		t.Fatal("underrun was not recorded")
	}
}

func TestPCMBackpressureAndBargeInDiscardPendingFrames(t *testing.T) {
	s := newPCMStreamSource()
	for i := 0; i < cap(s.frames); i++ {
		if err := s.push(context.Background(), make([]byte, 1920)); err != nil {
			t.Fatal(err)
		}
	}
	done := make(chan error, 1)
	go func() { done <- s.push(context.Background(), make([]byte, 1920)) }()
	_ = s.Close()
	select {
	case err := <-done:
		if err != ErrStreamInterrupted {
			t.Fatal(err)
		}
	case <-time.After(time.Second):
		t.Fatal("producer did not cancel")
	}
	if _, err := s.ReadFrame(); err != io.EOF {
		t.Fatal("queued audio leaked after interruption")
	}
}

func TestNewSpeechInvalidatesPendingStream(t *testing.T) {
	s := newPCMStreamSource()
	e := &Engine{callStreams: map[string]*pcmStreamSource{"call": s}}
	if epoch := e.advanceSpeechEpoch("call"); epoch != 1 {
		t.Fatal("invalid epoch")
	}
	select {
	case <-s.done:
	default:
		t.Fatal("pending stream survived new speech")
	}
}

func TestPCMRejectsPartialSample(t *testing.T) {
	if err := newPCMStreamSource().push(context.Background(), []byte{1}); err == nil {
		t.Fatal("accepted half a PCM sample")
	}
}
