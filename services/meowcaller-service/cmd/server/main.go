package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/tvmensal2025/financeiromaxnutrition/services/meowcaller-service/internal/api"
	"github.com/tvmensal2025/financeiromaxnutrition/services/meowcaller-service/internal/calls"
	"github.com/tvmensal2025/financeiromaxnutrition/services/meowcaller-service/internal/config"
	"github.com/tvmensal2025/financeiromaxnutrition/services/meowcaller-service/internal/events"
	"github.com/tvmensal2025/financeiromaxnutrition/services/meowcaller-service/internal/session"
)

func main() {
	zerolog.TimeFieldFormat = time.RFC3339
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr, TimeFormat: time.RFC3339})

	cfg := config.LoadConfig()
	log.Info().
		Str("port", cfg.Port).
		Str("session_path", cfg.WhatsAppSessionPath).
		Int("max_duration_sec", cfg.CallMaxDurationSeconds).
		Msg("Iniciando Meowcaller Service — WhatsApp Voice Transport")

	bus := events.NewEventBus()
	callMgr := calls.NewCallManager(cfg.CallMaxDurationSeconds, bus)
	sessMgr := session.NewWhatsAppSessionManager(cfg.WhatsAppSessionPath)

	server := api.NewServer(cfg, callMgr, sessMgr, bus)
	httpServer := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      server.Routes(),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Inicia servidor HTTP em goroutine
	go func() {
		log.Info().Str("addr", httpServer.Addr).Msg("Servidor HTTP do Meowcaller escutando")
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("Falha crítica no servidor HTTP")
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info().Msg("Recebido sinal de encerramento. Finalizando Meowcaller com segurança...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Encerra todas as chamadas ativas
	active := callMgr.ListActiveCalls()
	for _, c := range active {
		_ = callMgr.HangupCall(c.CallID, "SERVICE_SHUTDOWN")
	}

	if err := httpServer.Shutdown(ctx); err != nil {
		log.Error().Err(err).Msg("Erro durante encerramento gracioso do servidor")
	}

	log.Info().Msg("Meowcaller Service finalizado com sucesso.")
}
