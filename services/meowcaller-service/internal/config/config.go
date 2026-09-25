package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port                                string
	InternalAPIKey                      string
	VoicePlatformURL                    string
	VoicePlatformAPIKey                 string
	WhatsAppSessionPath                 string
	LogLevel                            string
	CallMaxDurationSeconds              int
	EnableAutoAnswerControlledNumbers   bool
}

func LoadConfig() *Config {
	port := getEnv("PORT", "8002")
	apiKey := getEnv("INTERNAL_API_KEY", "")
	voiceURL := getEnv("VOICE_PLATFORM_URL", "ws://voice-platform:8000/v1/voice/stream")
	voiceKey := getEnv("VOICE_PLATFORM_API_KEY", "")
	sessionPath := getEnv("WHATSAPP_SESSION_PATH", "/data/whatsapp.db")
	logLevel := getEnv("LOG_LEVEL", "info")
	
	maxDurationStr := getEnv("CALL_MAX_DURATION_SECONDS", "300")
	maxDuration, err := strconv.Atoi(maxDurationStr)
	if err != nil || maxDuration <= 0 {
		maxDuration = 300
	}

	autoAnswerStr := getEnv("ENABLE_AUTO_ANSWER_CONTROLLED_NUMBERS", "false")
	autoAnswer := autoAnswerStr == "true" || autoAnswerStr == "1"

	return &Config{
		Port:                              port,
		InternalAPIKey:                    apiKey,
		VoicePlatformURL:                  voiceURL,
		VoicePlatformAPIKey:               voiceKey,
		WhatsAppSessionPath:               sessionPath,
		LogLevel:                          logLevel,
		CallMaxDurationSeconds:            maxDuration,
		EnableAutoAnswerControlledNumbers: autoAnswer,
	}
}

func getEnv(key, defaultVal string) string {
	val := os.Getenv(key)
	if val == "" {
		return defaultVal
	}
	return val
}
