# Integração WhatsApp Chamadas de Voz — Meowcaller Service

## 1. Visão Geral

O **Meowcaller Service** é o microserviço dedicado à sinalização, atendimento e originação de chamadas de voz via protocolo WhatsApp VoIP. Ele atua em conjunto com a ponte de áudio (Audio Bridge) para conectar as chamadas telefônicas ao motor de fala e escuta do ElevenLabs.

---

## 2. Configurações de Ambiente

No `helena-gateway`, configure as seguintes variáveis no arquivo `.env` ou no painel do EasyPanel:

```bash
MEOWCALLER_BASE_URL=https://helena-automation-meowcaller-service.d9v63q.easypanel.host
MEOWCALLER_TOKEN=seu_token_de_autenticacao_meowcaller
```

---

## 3. Arquitetura de Sessão Isolada

O Meowcaller estabelece uma sessão WebRTC/VoIP independente utilizando um chip/número telefônico específico para voz:
- Status de Conexão WhatsApp: `DISCONNECTED`, `CONNECTING`, `CONNECTED`.
- O Helena Gateway monitora a saúde e as chamadas ativas através de `GET /health` e `GET /v1/session`.
- Na inicialização (`POST /v1/session/start`), a sessão é aberta para receber e emitir tráfego de áudio.

---

## 4. Originação e Recepção de Chamadas

### Originação de Chamada (Outbound)
1. No painel executivo (**Aba Ligações**), insira o número de destino no formato internacional (ex: `5511999998888`).
2. O backend envia `POST /v1/calls/originate` com:
   ```json
   {
     "target_jid": "5511999998888@s.whatsapp.net",
     "audio_bridge_url": "wss://helena-gateway.../audio-bridge",
     "metadata": {
       "agent_id": "HELENA-CORE",
       "reason": "Follow-up executivo"
     }
   }
   ```
3. Uma sessão é registrada imediatamente em `public.call_sessions` com status `INICIANDO`.

### Recepção de Chamada (Inbound)
1. Quando uma chamada é recebida pelo Meowcaller, o webhook `POST /webhooks/meowcaller` recebe o evento `call:incoming`.
2. Se a configuração `auto_answer` estiver ativada, o Meowcaller atende a ligação imediatamente e estabelece a ponte de áudio com a sessão do agente de voz.
3. Se desativada, o painel exibe a notificação de chamada recebida com opção de atendimento manual.

---

## 5. Auditoria de Chamadas no Supabase

Todas as ligações são persistidas na tabela `public.call_sessions`:
- `id`: Identificador canônico da sessão.
- `provider`: `MEOWCALLER`.
- `direction`: `INBOUND` (recebida) ou `OUTBOUND` (originada).
- `remote_number`: Número do cliente/contato.
- `status`: `INICIANDO`, `CONECTADA`, `FINALIZADA`, `FALHOU`.
- `started_at` / `ended_at`: Timestamps precisos de início e término.
- `duration_seconds`: Duração total da conversa em segundos.
- `transcription`: Transcrição integral da conversa gravada pela ponte de áudio.
- `summary`: Resumo executivo da conversa gerado pela Helena.
