import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Transform, Readable } from 'node:stream';
import { readSSE, extractSentences, streamReplyToCall } from '../src/integrations/call-streaming.mjs';
import { openChirp3CallStream, setGoogleTTSClientForTesting } from '../src/integrations/google-chirp3-hd.mjs';

const event = data => Buffer.from(`data: ${JSON.stringify(data)}\r\n\r\n`);
const delta = text => ({ choices: [{ delta: { content: text } }] });
const stop = { choices: [{ delta: {}, finish_reason: 'stop' }] };
const base = { callId: 'test', speechEpoch: 2, apiKey: 'fake-key', systemInstruction: 'Atenda com gentileza.',
  userPrompt: 'Oi', history: [], voice: 'pt-BR-Chirp3-HD-Achird', baseUrl: 'http://transport', token: 'fake' };
function fakeTTS(onSentence = () => {}) {
  return new Transform({ objectMode: true, transform(message, _encoding, callback) {
    if (message.input) { onSentence(message.input.text); this.push({ audioContent: Buffer.alloc(3840) }); }
    callback();
  } });
}

describe('End-to-end voice streaming', () => {
  it('decodes UTF-8 and SSE records across arbitrary network boundaries', async () => {
    const payload = Buffer.concat([event(delta('Olá, João!')), Buffer.from('data: [DONE]\r\n\r\n')]);
    const packets = [...payload].map(byte => Buffer.from([byte]));
    const events = [];
    for await (const e of readSSE(Readable.from(packets))) events.push(e);
    assert.deepEqual(events, [delta('Olá, João!')]);
  });
  it('preserves decimals, abbreviations and incomplete sentence tails', () => {
    assert.deepEqual(extractSentences('O Dr. Vital explicou. Custa 19,90 reais. Você'), {
      sentences: ['O Dr. Vital explicou.', 'Custa 19,90 reais.'], rest: ' Você'
    });
    assert.deepEqual(extractSentences('Use 3.5 como exemplo.'), { sentences: [], rest: 'Use 3.5 como exemplo.' });
    assert.deepEqual(extractSentences('Tudo certo?', true), { sentences: ['Tudo certo?'], rest: '' });
  });
  it('sends audio to transport before OpenAI finishes generating', async () => {
    let releaseLLM;
    const firstAudio = new Promise(resolve => { releaseLLM = resolve; });
    let llmEnded = false;
    const sentences = [];
    const result = await streamReplyToCall({ ...base, openTTS: () => fakeTTS(s => sentences.push(s)),
      fetchImpl: async (url, opts) => {
        if (url.includes('api.openai.com')) return { ok: true, body: Readable.from((async function* () {
          yield event(delta('Olá, vamos conversar. '));
          await firstAudio;
          yield event(delta('Como posso ajudar?'));
          yield event(stop);
          llmEnded = true;
        })()) };
        assert.equal(opts.duplex, 'half');
        assert.equal(opts.headers['X-Speech-Epoch'], '2');
        let chunks = 0;
        for await (const chunk of opts.body) {
          if (chunks++ === 0) { assert.equal(llmEnded, false); releaseLLM(); }
          assert.ok(chunk.length > 0);
        }
        return Response.json({ ok: true, metrics: { first_frame_ms: 120 } });
      } });
    assert.deepEqual(sentences, ['Olá, vamos conversar. ', 'Como posso ajudar? ']);
    assert.equal(result.text, 'Olá, vamos conversar. Como posso ajudar?');
    assert.ok(result.metrics.llm_first_token_ms >= 0);
    assert.ok(result.audioBytes > 0);
  });
  it('cancels both providers when transport reports barge-in; never retries batch', async () => {
    let capturedSignal;
    let calls = 0;
    const tts = fakeTTS();
    await assert.rejects(streamReplyToCall({ ...base, openTTS: () => tts,
      fetchImpl: async (url, opts) => {
        calls++;
        if (!url.includes('api.openai.com')) return new Response('', { status: 409 });
        capturedSignal = opts.signal;
        return { ok: true, body: Readable.from((async function* () {
          await new Promise((_, reject) => {
            if (opts.signal.aborted) reject(opts.signal.reason);
            else opts.signal.addEventListener('abort', () => reject(opts.signal.reason), { once: true });
          });
        })()) };
      } }), err => err.interrupted === true);
    assert.equal(capturedSignal.aborted, true);
    assert.equal(tts.destroyed, true);
    assert.equal(calls, 2);
  });
  it('does not speak the incomplete tail when token generation is truncated', async () => {
    const sentences = [];
    await assert.rejects(streamReplyToCall({ ...base, openTTS: () => fakeTTS(s => sentences.push(s)),
      fetchImpl: async (url, opts) => {
        if (url.includes('api.openai.com')) return { ok: true, body: Readable.from([
          event(delta('O valor depende de')), event({ choices: [{ finish_reason: 'length' }] })
        ]) };
        for await (const chunk of opts.body) void chunk;
        return Response.json({ ok: true });
      } }), /Incomplete streamed response/);
    assert.deepEqual(sentences, []);
  });
  it('configures headerless PCM at 16kHz before submitting text to Google', async () => {
    let config;
    const tts = new Transform({ objectMode: true, transform(message, _encoding, done) { config = message; done(); } });
    setGoogleTTSClientForTesting({ streamingSynthesize: () => tts });
    try {
      const stream = openChirp3CallStream({ voice: base.voice });
      assert.deepEqual(config.streamingConfig.streamingAudioConfig, { audioEncoding: 'PCM', sampleRateHertz: 16000 });
      assert.equal(config.streamingConfig.voice.name, base.voice);
      stream.destroy();
    } finally { setGoogleTTSClientForTesting(null); }
  });
});
