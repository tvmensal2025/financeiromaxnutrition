/**
 * audio-router.mjs — Roteador Canônico de Contexto de Áudio
 *
 * Garante o isolamento estrito:
 * CALL     → ElevenLabs V4 Turbo primeiro (voz do personagem); Google Chirp 3 HD só como reserva
 * VARIABLE → ElevenLabs / comportamento existente
 * FIXED    → Áudios estáticos existentes / comportamento existente
 * KOKORO   → Preservado
 * OTHER    → Comportamento existente
 */

import {
  GoogleChirp3HDCallTTS,
  previewGoogleCallVoice,
  PROVIDER_NAME as GOOGLE_CHIRP3_PROVIDER
} from './google-chirp3-hd.mjs';
import {
  isElevenLabsConfigured,
  synthesizeElevenLabsCallSpeech,
  resolveCallCharacter,
  googleVoiceForCall
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
 * Roteia a síntese de áudio para chamadas telefônicas (VoIP / Telefonia)
 *
 * REGRA DO DONO (voz única por personagem, eliving-voice-config.mjs):
 * 1. PRIMEIRO: ElevenLabs V4 Turbo (tempo real) com a voz e o padrão do PERSONAGEM, 192 kbps.
 * 2. RESERVA: Google Cloud Chirp 3 HD, só quando acabam créditos/minutos da ElevenLabs (HTTP 429/cota)
 *    ou ela falha. Voz Google FIXA do personagem e texto sem tags, sem interromper a chamada.
 *
 * @param {Object} params
 * @param {string} params.text Texto a sintetizar
 * @param {string} params.callId Identificador da chamada
 * @param {string} [params.characterId] Personagem da ligação (manda na voz)
 * @param {string} [params.voice] Voz antiga de perfil/painel: só identifica o personagem sem characterId
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
export async function routeCallAudio({ text, callId = '', voice = null, characterId = null }) {
  const character = resolveCallCharacter({ characterId, voice });
  // 1. Tenta sintetizar prioritariamente via ElevenLabs (Consumo da Cota Mensal)
  const elevenLabsEnabled = process.env.ELEVENLABS_CALL_ENABLED !== 'false';
  if (elevenLabsEnabled && isElevenLabsConfigured()) {
    try {
      const speechText = formatSpeechForElevenLabs(text);
      const elResult = await synthesizeElevenLabsCallSpeech({
        text: speechText,
        characterId: character,
        uso: 'tempoReal',
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

  // 2. Provedor Secundário / Fallback: Google Cloud Chirp 3 HD (voz fixa do personagem, sem tags)
  try {
    const chirpVoice = googleVoiceForCall({ characterId: character, voice });
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
 * Áudio de um turno da ligação do app (abertura e respostas sem streaming), no MESMO formato de
 * previewGoogleCallVoice ({ ok, provider, voice, audio_base64, content_type: 'audio/mpeg', ... }).
 * Fala primeiro a ElevenLabs V4 Turbo (MP3) com a voz do personagem; o Google Chirp 3 HD só entra
 * como reserva (cota/falha), com a voz fixa do personagem e o texto sem tags.
 */
export async function routeCallPreviewAudio({ text, characterId = null, voice = null } = {}) {
  const character = resolveCallCharacter({ characterId, voice });
  const elevenLabsEnabled = process.env.ELEVENLABS_CALL_ENABLED !== 'false';
  if (elevenLabsEnabled && isElevenLabsConfigured()) {
    try {
      const el = await synthesizeElevenLabsCallSpeech({
        text: formatSpeechForElevenLabs(text),
        characterId: character,
        uso: 'tempoReal',
        outputFormat: 'mp3_44100_128'
      });
      return {
        ok: true,
        provider: 'ELEVENLABS',
        voice: el.voice,
        character_id: el.characterId,
        model: el.modelId,
        format: 'mp3',
        content_type: 'audio/mpeg',
        audio_base64: el.buffer.toString('base64'),
        size_bytes: el.buffer.length,
        character_count: el.characterCount,
        latency_ms: el.latencyMs
      };
    } catch (elErr) {
      const isQuota = elErr.isQuotaExceeded || elErr.status === 429;
      console.warn(
        `[AUDIO_ROUTER] ${isQuota ? '⚠️ Cota ElevenLabs esgotada (HTTP 429)' : '⚠️ Falha temporária ElevenLabs'}: ${elErr.message}. Usando a reserva Google Chirp 3 HD.`
      );
    }
  }
  return previewGoogleCallVoice({
    text: stripAudioTags(text),
    voice: googleVoiceForCall({ characterId: character, voice })
  });
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
