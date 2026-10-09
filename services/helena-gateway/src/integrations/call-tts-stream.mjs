/**
 * call-tts-stream.mjs — Stream Híbrido de TTS Telefônico (voz do eLiving)
 *
 * REGRA DO DONO (06/10/2026), dados em eliving-voice-config.mjs (gerado da fonte única do app):
 * 1. FALA PRIMEIRO A ElevenLabs V4 Turbo (models.tempoReal = eleven_v4_turbo), PCM 16 kHz em streaming,
 *    com a voz e o padrão (voice_settings) do PERSONAGEM da ligação — Sirlene, Alex, Dr. Vital ou
 *    Rafael (Rafael = B4ra…, a voz dele, nunca a do Alex). A voz vem do characterId da ligação, nunca
 *    de uma voz Google escolhida no painel. Tags de áudio do dono entre colchetes ([curious],
 *    [short pause]…); proibidas com o aluno e desconhecidas saem antes do envio.
 *
 * 2. RESERVA: Google Cloud Chirp 3 HD. Só entra quando acabam créditos/minutos da ElevenLabs
 *    (HTTP 429/cota) ou ela falha: chaveia na hora, sem derrubar a ligação, com a voz Google FIXA do
 *    personagem (googleFallbackVoice) e o texto SEM tags.
 */

import { Transform } from 'node:stream';
import { ElevenLabsDialogueSession } from './elevenlabs-dialogue.mjs';
import {
  isElevenLabsConfigured,
  getElevenLabsApiKey,
  isElevenLabsQuotaExceeded,
  isElevenLabsQuotaCurrentlyExceeded,
  markElevenLabsQuotaExceeded,
  resolveCallCharacter,
  elevenLabsSpecForCharacter,
  googleVoiceForCall
} from './elevenlabs.mjs';
import {
  openChirp3CallStream
} from './google-chirp3-hd.mjs';
import {
  formatSpeechForElevenLabs,
  stripAudioTags,
  countAudioTags,
  MAX_AUDIO_TAGS_PER_FALA
} from './conversation-naturalness.mjs';

/**
 * Cria ou abre o stream Duplex de TTS telefônico (híbrido ElevenLabs + Google Chirp 3 HD).
 * characterId = personagem da ligação (manda na voz dos dois provedores); `voice` só identifica o
 * personagem quando o characterId não vier.
 */
export function openCallTTSStream({
  voice = null,
  characterId = null,
  context = 'CALL',
  signal = null,
  WebSocketImpl,
  timeoutMs = 5000
} = {}) {
  const character = resolveCallCharacter({ characterId, voice });
  const elevenLabsEnabled = process.env.ELEVENLABS_CALL_ENABLED !== 'false';
  const canUseElevenLabs = elevenLabsEnabled && isElevenLabsConfigured() && !isElevenLabsQuotaCurrentlyExceeded();

  if (!canUseElevenLabs) {
    const stream = openChirp3CallStream({ voice: googleVoiceForCall({ characterId: character, voice }), context, signal });
    stream.providersUsed = new Set(['google_chirp3_hd']);
    return stream;
  }

  return new HybridCallTTSStream({ voice, characterId: character, context, signal, WebSocketImpl, timeoutMs });
}

export class HybridCallTTSStream extends Transform {
  constructor({ voice = null, characterId = null, context = 'CALL', signal = null, WebSocketImpl, timeoutMs = 5000 } = {}) {
    super({ objectMode: true });
    this.voice = voice;
    this.characterId = resolveCallCharacter({ characterId, voice });
    this.elevenLabsSpec = elevenLabsSpecForCharacter(this.characterId, 'tempoReal');
    this.googleVoice = googleVoiceForCall({ characterId: this.characterId, voice });
    this.context = context;
    this.signal = signal;
    this.WebSocketImpl = WebSocketImpl;
    this.timeoutMs = timeoutMs;
    this.spokenText = '';
    this.tagsUsed = 0;

    this.supportsAudioTags = true;
    this.elevenLabsFailed = false;
    this.chirpStream = null;

    this.queue = [];
    this.isProcessing = false;
    this.streamEnded = false;
    this.flushCallback = null;

    this.dialogue = null;
    this.provider = 'ELEVENLABS';
    this.providersUsed = new Set();

    if (signal) {
      if (signal.aborted) {
        this.destroy(signal.reason);
      } else {
        const onAbort = () => this.destroy(signal.reason);
        signal.addEventListener('abort', onAbort, { once: true });
        this.once('close', () => signal.removeEventListener('abort', onAbort));
      }
    }
  }

  _transform(chunk, encoding, callback) {
    if (this.destroyed) return callback();

    const rawText = chunk?.input?.text || chunk?.text || (typeof chunk === 'string' ? chunk : '');
    const text = String(rawText || '').trim();

    if (!text) {
      return callback();
    }

    if (this.elevenLabsFailed && this.chirpStream) {
      const cleanChirp = stripAudioTags(text);
      if (cleanChirp) {
        this.chirpStream.write({ input: { text: `${cleanChirp} ` } });
      }
      return callback();
    }

    this.queue.push({ text, callback });
    this._processNext();
  }

  _processNext() {
    if (this.isProcessing || this.queue.length === 0 || this.destroyed) {
      this._checkFlush();
      return;
    }

    this.isProcessing = true;
    const item = this.queue.shift();

    this._synthesizeItem(item)
      .catch((err) => {
        if (!this.destroyed && err?.name !== 'AbortError') {
          this.destroy(err);
        }
      })
      .finally(() => {
        this.isProcessing = false;
        item.callback();
        this._processNext();
      });
  }

  async _synthesizeItem({ text }) {
    if (this.signal?.aborted || this.destroyed) return;

    if (this.elevenLabsFailed) {
      if (this.chirpStream) {
        const cleanChirp = stripAudioTags(text);
        if (cleanChirp) {
          this.chirpStream.write({ input: { text: `${cleanChirp} ` } });
        }
      }
      return;
    }

    // Uma fala = o turno inteiro deste stream: no máximo 3 tags e a exceção de comemoração vale na fala toda.
    const speechText = formatSpeechForElevenLabs(text, {
      contexto: this.spokenText,
      maxTags: Math.max(0, MAX_AUDIO_TAGS_PER_FALA - this.tagsUsed)
    });
    this.spokenText += ` ${text}`;
    if (!speechText) return;
    this.tagsUsed += countAudioTags(speechText);

    let emittedAudio = false;
    try {
      this.dialogue ||= new ElevenLabsDialogueSession({ spec: this.elevenLabsSpec, apiKey: getElevenLabsApiKey(),
        signal: this.signal, WebSocketImpl: this.WebSocketImpl, timeoutMs: this.timeoutMs });
      await this.dialogue.synthesize(speechText, bytes => {
        emittedAudio = true;
        this.providersUsed.add('ELEVENLABS');
        this.push({ audioContent: bytes });
      });
    } catch (err) {
      if (err?.name === 'AbortError' || this.signal?.aborted || this.destroyed) {
        return;
      }

      if (isElevenLabsQuotaExceeded(err.status, err.providerError)) markElevenLabsQuotaExceeded();
      this.dialogue?.close();
      // Repetir uma frase já parcialmente ouvida criaria eco e duplicação. Encerra o turno incompleto.
      if (emittedAudio) throw new Error('A fala foi interrompida antes de terminar');
      console.warn(`[CALL_TTS_STREAM] Reserva Google acionada: ${err.status || 'conexão/tempo esgotado'}.`);
      this._activateChirpFallback();
      const cleanChirp = stripAudioTags(text);
      if (cleanChirp && this.chirpStream) {
        this.chirpStream.write({ input: { text: `${cleanChirp} ` } });
      }
    }
  }

  _activateChirpFallback() {
    if (this.elevenLabsFailed) return;
    this.elevenLabsFailed = true;
    this.supportsAudioTags = false;
    this.provider = 'google_chirp3_hd';

    try {
      // Voz Google FIXA do personagem da ligação (nunca a voz escolhida no painel).
      this.chirpStream = openChirp3CallStream({
        voice: this.googleVoice,
        context: this.context,
        signal: this.signal
      });

      this.chirpStream.on('data', (chunk) => {
        if (!this.destroyed) {
          this.providersUsed.add('google_chirp3_hd');
          this.push(chunk);
        }
      });

      this.chirpStream.on('error', (err) => {
        if (!this.destroyed) {
          this.destroy(err);
        }
      });

      this.chirpStream.on('end', () => {
        this._checkFlush();
      });
    } catch (chirpErr) {
      console.error('[CALL_TTS_STREAM] Erro crítico ao inicializar fallback Google Chirp 3 HD:', chirpErr.message);
      this.destroy(chirpErr);
    }
  }

  _flush(callback) {
    this.streamEnded = true;
    this.flushCallback = callback;
    this._checkFlush();
  }

  _checkFlush() {
    if (!this.streamEnded || !this.flushCallback) return;
    if (this.isProcessing || this.queue.length > 0) return;

    if (this.elevenLabsFailed && this.chirpStream) {
      this.chirpStream.end();
      const callback = this.flushCallback;
      this.flushCallback = null;
      // 'end' e 'close' podem chegar os dois: o flush só pode ser concluído uma vez.
      let finished = false;
      const done = () => { if (!finished) { finished = true; callback(); } };
      this.chirpStream.once('end', done);
      this.chirpStream.once('close', done);
      return;
    }

    const done = this.flushCallback;
    this.flushCallback = null;
    this.dialogue?.close();
    done();
  }

  _destroy(err, callback) {
    this.dialogue?.fail(err || new DOMException('Ligação encerrada', 'AbortError'));
    if (this.chirpStream) {
      this.chirpStream.destroy(err);
    }
    callback(err);
  }
}
