/**
 * Integrations / ElevenLabs Client
 * Cliente seguro para listagem de vozes, agentes, signed URLs e teste de TTS
 * REGRA ABSOLUTA: A chave ELEVENLABS_API_KEY NUNCA é enviada ao navegador.
 */

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_LABS_API_KEY || '';
const ELEVENLABS_DEFAULT_AGENT_ID = process.env.ELEVENLABS_DEFAULT_AGENT_ID || process.env.ELEVENLABS_AGENT_ID || '';
const ELEVENLABS_DEFAULT_VOICE_ID = process.env.ELEVENLABS_DEFAULT_VOICE_ID || process.env.ELEVENLABS_VOICE_ID || '';

export function getElevenLabsApiKey() {
  return (process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_LABS_API_KEY || '').trim();
}

export function isElevenLabsConfigured() {
  return Boolean(getElevenLabsApiKey());
}

function getHeaders() {
  const key = getElevenLabsApiKey();
  if (!key) {
    throw new Error('ELEVENLABS_API_KEY não configurada no servidor');
  }
  return {
    'xi-api-key': key,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
}

/**
 * Consulta a lista de vozes disponíveis na conta ElevenLabs
 * Retorna exclusivamente dados sanitizados e seguros.
 */
export async function getElevenLabsVoices() {
  if (!isElevenLabsConfigured()) {
    return {
      configured: false,
      voices: [],
      message: 'ELEVENLABS_API_KEY não configurada no ambiente'
    };
  }

  try {
    const res = await fetch('https://api.elevenlabs.io/v1/voices', {
      method: 'GET',
      headers: getHeaders()
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Erro ao listar vozes');
      return {
        configured: true,
        reachable: false,
        error: `Erro ElevenLabs [${res.status}]: ${errText}`,
        voices: []
      };
    }

    const data = await res.json();
    const rawVoices = data.voices || [];

    // Sanitiza para garantir que NENHUM dado confidencial vaze
    const voices = rawVoices.map((v) => ({
      voice_id: v.voice_id,
      name: v.name,
      category: v.category || 'generated',
      description: v.description || '',
      preview_url: v.preview_url || null,
      labels: v.labels || {},
      verified_languages: v.verified_languages || [],
      high_quality_base_model_ids: v.high_quality_base_model_ids || []
    }));

    return {
      configured: true,
      reachable: true,
      voices_count: voices.length,
      default_agent_id: ELEVENLABS_DEFAULT_AGENT_ID || null,
      default_voice_id: ELEVENLABS_DEFAULT_VOICE_ID || null,
      voices
    };
  } catch (err) {
    return {
      configured: true,
      reachable: false,
      error: err.message,
      voices: []
    };
  }
}

/**
 * Consulta os agentes de conversação (Conversational AI Agents) configurados na conta
 */
export async function getElevenLabsAgents() {
  if (!isElevenLabsConfigured()) {
    return [];
  }

  try {
    const res = await fetch('https://api.elevenlabs.io/v1/convai/agents', {
      method: 'GET',
      headers: getHeaders()
    });

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    const agents = data.agents || [];

    return agents.map((a) => ({
      agent_id: a.agent_id,
      name: a.name,
      conversation_config: a.conversation_config || {}
    }));
  } catch {
    return [];
  }
}

/**
 * Gera uma Signed URL temporária oficial da ElevenLabs para abrir WebSocket
 * seguro de conversação em tempo real (Conversational AI).
 * Não expõe a chave nem credenciais de longa duração.
 */
export async function getSignedConversationUrl(agentId = null) {
  if (!isElevenLabsConfigured()) {
    throw new Error('ELEVENLABS_API_KEY não configurada no servidor');
  }

  const targetAgentId = agentId || ELEVENLABS_DEFAULT_AGENT_ID;
  if (!targetAgentId) {
    throw new Error('Agent ID é obrigatório para gerar Signed URL (defina ELEVENLABS_DEFAULT_AGENT_ID ou envie no parâmetro)');
  }

  const url = `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${encodeURIComponent(targetAgentId)}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: getHeaders()
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'Erro ao obter signed url');
    throw new Error(`Falha ao gerar Signed URL ElevenLabs [${res.status}]: ${errText}`);
  }

  const data = await res.json();
  return {
    signed_url: data.signed_url,
    agent_id: targetAgentId,
    expires_in_seconds: 300
  };
}

/**
 * Gera áudio de teste (Text-to-Speech) para uma voz selecionada
 * Retorna base64 de áudio para ser tocado com segurança no navegador do Fundador.
 */
export async function generateVoiceSample(voiceId, text = 'Olá! Esta é uma demonstração de voz do Sistema Helena.') {
  if (!isElevenLabsConfigured()) {
    throw new Error('ELEVENLABS_API_KEY não configurada no servidor');
  }

  if (!voiceId) {
    throw new Error('voice_id é obrigatório para testar voz');
  }

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`;

  const payload = {
    text: text.slice(0, 300), // Limite seguro para teste
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'Erro TTS');
    throw new Error(`Falha ao gerar amostra de voz [${res.status}]: ${errText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const base64Audio = Buffer.from(arrayBuffer).toString('base64');

  return {
    voice_id: voiceId,
    mime_type: 'audio/mpeg',
    audio_base64: `data:audio/mpeg;base64,${base64Audio}`
  };
}

// ======================================================================
// CONFIGURAÇÕES DE ALTÍSSIMA FIDELIDADE & STREAMING PARA LIGAÇÕES (CALL)
// ======================================================================

/**
 * Mapeamento das vozes originais e clonadas reais de cada personagem no ElevenLabs.
 */
export const ELEVENLABS_CHARACTER_VOICES = Object.freeze({
  sirlene: process.env.ELEVENLABS_VOICE_SIRLENE || 'eabgQyq9no9rW5ZiGiaZ',
  alex: process.env.ELEVENLABS_VOICE_ALEX || 'TX3LPaxmHKxFdv7VOQHJ',
  vital: process.env.ELEVENLABS_VOICE_VITAL || 'IKpiSijWzlhOL6uX83EH',
  rafael: process.env.ELEVENLABS_VOICE_RAFAEL || 'TX3LPaxmHKxFdv7VOQHJ'
});

/**
 * Mapeamento reverso entre vozes Google Chirp 3 HD, perfis e ElevenLabs
 */
const CHIRP_TO_ELEVENLABS_MAP = {
  // Sirlene
  'pt-br-chirp3-hd-achernar': 'sirlene',
  'pt-br-chirp3-hd-aoede': 'sirlene',
  'pt-br-chirp3-hd-autonoe': 'sirlene',
  'sirlene_normal': 'sirlene',
  'sirlene_firm': 'sirlene',
  'sirlene_intense': 'sirlene',
  // Alex
  'pt-br-chirp3-hd-alkaid': 'alex',
  'pt-br-chirp3-hd-fenrir': 'alex',
  'alex_normal': 'alex',
  'alex_firm': 'alex',
  'alex_intense': 'alex',
  // Vital
  'pt-br-chirp3-hd-charon': 'vital',
  'pt-br-chirp3-hd-iapetus': 'vital',
  'vital_normal': 'vital',
  'vital_firm': 'vital',
  'vital_intense': 'vital',
  // Rafael
  'pt-br-chirp3-hd-achird': 'rafael',
  'rafael_normal': 'rafael',
  'rafael_firm': 'rafael',
  'rafael_intense': 'rafael'
};

/**
 * Resolve o Voice ID oficial no ElevenLabs a partir do personagem, ID ou voz do Chirp.
 */
export function resolveElevenLabsVoice(voiceOrCharacterId) {
  if (!voiceOrCharacterId) return ELEVENLABS_CHARACTER_VOICES.sirlene;
  const key = String(voiceOrCharacterId).toLowerCase().trim();

  // Substitui automaticamente qualquer referência à voz antiga filipina pela voz real clonada da Sirlene
  if (key === 'ejv7h2bagt5ab95toosg' || key === 'ejv7h2bagt5ab95tooosg') {
    return ELEVENLABS_CHARACTER_VOICES.sirlene;
  }
  
  if (CHIRP_TO_ELEVENLABS_MAP[key]) {
    const charKey = CHIRP_TO_ELEVENLABS_MAP[key];
    return ELEVENLABS_CHARACTER_VOICES[charKey] || ELEVENLABS_CHARACTER_VOICES.sirlene;
  }
  if (ELEVENLABS_CHARACTER_VOICES[key]) {
    return ELEVENLABS_CHARACTER_VOICES[key];
  }
  // Se contiver 'sirlene', 'alex', 'vital' ou 'rafael' no texto
  if (key.includes('sirlene')) return ELEVENLABS_CHARACTER_VOICES.sirlene;
  if (key.includes('vital')) return ELEVENLABS_CHARACTER_VOICES.vital;
  if (key.includes('alex')) return ELEVENLABS_CHARACTER_VOICES.alex;
  if (key.includes('rafael')) return ELEVENLABS_CHARACTER_VOICES.rafael;

  return voiceOrCharacterId;
}

/**
 * Configurações de Altíssima Fidelidade (Master Quality) para as vozes reais clonadas.
 * - stability: 0.50 (Permite emoção e respiração natural sem instabilidade)
 * - similarity_boost: 0.85 (Fidelidade máxima ao timbre da voz real gravada)
 * - style: 0.15 (Expressividade humana dinâmica para conversação)
 * - use_speaker_boost: true (Ativa realce do falante proprietário da ElevenLabs)
 */
export const ELEVENLABS_HIGH_QUALITY_SETTINGS = Object.freeze({
  stability: 0.50,
  similarity_boost: 0.85,
  style: 0.15,
  use_speaker_boost: true
});

// Circuit-breaker em memória para cota mensal do ElevenLabs
let elevenLabsQuotaExceededUntil = 0;

export function markElevenLabsQuotaExceeded(ttlMs = 60 * 60 * 1000) {
  elevenLabsQuotaExceededUntil = Date.now() + ttlMs;
}

export function isElevenLabsQuotaCurrentlyExceeded() {
  return Date.now() < elevenLabsQuotaExceededUntil;
}

export function resetElevenLabsQuotaStatus() {
  elevenLabsQuotaExceededUntil = 0;
}

/**
 * Detecta se a resposta do ElevenLabs indica estouro de cota mensal de caracteres / créditos.
 */
export function isElevenLabsQuotaExceeded(status, errorBody = '') {
  if (status === 429) return true;
  if (status === 401 && /quota|credit|insufficient|exceeded/i.test(String(errorBody))) return true;
  if (typeof errorBody === 'object' && errorBody !== null) {
    const detail = JSON.stringify(errorBody).toLowerCase();
    if (detail.includes('quota_exceeded') || detail.includes('insufficient_credits') || detail.includes('character_limit_exceeded')) {
      return true;
    }
  }
  return false;
}

/**
 * Executa a síntese de voz em alta fidelidade (192 kbps HD) para ligações.
 * Caso a cota mensal tenha estourado, lança erro com flag `isQuotaExceeded = true`
 * para que o router acione imediatamente o fallback automático do Google Chirp 3 HD.
 */
export async function synthesizeElevenLabsCallSpeech({
  text,
  voice,
  signal,
  outputFormat = 'mp3_44100_192',
  modelId = 'eleven_multilingual_v2'
}) {
  if (!isElevenLabsConfigured()) {
    const err = new Error('ELEVENLABS_API_KEY não configurada no servidor');
    err.code = 'ELEVENLABS_NOT_CONFIGURED';
    err.isQuotaExceeded = true;
    throw err;
  }

  if (isElevenLabsQuotaCurrentlyExceeded()) {
    const err = new Error('ElevenLabs cota mensal esgotada (circuit-breaker ativo)');
    err.code = 'ELEVENLABS_QUOTA_EXCEEDED';
    err.isQuotaExceeded = true;
    throw err;
  }

  const voiceId = resolveElevenLabsVoice(voice);
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${outputFormat}`;

  const payload = {
    text: String(text).trim(),
    model_id: modelId,
    voice_settings: ELEVENLABS_HIGH_QUALITY_SETTINGS
  };

  const start = performance.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
    signal
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'Erro ElevenLabs');
    const isQuota = isElevenLabsQuotaExceeded(res.status, errText);
    if (isQuota) {
      markElevenLabsQuotaExceeded();
    }
    const err = new Error(`ElevenLabs TTS [${res.status}]: ${errText}`);
    err.status = res.status;
    err.isQuotaExceeded = isQuota;
    throw err;
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const latencyMs = Math.round(performance.now() - start);

  return {
    buffer,
    format: outputFormat.startsWith('pcm') ? 'pcm' : 'mp3',
    voice: voiceId,
    latencyMs,
    characterCount: text.length
  };
}

/**
 * Abre stream nativo de áudio (HTTP chunked streaming) em altíssima qualidade (192 kbps HD).
 * Permite latência ultra-baixa com início de reprodução em menos de 300ms.
 */
export async function streamElevenLabsCallSpeech({
  text,
  voice,
  signal,
  outputFormat = 'mp3_44100_192',
  optimizeStreamingLatency = 1,
  modelId = 'eleven_multilingual_v2'
}) {
  if (!isElevenLabsConfigured()) {
    const err = new Error('ELEVENLABS_API_KEY não configurada no servidor');
    err.code = 'ELEVENLABS_NOT_CONFIGURED';
    err.isQuotaExceeded = true;
    throw err;
  }

  const voiceId = resolveElevenLabsVoice(voice);
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream?optimize_streaming_latency=${optimizeStreamingLatency}&output_format=${outputFormat}`;

  const payload = {
    text: String(text).trim(),
    model_id: modelId,
    voice_settings: ELEVENLABS_HIGH_QUALITY_SETTINGS
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
    signal
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'Erro ElevenLabs');
    const isQuota = isElevenLabsQuotaExceeded(res.status, errText);
    const err = new Error(`ElevenLabs Streaming [${res.status}]: ${errText}`);
    err.status = res.status;
    err.isQuotaExceeded = isQuota;
    throw err;
  }

  return {
    stream: res.body,
    contentType: res.headers.get('content-type') || 'audio/mpeg',
    voiceId,
    format: outputFormat.startsWith('pcm') ? 'pcm' : 'mp3'
  };
}

