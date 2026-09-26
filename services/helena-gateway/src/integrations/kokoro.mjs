/**
 * Integrations / Kokoro Client (Open-Source Neural TTS)
 * Cliente para sintetização de voz na VPS via Kokoro Web (FastAPI / OpenAI-compatible API)
 * Instância VPS: https://helena-automation-kokoro.d9v63q.easypanel.host/
 */

const KOKORO_BASE_URL = (
  process.env.KOKORO_BASE_URL ||
  'https://helena-automation-kokoro.d9v63q.easypanel.host'
).replace(/\/$/, '');

const KW_SECRET_API_KEY =
  process.env.KW_SECRET_API_KEY ||
  process.env.KOKORO_API_KEY ||
  'qjuo4ld0exr5bkexo3cczbbcoanvrzu4';

const KOKORO_DEFAULT_MODEL = process.env.KOKORO_MODEL || 'model';

export const KOKORO_OFFICIAL_VOICE_ID = 'pm_alex*0.7+am_liam*0.3';
export const KOKORO_DEFAULT_PROFILE_ID = 'VP-KOKORO-MASC-03';

export const KOKORO_VOICES = {
  PT_BR: [
    { voice_id: 'pm_alex*0.7+am_liam*0.3', profile_id: 'VP-KOKORO-MASC-03', name: 'Pedro (Oficial - Homem Jovem Dinâmico / Parcerias)', gender: 'male', lang: 'pt-BR', is_official: true, is_default: true, agent_id: 'AGT-18' },
    { voice_id: 'pm_santa', profile_id: 'VP-KOKORO-MASC-01', name: 'Assistente do Dr. Vital (Homem - Padrão Maduro)', gender: 'male', lang: 'pt-BR', is_official: false, is_default: false },
    { voice_id: 'pf_dora*0.7+af_heart*0.3', profile_id: 'VP-KOKORO-FEM-01', name: 'Assistente da Sirlene (Mulher - Padrão Vital)', gender: 'female', lang: 'pt-BR', is_official: false, is_default: false },
    { voice_id: 'pm_santa*0.7+pm_alex*0.3', profile_id: 'VP-KOKORO-MASC-02', name: 'Alex (Assistente Executivo - Central de Suporte)', gender: 'male', lang: 'pt-BR', is_official: false, is_default: false },
    { voice_id: 'pm_alex', name: 'Alex / Pedro (Homem Jovem - Português Nativo)', gender: 'male', lang: 'pt-BR', is_official: false, is_default: false },
    { voice_id: 'pf_dora', name: 'Dora (Mulher - Português Padrão)', gender: 'female', lang: 'pt-BR', is_official: false, is_default: false }
  ],

  EN: [
    { voice_id: 'af_heart', name: 'Heart (Female - US)', gender: 'female', lang: 'en-US' },
    { voice_id: 'af_bella', name: 'Bella (Female - US)', gender: 'female', lang: 'en-US' },
    { voice_id: 'am_michael', name: 'Michael (Male - US)', gender: 'male', lang: 'en-US' },
    { voice_id: 'am_adam', name: 'Adam (Male - US)', gender: 'male', lang: 'en-US' },
    { voice_id: 'bm_george', name: 'George (Male - UK)', gender: 'male', lang: 'en-GB' },
    { voice_id: 'bm_daniel', name: 'Daniel (Male - UK)', gender: 'male', lang: 'en-GB' }
  ]
};

export function isKokoroConfigured() {
  return Boolean(KOKORO_BASE_URL && KW_SECRET_API_KEY);
}

function getHeaders() {
  if (!KW_SECRET_API_KEY) {
    throw new Error('KW_SECRET_API_KEY não configurada no servidor');
  }
  return {
    'Authorization': `Bearer ${KW_SECRET_API_KEY}`,
    'Content-Type': 'application/json',
    'Accept': 'audio/mpeg, application/json'
  };
}

/**
 * Retorna vozes suportadas e status da conexão com a VPS
 */
export async function getKokoroVoices() {
  const configured = isKokoroConfigured();
  return {
    configured,
    is_official_engine: true,
    provider: 'KOKORO',
    baseUrl: KOKORO_BASE_URL,
    default_model: KOKORO_DEFAULT_MODEL,
    default_voice_id: KOKORO_OFFICIAL_VOICE_ID,
    default_profile_id: KOKORO_DEFAULT_PROFILE_ID,
    official_voice: KOKORO_VOICES.PT_BR[0],
    voices_pt_br: KOKORO_VOICES.PT_BR,
    voices_en: KOKORO_VOICES.EN
  };
}

/**
 * Gera áudio MP3 a partir de texto via Kokoro TTS
 * @param {Object} params
 * @param {string} params.input Texto a ser sintetizado
 * @param {string} [params.voice] ID da voz (default: voz oficial Pedro 'pm_alex*0.7+am_liam*0.3')
 * @param {string} [params.model] Modelo (default: 'model')
 * @returns {Promise<{ buffer: Buffer, durationMs: number, sizeBytes: number }>}
 */
export async function generateKokoroSpeech({ input, voice = KOKORO_OFFICIAL_VOICE_ID, model = KOKORO_DEFAULT_MODEL }) {
  if (!isKokoroConfigured()) {
    throw new Error('Serviço Kokoro não está configurado');
  }
  if (!input || !input.trim()) {
    throw new Error('Texto de entrada (input) é obrigatório');
  }

  const startTime = performance.now();
  const endpoint = `${KOKORO_BASE_URL}/api/v1/audio/speech`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      model,
      input: input.trim(),
      voice
    })
  });

  const durationMs = Math.round(performance.now() - startTime);

  if (!res.ok) {
    const errText = await res.text().catch(() => 'Erro desconhecido');
    throw new Error(`Falha no Kokoro TTS [${res.status}]: ${errText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return {
    buffer,
    durationMs,
    sizeBytes: buffer.length,
    mimeType: 'audio/mpeg',
    voice,
    model
  };
}

export const synthesizeKokoroSpeech = generateKokoroSpeech;

export async function generateKokoroSample(voiceIdOrOptions, maybeText) {
  let voiceId = KOKORO_OFFICIAL_VOICE_ID;
  let text = 'Olá! Este é um teste de voz neural.';

  if (typeof voiceIdOrOptions === 'object' && voiceIdOrOptions !== null) {
    voiceId = voiceIdOrOptions.voice || voiceIdOrOptions.voice_id || voiceIdOrOptions.voiceId || KOKORO_OFFICIAL_VOICE_ID;
    text = voiceIdOrOptions.text || voiceIdOrOptions.input || text;
  } else if (typeof voiceIdOrOptions === 'string') {
    voiceId = voiceIdOrOptions;
    if (typeof maybeText === 'string') {
      text = maybeText;
    }
  }

  const result = await generateKokoroSpeech({
    voice: voiceId,
    input: text
  });

  const base64 = result.buffer.toString('base64');
  return {
    voice_id: voiceId,
    mime_type: 'audio/mpeg',
    audio_base64: `data:audio/mpeg;base64,${base64}`,
    audio_url: `data:audio/mpeg;base64,${base64}`,
    duration_ms: result.durationMs,
    size_bytes: result.sizeBytes
  };
}
