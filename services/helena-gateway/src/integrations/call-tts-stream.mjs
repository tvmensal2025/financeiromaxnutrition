/**
 * call-tts-stream.mjs — Stream Híbrido de TTS Telefônico de Altíssima Fidelidade
 *
 * ESTRATÉGIA HÍBRIDA DE LIGAÇÕES (STREAMING AO VIVO):
 * 1. PRIORIDADE MÁXIMA: ElevenLabs (16 kHz PCM Streaming / 192 kbps HD)
 *    Consome a cota mensal com as vozes reais clonadas dos 4 personagens:
 *    - Sirlene: EJV7H2baGt5ab95tOoSG
 *    - Alex: TX3LPaxmHKxFdv7VOQHJ
 *    - Dr. Vital: IKpiSijWzlhOL6uX83EH
 *    - Rafael: TX3LPaxmHKxFdv7VOQHJ
 *    Suporta nativamente o Catálogo de Audio Tags ([laughs], [sighs], [warmly], etc.).
 *
 * 2. FALLBACK AUTOMÁTICO INSTANTÂNEO: Google Cloud Chirp 3 HD
 *    Se a cota do ElevenLabs esgotar (HTTP 429) ou ocorrer falha de rede,
 *    chaveia no mesmo instante para o Google Chirp 3 HD gRPC,
 *    higienizando as Audio Tags para pronúncia perfeita sem interrupção de chamada.
 */

import { Transform } from 'node:stream';
import {
  isElevenLabsConfigured,
  getElevenLabsApiKey,
  resolveElevenLabsVoice,
  isElevenLabsQuotaExceeded,
  isElevenLabsQuotaCurrentlyExceeded,
  markElevenLabsQuotaExceeded,
  ELEVENLABS_HIGH_QUALITY_SETTINGS
} from './elevenlabs.mjs';
import {
  openChirp3CallStream,
  isGoogleChirp3CallEnabled
} from './google-chirp3-hd.mjs';
import {
  formatSpeechForElevenLabs,
  stripAudioTags
} from './conversation-naturalness.mjs';

/**
 * Cria ou abre o stream Duplex de TTS telefônico (híbrido ElevenLabs + Google Chirp 3 HD).
 */
export function openCallTTSStream({
  voice = null,
  context = 'CALL',
  signal = null,
  fetchImpl = fetch
} = {}) {
  const elevenLabsEnabled = process.env.ELEVENLABS_CALL_ENABLED !== 'false';
  const canUseElevenLabs = elevenLabsEnabled && isElevenLabsConfigured() && !isElevenLabsQuotaCurrentlyExceeded();

  if (!canUseElevenLabs) {
    return openChirp3CallStream({ voice, context, signal });
  }

  return new HybridCallTTSStream({ voice, context, signal, fetchImpl });
}

export class HybridCallTTSStream extends Transform {
  constructor({ voice = null, context = 'CALL', signal = null, fetchImpl = fetch } = {}) {
    super({ objectMode: true });
    this.voice = voice;
    this.context = context;
    this.signal = signal;
    this.fetchImpl = fetchImpl;

    this.supportsAudioTags = true;
    this.elevenLabsFailed = false;
    this.chirpStream = null;

    this.queue = [];
    this.isProcessing = false;
    this.streamEnded = false;
    this.flushCallback = null;

    this.currentAbortController = null;

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
          console.error('[CALL_TTS_STREAM] Erro inesperado ao sintetizar item:', err.message);
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

    const speechText = formatSpeechForElevenLabs(text);
    if (!speechText) return;

    const voiceId = resolveElevenLabsVoice(this.voice);
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream?optimize_streaming_latency=2&output_format=pcm_16000`;

    const controller = new AbortController();
    this.currentAbortController = controller;

    const onParentAbort = () => controller.abort(this.signal?.reason);
    if (this.signal) {
      this.signal.addEventListener('abort', onParentAbort, { once: true });
    }

    try {
      const res = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          'xi-api-key': getElevenLabsApiKey(),
          'Content-Type': 'application/json',
          'Accept': 'audio/pcm'
        },
        body: JSON.stringify({
          text: speechText,
          model_id: 'eleven_multilingual_v2',
          voice_settings: ELEVENLABS_HIGH_QUALITY_SETTINGS
        }),
        signal: controller.signal
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        const isQuota = isElevenLabsQuotaExceeded(res.status, errText);
        if (isQuota) {
          markElevenLabsQuotaExceeded();
        }
        console.warn(
          `[CALL_TTS_STREAM] ⚠️ Falha na ElevenLabs [${res.status}]: ${errText}. Acionando fallback automático para Google Cloud Chirp 3 HD!`
        );

        this._activateChirpFallback();
        const cleanChirp = stripAudioTags(text);
        if (cleanChirp && this.chirpStream) {
          this.chirpStream.write({ input: { text: `${cleanChirp} ` } });
        }
        return;
      }

      if (res.body) {
        for await (const chunk of res.body) {
          if (this.signal?.aborted || this.destroyed) break;
          const bytes = Buffer.from(chunk);
          if (bytes.length > 0) {
            this.push({ audioContent: bytes });
          }
        }
      }
    } catch (err) {
      if (err?.name === 'AbortError' || this.signal?.aborted || this.destroyed) {
        return;
      }

      console.warn(
        `[CALL_TTS_STREAM] ⚠️ Erro de conexão com ElevenLabs: ${err.message}. Acionando fallback automático para Google Cloud Chirp 3 HD!`
      );
      this._activateChirpFallback();
      const cleanChirp = stripAudioTags(text);
      if (cleanChirp && this.chirpStream) {
        this.chirpStream.write({ input: { text: `${cleanChirp} ` } });
      }
    } finally {
      if (this.signal) {
        this.signal.removeEventListener('abort', onParentAbort);
      }
      if (this.currentAbortController === controller) {
        this.currentAbortController = null;
      }
    }
  }

  _activateChirpFallback() {
    if (this.elevenLabsFailed) return;
    this.elevenLabsFailed = true;
    this.supportsAudioTags = false;

    try {
      this.chirpStream = openChirp3CallStream({
        voice: this.voice,
        context: this.context,
        signal: this.signal
      });

      this.chirpStream.on('data', (chunk) => {
        if (!this.destroyed) {
          this.push(chunk);
        }
      });

      this.chirpStream.on('error', (err) => {
        if (!this.destroyed) {
          this.emit('error', err);
        }
      });

      this.chirpStream.on('end', () => {
        this._checkFlush();
      });
    } catch (chirpErr) {
      console.error('[CALL_TTS_STREAM] Erro crítico ao inicializar fallback Google Chirp 3 HD:', chirpErr.message);
      this.emit('error', chirpErr);
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
      const done = this.flushCallback;
      this.flushCallback = null;
      this.chirpStream.once('end', () => done());
      this.chirpStream.once('close', () => done());
      return;
    }

    const done = this.flushCallback;
    this.flushCallback = null;
    done();
  }

  _destroy(err, callback) {
    if (this.currentAbortController) {
      this.currentAbortController.abort(err || new Error('Stream destroyed'));
    }
    if (this.chirpStream) {
      this.chirpStream.destroy(err);
    }
    callback(err);
  }
}
