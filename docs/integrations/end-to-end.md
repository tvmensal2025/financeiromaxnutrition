# Fluxo Operacional Ponta a Ponta: Canais, Voz e Roteamento

## 1. Visão Geral do Ciclo de Atendimento

Este documento descreve a jornada completa de uma interação executiva recebida via voz (WhatsApp VoIP) e seu processamento síncrono através de todas as camadas do ecossistema Helena.

---

## 2. Diagrama de Sequência Ponta a Ponta

```
Cliente Remoto       Meowcaller         Gateway / Bridge         Laya          ElevenLabs       Supabase
      |                  |                      |                  |               |                |
      |--- Ligação ----->|                      |                  |               |                |
      |    WhatsApp      |--- webhook --------->|                  |               |                |
      |                  |    (call:incoming)   |                  |               |                |
      |                  |                      |--- Registra chamada INICIANDO ------------------->|
      |                  |<-- answerCall -------|                  |               |                |
      |<-- Atendimento --|                      |                  |               |                |
      |                  |                      |                  |               |                |
      |=== Stream Áudio =|=== Bridge Audio ====>|                  |               |                |
      |                  |                      |--- Áudio In ---> |               |                |
      |                  |                      |                  |               |--- Transcrição |
      |                  |                      |                  |<-- Texto -----|                |
      |                  |                      |                  |               |                |
      |                  |                      |--- /classify --->|               |                |
      |                  |                      |<-- Intenção -----|               |                |
      |                  |                      |                  |               |                |
      |                  |                      |--- Resposta Texto -------------->|                |
      |                  |                      |<-- Stream TTS (Áudio) -----------|                |
      |                  |<== Bridge Audio =====|                                                   |
      |<== Fala Helena ==|                      |                                                   |
      |                  |                      |                                                   |
      |--- Desliga ----->|                      |                                                   |
      |                  |--- call:ended ------>|                                                   |
      |                  |                      |--- Atualiza call_sessions (FINALIZADA, resumo) -->|
      |                  |                      |--- Registra integration_events ------------------>|
```

---

## 3. Etapas do Processamento

### Etapa 1: Sinalização e Recepção (Meowcaller)
- O cliente liga para o número WhatsApp exclusivo de voz da Helena.
- O Meowcaller Service captura o evento e notifica o Helena Gateway.
- Uma nova sessão é instanciada na tabela `public.call_sessions` com status `INICIANDO`.

### Etapa 2: Conexão da Ponte de Áudio (`MeowcallerElevenBridge`)
- O Gateway estabelece o túnel de áudio bidirecional via WebSocket com o Meowcaller.
- Ao mesmo tempo, conecta-se à API de Voz em tempo real da ElevenLabs utilizando a Signed URL gerada com a chave mestra.

### Etapa 3: Triagem Neural Rápida (Laya Service)
- Conforme o áudio é transcrito em tempo real, as primeiras frases passam pela inferência do Laya Service (`/v1/classify` e `/v1/score`).
- O Laya detecta:
  - Urgência alta ou risco de escalada.
  - Categoria da demanda (financeira, logística, suporte, diretoria).
  - Se a resposta exige o raciocínio complexo de Sistema 2 ou se segue pelo playbook direto.

### Etapa 4: Síntese e Devolução de Áudio (ElevenLabs)
- A resposta formulada é sintetizada pela voz da Helena cadastrada no perfil ativo (`public.voice_profiles`).
- O stream PCM/Opus é enviado de volta ao Meowcaller, que reproduz a voz para o usuário no WhatsApp com latência ultra-baixa.

### Etapa 5: Encerramento e Auditoria Completa (Supabase)
- Ao término da ligação, a duração exata, a transcrição completa e o resumo são persistidos em `public.call_sessions`.
- Um evento de auditoria é gravado em `public.integration_events` para acompanhamento no Painel Executivo.
