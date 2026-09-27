/**
 * audio-router.mjs — Roteador Canônico de Contexto de Áudio
 *
 * Garante o isolamento estrito:
 * CALL     → Google Chirp 3 HD (se habilitado) com fallback controlado
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
 * Roteia a síntese de áudio exclusivamente para chamadas telefônicas (VoIP / Telefonia)
 * REGRA DEFINITIVA: O único TTS permitido para o contexto CALL é Google Cloud Chirp 3 HD.
 * Nenhum outro TTS (Kokoro, Chatterbox, etc.) participa deste fluxo.
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
export async function routeCallAudio({ text, callId = '', voice = null, legacyCallSynthesizer = null }) {
  if (process.env.GOOGLE_CALL_TTS_ENABLED === 'false' && typeof legacyCallSynthesizer === 'function') {
    return await legacyCallSynthesizer();
  }

  try {
    const result = await GoogleChirp3HDCallTTS.synthesizeCallSpeech({
      text,
      callId,
      context: AudioContext.CALL,
      voice
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
    console.error(`[AUDIO_ROUTER] ❌ Falha crítica no Google Chirp 3 HD para chamada ${callId}:`, err.message);
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
