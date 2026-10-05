# Diretrizes de Roteamento de Áudio (Audio Routing Architecture)

Este documento define a separação canônica e os pontos de responsabilidade do sistema para cada contexto de áudio.

---

## 1. Matriz Canônica de Roteamento por Contexto

| Contexto | Provedor Principal | Provedor Fallback / Standby | Arquivo / Módulo Responsável | Função / Método Principal |
| :--- | :--- | :--- | :--- | :--- |
| **`CALL`** (Telefonia / VoIP WhatsApp) | **ElevenLabs Master Quality (192 kbps)** (Consome cota mensal contratada) | **Google Cloud Chirp 3 HD** (`google_chirp3_hd`) | `services/helena-gateway/src/integrations/elevenlabs.mjs`<br>`services/helena-gateway/src/integrations/audio-router.mjs` | `synthesizeElevenLabsCallSpeech()`<br>`streamElevenLabsCallSpeech()`<br>`routeCallAudio()` |
| **`VARIABLE`** (Amostras dinâmicas, prévias, testes) | **ElevenLabs Flash v2.5** | Kokoro TTS VPS | `services/helena-gateway/src/integrations/elevenlabs.mjs` | `generateVoiceSample()` |
| **`FIXED`** (Catálogo imutável, áudios prontos no storage) | **Cloudflare R2** (`ids-media`) | Arquivo local / CDN | `services/helena-gateway/src/integrations/audio-router.mjs` | `routeFixedAudio()` |
| **`KOKORO`** (Motor Neural Open-Source) | **Kokoro-82M VPS** | Instância EasyPanel | `services/helena-gateway/src/integrations/kokoro.mjs` | `generateKokoroSpeech()`<br>`synthesizeKokoroSpeech()` |
| **`OTHER`** (Notificações, automações) | Comportamento Atual | Comportamento Atual | Conforme módulo de origem | Conforme módulo de origem |

---

## 2. Estratégia Híbrida de Voz & Cérebro nas Ligações (CALL)

### 2.1. Cérebro da Conversa (Inteligência Conversacional)
O "cérebro" das ligações é exclusivamente a **OpenAI GPT Luna** (`gpt-6-luna`), responsável pelo raciocínio em tempo real, empatia e tomada de decisões terapêuticas e comerciais. O cérebro permanece o mesmo independentemente de qual motor sintetizar o áudio da voz.

### 2.2. Vozes Originais Reais dos Personagens
No ElevenLabs, cada personagem utiliza a voz original e clonada gravada em estúdio:
- **Sirlene:** `EJV7H2baGt5ab95tOoSG`
- **Alex:** `TX3LPaxmHKxFdv7VOQHJ` (Liam)
- **Dr. Vital:** `IKpiSijWzlhOL6uX83EH` (Will)
- **Rafael:** `TX3LPaxmHKxFdv7VOQHJ`

### 2.3. Configuração de Altíssima Fidelidade (Master Quality)
Para preservar o timbre humano real e a expressividade:
- **Taxa de Bits / Formato:** `mp3_44100_192` (192 kbps HD a 44.1 kHz).
- **Parâmetros Acústicos:** `stability: 0.50`, `similarity_boost: 0.85`, `style: 0.15`, `use_speaker_boost: true`.
- **Modo Streaming:** `optimize_streaming_latency=1` para início de reprodução em menos de 300ms.

### 2.4. Modulação Vocal & Expressividade Humana (Audio Tags — Especificação V4)
O cérebro conversacional (GPT Luna) insere dinamicamente Audio Tags em inglês entre colchetes `[ ]` para conferir reações sonoras e modulações autênticas:
- **Tags Suportadas:** `[surprised]`, `[shocked]`, `[amazed]`, `[excited]`, `[angry]`, `[annoyed]`, `[frustrated]`, `[laughing]`, `[laughs]`, `[giggling]`, `[cheerfully]`, `[sighs]`, `[sigh]`, `[clears throat]`, `[groaning]`, `[whispers]`, `[whispering]`, `[shouts]`, `[quizzically]`, `[hesitant]`, `[indecisive]`, `[comforting]`, `[warmly]`.
- **Processamento no ElevenLabs:** As tags válidas são preservadas e instruem o motor de voz sobre a entonação, suspiro, riso ou pigarro.
- **Processamento no Google Chirp 3 HD:** As tags são expurgadas via `stripAudioTags()` antes da síntese, garantindo que o Google Chirp 3 HD nunca verbalize as palavras em inglês e mantenha a fala 100% natural.

### 2.5. Fluxo de Execução com Fallback Automático por Cota

```text
PESSOA FALA
    ↓
Meowcaller Service (RTP / PCM)
    ↓
Webhook user-speech (helena-gateway)
    ↓
STT (ElevenLabs Scribe / Whisper)
    ↓
LLM Cérebro: OpenAI GPT Luna (gpt-6-luna)
    ↓
TEXTO DA RESPOSTA
    ↓
audio-router (Contexto: CALL)
    ↓
[1º TENTATIVA: ELEVENLABS MASTER QUALITY 192 kbps]
    ├── Cota Disponível? → Sintetiza com Voz Original do Personagem
    └── Cota Esgotada (HTTP 429 / Insufficient Credits)?
            ↓ (Chaveamento Automático e Instantâneo)
[2º TENTATIVA / FALLBACK: GOOGLE CLOUD CHIRP 3 HD]
    ├── Sirlene  → pt-BR-Chirp3-HD-Achernar
    ├── Alex     → pt-BR-Chirp3-HD-Alkaid
    ├── Vital    → pt-BR-Chirp3-HD-Charon
    └── Rafael   → pt-BR-Chirp3-HD-Achird
    ↓
MP3 / PCM 16-bit
    ↓
Meowcaller /v1/calls/{id}/play
    ↓
PESSOA ESCUTA
```

---

## 3. Garantias de Não-Regressão e Integridade

1. **Priorização e Economia Inteligente:**
   Todo mês a cota do ElevenLabs é utilizada ao máximo no patamar audiófilo (192 kbps). No momento em que a cota esgota, a transição para o Google Chirp 3 HD ocorre sem quedas de chamada ou erros para o cliente.
2. **Preservação do Cérebro Conversacional:**
   A inteligência OpenAI GPT Luna rege o conteúdo textual independentemente de qual sintetizador gera as ondas acústicas.
3. **Resiliência Multi-Provedor:**
   Falhas em qualquer um dos serviços de voz não derrubam a operação: ElevenLabs → Fallback Google Chirp 3 HD → Fail-safe com áudio de contingência.
4. **Zero Regressão no Storage:**
   Cloudflare R2, mídias imutáveis e áudios de catálogo permanecem 100% íntegros.

