# Arquitetura Meowcaller — WhatsApp Voice Transport

## 1. Visão Geral e Responsabilidades

O **Meowcaller Service** atua como uma camada estrita e especializada de **transporte de chamadas de voz via WhatsApp** para o Sistema Helena.

### Responsabilidades Canônicas:
- Receber ligações de voz entrantes (Inbound VoIP WhatsApp).
- Disparar ligações de voz saintes controladas (Outbound VoIP WhatsApp para números autorizados).
- Controlar o ciclo de vida da chamada: aceitar (`Answer`), rejeitar (`Reject`) e encerrar (`Hangup`).
- Gerenciar o fluxo contínuo de áudio:
  - **RX (Recepção)**: capturar os frames de áudio do interlocutor e disponibilizar como PCM float32.
  - **TX (Transmissão)**: alimentar o canal de voz com frames de áudio sintético gerados pela Voice Platform.
- Emitir telemetria e eventos de estado em tempo real (`CALL_INCOMING`, `CALL_RINGING`, `CALL_ACCEPTED`, `CALL_READY`, `CALL_ENDED`, `CALL_FAILED`).
- Gerenciar reconexão e persistência de sessão de forma isolada e segura.

### O que o Meowcaller NÃO Contém:
- **NÃO contém inteligência conversacional**, prompts ou raciocínio de agentes.
- **NÃO contém integração direta com ElevenLabs** (a geração de áudio pertence à Voice Platform).
- **NÃO contém CRM**, armazenamento de contatos ou regras de negócio.
- **NÃO contém roteamento comercial** ou decisões executivas.
- **NÃO altera mensagens de texto** do WhatsApp (o Evolution API permanece 100% responsável por mensagens de texto).

---

## 2. Auditoria Técnica da Biblioteca `purpshell/meowcaller`

| Parâmetro | Detalhes Técnicos Auditados |
| :--- | :--- |
| **Repositório Upstream** | `github.com/purpshell/meowcaller` |
| **Licença** | MIT License (Permite modificação, distribuição e uso comercial) |
| **Linguagem / Runtime** | Go 1.24+ / 1.25 (100% Pure Go, sem CGO, cross-platform) |
| **Protocolo Base** | WhatsApp Web VoIP Stack via `whatsmeow` / `hypermeow` |
| **Codec de Áudio Nativo** | **MLOW** (Meta Low-latency Audio Codec implementado em Go puro) + suporte a Opus |
| **Mecanismo de Áudio** | `meowcaller.AudioSource` (TX) e `meowcaller.AudioSink` / `SinkFunc` (RX em `[]float32`) |
| **Sessão & Persistência** | SQLite puro (`modernc.org/sqlite` sem CGO) armazenado em volume persistente |
| **Tratamento de Chamadas** | Assíncrono com channels de sinalização e `CallRegistry` com controle de concorrência |

---

## 3. Coexistência Arquitetural: Evolution API vs. Meowcaller

```
                      ┌───────────────────────────────────────┐
                      │             CLIENTE / LEAD            │
                      └──────────────────┬────────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 │                                               │
          [ Mensagens de Texto ]                         [ Chamada de Voz ]
                 │                                               │
                 ▼                                               ▼
       ┌───────────────────┐                           ┌───────────────────┐
       │   EVOLUTION API   │                           │ MEOWCALLER ENGINE │
       │ (Baileys Engine)  │                           │ (whatsmeow VoIP)  │
       └─────────┬─────────┘                           └─────────┬─────────┘
                 │                                               │
                 ▼                                               ▼
       ┌───────────────────┐                           ┌───────────────────┐
       │  SUPABASE / JOBS  │                           │   VOICE ADAPTER   │
       │ (Histórico Texto) │                           │  (Audio Streaming)│
       └───────────────────┘                           └─────────┬─────────┘
                                                                 │
                                                                 ▼
                                                       ┌───────────────────┐
                                                       │  VOICE PLATFORM   │
                                                       │ (STT / VAD / TTS) │
                                                       └───────────────────┘
```

> [!WARNING]
> **Isolamento de Sessão de WhatsApp**:
> 1. É terminantemente proibido compartilhar o mesmo arquivo de sessão ou chave Baileys entre Evolution e Meowcaller.
> 2. O WhatsApp Web desconecta a sessão caso dois clientes simultâneos façam handshake com a mesma identidade.
> 3. Na fase de Prova de Conceito (POC), **utiliza-se exclusivamente um chip/número telefônico controlado e secundário**, jamais o número comercial mestre do ecossistema.

---

## 4. Ciclo de Vida da Chamada (State Machine)

```
 [ INCOMING ] ──► [ RINGING ] ──► [ ACCEPTED ] ──► [ READY (Media Active) ] ──► [ ENDED ]
      │                │               │                      │
      └────────────────┴───────────────┴──────────────────────┴───────────────► [ FAILED ]
```

1. **CALL_INCOMING**: O WhatsApp notifica uma tentativa de ligação com caller JID e timestamp.
2. **CALL_RINGING**: Sinalização de toque enviada ao originador.
3. **CALL_ACCEPTED**: Handshake criptográfico de chave SRTP/DTLS concluído via Meowcaller.
4. **CALL_READY**: Canal de mídia bidirecional aberto; RX começa a capturar PCM e TX pronto para reprodução.
5. **CALL_ENDED**: Finalização limpa (desligamento local ou remoto), flush de buffers e liberação de recursos.
6. **CALL_FAILED**: Tratamento de timeout de rede, recusa de chamada ou queda de conexão.

---

## 5. Comparativo Crítico: Meowcaller (Não Oficial) vs. WhatsApp Business Calling API (Oficial Meta)

| Dimensão | Meowcaller (whatsmeow VoIP) | WhatsApp Business Calling API (Meta Cloud) |
| :--- | :--- | :--- |
| **Natureza** | Engenharia reversa do protocolo WhatsApp Web VoIP. | Endpoint oficial da API Cloud da Meta para parceiros BSP. |
| **Custo de Licenciamento** | Gratuito / Código Aberto. | Tarifado por minuto de chamada (Meta Calling pricing). |
| **Controle de Latência** | **Baixíssima** (~20-40 ms no codec MLOW direto no container). | Depende do gateway SIP / WebRTC da Meta (geralmente 150–350 ms). |
| **Risco de Banimento** | **EXISTE RISCO REAL** se utilizado para outbound massivo ou spam. | **Zero risco** de banimento por protocolo (desde que em conformidade com termos). |
| **Estabilidade de Protocolo** | Sujeito a quebras quando a Meta altera o handshake de VoIP no WhatsApp Web. | SLA corporativo garantido pela Meta. |
| **Recomendação Helena** | **EXCELENTE PARA POC, TESTES DE LATÊNCIA E LABORATÓRIO**. | **CANÔNICO E OBRIGATÓRIO PARA ESCALA DE PRODUÇÃO EM ALTO VOLUME**. |

---

## 6. Governança e Diretrizes de Segurança

1. **Anti-Spam & Discagem**:
   - É proibido criar rotinas de discagem preditiva ou chamadas em massa no Meowcaller.
   - Chamadas saintes exigem lista de números estritamente autorizados no whitelist interno.
2. **Privacidade e LGPD**:
   - Áudios brutos de ligações não devem ser gravados permanentemente sem política explícita e consentimento prévio do interlocutor.
   - Credenciais e arquivos de sessão SQLite ficam montados em volume seguro (`/data/sessions`) protegidos contra leitura de terceiros.
3. **Monitoramento e Limpeza (Zero Sessões Zumbis)**:
   - Toda chamada possui timeout máximo rígido de inatividade (ex: 5 minutos).
   - Se a Voice Platform ou o WebSocket cair, o Meowcaller encerra a chamada imediatamente (`Hangup`).
