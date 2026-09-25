package tests

import (
	"testing"

	"github.com/tvmensal2025/financeiromaxnutrition/services/meowcaller-service/internal/audio"
)

func TestAudioBufferAndBargeIn(t *testing.T) {
	buf := audio.NewAudioBuffer(1024)

	payload := []byte{1, 2, 3, 4, 5, 6, 7, 8}
	n := buf.Write(payload)
	if n != 8 {
		t.Fatalf("Esperado 8 bytes escritos, obtido %d", n)
	}

	if buf.Len() != 8 {
		t.Fatalf("Esperado tamanho 8, obtido %d", buf.Len())
	}

	// Simula interrupção / barge-in
	buf.Clear()
	if buf.Len() != 0 {
		t.Fatalf("Buffer deveria estar vazio após Clear(), tamanho atual %d", buf.Len())
	}
}

func TestFloat32PCM16Conversion(t *testing.T) {
	samples := []float32{0.0, 0.5, -0.5, 1.0, -1.0}
	pcmBytes := audio.Float32ToPCM16(samples)

	if len(pcmBytes) != len(samples)*2 {
		t.Fatalf("Esperado %d bytes, obtido %d", len(samples)*2, len(pcmBytes))
	}

	convertedBack := audio.PCM16ToFloat32(pcmBytes)
	if len(convertedBack) != len(samples) {
		t.Fatalf("Esperado %d samples reconvertidos, obtido %d", len(samples), len(convertedBack))
	}

	rms := audio.CalculateRMS(samples)
	if rms <= 0 {
		t.Fatalf("RMS deveria ser positivo, obtido %f", rms)
	}
}
