import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Transform, Readable } from 'node:stream';
import { readSSE, extractSentences, extractSpeechChunks, streamReplyToCall } from '../src/integrations/call-streaming.mjs';
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

it('separates context loading, provider response and text buffering in latency metrics', async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const result = await streamReplyToCall({ ...base,
    systemInstruction: wait(45).then(() => 'Atenda com gentileza.'),
    openTTS: () => fakeTTS(),
    fetchImpl: async (url, opts) => {
      if (url.includes('api.openai.com')) return { ok: true, body: Readable.from((async function* () {
        await wait(15);
        yield event(delta('Tudo '));
        await wait(25);
        yield event(delta('pronto. '));
        yield event(stop);
      })()) };
      for await (const chunk of opts.body) assert.ok(chunk.length);
      return Response.json({ ok: true });
    },
  });
  assert.ok(result.metrics.context_wait_ms >= 30);
  assert.ok(result.metrics.llm_provider_first_token_ms >= 10);
  assert.ok(result.metrics.llm_first_token_ms - result.metrics.llm_provider_first_token_ms >= 30);
  assert.ok(result.metrics.text_chunk_wait_ms >= 15);
  assert.ok(result.metrics.tts_first_audio_ms >= 0);
  assert.equal(result.text, 'Tudo pronto.');
});

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
  it('never invents a filler while waiting for a slow GPT response', async () => {
    const sentences = [];
    const result = await streamReplyToCall({ ...base,
      openTTS: ({ voice }) => { assert.equal(voice, base.voice); return fakeTTS(s => sentences.push(s)); },
      fetchImpl: async (url, opts) => {
        if (url.includes('api.openai.com')) return { ok: true, body: Readable.from((async function* () {
          await new Promise(resolve => setTimeout(resolve, 800));
          yield event(delta('A resposta está pronta.'));
          yield event(stop);
        })()) };
        for await (const chunk of opts.body) assert.ok(chunk.length);
        return Response.json({ ok: true });
      } });
    assert.deepEqual(sentences, ['A resposta está pronta. ']);
    assert.equal(result.text, 'A resposta está pronta.');
    assert.equal(result.metrics.backchannel_ms, null);
  });
  it('skips the acknowledgement when the answer is ready first', async () => {
    const sentences = [];
    const result = await streamReplyToCall({ ...base,
      openTTS: () => fakeTTS(s => sentences.push(s)),
      fetchImpl: async (url, opts) => {
        if (url.includes('api.openai.com')) return { ok: true, body: Readable.from([event(delta('Claro, aqui está.')), event(stop)]) };
        for await (const chunk of opts.body) assert.ok(chunk.length);
        return Response.json({ ok: true });
      } });
    assert.deepEqual(sentences, ['Claro, aqui está. ']);
    assert.equal(result.metrics.backchannel_ms, null);
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
      } }), err => err.interrupted === true && err.interruptionReason === 'playback_superseded' &&
        err.playbackHttpStatus === 409 && err.streamMetrics?.interruption_reason === 'playback_superseded');
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

it('emits a meaningful clause before the rest of a long sentence is generated', async () => {
  assert.deepEqual(extractSpeechChunks('Para entender melhor a sua situação, preciso saber mais'), {
    sentences: ['Para entender melhor a sua situação,'], rest: ' preciso saber mais'
  });
  assert.deepEqual(extractSpeechChunks('O valor é de 1234,56 reais'), {sentences: [], rest: 'O valor é de 1234,56 reais'});
  let release;
  const heard = new Promise(resolve => { release = resolve; });
  const sent = [];
  await streamReplyToCall({...base, openTTS: () => fakeTTS(s => { sent.push(s); release(); }),
    fetchImpl: async (url,opts) => {
      if (url.includes('api.openai.com')) return {ok:true,body:Readable.from((async function*(){
        yield event(delta('Para entender melhor a sua situação, '));
        await heard;
        yield event(delta('preciso saber mais.')); yield event(stop);
      })())};
      for await (const chunk of opts.body) assert.ok(chunk.length);
      return Response.json({ok:true});
    }});
  assert.deepEqual(sent,['Para entender melhor a sua situação, ','preciso saber mais. ']);
});

it('keeps generated acknowledgements and ellipses with their following thought', async () => {
  const sentences=[];
  await streamReplyToCall({...base,openTTS:()=>fakeTTS(s=>sentences.push(s)),fetchImpl:async(url,opts)=>{
    if(url.includes('api.openai.com'))return {ok:true,body:Readable.from([
      event(delta('Hum')),event(delta('... ')),event(delta('deixa eu ver. ')),
      event(delta('[pensando. ')),event(delta('pausa] Entendi. ')),event(delta('Nesse caso, muda um pouco.')),event(stop)
    ])};
    for await(const chunk of opts.body)assert.ok(chunk.length);
    return Response.json({ok:true});
  }});
  assert.deepEqual(sentences,['Hum… deixa eu ver. ','Entendi. Nesse caso, muda um pouco. ']);
});

it('does not play a response containing only hesitation or internal stage directions', async () => {
  for(const text of ['Hum…','[pensando]']) {
    const sentences=[];
    await assert.rejects(streamReplyToCall({...base,openTTS:()=>fakeTTS(s=>sentences.push(s)),fetchImpl:async(url,opts)=>{
      if(url.includes('api.openai.com'))return {ok:true,body:Readable.from([event(delta(text)),event(stop)])};
      for await(const chunk of opts.body)void chunk;
      return Response.json({ok:true});
    }}),/Empty streamed response|no streaming audio/);
    assert.deepEqual(sentences,[]);
  }
});

it('SSE framing accepts coalesced small events but rejects one oversized event',async()=>{
 const events=Array.from({length:2500},()=>event(delta('Olá.')));let count=0;
 for await(const _ of readSSE(Readable.from([Buffer.concat(events)]))) count++;
 assert.equal(count,2500);
 await assert.rejects(async()=>{for await(const _ of readSSE(Readable.from([Buffer.from('data: '+ 'x'.repeat(131073))]))){}},/Oversized/);
});

it('fala preparada também usa streaming, sem solicitar outra geração ao GPT', async () => {
  const sentences = []; let requests = 0;
  const result = await streamReplyToCall({ ...base, preparedSpeech: 'Olá, como você está?',
    openTTS: () => fakeTTS(sentence => sentences.push(sentence)),
    fetchImpl: async (_url, opts) => { requests++; for await (const bytes of opts.body) assert.ok(bytes.length); return Response.json({ ok: true }); },
  });
  assert.equal(requests, 1); // somente transporte de áudio, sem geração de texto
  assert.equal(result.text, 'Olá, como você está?');
  assert.deepEqual(sentences, ['Olá, como você está? ']);
});
