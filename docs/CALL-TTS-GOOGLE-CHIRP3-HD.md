# Integração Exclusiva: Google Cloud Text-to-Speech Chirp 3 HD para Ligações (CALL)

## 1. Objetivo
Implementar de forma cirúrgica e isolada o motor neural de voz **Google Cloud Text-to-Speech Chirp 3 HD** em português do Brasil (`pt-BR`) **exclusivamente para a síntese de áudio durante ligações telefônicas (VoIP / WhatsApp Telefonia)**.

O objetivo não é substituir o ecossistema existente de áudio, mas sim adicionar um sintetizador de voz generativa de ultra-alta fidelidade para a conversação bidirecional durante chamadas.

---

## 2. Escopo e Diretiva de Isolamento (Regra Inegociável)

A arquitetura de roteamento de áudio opera estritamente segmentada por contexto:

```text
LIGAÇÃO / CALL / TELEFONIA
        ↓
Google Cloud Text-to-Speech
        ↓
Chirp 3 HD
        ↓
pt-BR (Voz Feminina Oficial)
        ↓
MP3 / WAV (adequado ao pipeline de telefonia)
        ↓
Meowcaller / WhatsApp VoIP
```

Todo o restante do sistema permanece 100% inalterado:

```text
CALL
→ Google Chirp 3 HD (google_chirp3_hd)

VARIABLE (amostras dinâmicas / prévias)
→ ElevenLabs Flash v2.5 / comportamento atual

FIXED (catálogo e áudios gravados no Storage / R2)
→ Áudio atual preservado / comportamento atual

KOKORO (motor neural open-source)
→ Preservado, configurado e disponível como fallback e servidor VPS

OTHER
→ Comportamento existente
```

Nenhum áudio gravado, catálogo de voz ou configuração de outros provedores foi modificado ou excluído.

---

## 3. Arquitetura da Solução

### 3.1. Componentes Criados e Integrados

1. **Adapter Exclusivo (`GoogleChirp3HDCallTTS`):**
   - Arquivo: `services/helena-gateway/src/integrations/google-chirp3-hd.mjs`
   - Provider interno: `google_chirp3_hd`
   - Função principal: `synthesizeCallSpeech({ text, callId, context, voice })`
   - Guarda de isolamento: Exige `context === 'CALL'`, rejeitando com erro qualquer tentativa indevida vinda de contextos como `VARIABLE` ou `FIXED`.

2. **Roteador Canônico de Contexto (`audio-router.mjs`):**
   - Arquivo: `services/helena-gateway/src/integrations/audio-router.mjs`
   - Função: `routeCallAudio({ text, callId, voice, legacyCallSynthesizer })`
   - Roteia o áudio para o Google Chirp 3 HD quando habilitado e provê reversão imediata (*fallback* ou *rollback*) para o motor legado de chamada (ElevenLabs/Kokoro) sem interrupção do serviço.

3. **Ponto de Injeção no Atendente Telefônico (`voice-agent.mjs`):**
   - Função: `speakInCall({ callId, text, voice })`
   - Consome `routeCallAudio` e envia o buffer final codificado ao endpoint `/v1/calls/{id}/play` do `meowcaller-service`.

---

## 4. Provedor, Modelo e Catálogo de Vozes

- **Provedor:** `Google Cloud Text-to-Speech`
- **Nome interno:** `google_chirp3_hd`
- **Modelo:** `Chirp 3 HD`
- **Idioma:** `pt-BR`
- **Voz Padrão:** `pt-BR-Chirp3-HD-Achernar` (Voz feminina oficial com entonação coloquial, expressiva e alta clareza telefônica).

### Catálogo Completo de Vozes pt-BR Chirp 3 HD Suportadas:

| Nome da Voz | Gênero | Descrição / Aplicação Recomendada |
| :--- | :--- | :--- |
| `pt-BR-Chirp3-HD-Achernar` | Feminina (Padrão) | Natural, expressiva, coloquial e alta clareza para telefonia |
| `pt-BR-Chirp3-HD-Aoede` | Feminina | Tom suave, calmo e acolhedor |
| `pt-BR-Chirp3-HD-Autonoe` | Feminina | Dinâmica, ágil e comercial |
| `pt-BR-Chirp3-HD-Callirrhoe` | Feminina | Firme, segura e prestativa |
| `pt-BR-Chirp3-HD-Despina` | Feminina | Jovem, moderna e calorosa |
| `pt-BR-Chirp3-HD-Erinome` | Feminina | Corporativa e equilibrada |
| `pt-BR-Chirp3-HD-Gacrux` | Feminina | Executiva e institucional |
| `pt-BR-Chirp3-HD-Kore` | Feminina | Leve, amigável e conversacional |
| `pt-BR-Chirp3-HD-Laomedeia` | Feminina | Formal e articulada |
| `pt-BR-Chirp3-HD-Leda` | Feminina | Tranquila e atenciosa |
| `pt-BR-Chirp3-HD-Pulcherrima` | Feminina | Persuasiva |
| `pt-BR-Chirp3-HD-Sulafat` | Feminina | Padrão clássico de SAC |
| `pt-BR-Chirp3-HD-Vindemiatrix` | Feminina | Assertiva e direta |
| `pt-BR-Chirp3-HD-Zephyr` | Feminina | Fluida e descontraída |
| `pt-BR-Chirp3-HD-Achird` | Masculina | Tom natural e seguro |
| `pt-BR-Chirp3-HD-Algenib` | Masculina | Firme e corporativo |

A troca de voz é 100% dinâmica via variável de ambiente `GOOGLE_CALL_TTS_VOICE`, sem necessidade de refatoração ou alteração em código.

---

## 5. Codec, Taxa de Amostragem e Pipeline Telefônico

- **Formatos Suportados:**
  - `MP3` (`audio/mpeg`): Formato padrão e ultra-leve para envio em Base64 via HTTP REST ao Meowcaller.
  - `LINEAR16` (`audio/wav`): Áudio descompactado em PCM 16-bit com cabeçalho RIFF/WAV para máxima fidelidade.
- **Taxa de Amostragem Padrão:** `24000 Hz` (ou `16000 Hz`).
- **Compatibilidade com o Meowcaller:**
  O `meowcaller-service` recebe o payload `{ audio_base64, format: "mp3"|"wav" }` em `/v1/calls/{id}/play` e decodifica diretamente para os buffers de reprodução do WhatsApp VoIP, eliminando etapas desnecessárias de transcodificação.

---

## 6. Autenticação e Segurança

- Todas as chamadas ao Google Cloud ocorrem **exclusivamente no backend** (`helena-gateway`).
- Nenhuma chave de API ou credencial JSON é exposta ao frontend, navegador ou logs.
- Suporta nativamente:
  1. **Credencial Base64 em memória (`GOOGLE_TTS_CREDENTIALS_B64`):** Método prioritário e recomendado, permitindo configurar a Service Account diretamente no EasyPanel / Secret Manager sem criar arquivos em disco ou commitar JSONs.
  2. **Application Default Credentials (ADC)** padrão do GCP / Workload Identity.
  3. **Arquivo de credenciais** via `GOOGLE_APPLICATION_CREDENTIALS`.
  4. `GOOGLE_CLOUD_PROJECT_ID`.
- Reutilização de instância singleton do `TextToSpeechClient` para evitar overhead de reconexão TCP/TLS a cada frase.

### Rotação de Credenciais Segura:
1. Gere uma nova Service Account Key no Google Cloud Console com a role mínima `roles/texttospeech.client`.
2. Converta o JSON localmente em Base64 (ex: `base64 -w 0 key.json` ou script em memória).
3. Atualize o Secret `GOOGLE_TTS_CREDENTIALS_B64` no painel de controle do serviço (EasyPanel).
4. Reinicie o container para carregar a nova chave em memória.
5. Verifique `/api/integrations/google-chirp3-hd/status`.
6. Revogue e delete a chave antiga no Google Cloud Console.

---

## 7. Variáveis de Ambiente Criadas

Configurações exclusivas para o contexto CALL inseridas no `.env.example`:

```env
# ============================================
# GOOGLE CHIRP 3 HD — SOMENTE LIGAÇÕES (CALL)
# ============================================
CALL_TTS_PROVIDER=google_chirp3_hd
GOOGLE_CALL_TTS_ENABLED=true
GOOGLE_TTS_CREDENTIALS_B64=
GOOGLE_CLOUD_PROJECT_ID=
# Opcional se usar Application Default Credentials (ADC); caminho no servidor se usar arquivo JSON:
GOOGLE_APPLICATION_CREDENTIALS=
GOOGLE_CALL_TTS_LANGUAGE=pt-BR
GOOGLE_CALL_TTS_VOICE=pt-BR-Chirp3-HD-Achernar
GOOGLE_CALL_TTS_ENCODING=MP3
GOOGLE_CALL_TTS_SAMPLE_RATE=24000
GOOGLE_CALL_TTS_TIMEOUT_MS=5000
GOOGLE_CALL_TTS_MONTHLY_SOFT_LIMIT=900000
GOOGLE_CALL_TTS_WARN_PERCENT=80
GOOGLE_CALL_TTS_STOP_PERCENT=95
GOOGLE_CALL_TTS_FALLBACK=none
```

---

## 8. Telemetria, Alertas e Controle de Franquia

O módulo inclui monitoramento integrado em memória:
- `totalCharacters`: Contagem exata de caracteres enviados ao Chirp 3 HD no mês.
- `totalRequests`: Total de frases solicitadas.
- `successCount` e `errorCount`: Taxa de sucesso.
- `averageLatencyMs`: Latência média de resposta.
- **Alertas Proativos:**
  - Alerta de atenção emitido no console ao atingir **80%** da franquia mensal configurada.
  - Alerta de atenção elevado emitido no console ao atingir **90%** da franquia mensal.
  - Alerta crítico emitido ao atingir **95%** da franquia mensal configurada.

Consulta pública via endpoint seguro do Gateway:
`GET /api/integrations/google-chirp3-hd/status`

---

## 9. Feature Flag e Mecanismo de Rollback Imediato

Para desativar o Google Chirp 3 HD e retornar imediatamente ao comportamento anterior da chamada (ElevenLabs Flash / Kokoro):

```env
GOOGLE_CALL_TTS_ENABLED=false
```

ou:

```env
CALL_TTS_PROVIDER=legacy
```

O rollback é imediato, não requer alteração de banco de dados nem reimplantação de arquivos de mídia.

---

## 10. Validação e Testes Automatizados

A suíte em `services/helena-gateway/test/google-chirp3-hd.test.mjs` valida 14 requisitos obrigatórios:
1. **TESTE A:** CALL aciona Google Chirp 3 HD exclusivamente.
2. **TESTE B:** VARIABLE aciona ElevenLabs; Google não é chamado.
3. **TESTE C:** FIXED carrega áudio existente; Google não é chamado.
4. **TESTE D:** Kokoro permanece 100% íntegro e disponível.
5. **TESTE E:** ElevenLabs permanece 100% íntegro e disponível.
6. **TESTE F:** Rollback imediato via `GOOGLE_CALL_TTS_ENABLED=false`.
7. **TESTE G:** Tratamento controlado de erros (429, timeout, quota).
8. **TESTE H:** Compatibilidade com codecs MP3 e LINEAR16/WAV.
9. **TESTE I:** Bloqueio e rejeição estrita de contextos fora de CALL.
10. **TESTE J:** Suporte e resolução de múltiplas vozes Chirp 3 HD.
11. **TESTE K:** Processamento das 10 frases telefônicas oficiais em pt-BR.
12. **TESTE L:** Rastreamento de métricas e limites de franquia.
13. **TESTE M:** Inicialização segura com credenciais Base64 (`GOOGLE_TTS_CREDENTIALS_B64`).
14. **TESTE N:** Função autônoma `synthesizeCallSpeech()` e alias canônico `buffer`.
