# Diretrizes de Roteamento de Áudio (Audio Routing Architecture)

Este documento define a separação canônica e os pontos de responsabilidade do sistema para cada contexto de áudio.

> **Voz do eLiving (regra do dono, 06/10/2026):** modelo, voz, padrão (`voice_settings`), voz reserva Google e tags
> de áudio de cada personagem vêm **só** de `services/helena-gateway/src/integrations/eliving-voice-config.mjs`.
> Esse arquivo é **gerado** a partir da fonte única do app (`ids-max/supabase/functions/_shared/voice/elevenlabsConfig.ts`,
> regras em `ids-max/docs/voz/REGRAS_VOZ_ELEVENLABS.md`); não editar à mão. Para mudar: alterar a fonte única e,
> no ids-max, rodar `node --experimental-strip-types scripts/sync-voice-config-gateway.mjs` (`--check` só confere).
> Nenhuma voz vem de variável de ambiente; vozes antigas ficam na conta ElevenLabs, mas o sistema nunca as usa.

---

## 1. Matriz Canônica de Roteamento por Contexto

| Contexto | Provedor Principal | Provedor Reserva / Standby | Arquivo / Módulo Responsável | Função / Método Principal |
| :--- | :--- | :--- | :--- | :--- |
| **`CALL`** (Telefonia / VoIP WhatsApp e ligação do app) | **ElevenLabs V4 Turbo** (`models.tempoReal`), voz e padrão do personagem | **Google Cloud Chirp 3 HD**, voz fixa do personagem, texto sem tags | `elevenlabs.mjs`, `call-tts-stream.mjs`, `audio-router.mjs` | `openCallTTSStream()`<br>`routeCallAudio()`<br>`routeCallPreviewAudio()` |
| **`VARIABLE`** (Prévias e testes de voz no painel) | **ElevenLabs V4 Turbo** com a voz de um personagem | — | `elevenlabs.mjs` | `generateVoiceSample()` |
| **`FIXED`** (Catálogo imutável, áudios prontos no storage) | **Cloudflare R2** (`ids-media`) | Arquivo local / CDN | `audio-router.mjs` | `routeFixedAudio()` |
| **`KOKORO`** (Motor Neural Open-Source) | **Kokoro-82M VPS** | Instância EasyPanel | `kokoro.mjs` | `generateKokoroSpeech()`<br>`synthesizeKokoroSpeech()` |
| **`OTHER`** (Notificações, automações) | Comportamento Atual | Comportamento Atual | Conforme módulo de origem | Conforme módulo de origem |

Áudio **gravado** (arquivo) usa `models.gravado` (`eleven_v4`); ligação, streaming e prévia ao vivo usam
`models.tempoReal` (`eleven_v4_turbo`). Modelos antigos (multilingual v2, v3, flash, turbo v2) são proibidos.

---

## 2. Estratégia Híbrida de Voz & Cérebro nas Ligações (CALL)

### 2.1. Cérebro da Conversa
O "cérebro" das ligações é a **OpenAI GPT Luna** (`gpt-6-luna`). Ele não muda com o motor de voz.

### 2.2. Uma voz por personagem (nos dois provedores)
- A voz depende só do **personagem da ligação** (Sirlene, Alex, Dr. Vital, Rafael): `characterId` do perfil ativo.
- ElevenLabs: `elevenLabsSpecForCharacter(personagem, uso)` → voz, modelo e `voice_settings` do personagem.
- Google (reserva): `googleFallbackVoice` do personagem, uma por personagem, sem repetir e sem trocar por modo.
- Voz escolhida no painel, em perfil salvo ou na troca ao vivo nunca faz um personagem falar com a voz de outro:
  é ignorada (com log) e vale a voz fixa do personagem.

### 2.3. Tags de áudio (regra do dono)
- Lista fechada do dono (`audioTagsDono`), sempre entre colchetes e em inglês, de 1 a 3 por fala; nunca chaves `{ }`.
- Proibidas com o aluno (`forbiddenWithStudent`); `[shouts]`/`[yelling]` só comemorando junto de `[excited]`/`[enthusiastic]`.
- `formatSpeechForElevenLabs()` mantém só as tags permitidas e remove o resto; antes do Google, `stripAudioTags()` e
  `sanitizeCallText()` removem qualquer `[..]` (o stream do Chirp também remove).

### 2.4. Fluxo de Execução com Reserva por Cota

```text
PESSOA FALA → Meowcaller / app → STT → GPT Luna → TEXTO DA RESPOSTA
    ↓
call-tts-stream / audio-router (Contexto: CALL, personagem da ligação)
    ↓
[1º ELEVENLABS V4 TURBO] voz + padrão do personagem, tags do dono
    └── Créditos/minutos acabaram (HTTP 429/cota) ou falha?
            ↓ (chaveamento na hora, sem derrubar a ligação)
[2º RESERVA: GOOGLE CLOUD CHIRP 3 HD] voz fixa do personagem, texto sem tags
    ↓
PCM 16 kHz / MP3 → Meowcaller ou app → PESSOA ESCUTA
```

---

## 3. Garantias de Não-Regressão e Integridade

1. **Prioridade:** a ElevenLabs V4 Turbo fala primeiro; o Google só entra por cota/falha (circuit-breaker de 1 hora após 429).
2. **Cérebro preservado:** a GPT Luna rege o texto independentemente do sintetizador.
3. **Resiliência:** falha de voz não derruba a ligação (ElevenLabs → reserva Google Chirp 3 HD).
4. **Guardião:** `services/helena-gateway/test/eliving-voice-rules.test.mjs` barra voz legada, modelo antigo, voz por
   ambiente, tag inventada, voz repetida entre personagens e textos de perfil fora do tom do eLiving.
5. **Storage:** Cloudflare R2, mídias imutáveis e áudios de catálogo permanecem íntegros.
