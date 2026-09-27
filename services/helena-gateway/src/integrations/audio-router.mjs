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
 * Roteia a síntese de áudio para chamadas ativas (VoIP / Telefonia)
 *
 * @param {Object} params
 * @param {string} params.text Texto a sintetizar
 * @param {string} params.callId Identificador da chamada
 * @param {string} [params.voice] Override opcional de voz
 * @param {Function} [params.legacyCallSynthesizer] Sintetizador legado para fallback (ElevenLabs/Kokoro)
 * @returns {Promise<{
 *   buffer: Buffer,
 *   format: string,
 *   provider: string,
 *   voice_id: string,
 *   durationMs?: number,
 *   sizeBytes: number,
 *   cached?: boolean,
 *   callId?: string
 * }>}
 */
export async function routeCallAudio({ text, callId = '', voice = null, legacyCallSynthesizer = null }) {
  const isChirpEnabled = isGoogleChirp3CallEnabled();

  // 1. Se Google Chirp 3 HD estiver ativo para chamadas, tenta sintetizar
  if (isChirpEnabled) {
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
      console.warn(`[AUDIO_ROUTER] Falha no Google Chirp 3 HD para chamada ${callId}:`, err.message);

      const fallbackMode = (process.env.GOOGLE_CALL_TTS_FALLBACK || 'none').trim().toLowerCase();
      // Regra 26: Se fallback for 'none', não aciona ElevenLabs sem autorização explícita
      if (fallbackMode === 'none') {
        throw err;
      }

      // Se houver fallback explicitamente configurado, utiliza o sintetizador anterior
      if (typeof legacyCallSynthesizer === 'function') {
        console.log(`[AUDIO_ROUTER] Acionando fallback configurado (${fallbackMode}) para a chamada ${callId}...`);
        return await legacyCallSynthesizer();
      }
      throw err;
    }
  }

  // 2. Rollback ou Google Desativado: utiliza imediatamente o fluxo legado de chamada
  console.log(`[AUDIO_ROUTER] Google Chirp 3 HD inativo para CALL. Utilizando provedor de chamada anterior.`);
  if (typeof legacyCallSynthesizer === 'function') {
    return await legacyCallSynthesizer();
  }

  throw new Error('[AUDIO_ROUTER] Nenhum sintetizador disponível para o contexto CALL.');
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
