package voice

import (
	"math"
	"os"
	"strconv"
	"strings"
)

// Calibration is explicit and quantized to incoming 60ms frames. Keep the
// existing 720ms until a real call validates a shorter conversational pause.
func speechEndpointFrames() int {
	ms, err := strconv.Atoi(strings.TrimSpace(os.Getenv("CALL_SPEECH_END_SILENCE_MS")))
	if err != nil || ms < 360 || ms > 1500 {
		return 12
	}
	return (ms + 59) / 60
}

// plausibleSpeechFrame rejects obvious non-speech in 16 kHz mono PCM.
// It deliberately does not claim to distinguish a person from TV/music or
// replace acoustic echo cancellation. Temporal confirmation remains in the sink.
func plausibleSpeechFrame(frame []float32) bool {
	if len(frame) < 2 {
		return false
	}
	var mean float64
	for _, sample := range frame {
		v := float64(sample)
		if math.IsNaN(v) || math.IsInf(v, 0) {
			return false
		}
		mean += v
	}
	mean /= float64(len(frame))
	var energy, peak float64
	crossings := 0
	previous := float64(frame[0]) - mean
	for _, sample := range frame {
		v := float64(sample) - mean
		energy += v * v
		peak = math.Max(peak, math.Abs(v))
		if (v > 0 && previous <= 0) || (v < 0 && previous >= 0) {
			crossings++
		}
		previous = v
	}
	rms := math.Sqrt(energy / float64(len(frame)))
	if rms < 0.0001 {
		return false
	} // DC/empty frames have no acoustic speech energy.
	// Reject isolated impulses and predominantly sub-bass/high-frequency signals.
	// Wide bounds preserve low-pitched voices and unvoiced consonants.
	rate := float64(crossings) / float64(len(frame))
	return peak/rms < 12 && rate >= 0.008 && rate <= 0.65
}
