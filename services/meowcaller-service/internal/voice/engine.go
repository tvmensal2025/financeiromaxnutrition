// Package voice implementa o engine real de WhatsApp VoIP usando
// hypermeow (cliente WhatsApp Web) + meowcaller (stack VoIP).
// Responsabilidades:
//   - Gerenciar sessão WhatsApp (QR Code via channel, pareamento, reconexão contínua)
//   - Controlar o ciclo de vida de chamadas (Originar, Atender, Encerrar)
//   - Expor estado via GetStatus() para a camada HTTP
package voice

import (
	"context"
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/google/uuid"
	waClient "github.com/polymorfa/hypermeow"
	"github.com/polymorfa/hypermeow/proto/waCompanionReg"
	"github.com/polymorfa/hypermeow/store"
	"github.com/polymorfa/hypermeow/store/sqlstore"
	"github.com/polymorfa/hypermeow/types"
	"github.com/polymorfa/hypermeow/types/events"
	waLog "github.com/polymorfa/hypermeow/util/log"
	"github.com/purpshell/meowcaller"
	"github.com/rs/zerolog/log"
	"github.com/skip2/go-qrcode"
	"github.com/tvmensal2025/financeiromaxnutrition/services/meowcaller-service/internal/config"
	"google.golang.org/protobuf/proto"

	_ "modernc.org/sqlite"
)

// SessionStatus representa o estado de conexão WhatsApp
type SessionStatus string

const (
	StatusDisconnected    SessionStatus = "DISCONNECTED"
	StatusConnecting      SessionStatus = "CONNECTING"
	StatusPairingRequired SessionStatus = "PAIRING_REQUIRED"
	StatusConnected       SessionStatus = "CONNECTED"
)

// CallSnapshot representa o estado atual de uma chamada
type CallSnapshot struct {
	CallID       string    `json:"call_id"`
	Direction    string    `json:"direction"`
	RemoteNumber string    `json:"remote_number"`
	Status       string    `json:"status"`
	StartedAt    time.Time `json:"started_at"`
}

// Engine gerencia a sessão WhatsApp e o engine de chamadas VoIP
type Engine struct {
	cfg           *config.Config
	mu            sync.RWMutex
	status        SessionStatus
	jid           string
	qrCodeB64     string // QR Code em base64 PNG com prefixo data:image/png;base64,...
	qrGeneratedAt time.Time
	lastRestart   time.Time
	stopped       bool

	wa        *waClient.Client
	meo       *meowcaller.Client
	cancelCtx context.CancelFunc

	activeCalls map[string]*CallSnapshot
	callsMu     sync.RWMutex
}

// NewEngine inicializa o engine de voz WhatsApp real
func NewEngine(cfg *config.Config) (*Engine, error) {
	e := &Engine{
		cfg:         cfg,
		status:      StatusDisconnected,
		activeCalls: make(map[string]*CallSnapshot),
	}

	// Garante que o diretório de sessão existe
	dir := filepath.Dir(cfg.WhatsAppSessionPath)
	if err := os.MkdirAll(dir, 0700); err != nil {
		log.Warn().Err(err).Str("dir", dir).Msg("Não foi possível criar diretório de sessão")
	}

	// Inicia o loop de conexão em background
	go e.connectLoop()

	return e, nil
}

// connectLoop tenta conectar/reconectar continuamente mantendo o WhatsApp online e QR Code ativo
func (e *Engine) connectLoop() {
	for {
		e.mu.RLock()
		isStopped := e.stopped
		e.mu.RUnlock()
		if isStopped {
			log.Info().Msg("Loop de conexão WhatsApp encerrado (serviço parado).")
			return
		}

		ctx, cancel := context.WithCancel(context.Background())
		e.mu.Lock()
		e.cancelCtx = cancel
		e.mu.Unlock()

		err := e.runSession(ctx)
		cancel()

		e.mu.RLock()
		isStopped = e.stopped
		e.mu.RUnlock()
		if isStopped {
			return
		}

		if err != nil {
			log.Warn().Err(err).Msg("Ciclo de sessão WhatsApp finalizado. Reiniciando ciclo em 2s para manter QR Code fresco...")
		}
		time.Sleep(2 * time.Second)
	}
}

// runSession cria e gerencia uma sessão WhatsApp completa
func (e *Engine) runSession(ctx context.Context) error {
	e.setStatus(StatusConnecting, "", "")

	// Configura o device como Mac OS / Chrome
	store.DeviceProps.Os = proto.String("Mac OS")
	store.DeviceProps.PlatformType = waCompanionReg.DeviceProps_CHROME.Enum()

	// Abre o store SQLite (persiste sessão entre reinicializações)
	dbPath := "file:" + e.cfg.WhatsAppSessionPath + "?_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)"
	container, err := sqlstore.New(ctx, "sqlite", dbPath, waLog.Zerolog(log.Logger).Sub("wa-db"))
	if err != nil {
		return fmt.Errorf("erro ao abrir SQLite de sessão WhatsApp: %w", err)
	}
	defer container.Close()

	device, err := container.GetFirstDevice(ctx)
	if err != nil {
		return fmt.Errorf("erro ao carregar dispositivo WhatsApp: %w", err)
	}

	// Cria o cliente WhatsApp
	wa := waClient.NewClient(device, waLog.Zerolog(log.Logger).Sub("wa"))

	// Instala o meowcaller ANTES de conectar (obrigatório para interceptar chamadas VoIP)
	meo := meowcaller.NewClient(wa)

	e.mu.Lock()
	e.wa = wa
	e.meo = meo
	e.mu.Unlock()

	// Handler de logout remoto
	wa.AddEventHandler(func(evt any) {
		if _, ok := evt.(*events.LoggedOut); ok {
			log.Warn().Msg("WhatsApp desconectado pelo celular (LoggedOut). Limpando credenciais antigas...")
			_ = device.Delete(context.Background())
			e.RestartSession()
		}
	})

	// Handler de chamadas recebidas (Inbound VoIP)
	meo.OnIncomingCall(func(call *meowcaller.Call) {
		callID := call.ID()
		peer := call.Peer().String()
		snap := &CallSnapshot{
			CallID:       callID,
			Direction:    "INBOUND",
			RemoteNumber: peer,
			Status:       "RINGING",
			StartedAt:    time.Now(),
		}
		e.callsMu.Lock()
		e.activeCalls[callID] = snap
		e.callsMu.Unlock()

		log.Info().Str("caller", peer).Str("call_id", callID).Msg("📞 Chamada VoIP recebida!")

		// Atender automaticamente
		if err := call.Answer(); err != nil {
			log.Error().Err(err).Str("call_id", callID).Msg("Erro ao atender chamada")
			snap.Status = "FAILED"
			return
		}
		snap.Status = "CONNECTED"

		// Finaliza ao encerrar a chamada
		call.OnEnd(func(reason string) {
			log.Info().Str("call_id", callID).Str("reason", reason).Msg("Chamada encerrada")
			snap.Status = "ENDED"
			time.AfterFunc(10*time.Second, func() {
				e.callsMu.Lock()
				delete(e.activeCalls, callID)
				e.callsMu.Unlock()
			})
		})

		log.Info().Str("call_id", callID).Msg("✅ Chamada atendida com sucesso!")
	})

	// Conecta ao WhatsApp
	if device.ID == nil {
		// Novo dispositivo — precisa escanear QR Code
		return e.connectWithQR(ctx, wa)
	}

	// Dispositivo com credenciais salvas — tenta restabelecer conexão
	log.Info().Str("jid", device.ID.String()).Msg("Tentando reconectar sessão salva...")
	if err := wa.Connect(); err != nil {
		log.Warn().Err(err).Msg("Falha ao discar conexão com sessão salva")
	}

	// Aguarda conexão autenticada por no máximo 8s
	if err := waitUntilConnected(ctx, wa, 8*time.Second); err != nil {
		log.Warn().Err(err).Msg("Sessão salva expirada ou inválida. Limpando credenciais antigas para gerar novo QR Code...")
		_ = device.Delete(context.Background())
		// Inicia imediatamente o fluxo de QR Code
		return e.connectWithQR(ctx, wa)
	}

	jid := wa.Store.GetJID().String()
	log.Info().Str("jid", jid).Msg("✅ WhatsApp de Voz conectado com sucesso!")
	e.setStatus(StatusConnected, jid, "")

	// Anuncia presença para receber chamadas
	if wa.Store.PushName == "" {
		wa.Store.PushName = "Helena VoIP"
	}
	if err := wa.SendPresence(ctx, types.PresenceAvailable); err != nil {
		log.Warn().Err(err).Msg("Falha ao enviar presença (não crítico)")
	}

	// Aguarda o contexto ser cancelado (shutdown ou reconexão)
	<-ctx.Done()
	wa.Disconnect()
	return nil
}

// connectWithQR gerencia o fluxo de primeiro pareamento via QR Code
func (e *Engine) connectWithQR(ctx context.Context, wa *waClient.Client) error {
	log.Info().Msg("Novo dispositivo detectado. Gerando QR Code de Ligações...")
	e.setStatus(StatusPairingRequired, "", "")

	qrChan, err := wa.GetQRChannel(ctx)
	if err != nil {
		return fmt.Errorf("erro ao obter canal QR: %w", err)
	}

	if err := wa.Connect(); err != nil {
		return fmt.Errorf("erro ao conectar para QR: %w", err)
	}

	var lastEvent string
	// Processa eventos do canal QR emitidos pelo WhatsApp Web
	for evt := range qrChan {
		lastEvent = evt.Event
		if evt.Event == "code" {
			// Gera imagem PNG do QR Code
			png, err := qrcode.Encode(evt.Code, qrcode.Medium, 256)
			if err != nil {
				log.Error().Err(err).Msg("Erro ao gerar imagem QR Code")
				// Usa texto puro como fallback
				e.mu.Lock()
				e.qrCodeB64 = "data:text/plain;base64," + base64.StdEncoding.EncodeToString([]byte(evt.Code))
				e.qrGeneratedAt = time.Now()
				e.mu.Unlock()
			} else {
				b64 := "data:image/png;base64," + base64.StdEncoding.EncodeToString(png)
				e.mu.Lock()
				e.qrCodeB64 = b64
				e.qrGeneratedAt = time.Now()
				e.mu.Unlock()
				log.Info().Msg("📱 QR Code de Ligações gerado! Escaneie no WhatsApp: Aparelhos Conectados.")
			}
		} else if evt.Event == "success" {
			log.Info().Msg("✅ Pareamento via QR Code concluído com sucesso!")
			break
		} else if evt.Event == "timeout" {
			log.Warn().Msg("⏰ QR Code expirou por inatividade. O canal será reciclado automaticamente.")
			break
		} else {
			log.Info().Str("event", evt.Event).Msg("Evento de login WhatsApp")
		}
	}

	// QR Channel fechado (timeout ou pareamento falhou)
	e.mu.Lock()
	e.qrCodeB64 = "" // Limpa QR Code expirado imediatamente
	e.mu.Unlock()

	// Se não logou e não teve sucesso explícito, retorna erro para reiniciar o ciclo
	if !wa.IsLoggedIn() && lastEvent != "success" {
		return fmt.Errorf("sessão QR finalizada sem pareamento (lastEvent: %s)", lastEvent)
	}

	// Pareamento concluído (ou em finalização)
	if err := waitUntilConnected(ctx, wa, 30*time.Second); err != nil {
		return fmt.Errorf("timeout após pareamento QR: %w", err)
	}

	jid := wa.Store.GetJID().String()
	log.Info().Str("jid", jid).Msg("✅ WhatsApp de Voz pareado e conectado!")
	e.setStatus(StatusConnected, jid, "")

	// Anuncia presença
	if wa.Store.PushName == "" {
		wa.Store.PushName = "Helena VoIP"
	}
	if err := wa.SendPresence(ctx, types.PresenceAvailable); err != nil {
		log.Warn().Err(err).Msg("Falha ao enviar presença (não crítico)")
	}

	// Aguarda shutdown
	<-ctx.Done()
	wa.Disconnect()
	return nil
}

// waitUntilConnected aguarda com ticker até o cliente estar conectado e autenticado
func waitUntilConnected(ctx context.Context, wa *waClient.Client, timeout time.Duration) error {
	deadline := time.After(timeout)
	ticker := time.NewTicker(200 * time.Millisecond)
	defer ticker.Stop()

	for {
		if wa.IsConnected() && wa.IsLoggedIn() {
			return nil
		}
		select {
		case <-ticker.C:
			if wa.IsConnected() && wa.IsLoggedIn() {
				return nil
			}
		case <-deadline:
			return fmt.Errorf("timeout aguardando conexão WhatsApp (%s)", timeout)
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

// setStatus atualiza o estado de forma thread-safe
func (e *Engine) setStatus(s SessionStatus, jid, qr string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.status = s
	if jid != "" {
		e.jid = jid
	}
	if s == StatusConnected {
		e.qrCodeB64 = "" // Limpa QR Code ao conectar
	}
	if qr != "" {
		e.qrCodeB64 = qr
	}
}

// GetStatus retorna o estado atual da sessão (thread-safe)
func (e *Engine) GetStatus() (SessionStatus, string, string) {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.status, e.jid, e.qrCodeB64
}

// RestartSession força uma reconexão imediata gerando um QR Code 100% fresco
func (e *Engine) RestartSession() {
	e.mu.Lock()
	if time.Since(e.lastRestart) < 8*time.Second {
		e.mu.Unlock()
		log.Info().Msg("RestartSession ignorado: reinício recente já em andamento")
		return
	}
	e.lastRestart = time.Now()
	e.qrCodeB64 = ""
	e.status = StatusConnecting
	cancel := e.cancelCtx
	wa := e.wa
	e.mu.Unlock()

	if wa != nil {
		wa.Disconnect()
	}
	if cancel != nil {
		cancel()
	}
	log.Info().Msg("🔄 Sessão WhatsApp reiniciada sob demanda. Gerando QR Code fresco...")
}

// ResetSession limpa completamente o banco SQLite de sessão e força geração de QR Code do zero
func (e *Engine) ResetSession(ctx context.Context) error {
	e.mu.Lock()
	e.lastRestart = time.Now()
	e.qrCodeB64 = ""
	e.jid = ""
	e.status = StatusConnecting
	cancel := e.cancelCtx
	wa := e.wa
	e.mu.Unlock()

	if wa != nil {
		wa.Disconnect()
	}
	if cancel != nil {
		cancel()
	}

	// Remove arquivos do SQLite da sessão para forçar novo pareamento limpo
	dbPath := e.cfg.WhatsAppSessionPath
	if dbPath != "" {
		_ = os.Remove(dbPath)
		_ = os.Remove(dbPath + "-shm")
		_ = os.Remove(dbPath + "-wal")
		log.Info().Str("path", dbPath).Msg("Credenciais salvas e banco WhatsApp removidos com sucesso.")
	}

	return nil
}

// PairPhone solicita código de pareamento por número de telefone (8 dígitos)
func (e *Engine) PairPhone(ctx context.Context, phone string) (string, error) {
	cleaned := ""
	for _, ch := range phone {
		if ch >= '0' && ch <= '9' {
			cleaned += string(ch)
		}
	}
	if len(cleaned) < 10 {
		return "", fmt.Errorf("número de telefone inválido: %s", phone)
	}
	if len(cleaned) == 10 || len(cleaned) == 11 {
		cleaned = "55" + cleaned
	}

	e.mu.RLock()
	wa := e.wa
	status := e.status
	e.mu.RUnlock()

	if wa == nil {
		return "", fmt.Errorf("cliente WhatsApp ainda não inicializado. Aguarde alguns segundos e tente novamente")
	}
	if status == StatusConnected {
		return "", fmt.Errorf("dispositivo já está conectado")
	}

	code, err := wa.PairPhone(ctx, cleaned, true, waClient.PairClientChrome, "Chrome (Linux)")
	if err != nil {
		return "", fmt.Errorf("erro ao gerar código de pareamento: %w", err)
	}

	log.Info().Str("phone", cleaned).Str("code", code).Msg("📲 Código de pareamento WhatsApp gerado!")
	return code, nil
}

// OriginateCall inicia uma chamada de saída via meowcaller
func (e *Engine) OriginateCall(ctx context.Context, target string) (*CallSnapshot, error) {
	e.mu.RLock()
	status := e.status
	meo := e.meo
	e.mu.RUnlock()

	if status != StatusConnected {
		return nil, fmt.Errorf(
			"sessão WhatsApp não conectada (status: %s). Escaneie o QR Code de Ligações para conectar o chip de voz",
			status,
		)
	}
	if meo == nil {
		return nil, fmt.Errorf("engine de voz não inicializado")
	}

	log.Info().Str("target", target).Msg("🔔 Originando chamada WhatsApp VoIP...")

	call, err := meo.Call(ctx, target)
	if err != nil {
		return nil, fmt.Errorf("erro ao originar chamada para %s: %w", target, err)
	}

	callID := uuid.New().String()
	snap := &CallSnapshot{
		CallID:       callID,
		Direction:    "OUTBOUND",
		RemoteNumber: target,
		Status:       "RINGING",
		StartedAt:    time.Now(),
	}

	e.callsMu.Lock()
	e.activeCalls[callID] = snap
	e.callsMu.Unlock()

	// Monitora a chamada em background
	go func() {
		call.OnReady(func() {
			snap.Status = "CONNECTED"
			log.Info().Str("call_id", callID).Msg("📞 Chamada conectada — mídia fluindo!")
		})
		call.OnEnd(func(reason string) {
			snap.Status = "ENDED"
			log.Info().Str("call_id", callID).Str("reason", reason).Msg("Chamada encerrada")
			time.AfterFunc(10*time.Second, func() {
				e.callsMu.Lock()
				delete(e.activeCalls, callID)
				e.callsMu.Unlock()
			})
		})

		// Timeout máximo de segurança
		select {
		case <-time.After(time.Duration(e.cfg.CallMaxDurationSeconds) * time.Second):
			if snap.Status == "RINGING" || snap.Status == "CONNECTED" {
				snap.Status = "ENDED"
				log.Warn().Str("call_id", callID).Msg("Chamada encerrada por timeout máximo")
			}
		}
	}()

	return snap, nil
}

// ListActiveCalls retorna lista de chamadas ativas
func (e *Engine) ListActiveCalls() []CallSnapshot {
	e.callsMu.RLock()
	defer e.callsMu.RUnlock()
	calls := make([]CallSnapshot, 0, len(e.activeCalls))
	for _, c := range e.activeCalls {
		calls = append(calls, *c)
	}
	return calls
}

// Shutdown encerra o engine graciosamente
func (e *Engine) Shutdown() {
	e.mu.Lock()
	e.stopped = true
	cancel := e.cancelCtx
	wa := e.wa
	e.mu.Unlock()

	if wa != nil {
		wa.Disconnect()
	}
	if cancel != nil {
		cancel()
	}
	log.Info().Msg("Engine de voz WhatsApp encerrado.")
}
