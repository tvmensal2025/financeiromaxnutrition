import WebSocket from 'ws';

let testingSocket = null;
export function setElevenLabsDialogueSocketForTesting(implementation) { testingSocket = implementation; }

/** Uma conexão por turno, reaproveitada entre frases; credencial permanece no servidor. */
export class ElevenLabsDialogueSession {
  constructor({ spec, apiKey, outputFormat = 'pcm_16000', signal, timeoutMs = 5000,
    WebSocketImpl = testingSocket || WebSocket }) {
    this.spec = spec;
    this.signal = signal;
    this.timeoutMs = timeoutMs;
    this.finalizeAfterSpeech = !outputFormat.startsWith('pcm');
    this.closed = false;
    this.active = null;
    signal?.throwIfAborted();
    this.ready = new Promise((resolve, reject) => { this.resolveReady = resolve; this.rejectReady = reject; });
    this.ready.catch(() => {});
    const url = new URL('wss://api.elevenlabs.io/v1/text-to-dialogue/stream-input');
    url.searchParams.set('model_id', spec.modelId);
    url.searchParams.set('output_format', outputFormat);
    url.searchParams.set('language_code', 'pt');
    this.socket = new WebSocketImpl(url.toString(), { headers: { 'xi-api-key': apiKey }, maxPayload: 4_000_000 });
    this.timer = setTimeout(() => this.fail(new Error('Tempo esgotado na conexão de voz ElevenLabs')), timeoutMs);
    this.onAbort = () => this.fail(signal.reason || new DOMException('Ligação encerrada', 'AbortError'));
    signal?.addEventListener('abort', this.onAbort, { once: true });
    this.socket.on('open', () => {
      if (this.closed) return;
      clearTimeout(this.timer);
      try {
        this.socket.send(JSON.stringify({ voices: [spec.voiceId], voice_settings: spec.voiceSettings }), error => {
          if (error) this.fail(new Error('Não foi possível configurar a voz ElevenLabs'));
        });
        this.resolveReady();
      } catch { this.fail(new Error('Não foi possível configurar a voz ElevenLabs')); }
    });
    this.socket.on('message', bytes => {
      if (this.closed) return;
      try {
        const message = JSON.parse(bytes.toString());
        if (message.error || message.type === 'error') {
          const error = new Error('ElevenLabs recusou a síntese de voz');
          error.providerError = message;
          error.status = Number(message.code || message.status_code) || 0;
          this.fail(error);
          return;
        }
        const active = this.active;
        if (!active) return;
        if (typeof message.audio === 'string' && message.audio.length) {
          const audio = Buffer.from(message.audio, 'base64');
          if (audio.length) {
            active.bytes += audio.length;
            active.onAudio(audio);
            this.armTimeout();
          }
        }
        if (message.is_final || (message.is_final_audio_for_turn && !this.finalizeAfterSpeech)) {
          clearTimeout(this.timer);
          this.active = null;
          if (active.bytes) active.resolve();
          else {
            const error = new Error('ElevenLabs encerrou a síntese sem áudio');
            active.reject(error);
            this.fail(error);
          }
        }
      } catch {
        this.fail(new Error('Resposta inválida do serviço de voz ElevenLabs'));
      }
    });
    this.socket.on('unexpected-response', (_request, response) => {
      const error = new Error('ElevenLabs recusou a conexão de voz');
      error.status = response.statusCode;
      let body = '';
      response.on('data', bytes => { if (body.length < 8192) body += bytes.toString().slice(0, 8192 - body.length); });
      response.on('end', () => { error.providerError = body; this.fail(error); });
    });
    this.socket.on('error', () => this.fail(new Error('Falha na conexão de voz ElevenLabs')));
    this.socket.on('close', () => {
      if (!this.closed) this.fail(new Error('Conexão ElevenLabs interrompida antes de concluir a fala'));
    });
    if (signal?.aborted) this.onAbort();
  }

  armTimeout() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.fail(new Error('ElevenLabs parou de enviar áudio')), this.timeoutMs);
  }

  async synthesize(text, onAudio) {
    await this.ready;
    this.signal?.throwIfAborted();
    if (this.closed) throw this.failure || new Error('Conexão de voz encerrada');
    if (this.active) throw new Error('Uma fala já está sendo sintetizada');
    return await new Promise((resolve, reject) => {
      this.active = { resolve, reject, onAudio, bytes: 0 };
      this.armTimeout();
      try {
        this.socket.send(JSON.stringify({ inputs: [{ text, voice_id: this.spec.voiceId, new_turn: true }], flush: true }), error => {
          if (error) this.fail(new Error('Não foi possível enviar a fala à ElevenLabs'));
        });
        // MP3/Opus retêm bytes no encoder: só is_final garante o final íntegro do arquivo.
        if (this.finalizeAfterSpeech) this.socket.send(JSON.stringify({ close_socket: true }), error => {
          if (error) this.fail(new Error('Não foi possível finalizar a fala ElevenLabs'));
        });
      } catch {
        this.fail(new Error('Não foi possível enviar a fala à ElevenLabs'));
      }
    });
  }

  fail(error) {
    if (this.closed) return;
    this.failure = error;
    this.rejectReady(error);
    const active = this.active;
    this.active = null;
    active?.reject(error);
    this.close();
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    clearTimeout(this.timer);
    this.signal?.removeEventListener('abort', this.onAbort);
    // terminate cancela também handshakes pendentes e geração quando há interrupção do usuário.
    this.socket.terminate();
  }
}
