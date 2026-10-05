/**
 * audio-router.mjs — Roteador Canônico de Contexto de Áudio
 *
 * Garante o isolamento estrito:
 * CALL     → Google Chirp 3 HD exclusivo; falhas são reportadas
 * VARIABLE → ElevenLabs / comportamento existente
 * FIXED    → Áudios estáticos existentes / comportamento existente
 * KOKORO   → Preservado
 * OTHER    → Comportamento existente
 */

import {
  GoogleChirp3HDCallTTS,
  isGoogleChirp3CallEnabled,
  PROVIDER_NAME as GOOGLE_CHIRP3_PROVIDER
} from './google-chirp3-hd.mjs';
import {
  isElevenLabsConfigured,
  synthesizeElevenLabsCallSpeech,
  resolveElevenLabsVoice,
  isElevenLabsQuotaExceeded
} from './elevenlabs.mjs';
import {
  formatSpeechForElevenLabs,
  stripAudioTags
} from './conversation-naturalness.mjs';


/**
 * Contextos canônicos de áudio do sistema
 */
export const AudioContext = Object.freeze({
  CALL: 'CALL',
  VARIABLE: 'VARIABLE',
  FIXED: 'FIXED',
  OTHER: 'OTHER'
});

/**
 * Mapeamento de voz do ElevenLabs para o equivalente oficial no Google Chirp 3 HD (para o Fallback).
 */
const ELEVENLABS_TO_CHIRP_FALLBACK_MAP = {
  'ejv7h2bagt5ab95tooosg': 'pt-BR-Chirp3-HD-Achernar', // Sirlene
  'tx3lpaxmhkxfdv7voqhj': 'pt-BR-Chirp3-HD-Alkaid',   // Alex
  'ikpisijwzlhol6ux83eh': 'pt-BR-Chirp3-HD-Charon',   // Vital
  'sirlene': 'pt-BR-Chirp3-HD-Achernar',
  'alex': 'pt-BR-Chirp3-HD-Alkaid',
  'vital': 'pt-BR-Chirp3-HD-Charon',
  'rafael': 'pt-BR-Chirp3-HD-Achird'
};

function resolveChirpFallbackVoice(voice) {
  if (!voice) return null;
  const key = String(voice).toLowerCase().trim();
  return ELEVENLABS_TO_CHIRP_FALLBACK_MAP[key] || voice;
}

/**
 * Roteia a síntese de áudio para chamadas telefônicas (VoIP / Telefonia)
 *
 * ESTRATÉGIA HÍBRIDA DE CUSTO & QUALIDADE MÁXIMA:
 * 1. PRIORIDADE MÁXIMA: ElevenLabs (Vozes Originais Reais dos Mentores em 192 kbps HD)
 *    Consome 100% da cota mensal contratada na ElevenLabs.
 * 2. FALLBACK AUTOMÁTICO: Google Cloud Chirp 3 HD
 *    Se a cota do ElevenLabs esgotar (HTTP 429 / Quota Exceeded) ou a API oscilar,
 *    chaveia instantaneamente para o Google Chirp 3 HD sem interromper a chamada.
 *
 * @param {Object} params
 * @param {string} params.text Texto a sintetizar
 * @param {string} params.callId Identificador da chamada
 * @param {string} [params.voice] Override opcional de voz
 * @returns {Promise<{
 *   buffer: Buffer,
 *   format: string,
 *   provider: string,
 *   voice_id: string,
 *   durationMs: number,
 *   sizeBytes: number,
 *   cached: boolean,
 *   characterCount: number,
 *   callId: string
 * }>}
 */
export async function routeCallAudio({ text, callId = '', voice = null }) {
  // 1. Tenta sintetizar prioritariamente via ElevenLabs (Consumo da Cota Mensal)
  const elevenLabsEnabled = process.env.ELEVENLABS_CALL_ENABLED !== 'false';
  if (elevenLabsEnabled && isElevenLabsConfigured()) {
    try {
      const elVoice = resolveElevenLabsVoice(voice);
      const speechText = formatSpeechForElevenLabs(text);
      const elResult = await synthesizeElevenLabsCallSpeech({
        text: speechText,
        voice: elVoice,
        outputFormat: 'mp3_44100_192' // Altíssima fidelidade
      });

      return {
        buffer: elResult.buffer,
        format: elResult.format,
        provider: 'ELEVENLABS',
        voice_id: elResult.voice,
        durationMs: elResult.latencyMs,
        sizeBytes: elResult.buffer.length,
        cached: false,
        characterCount: elResult.characterCount,
        callId
      };
    } catch (elErr) {
      const isQuota = elErr.isQuotaExceeded || elErr.status === 429;
      console.warn(
        `[AUDIO_ROUTER] ${isQuota ? '⚠️ Cota ElevenLabs esgotada (HTTP 429)' : '⚠️ Falha temporária ElevenLabs'}: ${elErr.message}. Acionando fallback automático para Google Cloud Chirp 3 HD!`
      );
      // Prossegue imediatamente para o Google Chirp 3 HD
    }
  }

  // 2. Provedor Secundário / Fallback: Google Cloud Chirp 3 HD
  try {
    const chirpVoice = resolveChirpFallbackVoice(voice);
    const cleanChirpText = stripAudioTags(text);
    const result = await GoogleChirp3HDCallTTS.synthesizeCallSpeech({
      text: cleanChirpText,
      callId,
      context: AudioContext.CALL,
      voice: chirpVoice
    });


    return {
      buffer: result.audio,
      format: result.format, // 'mp3' ou 'wav'
      provider: GOOGLE_CHIRP3_PROVIDER,
      voice_id: result.voice,
      durationMs: result.latencyMs,
      sizeBytes: result.audio.length,
      cached: result.cached,
      characterCount: result.characterCount,
      callId
    };
  } catch (err) {
    console.error(`[AUDIO_ROUTER] ❌ Falha crítica em todos os provedores (ElevenLabs e Google Chirp) para chamada ${callId}:`, err.message);
    throw err;
  }
}

/**
 * Roteia áudios do contexto VARIABLE (amostras dinâmicas, prévias, testes fora de ligação)
 * Regra: NUNCA chama o Google Chirp 3 HD.
 */
export async function routeVariableAudio({ synthesizer }) {
  if (typeof synthesizer !== 'function') {
    throw new Error('[AUDIO_ROUTER] Sintetizador variável obrigatório.');
  }
  return await synthesizer();
}

/**
 * Roteia áudios do contexto FIXED (arquivos imutáveis de storage / R2)
 * Regra: NUNCA chama o Google Chirp 3 HD.
 */
export async function routeFixedAudio({ loader }) {
  if (typeof loader !== 'function') {
    throw new Error('[AUDIO_ROUTER] Carregador de áudio fixo obrigatório.');
  }
  return await loader();
}
