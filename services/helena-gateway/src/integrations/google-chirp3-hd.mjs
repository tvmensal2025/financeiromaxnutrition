/**
 * google-chirp3-hd.mjs — Adapter Exclusivo de Voz para Ligações (CALL)
 * Integração com Google Cloud Text-to-Speech usando o modelo Chirp 3 HD em pt-BR.
 *
 * REGRAS ARQUITETURAIS RÍGIDAS:
 * 1. Exclusivo para LIGAÇÕES / TELEFONIA (contexto CALL).
 * 2. NUNCA utilizar em áudios fixos, variáveis, WhatsApp ou outros canais.
 * 3. Modelo: Chirp 3 HD (NÃO WaveNet, NÃO Standard, NÃO Neural2).
 * 4. Idioma: pt-BR.
 * 5. Voz padrão: pt-BR-Chirp3-HD-Achernar (Feminina brasileira de alta expressividade).
 * 6. Suporte a ADC, GOOGLE_APPLICATION_CREDENTIALS e projeto GCP sem expor segredos.
 */

import textToSpeech from '@google-cloud/text-to-speech';
import crypto from 'node:crypto';

// ======================================================================
// CONSTANTES & VOZES CHIRP 3 HD OFICIAIS (pt-BR)
// ======================================================================

export const PROVIDER_NAME = 'google_chirp3_hd';
export const DEFAULT_LANGUAGE = 'pt-BR';
export const DEFAULT_CHIRP3_HD_VOICE = 'pt-BR-Chirp3-HD-Achernar';

/**
 * Catálogo validado de vozes Chirp 3 HD disponíveis para português do Brasil (pt-BR).
 * Todas as vozes abaixo pertencem ao modelo generativo Chirp 3 HD.
 */
export const CHIRP3_HD_VOICES_PT_BR = Object.freeze({
  FEMALE: [
    { name: 'pt-BR-Chirp3-HD-Achernar', gender: 'FEMALE', isDefault: true, description: 'Feminina natural, expressiva e clara para telefonia (Soft)' },
    { name: 'pt-BR-Chirp3-HD-Algieba', gender: 'FEMALE', isDefault: false, description: 'Feminina calorosa e acolhedora (Warm)' },
    { name: 'pt-BR-Chirp3-HD-Aoede', gender: 'FEMALE', isDefault: false, description: 'Feminina suave e cordial (Breezy)' },
    { name: 'pt-BR-Chirp3-HD-Autonoe', gender: 'FEMALE', isDefault: false, description: 'Feminina dinâmica e profissional (Bright)' },
    { name: 'pt-BR-Chirp3-HD-Callirrhoe', gender: 'FEMALE', isDefault: false, description: 'Feminina firme e acolhedora (Lively)' },
    { name: 'pt-BR-Chirp3-HD-Despina', gender: 'FEMALE', isDefault: false, description: 'Feminina jovem e calorosa (Smooth)' },
    { name: 'pt-BR-Chirp3-HD-Dia', gender: 'FEMALE', isDefault: false, description: 'Feminina expressiva e clara' },
    { name: 'pt-BR-Chirp3-HD-Elara', gender: 'FEMALE', isDefault: false, description: 'Feminina nítida e confiante' },
    { name: 'pt-BR-Chirp3-HD-Erinome', gender: 'FEMALE', isDefault: false, description: 'Feminina corporativa e equilibrada (Clear)' },
    { name: 'pt-BR-Chirp3-HD-Eukelade', gender: 'FEMALE', isDefault: false, description: 'Feminina articulada e fluida' },
    { name: 'pt-BR-Chirp3-HD-Galatea', gender: 'FEMALE', isDefault: false, description: 'Feminina suave e atenciosa' },
    { name: 'pt-BR-Chirp3-HD-Harpalyke', gender: 'FEMALE', isDefault: false, description: 'Feminina confiante e serena' },
    { name: 'pt-BR-Chirp3-HD-Helike', gender: 'FEMALE', isDefault: false, description: 'Feminina calorosa e empática' },
    { name: 'pt-BR-Chirp3-HD-Hermippe', gender: 'FEMALE', isDefault: false, description: 'Feminina executiva e segura' },
    { name: 'pt-BR-Chirp3-HD-Himalia', gender: 'FEMALE', isDefault: false, description: 'Feminina dinâmica e moderna' },
    { name: 'pt-BR-Chirp3-HD-Kore', gender: 'FEMALE', isDefault: false, description: 'Feminina leve e conversacional (Gentle)' },
    { name: 'pt-BR-Chirp3-HD-Laomedeia', gender: 'FEMALE', isDefault: false, description: 'Feminina formal e articulada (Cheerful)' },
    { name: 'pt-BR-Chirp3-HD-Leda', gender: 'FEMALE', isDefault: false, description: 'Feminina calma e atenciosa (Melodic)' },
    { name: 'pt-BR-Chirp3-HD-Pulcherrima', gender: 'FEMALE', isDefault: false, description: 'Feminina persuasiva e elegante (Elegant)' },
    { name: 'pt-BR-Chirp3-HD-Sadachbia', gender: 'FEMALE', isDefault: false, description: 'Feminina serena e tranquila (Serene)' },
    { name: 'pt-BR-Chirp3-HD-Schedar', gender: 'FEMALE', isDefault: false, description: 'Feminina nítida e direta (Crisp)' },
    { name: 'pt-BR-Chirp3-HD-Sulafat', gender: 'FEMALE', isDefault: false, description: 'Feminina padrão atendimento comercial (Dynamic)' },
    { name: 'pt-BR-Chirp3-HD-Vindemiatrix', gender: 'FEMALE', isDefault: false, description: 'Feminina assertiva e segura (Warm)' }
  ],
  MALE: [
    { name: 'pt-BR-Chirp3-HD-Achird', gender: 'MALE', isDefault: false, description: 'Masculina natural e segura (Natural)' },
    { name: 'pt-BR-Chirp3-HD-Algenib', gender: 'MALE', isDefault: false, description: 'Masculina firme e corporativa (Firm)' },
    { name: 'pt-BR-Chirp3-HD-Alnilam', gender: 'MALE', isDefault: false, description: 'Masculina equilibrada e clara' },
    { name: 'pt-BR-Chirp3-HD-Charon', gender: 'MALE', isDefault: false, description: 'Masculina informativa e estruturada (Informative)' },
    { name: 'pt-BR-Chirp3-HD-Enceladus', gender: 'MALE', isDefault: false, description: 'Masculina próxima e amigável (Breathy)' },
    { name: 'pt-BR-Chirp3-HD-Fenrir', gender: 'MALE', isDefault: false, description: 'Masculina encorpada e profunda (Deep)' },
    { name: 'pt-BR-Chirp3-HD-Gacrux', gender: 'MALE', isDefault: false, description: 'Masculina calma e executiva (Calm)' },
    { name: 'pt-BR-Chirp3-HD-Iapetus', gender: 'MALE', isDefault: false, description: 'Masculina institucional e firme (Authoritative)' },
    { name: 'pt-BR-Chirp3-HD-Isonoe', gender: 'MALE', isDefault: false, description: 'Masculina grave e sóbria' },
    { name: 'pt-BR-Chirp3-HD-Kalyke', gender: 'MALE', isDefault: false, description: 'Masculina moderada e pontual' },
    { name: 'pt-BR-Chirp3-HD-Orus', gender: 'MALE', isDefault: false, description: 'Masculina direta e estável (Firm)' },
    { name: 'pt-BR-Chirp3-HD-Puck', gender: 'MALE', isDefault: false, description: 'Masculina jovem e ágil (Youthful)' },
    { name: 'pt-BR-Chirp3-HD-Rasalgethi', gender: 'MALE', isDefault: false, description: 'Masculina confiante e vibrante (Confident)' },
    { name: 'pt-BR-Chirp3-HD-Sadaltager', gender: 'MALE', isDefault: false, description: 'Masculina ressonante e clara (Resonant)' },
    { name: 'pt-BR-Chirp3-HD-Umbriel', gender: 'MALE', isDefault: false, description: 'Masculina sóbria e ponderada (Grounded)' },
    { name: 'pt-BR-Chirp3-HD-Zephyr', gender: 'MALE', isDefault: false, description: 'Masculina fluida e moderna (Gentle)' },
    { name: 'pt-BR-Chirp3-HD-Zubenelgenubi', gender: 'MALE', isDefault: false, description: 'Masculina séria e precisa (Serious)' }
  ]
});

// ======================================================================
// CLIENTE REUTILIZADO (SINGLETON SERVER-SIDE)
// ======================================================================

let cachedClient = null;

/**
 * Retorna a instância compartilhada do cliente Google Cloud Text-to-Speech.
 * Reutiliza a conexão TCP/gRPC e credenciais sem instanciar novo cliente por requisição.
 */
export function getGoogleTTSClient() {
  if (!cachedClient) {
    const options = {};

    // 1. Prioridade máxima: credencial Base64 do JSON da Service Account
    const b64 = process.env.GOOGLE_TTS_CREDENTIALS_B64;
    if (b64 && b64.trim().length > 0) {
      try {
        const rawJson = Buffer.from(b64.trim(), 'base64').toString('utf8');
        const credentials = JSON.parse(rawJson);
        options.credentials = credentials;
        if (credentials.project_id) {
          options.projectId = credentials.project_id;
        }
      } catch (err) {
        console.error('[GoogleChirp3HDCallTTS] Falha ao processar GOOGLE_TTS_CREDENTIALS_B64:', err.message);
        throw new Error('Falha ao decodificar GOOGLE_TTS_CREDENTIALS_B64');
      }
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      try {
        const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON.trim());
        options.credentials = credentials;
        if (credentials.project_id) {
          options.projectId = credentials.project_id;
        }
      } catch (err) {
        console.error('[GoogleChirp3HDCallTTS] Falha ao parsear GOOGLE_APPLICATION_CREDENTIALS_JSON:', err.message);
        throw new Error('Falha ao processar GOOGLE_APPLICATION_CREDENTIALS_JSON');
      }
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      options.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS.trim();
    }

    if (process.env.GOOGLE_CLOUD_PROJECT_ID && !options.projectId) {
      options.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID.trim();
    }

    cachedClient = new textToSpeech.TextToSpeechClient(options);
  }
  return cachedClient;
}

/**
 * Permite injetar um cliente mockado para testes unitários isolados
 */
export function setGoogleTTSClientForTesting(mockClient) {
  cachedClient = mockClient;
}

// ======================================================================
// MÉTRICAS, CONSUMO & ALERTAS DE FRANQUIA
// ======================================================================

function getMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const metricsState = {
  monthKey: getMonthKey(),
  totalCharacters: 0,
  totalRequests: 0,
  successCount: 0,
  errorCount: 0,
  totalLatencyMs: 0,
  warnAlertsSent: new Set()
};

function ensureCurrentMonth() {
  const current = getMonthKey();
  if (metricsState.monthKey !== current) {
    metricsState.monthKey = current;
    metricsState.totalCharacters = 0;
    metricsState.totalRequests = 0;
    metricsState.successCount = 0;
    metricsState.errorCount = 0;
    metricsState.totalLatencyMs = 0;
    metricsState.warnAlertsSent.clear();
  }
}

/**
 * Registra consumo de caracteres e latência, verificando limites de franquia
 */
function recordUsage({ characters, latencyMs, success, errorCode = null }) {
  ensureCurrentMonth();
  metricsState.totalRequests += 1;
  if (success) {
    metricsState.successCount += 1;
    metricsState.totalCharacters += characters;
    metricsState.totalLatencyMs += latencyMs;
  } else {
    metricsState.errorCount += 1;
  }

  // Verificação de franquia mensal configurável
  const softLimit = parseInt(process.env.GOOGLE_CALL_TTS_MONTHLY_SOFT_LIMIT || '900000', 10);
  const warnPercent = parseInt(process.env.GOOGLE_CALL_TTS_WARN_PERCENT || '80', 10);
  const stopPercent = parseInt(process.env.GOOGLE_CALL_TTS_STOP_PERCENT || '95', 10);

  if (softLimit > 0) {
    const currentPercent = (metricsState.totalCharacters / softLimit) * 100;

    if (currentPercent >= warnPercent && !metricsState.warnAlertsSent.has(warnPercent)) {
      metricsState.warnAlertsSent.add(warnPercent);
      console.warn(`[GOOGLE_CHIRP3_HD] ⚠️ ALERTA DE CONSUMO (80%): Atingido ${Math.round(currentPercent)}% (${metricsState.totalCharacters} caracteres) do limite suave mensal de ${softLimit}.`);
    }

    if (currentPercent >= 90 && !metricsState.warnAlertsSent.has(90)) {
      metricsState.warnAlertsSent.add(90);
      console.warn(`[GOOGLE_CHIRP3_HD] ⚠️ ALERTA ELEVADO (90%): Atingido ${Math.round(currentPercent)}% (${metricsState.totalCharacters} caracteres) do limite suave mensal de ${softLimit}.`);
    }

    if (currentPercent >= stopPercent && !metricsState.warnAlertsSent.has(stopPercent)) {
      metricsState.warnAlertsSent.add(stopPercent);
      console.warn(`[GOOGLE_CHIRP3_HD] 🚨 ALERTA CRÍTICO (95%): Atingido ${Math.round(currentPercent)}% (${metricsState.totalCharacters} caracteres) do limite suave mensal de ${softLimit}!`);
    }
  }
}

/**
 * Consulta métricas agregadas de uso do Chirp 3 HD
 */
export function getChirp3Metrics() {
  ensureCurrentMonth();
  const avgLatency = metricsState.successCount > 0
    ? Math.round(metricsState.totalLatencyMs / metricsState.successCount)
    : 0;

  return {
    month: metricsState.monthKey,
    totalCharacters: metricsState.totalCharacters,
    totalRequests: metricsState.totalRequests,
    successCount: metricsState.successCount,
    errorCount: metricsState.errorCount,
    averageLatencyMs: avgLatency,
    softLimit: parseInt(process.env.GOOGLE_CALL_TTS_MONTHLY_SOFT_LIMIT || '900000', 10)
  };
}

// ======================================================================
// CACHE ISOLADO PARA FRASES REPETIDAS EM LIGAÇÕES
// ======================================================================

const callAudioCache = new Map();
const MAX_CACHE_ENTRIES = 50;
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 horas

function getCacheKey({ voice, language, encoding, text }) {
  return crypto
    .createHash('sha256')
    .update(`${PROVIDER_NAME}:${voice}:${language}:${encoding}:${text.trim()}`)
    .digest('hex');
}

function getFromCache(key) {
  const item = callAudioCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    callAudioCache.delete(key);
    return null;
  }
  return item.data;
}

function saveToCache(key, data) {
  if (callAudioCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = callAudioCache.keys().next().value;
    if (oldestKey) callAudioCache.delete(oldestKey);
  }
  callAudioCache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS
  });
}

// ======================================================================
// CONFIGURAÇÃO & FEATURE FLAG
// ======================================================================

/**
 * Verifica se o Chirp 3 HD está ativo para chamadas.
 * Permite rollback imediato configurando GOOGLE_CALL_TTS_ENABLED=false
 * ou CALL_TTS_PROVIDER com outro valor.
 */
export function isGoogleChirp3CallEnabled() {
  if (process.env.GOOGLE_CALL_TTS_ENABLED === 'false') {
    return false;
  }
  const provider = (process.env.CALL_TTS_PROVIDER || 'google_chirp3_hd').trim().toLowerCase();
  return provider === 'google_chirp3_hd';
}

// ======================================================================
// CONFIGURAÇÃO DINÂMICA DE VOZ (SEM REDEPLOY)
// ======================================================================

let dynamicActiveVoice = null;
let previousActiveVoice = null;
let lastVoiceUpdateAudit = null;

/**
 * Retorna a voz ativa no momento (dinâmica ou env)
 */
export function getActiveCallVoice() {
  return dynamicActiveVoice || (process.env.GOOGLE_CALL_TTS_VOICE || DEFAULT_CHIRP3_HD_VOICE).trim();
}

/**
 * Define uma nova voz ativa para chamadas sem necessidade de redeploy
 */
export function setActiveCallVoice(newVoice, updatedBy = 'Admin') {
  if (!newVoice || typeof newVoice !== 'string') {
    throw new Error('Nome de voz inválido.');
  }
  const cleanVoice = newVoice.trim();
  const currentVoice = getActiveCallVoice();

  if (cleanVoice !== currentVoice) {
    previousActiveVoice = currentVoice;
  }

  dynamicActiveVoice = cleanVoice;
  lastVoiceUpdateAudit = {
    previous_voice: previousActiveVoice,
    new_voice: cleanVoice,
    updated_by: updatedBy,
    updated_at: new Date().toISOString()
  };

  console.log(`[GoogleChirp3HDCallTTS] 🔄 Voz de chamadas atualizada dinamicamente para '${cleanVoice}' por ${updatedBy}`);
  return {
    success: true,
    active_voice: cleanVoice,
    previous_voice: previousActiveVoice,
    audit: lastVoiceUpdateAudit
  };
}

/**
 * Retorna a voz anterior para suporte a restauração/rollback
 */
export function getPreviousCallVoice() {
  return previousActiveVoice;
}

/**
 * Restaura a voz anterior de chamadas
 */
export function restorePreviousCallVoice(updatedBy = 'Admin') {
  if (!previousActiveVoice) {
    throw new Error('Nenhuma voz anterior disponível para restauração.');
  }
  const targetVoice = previousActiveVoice;
  const currentVoice = getActiveCallVoice();

  dynamicActiveVoice = targetVoice;
  previousActiveVoice = currentVoice; // Inverte para permitir desfazer se necessário

  lastVoiceUpdateAudit = {
    previous_voice: currentVoice,
    new_voice: targetVoice,
    action: 'RESTORE',
    updated_by: updatedBy,
    updated_at: new Date().toISOString()
  };

  console.log(`[GoogleChirp3HDCallTTS] ↩️ Voz de chamadas restaurada para '${targetVoice}' por ${updatedBy}`);
  return {
    success: true,
    active_voice: targetVoice,
    previous_voice: previousActiveVoice,
    audit: lastVoiceUpdateAudit
  };
}

/**
 * Retorna a auditoria da última alteração de voz
 */
export function getLastVoiceAudit() {
  return lastVoiceUpdateAudit;
}

/**
 * Resolve o nome oficial da voz Chirp 3 HD
 */
export function resolveChirp3Voice(overrideVoice = null) {
  if (overrideVoice && typeof overrideVoice === 'string' && (overrideVoice.includes('Chirp3-HD') || overrideVoice.startsWith('custom-'))) {
    return overrideVoice.trim();
  }
  return getActiveCallVoice();
}

/**
 * Resolve o formato e codec de áudio apropriado para o pipeline de telefonia
 */
export function resolveAudioEncoding() {
  const encoding = (process.env.GOOGLE_CALL_TTS_ENCODING || 'LINEAR16').trim().toUpperCase();
  const configuredRate = Number(process.env.GOOGLE_CALL_TTS_SAMPLE_RATE || 16000);
  const sampleRate = [8000, 16000, 22050, 24000, 32000, 44100, 48000].includes(configuredRate) ? configuredRate : 16000;
  if (encoding !== 'MP3') {
    return {
      encodingParam: 'LINEAR16',
      format: 'wav',
      mimeType: 'audio/wav',
      sampleRate: sampleRate
    };
  }
  return {
    encodingParam: 'MP3',
    format: 'mp3',
    mimeType: 'audio/mpeg',
    sampleRate: sampleRate
  };
}

// ======================================================================
// DESCOBERTA DINÂMICA DE VOZES & PREVIEW SEGURO
// ======================================================================

let cachedDiscoveredVoices = null;
let lastVoicesFetchTime = 0;
const VOICES_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutos

/**
 * Lista as vozes pt-BR Chirp 3 HD disponíveis (com cache e descoberta via API do Google)
 */
export async function listAvailableChirp3Voices(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedDiscoveredVoices && (now - lastVoicesFetchTime < VOICES_CACHE_TTL_MS)) {
    return cachedDiscoveredVoices;
  }

  try {
    const client = getGoogleTTSClient();
    if (client && typeof client.listVoices === 'function') {
      const [response] = await client.listVoices({ languageCode: 'pt-BR' });
      if (response && Array.isArray(response.voices)) {
        const chirp3Voices = response.voices.filter(v =>
          v.name && v.name.includes('Chirp3-HD') &&
          Array.isArray(v.languageCodes) && v.languageCodes.includes('pt-BR')
        );

        if (chirp3Voices.length > 0) {
          const formatted = chirp3Voices.map(v => {
            const isFemale = v.ssmlGender === 'FEMALE';
            return {
              name: v.name,
              gender: v.ssmlGender || (isFemale ? 'FEMALE' : 'MALE'),
              naturalSampleRateHertz: v.naturalSampleRateHertz || 24000,
              isDefault: v.name === DEFAULT_CHIRP3_HD_VOICE,
              description: isFemale ? 'Feminina oficial Google Chirp 3 HD' : 'Masculina oficial Google Chirp 3 HD'
            };
          });

          cachedDiscoveredVoices = {
            source: 'GOOGLE_API_DYNAMIC',
            language: 'pt-BR',
            model: 'Chirp 3 HD',
            total: formatted.length,
            voices: formatted,
            fetchedAt: new Date().toISOString()
          };
          lastVoicesFetchTime = now;
          return cachedDiscoveredVoices;
        }
      }
    }
  } catch (err) {
    console.warn('[GoogleChirp3HDCallTTS] Consulta dinâmica de vozes falhou ou não autorizada. Utilizando catálogo pré-validado:', err.message);
  }

  // Fallback seguro: catálogo oficial validado
  const allStatic = [
    ...CHIRP3_HD_VOICES_PT_BR.FEMALE,
    ...CHIRP3_HD_VOICES_PT_BR.MALE
  ];

  cachedDiscoveredVoices = {
    source: 'OFFICIAL_CATALOG',
    language: 'pt-BR',
    model: 'Chirp 3 HD',
    total: allStatic.length,
    voices: allStatic,
    fetchedAt: new Date().toISOString()
  };
  lastVoicesFetchTime = now;
  return cachedDiscoveredVoices;
}

/**
 * Gera uma prévia de voz no navegador de forma totalmente isolada.
 * NÃO inicia chamada telefônica. NÃO envia nada ao Meowcaller.
 */
export async function previewGoogleCallVoice({ text, voice = null } = {}) {
  const cleanText = sanitizeCallText(text || 'Olá, tudo bem? Como posso ajudar você hoje?');
  if (!cleanText) {
    throw new Error('Texto para teste não pode ser vazio.');
  }

  const voiceName = resolveChirp3Voice(voice);
  const languageCode = (process.env.GOOGLE_CALL_TTS_LANGUAGE || DEFAULT_LANGUAGE).trim();
  const { encodingParam, format, sampleRate } = resolveAudioEncoding();

  const request = {
    input: { text: cleanText },
    voice: {
      languageCode,
      name: voiceName
    },
    audioConfig: {
      audioEncoding: encodingParam,
      sampleRateHertz: sampleRate
    }
  };

  const startTime = performance.now();
  const client = getGoogleTTSClient();

  const timeoutMs = 8000;
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Timeout na prévia de voz Chirp 3 HD (${timeoutMs}ms)`)), timeoutMs);
  });

  const [response] = await Promise.race([client.synthesizeSpeech(request), timeoutPromise]);
  const latencyMs = Math.round(performance.now() - startTime);

  if (!response || !response.audioContent) {
    throw new Error('Google Cloud TTS não retornou conteúdo de áudio para a prévia.');
  }

  const audioBuffer = Buffer.isBuffer(response.audioContent)
    ? response.audioContent
    : Buffer.from(response.audioContent);

  return {
    ok: true,
    provider: PROVIDER_NAME,
    voice: voiceName,
    language: languageCode,
    codec: `${encodingParam} (${sampleRate}Hz)`,
    format,
    audio_base64: audioBuffer.toString('base64'),
    size_bytes: audioBuffer.length,
    character_count: cleanText.length,
    latency_ms: latencyMs
  };
}

/**
 * Checa a disponibilidade do recurso Google Chirp 3 Instant Custom Voice
 */
export async function checkInstantCustomVoiceAvailability() {
  // Conforme diretriz: Se o projeto não possuir permissão/allowlist aprovada,
  // reporta 'ACCESS_REQUIRED' sem quebrar o sistema.
  const customVoiceEnvEnabled = process.env.GOOGLE_CHIRP3_CUSTOM_VOICE_ENABLED === 'true';

  if (!customVoiceEnvEnabled) {
    return {
      available: false,
      status: 'ACCESS_REQUIRED',
      feature: 'Chirp 3 Instant Custom Voice',
      provider: PROVIDER_NAME,
      message: 'Instant Custom Voice ainda não está habilitado neste projeto Google Cloud. O recurso requer solicitação de permissão à equipe do Google Cloud.',
      requirements: [
        'Aprovação na allowlist oficial do Google Cloud para Instant Custom Voice',
        'Gravação de consentimento vocal do locutor original (áudio limpo, canal único, até 10 segundos)',
        'Gravação de referência de até 10 segundos (preferencialmente próximo de 10s), canal único, sem ruído de fundo (WAV/MP3 24kHz+)'
      ]
    };
  }

  return {
    available: true,
    status: 'AVAILABLE',
    feature: 'Chirp 3 Instant Custom Voice',
    provider: PROVIDER_NAME,
    message: 'Instant Custom Voice habilitado e disponível para o projeto.'
  };
}

// ======================================================================
// ADAPTER EXCLUSIVO: GoogleChirp3HDCallTTS
// ======================================================================

/**
 * Sanitiza o texto de entrada para fala telefônica limpa
 */
export function sanitizeCallText(rawText) {
  if (typeof rawText !== 'string') return '';
  return rawText
    .replace(/[*#_~`]/g, '') // remove marcações markdown
    .replace(/https?:\/\/\S+/g, '') // remove URLs brutas
    .replace(/[\r\n]+/g, ' ') // achata quebras de linha
    .replace(/\s{2,}/g, ' ') // normaliza espaços múltiplos
    .trim();
}

/**
 * GoogleChirp3HDCallTTS
 * Adapter estritamente isolado para síntese de áudio em chamadas VoIP/Telefonia.
 */
export const GoogleChirp3HDCallTTS = {
  provider: PROVIDER_NAME,

  /**
   * Sintetiza áudio de chamada via Google Cloud Chirp 3 HD em pt-BR.
   *
   * @param {Object} params
   * @param {string} params.text Texto a ser falado na ligação
   * @param {string} [params.callId] Identificador da chamada ativa
   * @param {string} [params.context] Contexto de áudio (OBRIGATÓRIO: 'CALL')
   * @param {string} [params.voice] Override opcional de voz Chirp 3 HD
   * @returns {Promise<{
   *   audio: Buffer,
   *   provider: 'google_chirp3_hd',
   *   voice: string,
   *   language: 'pt-BR',
   *   encoding: string,
   *   sampleRate: number,
   *   characterCount: number,
   *   latencyMs: number,
   *   format: 'mp3' | 'wav',
   *   callId?: string
   * }>}
   */
  async synthesizeCallSpeech({ text, callId = '', context = 'CALL', voice = null } = {}) {
    // 1. ISOLAMENTO OBRIGATÓRIO: Guarda estrita de contexto
    if (context !== 'CALL') {
      throw new Error(`[GoogleChirp3HDCallTTS] ACESSO NEGADO: Este sintetizador é restrito ao contexto 'CALL'. Contexto recebido: '${context}'.`);
    }

    const cleanText = sanitizeCallText(text);
    if (!cleanText) {
      throw new Error('[GoogleChirp3HDCallTTS] Texto de entrada não pode ser vazio.');
    }
    if (cleanText.length > 2000) {
      throw new Error(`[GoogleChirp3HDCallTTS] Texto longo demais para turno de ligação (${cleanText.length} caracteres, máx 2000).`);
    }

    const voiceName = resolveChirp3Voice(voice);
    const languageCode = (process.env.GOOGLE_CALL_TTS_LANGUAGE || DEFAULT_LANGUAGE).trim();
    const { encodingParam, format, sampleRate } = resolveAudioEncoding();
    const timeoutMs = parseInt(process.env.GOOGLE_CALL_TTS_TIMEOUT_MS || '5000', 10);

    // 2. Consulta de cache isolado em memória
    const cacheKey = getCacheKey({ voice: voiceName, language: languageCode, encoding: `${encodingParam}:${sampleRate}`, text: cleanText });
    const cachedAudio = getFromCache(cacheKey);
    if (cachedAudio) {
      return {
        audio: cachedAudio,
        buffer: cachedAudio, // Alias para compatibilidade canônica interna
        provider: PROVIDER_NAME,
        voice: voiceName,
        language: DEFAULT_LANGUAGE,
        encoding: encodingParam,
        sampleRate,
        characterCount: cleanText.length,
        latencyMs: 0,
        format,
        cached: true,
        callId
      };
    }

    // 3. Montagem da requisição com parâmetros nativos do Chirp 3 HD
    // IMPORTANTE: Chirp 3 HD requer texto puro (input: { text }), não SSML ou audioConfig legados do WaveNet.
    const request = {
      input: {
        text: cleanText
      },
      voice: {
        languageCode,
        name: voiceName
      },
      audioConfig: {
        audioEncoding: encodingParam,
        sampleRateHertz: sampleRate
      }
    };

    const startTime = performance.now();
    const client = getGoogleTTSClient();

    try {
      // Timeout seguro de chamada para não travar a linha telefônica
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Timeout na síntese Google Cloud Chirp 3 HD após ${timeoutMs}ms`)), timeoutMs);
      });

      const callPromise = client.synthesizeSpeech(request);
      const [response] = await Promise.race([callPromise, timeoutPromise]);

      const latencyMs = Math.round(performance.now() - startTime);

      if (!response || !response.audioContent) {
        throw new Error('Google Cloud TTS não retornou conteúdo de áudio.');
      }

      const audioBuffer = Buffer.isBuffer(response.audioContent)
        ? response.audioContent
        : Buffer.from(response.audioContent);

      if (audioBuffer.length === 0) {
        throw new Error('Conteúdo de áudio retornado pelo Google Cloud TTS está vazio.');
      }

      // Registra telemetria e atualiza cache isolado
      recordUsage({ characters: cleanText.length, latencyMs, success: true });
      saveToCache(cacheKey, audioBuffer);

      console.log(`[GoogleChirp3HDCallTTS] ⚡ Áudio gerado com sucesso via ${voiceName} (${encodingParam}, ${audioBuffer.length} bytes, ${latencyMs}ms) para chamada ${callId || 'N/A'}`);

      return {
        audio: audioBuffer,
        buffer: audioBuffer, // Alias para compatibilidade canônica interna
        provider: PROVIDER_NAME,
        voice: voiceName,
        language: DEFAULT_LANGUAGE,
        encoding: encodingParam,
        sampleRate,
        characterCount: cleanText.length,
        latencyMs,
        format,
        cached: false,
        callId
      };
    } catch (err) {
      const latencyMs = Math.round(performance.now() - startTime);
      recordUsage({ characters: cleanText.length, latencyMs, success: false, errorCode: err.code || err.name });
      console.error(`[GoogleChirp3HDCallTTS] ❌ Falha ao sintetizar voz Chirp 3 HD na chamada ${callId || 'N/A'}:`, err.message);
      throw err;
    }
  }
};

/**
 * Função autônoma de conveniência para sintetizar fala exclusiva para chamadas
 */
export async function synthesizeCallSpeech(params) {
  return GoogleChirp3HDCallTTS.synthesizeCallSpeech(params);
}

