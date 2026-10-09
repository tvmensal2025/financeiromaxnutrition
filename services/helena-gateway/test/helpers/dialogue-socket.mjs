import { EventEmitter } from 'node:events';

/** Adaptador das simulações HTTP existentes para frames reais do protocolo de diálogo. Sem rede. */
export function mockDialogueSocket(request = (...args) => globalThis.fetch(...args)) {
  return class MockDialogueSocket extends EventEmitter {
    constructor(url, options) {
      super(); this.url = url; this.options = options; this.closed = false;
      queueMicrotask(() => { if (!this.closed) this.emit('open'); });
    }
    send(raw) {
      const frame = JSON.parse(raw);
      if (frame.voices) { this.setup = frame; return; }
      if (frame.close_socket) { this.closeRequested = true; return; }
      if (!frame.inputs) return;
      void (async () => {
        try {
          const input = frame.inputs[0];
          const response = await request(this.url, { headers: this.options.headers,
            body: JSON.stringify({ text: input.text, voice_id: input.voice_id,
              model_id: new URL(this.url).searchParams.get('model_id'), voice_settings: this.setup.voice_settings }) });
          if (!response.ok) {
            this.emit('message', Buffer.from(JSON.stringify({ error: await response.text(), code: response.status })));
            return;
          }
          for await (const bytes of response.body || []) {
            if (this.closed) return;
            this.emit('message', Buffer.from(JSON.stringify({ audio: Buffer.from(bytes).toString('base64') })));
          }
          if (!this.closed) this.emit('message', Buffer.from(this.closeRequested ? '{"is_final":true}' : '{"is_final_audio_for_turn":true}'));
        } catch (error) { if (!this.closed) this.emit('error', error); }
      })();
    }
    terminate() { this.closed = true; this.emit('close'); }
  };
}
