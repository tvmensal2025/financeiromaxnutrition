# Contrato de Integração de Voz — Meowcaller ↔ Voice Platform

## 1. Visão Geral do Contrato

Este documento formaliza o contrato de transporte e streaming de áudio entre o **Meowcaller Service** (camada de transporte de VoIP do WhatsApp) e a **Voice Platform** existente no ecossistema Helena.

O objetivo do adapter é ser o **menor conector possível**, limitando-se a:
- Transmitir pacotes de áudio digital (PCM/Opus) nos dois sentidos.
- Encapsular metadados de sessão (`call_id`, `business_id`, `agent_id`).
- Notificar eventos de presença, início de fala e interrupção (*barge-in*).

Nenhum elemento de inteligência de negócio, prompt de IA ou chaves ElevenLabs é introduzido no Meowcaller.

---

## 2. Protocolo de Streaming (Full-Duplex WebSocket)

A conexão entre Meowcaller e Voice Platform opera prioritariamente via WebSocket seguro:

- **Endpoint da Voice Platform**: `wss://[VOICE_PLATFORM_HOST]/v1/voice/stream`
- **Cabeçalhos de Handshake**:
  - `Authorization: Bearer <VOICE_PLATFORM_API_KEY>`
  - `X-Service-Source: meowcaller-service`
  - `X-Call-ID: <UUID>`
  - `X-Business-ID: <BIZ-XXX>`
  - `X-Agent-ID: <AGT-XX>`

---

## 3. Especificação dos Formatos de Áudio

| Direção | Formato Primário | Alternativa / Suporte | Amostragem | Canais | Frame Size |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **RX (Meowcaller → Voice Platform)** | PCM Linear (16-bit Signed Little-Endian) | PCM Float32 (Normalizado -1.0 a 1.0) | 16.000 Hz / 24.000 Hz | 1 (Mono) | 20 ms (320 samples @ 16kHz) |
| **TX (Voice Platform → Meowcaller)** | PCM Linear (16-bit Signed Little-Endian) | Opus / MP3 Chunked | 16.000 Hz / 24.000 Hz | 1 (Mono) | 20 ms / 40 ms buffers |

---

## 4. Mensagens de Controle (JSON Frames)

O canal WebSocket trafega mensagens de texto formatadas em JSON para sinalização e mensagens binárias puras para dados de áudio.

### 4.1. Handshake de Início de Sessão (Meowcaller → Voice Platform)
```json
{
  "event": "session_start",
  "call_id": "call-7f8e3a2b-91c4-42b8",
  "business_id": "BIZ-003",
  "caller_jid": "5511999998888@s.whatsapp.net",
  "direction": "INBOUND",
  "assigned_agent_id": "AGT-20",
  "voice_profile": "joana_ptbr_v1",
  "audio_format": {
    "codec": "pcm_s16le",
    "sample_rate": 16000,
    "channels": 1
  },
  "timestamp": 1758784800000
}
```

### 4.2. Resposta de Aceite (Voice Platform → Meowcaller)
```json
{
  "event": "session_ready",
  "call_id": "call-7f8e3a2b-91c4-42b8",
  "session_token": "vses_01j7xyz89abc",
  "status": "READY"
}
```

### 4.3. Barge-in / Interrupção (Voice Platform → Meowcaller ou Meowcaller → Voice Platform)
Quando o interlocutor começa a falar enquanto o agente está reproduzindo um áudio TTS:
1. O detector VAD da Voice Platform (ou detector no Meowcaller) identifica fala humana.
2. A Voice Platform emite a mensagem de corte imediato:
```json
{
  "event": "barge_in_detected",
  "call_id": "call-7f8e3a2b-91c4-42b8",
  "action": "CLEAR_OUTPUT_BUFFER"
}
```
3. O Meowcaller limpa instantaneamente seu buffer de saída `AudioSource`, interrompendo a reprodução no ouvido do cliente sem atraso perceptível.

### 4.4. Handoff de Agente (Voice Platform → Meowcaller / Supabase)
Se a conversa migrar de atendimento para vendas durante a chamada (ex: Joana transfere para Victor):
```json
{
  "event": "agent_handoff",
  "call_id": "call-7f8e3a2b-91c4-42b8",
  "previous_agent_id": "AGT-20",
  "new_agent_id": "AGT-15",
  "reason": "oportunidade_comercial_identificada",
  "voice_profile": "victor_ptbr_v1"
}
```

### 4.5. Encerramento de Sessão (Bidirecional)
```json
{
  "event": "session_end",
  "call_id": "call-7f8e3a2b-91c4-42b8",
  "reason": "CALLER_DISCONNECTED",
  "duration_seconds": 142,
  "turn_count": 8
}
```

---

## 5. Mapeamento Canônico de Agentes e Perfis de Voz

Para preservar as credenciais da ElevenLabs e a governança dos 21 agentes:

| ID do Agente | Nome do Agente | Área Operacional | Perfil Lógico de Voz | Gestão de Voice ID |
| :--- | :--- | :--- | :--- | :--- |
| `AGT-01` | **Helena** | CEO Virtual / Governança | `helena_executive_ptbr` | Protegido na Voice Platform |
| `AGT-15` | **Victor** | Vendas & Aquisição | `victor_sales_ptbr` | Protegido na Voice Platform |
| `AGT-19` | **Renata** | CS / Onboarding | `renata_onboarding_ptbr` | Protegido na Voice Platform |
| `AGT-20` | **Joana** | Atendimento ao Cliente | `joana_support_ptbr` | Protegido na Voice Platform |

---

## 6. Telemetria e Monitoramento de Latência (KPIs de Voz)

O adapter instrumenta a chamada com 6 timestamps críticos:

- **$T_0$**: Recebimento do evento de chamada WhatsApp.
- **$T_1$**: Atendimento formal da ligação (`Answer` enviado).
- **$T_2$**: Primeiro frame de áudio RX capturado.
- **$T_3$**: Conclusão da transcrição STT pela Voice Platform.
- **$T_4$**: Resposta textual gerada pelo agente de IA.
- **$T_5$**: Início da síntese TTS (primeiro chunk recebido da ElevenLabs).
- **$T_6$**: Primeiro chunk de áudio reproduzido no alto-falante do cliente.

### Métrica de Ouro:
$$\text{Total Turn Latency} = T_6 - T_2$$
- Meta para o ecossistema Helena: **$<$ 1.200 ms** de latência ponta a ponta para conferir naturalidade conversacional.
