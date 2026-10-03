package voice

import (
	"math"
	"math/rand"
	"testing"
)

func TestSpeechGateRejectsObviousNoise(t *testing.T) {
	dc := make([]float32, 960)
	hum := make([]float32, 960)
	hiss := make([]float32, 960)
	click := make([]float32, 960)
	for i := range dc {
		dc[i] = 0.03
		hum[i] = float32(0.03 * math.Sin(2*math.Pi*40*float64(i)/16000))
		hiss[i] = float32(0.03 * math.Sin(2*math.Pi*7000*float64(i)/16000))
	}
	click[100] = 1
	invalid := make([]float32, 960)
	invalid[0] = float32(math.NaN())
	for name, frame := range map[string][]float32{"dc": dc, "hum": hum, "hiss": hiss, "click": click, "invalid": invalid, "silence": make([]float32, 960)} {
		t.Run(name, func(t *testing.T) {
			if plausibleSpeechFrame(frame) {
				t.Fatal("obvious noise accepted")
			}
		})
	}
}

func TestSpeechGatePreservesVoicedAndUnvoicedCandidates(t *testing.T) {
	for _, frequency := range []float64{80, 120, 200, 350, 1000, 3000} {
		frame := make([]float32, 960)
		for i := range frame {
			frame[i] = float32(0.01 * math.Sin(2*math.Pi*frequency*float64(i)/16000))
		}
		if !plausibleSpeechFrame(frame) {
			t.Fatalf("candidate rejected: %v Hz", frequency)
		}
	}
	// Broadband consonants cannot be rejected solely for having no pitch.
	rng := rand.New(rand.NewSource(42))
	frame := make([]float32, 960)
	for i := range frame {
		frame[i] = float32(rng.NormFloat64() * 0.01)
	}
	if !plausibleSpeechFrame(frame) {
		t.Fatal("unvoiced candidate rejected")
	}
}

func TestEndpointCalibrationBoundsAndFrameRounding(t *testing.T) {
	for _, row := range []struct {
		value  string
		frames int
	}{
		{"", 12}, {"0", 12}, {"-1", 12}, {"noise", 12}, {"300", 12}, {"1600", 12},
		{"360", 6}, {"420", 7}, {"480", 8}, {"600", 10}, {"720", 12}, {"721", 13}, {" 900 ", 15},
	} {
		t.Setenv("CALL_SPEECH_END_SILENCE_MS", row.value)
		if got := speechEndpointFrames(); got != row.frames {
			t.Fatalf("%q: got %d want %d", row.value, got, row.frames)
		}
	}
}
