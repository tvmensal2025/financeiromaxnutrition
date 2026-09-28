import { it } from 'node:test';
import assert from 'node:assert/strict';
import { pcm16To24k, transcribeLivePCM } from '../src/integrations/live-transcription.mjs';

it('resamples complete PCM16 frames from 16 to 24 kHz', () => {
  const source = Buffer.alloc(1920);
  for (let i = 0; i < 960; i++) source.writeInt16LE(i, i * 2);
  const result = pcm16To24k(source);
  assert.equal(result.length, 2880);
  assert.equal(result.readInt16LE(0), 0);
  assert.equal(result.readInt16LE(2), 1);
});

it('sends audio before commit and consumes the final live transcript', async () => {
  let audioBeforeCommit = 0, ended = false;
  class FakeSocket extends EventTarget {
    constructor(url, options) {
      super();
      assert.match(url, /intent=transcription/);
      assert.equal(options.headers.Authorization, 'Bearer test');
      queueMicrotask(() => this.dispatchEvent(new Event('open')));
    }
    send(raw) {
      const event = JSON.parse(raw);
      if (event.type === 'session.update') {
        assert.equal(event.session.audio.input.transcription.model, 'gpt-live-transcribe');
        queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ type: 'session.updated' }) })));
      }
      if (event.type === 'input_audio_buffer.append') audioBeforeCommit++;
      if (event.type === 'input_audio_buffer.commit') {
        assert.ok(audioBeforeCommit >= 2);
        assert.equal(ended, true);
        queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({
          type: 'conversation.item.input_audio_transcription.completed', transcript: 'Olá, preciso de ajuda.'
        }) })));
      }
    }
    close() {}
  }
  async function* audio() {
    yield Buffer.alloc(1921);
    yield Buffer.alloc(1919);
  }
  const result = await transcribeLivePCM(audio(), { apiKey: 'test', WebSocketImpl: FakeSocket, onInputEnd: () => { ended = true; } });
  assert.equal(result.text, 'Olá, preciso de ajuda.');
  assert.equal(result.metrics.audio_bytes, 3840);
  assert.ok(result.metrics.input_ended_at > 0);
  assert.ok(result.metrics.stt_after_commit_ms <= result.metrics.stt_final_ms);
});
