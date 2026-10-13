# Meowcaller Service — WhatsApp Voice Transport

Serviço especializado e desacoplado do **Sistema Helena**, responsável pelo **transporte e streaming de chamadas de voz VoIP do WhatsApp**.

---

## 1. Função Canônica e Responsabilidade

O Meowcaller é responsável exclusivamente pelo **transporte de chamadas telefônicas via WhatsApp**:
- Receber ligações de voz (*Inbound*).
- Disparar ligações de voz autorizadas (*Outbound controlado*).
- Gerenciar o ciclo de vida da chamada (`Answer`, `Reject`, `Hangup`).
- Streaming bidirecional de áudio:
  - **RX**: Captura áudio do interlocutor e envia para a Voice Platform via WebSocket.
  - **TX**: Recebe o áudio sintetizado e reproduz na chamada do WhatsApp.
- Rastrear telemetria e emitir eventos em tempo real (`CALL_INCOMING`, `CALL_RINGING`, `CALL_ACCEPTED`, `CALL_READY`, `CALL_ENDED`, `CALL_FAILED`).
- Garantir suporte a interrupção (*barge-in*), limpando buffers de áudio imediatamente quando o cliente fala.

---

## 2. O que o Meowcaller NÃO Faz

- **NÃO contém inteligência conversacional**, prompts ou raciocínio de agentes.
- **NÃO contém integração direta com ElevenLabs** (ElevenLabs é de responsabilidade da Voice Platform).
- **NÃO substitui o Evolution API** (o Evolution continua 100% responsável por mensagens de texto).
- **NÃO compartilha sessão com o Baileys** (banco de sessão e instâncias são 100% isolados).
- **NÃO realiza discagem em massa ou campanhas de spam**.

---

## 3. Arquitetura e Ciclo de Vida da Chamada

```
[ WhatsApp VoIP Call ]
         ↕
┌─────────────────────────────────┐
│     MEOWCALLER SERVICE          │
│                                 │
│  - Session Manager (SQLite)     │
│  - Call Manager & Lifecycle     │
│  - Audio Buffer & Codec (MLOW)  │
│  - Voice Adapter (WebSocket)    │
└────────────────┬────────────────┘
                 ↕ (PCM Linear / S16LE)
┌─────────────────────────────────┐
│     VOICE PLATFORM              │
│  (STT, VAD, Agente, TTS)        │
└─────────────────────────────────┘
```

---

## 4. Endpoints HTTP da API Interna

### `GET /health`
Verifica a integridade do serviço, status da sessão WhatsApp e quantidade de chamadas ativas.

### `POST /v1/calls`
Inicia uma chamada sainte controlada.
- **Payload**:
  ```json
  {
    "business_id": "BIZ-003",
    "agent_id": "AGT-20",
    "target_jid": "5511999998888@s.whatsapp.net"
  }
  ```

### `GET /v1/calls/{id}`
Retorna o snapshot com status, timestamps, duração e telemetria de áudio.

### `POST /v1/calls/{id}/answer`
Atende uma chamada entrante.

### `POST /v1/calls/{id}/reject`
Rejeita a chamada.

### `POST /v1/calls/{id}/hangup`
Encerra imediatamente a chamada ativa e limpa os buffers de memória.

### `GET /v1/events`
Stream Server-Sent Events (SSE) emitindo eventos de estado das chamadas em tempo real.

---

## 5. Docker e EasyPanel

### Variáveis de Ambiente (`.env`):
```env
PORT=8002
INTERNAL_API_KEY=sua_chave_secreta_aqui
SUPABASE_URL=https://sua-url.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua_key_aqui
VOICE_PLATFORM_URL=ws://voice-platform:8000/v1/voice/stream
VOICE_PLATFORM_API_KEY=sua_chave_voice_aqui
WHATSAPP_SESSION_PATH=/data/whatsapp.db
LOG_LEVEL=info
CALL_MAX_DURATION_SECONDS=300
```

### Quem a IA atende numa ligação recebida

O serviço aceita toda chamada VoIP recebida na hora (o WhatsApp exige o aceite imediato; ver `internal/voice/engine.go`,
`OnIncomingCall`). Quem decide se a conversa acontece é o **helena-gateway**: com `VOICE_INBOUND_CALL_POLICY=students`
(padrão) só aluno conhecido do eLiving é atendido; os demais são desligados pelo gateway (`POST /v1/calls/{id}/hangup`)
sem STT, GPT nem voz. A variável `ENABLE_AUTO_ANSWER_CONTROLLED_NUMBERS` deste serviço é lida mas **não tem efeito**.

### Build e Execução Docker:
```bash
docker build -t meowcaller-service:latest .
docker run -d -p 8002:8002 -v meowcaller_data:/data --name meowcaller meowcaller-service:latest
```

---

## 6. Riscos, Compliance e Comparativo com a Meta Calling API

> [!WARNING]
> **Aviso de Conformidade**:
> O Meowcaller baseia-se na biblioteca `purpshell/meowcaller` e engenharia reversa do protocolo VoIP do WhatsApp Web.
> - **Para a POC**: Excelente para comprovação técnica, validação de latência em milissegundos e laboratório com números controlados.
> - **Para Produção em Escala**: A recomendação canônica do Sistema Helena para alto volume comercial é a **WhatsApp Business Calling API oficial da Meta**, eliminando qualquer risco de banimento e garantindo SLA corporativo.
