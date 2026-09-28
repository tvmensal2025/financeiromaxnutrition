# Diretrizes de Roteamento de Áudio (Audio Routing Architecture)

Este documento define a separação canônica e os pontos de responsabilidade do sistema para cada contexto de áudio.

---

## 1. Matriz Canônica de Roteamento por Contexto

| Contexto | Provedor Principal | Provedor Fallback / Standby | Arquivo / Módulo Responsável | Função / Método Principal |
| :--- | :--- | :--- | :--- | :--- |
| **`CALL`** (Telefonia / VoIP WhatsApp) | **Google Cloud Chirp 3 HD** (`google_chirp3_hd`) | ElevenLabs Flash v2.5 / Kokoro TTS | `services/helena-gateway/src/integrations/google-chirp3-hd.mjs`<br>`services/helena-gateway/src/integrations/audio-router.mjs` | `synthesizeCallSpeech()`<br>`routeCallAudio()` |
| **`VARIABLE`** (Amostras dinâmicas, prévias, testes) | **ElevenLabs Flash v2.5** | Kokoro TTS VPS | `services/helena-gateway/src/integrations/elevenlabs.mjs` | `generateVoiceSample()` |
| **`FIXED`** (Catálogo imutável, áudios prontos no storage) | **Cloudflare R2** (`ids-media`) | Arquivo local / CDN | `services/helena-gateway/src/integrations/audio-router.mjs` | `routeFixedAudio()` |
| **`KOKORO`** (Motor Neural Open-Source) | **Kokoro-82M VPS** | Instância EasyPanel | `services/helena-gateway/src/integrations/kokoro.mjs` | `generateKokoroSpeech()`<br>`synthesizeKokoroSpeech()` |
| **`OTHER`** (Notificações, automações) | Comportamento Atual | Comportamento Atual | Conforme módulo de origem | Conforme módulo de origem |

---

## 2. Fluxo da Ligação Telefônica (CALL)

### 2.1. Antes da Implementação
```text
PESSOA FALA
    ↓
Meowcaller Service (RTP / PCM)
    ↓
Webhook user-speech (helena-gateway)
    ↓
STT (ElevenLabs Scribe)
    ↓
LLM / Catálogo Max Nutrition
    ↓
TEXTO DA RESPOSTA
    ↓
speakInCall
    ↓
ElevenLabs Flash v2.5 (com fallback Kokoro)
    ↓
MP3
    ↓
Meowcaller /v1/calls/{id}/play
    ↓
PESSOA ESCUTA
```

### 2.2. Depois da Implementação (Arquitetura Atual)
```text
PESSOA FALA
    ↓
Meowcaller Service (RTP / PCM)
    ↓
Webhook user-speech (helena-gateway)
    ↓
STT (ElevenLabs Scribe)
    ↓
LLM / Catálogo Max Nutrition
    ↓
TEXTO DA RESPOSTA
    ↓
speakInCall
    ↓
audio-router (Contexto: CALL)
    ↓
Google Cloud Text-to-Speech (Chirp 3 HD)
    ↓
Voz pt-BR (pt-BR-Chirp3-HD-Achernar)
    ↓
MP3 / LINEAR16
    ↓
Meowcaller /v1/calls/{id}/play
    ↓
PESSOA ESCUTA
```

---

## 3. Garantias de Não-Regressão e Integridade

1. **Google Chirp 3 HD é exclusivo para LIGAÇÕES:**
   O adapter `GoogleChirp3HDCallTTS.synthesizeCallSpeech` rejeita ativamente qualquer execução cujo contexto não seja estritamente `'CALL'`.
2. **ElevenLabs permanece intacto:**
   Chaves de API, perfis de vozes (`TX3LPaxmHKxFdv7VOQHJ`), endpoints e geração de amostras continuam 100% operacionais.
3. **Kokoro permanece intacto:**
   Todas as vozes pt-BR (`pm_alex`, `pm_santa`, `pf_dora`), rotas de amostra e integração com a VPS continuam ativas.
4. **Nenhum arquivo de áudio foi regenerado ou apagado:**
   O Cloudflare R2 e os diretórios de mídia preservam sua integridade integralmente.
5. **Rollback sem riscos:**
   A feature flag `GOOGLE_CALL_TTS_ENABLED=false` reverte o fluxo de ligação para o estado anterior instantaneamente.
