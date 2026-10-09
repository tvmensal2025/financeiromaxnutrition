/**
 * Integrations / ElevenLabs Client
 * Cliente seguro para listagem de vozes, agentes, signed URLs e teste de TTS
 * REGRA ABSOLUTA: A chave ELEVENLABS_API_KEY NUNCA é enviada ao navegador.
 *
 * VOZ DO eLIVING (regra do dono, 06/10/2026): voz, modelo e padrão vêm SÓ de eliving-voice-config.mjs
 * (gerado da fonte única do app). Uma voz por PERSONAGEM; nada de voz por variável de ambiente.
 * Ligação, streaming e prévia ao vivo = models.tempoReal (eleven_v4_turbo); áudio gravado = models.gravado.
 */

import ELIVING_VOICE_CONFIG from './eliving-voice-config.mjs';
import { ElevenLabsDialogueSession } from './elevenlabs-dialogue.mjs';

const ELEVENLABS_DEFAULT_AGENT_ID = process.env.ELEVENLABS_DEFAULT_AGENT_ID || process.env.ELEVENLABS_AGENT_ID || '';

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
      default_voice_id: ELEVENLABS_CHARACTER_VOICES[DEFAULT_VOICE_CHARACTER],
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
 * Gera áudio de teste (Text-to-Speech) para a voz de um PERSONAGEM (prévia ao vivo = tempoReal).
 * Aceita id do personagem, nome, profile_key ou a voz atual dele; voz fora do eLiving é recusada.
 * Retorna base64 de áudio para ser tocado com segurança no navegador do Fundador.
 */
export async function generateVoiceSample(voiceId, text = 'Olá! Esta é uma demonstração de voz do eLiving.') {
  if (!isElevenLabsConfigured()) {
    throw new Error('ELEVENLABS_API_KEY não configurada no servidor');
  }

  if (!voiceId) {
    throw new Error('voice_id é obrigatório para testar voz');
  }

  const characterId = resolveVoiceCharacter(voiceId);
  if (!characterId) {
    throw new Error('Voz fora do eLiving: escolha a voz de um personagem (Sirlene, Alex, Dr. Vital ou Rafael).');
  }
  const sample = await synthesizeElevenLabsCallSpeech({ characterId, text: String(text).slice(0, 300),
    uso: 'tempoReal', outputFormat: 'mp3_44100_128' });
  const base64Audio = sample.buffer.toString('base64');

  return {
    voice_id: sample.voice,
    mime_type: 'audio/mpeg',
    audio_base64: `data:audio/mpeg;base64,${base64Audio}`
  };
}

// ======================================================================
// CONFIGURAÇÕES DE ALTÍSSIMA FIDELIDADE & STREAMING PARA LIGAÇÕES (CALL)
// ======================================================================

/** Personagens com voz no gateway (chaves do gateway: sirlene, alex, vital, rafael). */
export const ELIVING_CHARACTER_IDS = Object.freeze(Object.keys(ELIVING_VOICE_CONFIG.characters));

/** Personagem usado quando nada identifica quem fala (ligação recebida começa com a Sirlene). */
export const DEFAULT_VOICE_CHARACTER = 'sirlene';

/** Voz ElevenLabs de cada personagem (uma só, da fonte única; sem override por ambiente). */
export const ELEVENLABS_CHARACTER_VOICES = Object.freeze(Object.fromEntries(
  ELIVING_CHARACTER_IDS.map(id => [id, ELIVING_VOICE_CONFIG.characters[id].voiceId])
));

/** Nomes e ids aceitos para cada personagem. */
const CHARACTER_ALIASES = Object.freeze({
  sirlene: 'sirlene',
  alex: 'alex',
  vital: 'vital',
  drvital: 'vital',
  'dr vital': 'vital',
  'dr. vital': 'vital',
  'doutor vital': 'vital',
  rafael: 'rafael'
});

/**
 * Compatibilidade: vozes Google que perfis ANTIGOS salvaram para um personagem. Só servem para
 * descobrir o personagem; a voz usada é sempre a do personagem.
 */
const LEGACY_GOOGLE_VOICE_CHARACTER = Object.freeze({
  'pt-br-chirp3-hd-aoede': 'sirlene',
  'pt-br-chirp3-hd-autonoe': 'sirlene',
  'pt-br-chirp3-hd-fenrir': 'alex',
  'pt-br-chirp3-hd-iapetus': 'vital'
});

const LEGACY_VOICE_ID_CHARACTER = Object.freeze(Object.fromEntries(
  Object.entries(ELIVING_VOICE_CONFIG.legacyVoiceCharacters).map(([id, character]) => [id.toLowerCase(), character])
));

/**
 * Descobre o PERSONAGEM a partir de id ('vital', 'drvital'), profile_key ('vital_firm'), nome
 * ('Dr. Vital'), voz ElevenLabs ou Google do personagem. Voz Google antiga e id legado (Uneskee → Sirlene)
 * valem só como compatibilidade. Devolve null quando não identifica.
 */
export function resolveVoiceCharacter(input) {
  if (input == null) return null;
  const key = String(input).trim().toLowerCase();
  if (!key) return null;
  if (CHARACTER_ALIASES[key]) return CHARACTER_ALIASES[key];
  const profile = key.match(/^([a-z]+)_(normal|firm|intense|firme|intenso)$/);
  if (profile && CHARACTER_ALIASES[profile[1]]) return CHARACTER_ALIASES[profile[1]];
  for (const id of ELIVING_CHARACTER_IDS) {
    const character = ELIVING_VOICE_CONFIG.characters[id];
    if (character.voiceId.toLowerCase() === key || character.googleFallbackVoice.toLowerCase() === key) return id;
  }
  if (LEGACY_VOICE_ID_CHARACTER[key]) return LEGACY_VOICE_ID_CHARACTER[key];
  if (LEGACY_GOOGLE_VOICE_CHARACTER[key]) return LEGACY_GOOGLE_VOICE_CHARACTER[key];
  for (const id of ELIVING_CHARACTER_IDS) {
    if (key.includes(id)) return id;
  }
  return null;
}

/**
 * Personagem da ligação: o characterId manda; a voz (de painel/perfil antigo) só identifica o
 * personagem quando não há characterId. Sem nada, a Sirlene.
 */
export function resolveCallCharacter({ characterId = null, voice = null } = {}) {
  return resolveVoiceCharacter(characterId) || resolveVoiceCharacter(voice) || DEFAULT_VOICE_CHARACTER;
}

/**
 * Voz + modelo V4 + padrão aprovado do personagem (equivale ao voiceFor do app).
 * uso: 'tempoReal' (ligação, streaming, prévia ao vivo) ou 'gravado' (áudio gravado/arquivo).
 */
export function elevenLabsSpecForCharacter(characterId, uso = 'tempoReal') {
  const id = resolveVoiceCharacter(characterId);
  if (!id) throw new Error(`[elevenlabs] personagem desconhecido: "${String(characterId)}"`);
  if (!Object.prototype.hasOwnProperty.call(ELIVING_VOICE_CONFIG.models, uso)) {
    throw new Error(`[elevenlabs] uso desconhecido: "${String(uso)}" (use "gravado" ou "tempoReal")`);
  }
  const character = ELIVING_VOICE_CONFIG.characters[id];
  return {
    characterId: id,
    voiceId: character.voiceId,
    modelId: ELIVING_VOICE_CONFIG.models[uso],
    voiceSettings: { ...character.voiceSettings }
  };
}

/** Voz reserva Google Chirp 3 HD FIXA do personagem (uma por personagem). */
export function googleFallbackVoiceForCharacter(characterId) {
  const id = resolveVoiceCharacter(characterId) || DEFAULT_VOICE_CHARACTER;
  return ELIVING_VOICE_CONFIG.characters[id].googleFallbackVoice;
}

/**
 * Voz Google da ligação: sempre a voz fixa do personagem. Voz pedida por painel/perfil que não é a
 * dele (por exemplo, a de outro personagem) é ignorada, com log.
 */
export function googleVoiceForCall({ characterId = null, voice = null } = {}) {
  const character = resolveCallCharacter({ characterId, voice });
  const fixed = googleFallbackVoiceForCharacter(character);
  const requested = voice == null ? '' : String(voice).trim();
  if (requested && /chirp3-hd/i.test(requested) && requested.toLowerCase() !== fixed.toLowerCase()) {
    const owner = resolveVoiceCharacter(requested);
    console.warn(`[VOZ_ELIVING] Voz Google '${requested}' ignorada${owner && owner !== character ? ` (é de ${owner})` : ''}: ${character} fala só com ${fixed}.`);
  }
  return fixed;
}

/**
 * Resolve o Voice ID ElevenLabs por PERSONAGEM (id, profile_key, nome; voz Google ou id legado só como
 * compatibilidade). Nunca devolve uma voz solta: sem personagem identificado, usa a Sirlene.
 */
export function resolveElevenLabsVoice(voiceOrCharacterId) {
  const id = resolveVoiceCharacter(voiceOrCharacterId);
  if (!id && voiceOrCharacterId) {
    console.warn(`[VOZ_ELIVING] Voz '${String(voiceOrCharacterId)}' não pertence a nenhum personagem; usando ${DEFAULT_VOICE_CHARACTER}.`);
  }
  return ELEVENLABS_CHARACTER_VOICES[id || DEFAULT_VOICE_CHARACTER];
}

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
  if (status !== 200 && /quota_exceeded|insufficient_credits|character_limit_exceeded|quota.*exceeded/i.test(String(errorBody))) return true;
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
 * Voz, modelo e padrão vêm do PERSONAGEM (characterId; `voice` só identifica o personagem quando
 * falta o characterId). uso 'tempoReal' (padrão, ligação) ou 'gravado' (arquivo).
 * Caso a cota mensal tenha estourado, lança erro com flag `isQuotaExceeded = true`
 * para que o router acione imediatamente o fallback automático do Google Chirp 3 HD.
 */
export async function synthesizeElevenLabsCallSpeech({
  text,
  characterId = null,
  voice = null,
  signal,
  outputFormat = 'mp3_44100_192',
  uso = 'tempoReal'
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

  const spec = elevenLabsSpecForCharacter(resolveCallCharacter({ characterId, voice }), uso);
  const voiceId = spec.voiceId;
  if (uso === 'tempoReal') {
    const started = performance.now();
    const chunks = [];
    const session = new ElevenLabsDialogueSession({ spec, apiKey: getElevenLabsApiKey(), outputFormat, signal });
    try {
      await session.synthesize(String(text).trim(), bytes => chunks.push(bytes));
      return { buffer: Buffer.concat(chunks), format: outputFormat.startsWith('pcm') ? 'pcm' : 'mp3',
        voice: voiceId, characterId: spec.characterId, modelId: spec.modelId,
        latencyMs: Math.round(performance.now() - started), characterCount: String(text).length };
    } catch (error) {
      error.isQuotaExceeded = isElevenLabsQuotaExceeded(error.status, error.providerError);
      if (error.isQuotaExceeded) markElevenLabsQuotaExceeded();
      throw error;
    } finally { session.close(); }
  }
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${outputFormat}`;

  const payload = {
    text: String(text).trim(),
    model_id: spec.modelId,
    voice_settings: spec.voiceSettings
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
    characterId: spec.characterId,
    modelId: spec.modelId,
    latencyMs,
    characterCount: String(text).length
  };
}

/**
 * Abre stream nativo de áudio (HTTP chunked streaming) para ligação: eleven_v4_turbo (tempo real),
 * com a voz e o padrão do PERSONAGEM. (optimize_streaming_latency é obsoleto na API e não é enviado.)
 */
export async function streamElevenLabsCallSpeech({
  text,
  characterId = null,
  voice = null,
  signal,
  outputFormat = 'mp3_44100_192',
  uso = 'tempoReal'
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

  const spec = elevenLabsSpecForCharacter(resolveCallCharacter({ characterId, voice }), uso);
  const voiceId = spec.voiceId;
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream?output_format=${outputFormat}`;

  const payload = {
    text: String(text).trim(),
    model_id: spec.modelId,
    voice_settings: spec.voiceSettings
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
    if (isQuota) {
      markElevenLabsQuotaExceeded();
    }
    const err = new Error(`ElevenLabs Streaming [${res.status}]: ${errText}`);
    err.status = res.status;
    err.isQuotaExceeded = isQuota;
    throw err;
  }

  return {
    stream: res.body,
    contentType: res.headers.get('content-type') || 'audio/mpeg',
    voiceId,
    characterId: spec.characterId,
    modelId: spec.modelId,
    format: outputFormat.startsWith('pcm') ? 'pcm' : 'mp3'
  };
}

