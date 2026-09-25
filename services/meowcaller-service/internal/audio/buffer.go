package audio

import (
	"encoding/binary"
	"math"
	"sync"
)

// AudioBuffer gerencia frames de áudio PCM em memória de forma segura para concorrência.
type AudioBuffer struct {
	mu     sync.RWMutex
	data   []byte
	maxCap int
}

func NewAudioBuffer(maxBytes int) *AudioBuffer {
	if maxBytes <= 0 {
		maxBytes = 64000 // ~2 segundos @ 16kHz 16-bit mono
	}
	return &AudioBuffer{
		data:   make([]byte, 0, maxBytes),
		maxCap: maxBytes,
	}
}

// Write adiciona bytes PCM ao buffer, descartando os mais antigos se estourar a capacidade.
func (b *AudioBuffer) Write(p []byte) int {
	b.mu.Lock()
	defer b.mu.Unlock()

	n := len(p)
	if n == 0 {
		return 0
	}

	if len(b.data)+n > b.maxCap {
		// Descarta dados antigos para manter baixa latência
		overflow := (len(b.data) + n) - b.maxCap
		if overflow < len(b.data) {
			b.data = b.data[overflow:]
		} else {
			b.data = b.data[:0]
		}
	}

	b.data = append(b.data, p...)
	return n
}

// Read lê até len(p) bytes do buffer, removendo os lidos.
func (b *AudioBuffer) Read(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if len(b.data) == 0 {
		return 0, nil
	}

	n := copy(p, b.data)
	b.data = b.data[n:]
	return n, nil
}

// Clear limpa instantaneamente o buffer (obrigatório para interrupção / barge-in).
func (b *AudioBuffer) Clear() {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.data = b.data[:0]
}

// Len retorna a quantidade de bytes atual no buffer.
func (b *AudioBuffer) Len() int {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return len(b.data)
}

// Float32ToPCM16 converte slice []float32 (-1.0 a 1.0) do Meowcaller para PCM 16-bit S16LE.
func Float32ToPCM16(samples []float32) []byte {
	out := make([]byte, len(samples)*2)
	for i, s := range samples {
		// Clamp entre -1.0 e 1.0
		if s > 1.0 {
			s = 1.0
		} else if s < -1.0 {
			s = -1.0
		}
		val := int16(s * 32767.0)
		binary.LittleEndian.PutUint16(out[i*2:i*2+2], uint16(val))
	}
	return out
}

// PCM16ToFloat32 converte PCM 16-bit S16LE para []float32 (-1.0 a 1.0) para playback no Meowcaller.
func PCM16ToFloat32(data []byte) []float32 {
	numSamples := len(data) / 2
	out := make([]float32, numSamples)
	for i := 0; i < numSamples; i++ {
		val := int16(binary.LittleEndian.Uint16(data[i*2 : i*2+2]))
		out[i] = float32(val) / 32768.0
	}
	return out
}

// CalculateRMS calcula o valor RMS (Root Mean Square) das amostras para detectar energia de voz.
func CalculateRMS(samples []float32) float64 {
	if len(samples) == 0 {
		return 0
	}
	var sum float64
	for _, s := range samples {
		sum += float64(s * s)
	}
	return math.Sqrt(sum / float64(len(samples)))
}
