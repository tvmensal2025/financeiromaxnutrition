import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Readable, Transform } from 'node:stream';
import {
  openCallTTSStream,
  HybridCallTTSStream
} from '../src/integrations/call-tts-stream.mjs';
import {
  resetElevenLabsQuotaStatus,
  markElevenLabsQuotaExceeded,
  isElevenLabsQuotaCurrentlyExceeded
} from '../src/integrations/elevenlabs.mjs';
import { setGoogleTTSClientForTesting } from '../src/integrations/google-chirp3-hd.mjs';
import ELIVING_VOICE_CONFIG from '../src/integrations/eliving-voice-config.mjs';

const VOICES = ELIVING_VOICE_CONFIG.characters;

function fakeChirp() {
  const state = { config: null, text: '' };
  const stream = new Transform({
    objectMode: true,
    transform(msg, _enc, cb) {
      if (msg.streamingConfig) state.config = msg.streamingConfig;
      if (msg.input?.text) {
        state.text += msg.input.text;
        this.push({ audioContent: Buffer.alloc(3200, 2) });
      }
      cb();
    }
  });
  return { stream, state };
}

describe('call-tts-stream — Híbrido Telefônico (ElevenLabs V4 Turbo + reserva Google Chirp 3 HD)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetElevenLabsQuotaStatus();
    process.env.ELEVENLABS_API_KEY = 'test-eleven-key';
    delete process.env.ELEVENLABS_CALL_ENABLED;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetElevenLabsQuotaStatus();
    setGoogleTTSClientForTesting(null);
  });

  it('usa ElevenLabs V4 Turbo com PCM 16kHz, a voz e o padrão do personagem e as tags do dono', async () => {
    let capturedUrl = '';
    let capturedBody = null;
    let capturedHeaders = null;

    const mockFetch = async (url, opts) => {
      capturedUrl = url;
      capturedBody = JSON.parse(opts.body);
      capturedHeaders = opts.headers;

      // Retorna stream simulado com chunks de PCM 16kHz
      const fakePcmChunk = Buffer.alloc(1600, 1);
      return {
        ok: true,
        status: 200,
        body: Readable.from([fakePcmChunk, fakePcmChunk])
      };
    };

    const stream = openCallTTSStream({
      voice: 'sirlene',
      context: 'CALL',
      fetchImpl: mockFetch
    });

    assert.equal(stream.supportsAudioTags, true);

    const receivedChunks = [];
    stream.on('data', (data) => receivedChunks.push(data));

    // Escreve sentença com tag do dono, tag inventada e tag proibida com o aluno
    stream.write({ input: { text: '[curious] Olá! [warmly] Que prazer [sarcastic] conversar com você.' } });
    stream.end();

    await new Promise((resolve) => stream.once('finish', resolve));

    assert.ok(capturedUrl.includes(`api.elevenlabs.io/v1/text-to-speech/${VOICES.sirlene.voiceId}/stream`));
    assert.ok(capturedUrl.includes('output_format=pcm_16000'));
    assert.ok(!capturedUrl.includes('optimize_streaming_latency'), 'parâmetro obsoleto não é enviado');
    assert.equal(capturedHeaders['xi-api-key'], 'test-eleven-key');
    assert.equal(capturedHeaders['Accept'], 'audio/pcm');
    assert.equal(capturedBody.text, '[curious] Olá! Que prazer [sarcastic] conversar com você.');
    assert.equal(capturedBody.model_id, 'eleven_v4_turbo');
    assert.deepEqual(capturedBody.voice_settings, { ...VOICES.sirlene.voiceSettings });

    // Verifica que os chunks de áudio chegaram
    assert.ok(receivedChunks.length >= 2);
    assert.equal(receivedChunks[0].audioContent.length, 1600);
  });

  it('a voz vem do characterId da ligação, nunca da voz Google do painel', async () => {
    const urls = [];
    const mockFetch = async (url) => {
      urls.push(url);
      return { ok: true, status: 200, body: Readable.from([Buffer.alloc(320, 1)]) };
    };
    const stream = openCallTTSStream({ voice: 'pt-BR-Chirp3-HD-Achernar', characterId: 'rafael', fetchImpl: mockFetch });
    stream.resume();
    stream.write({ input: { text: 'Bom dia.' } });
    stream.end();
    await new Promise((resolve) => stream.once('finish', resolve));
    assert.equal(urls.length, 1);
    assert.ok(urls[0].includes(`/text-to-speech/${VOICES.rafael.voiceId}/stream`));
    assert.notEqual(VOICES.rafael.voiceId, VOICES.alex.voiceId);
  });

  it('tags somam no turno inteiro até o limite da configuração única, e [shouts] vale sozinho', async () => {
    const texts = [];
    const mockFetch = async (_url, opts) => {
      texts.push(JSON.parse(opts.body).text);
      return { ok: true, status: 200, body: Readable.from([Buffer.alloc(320, 1)]) };
    };
    const stream = new HybridCallTTSStream({ characterId: 'alex', fetchImpl: mockFetch });
    stream.resume();
    stream.write({ input: { text: '[excited] Isso!' } });
    stream.write({ input: { text: '[shouts] Bateu a meta!' } });
    stream.write({ input: { text: '[laughs] Que dia.' } });
    stream.write({ input: { text: '[short pause] Amanhã tem mais.' } });
    stream.end();
    await new Promise((resolve) => stream.once('finish', resolve));
    assert.deepEqual(texts, ['[excited] Isso!', '[shouts] Bateu a meta!', '[laughs] Que dia.', '[short pause] Amanhã tem mais.']);
  });

  it('aciona a reserva Google Chirp 3 HD na hora quando a cota da ElevenLabs esgota (HTTP 429), com a voz fixa do personagem e sem tags', async () => {
    const chirp = fakeChirp();
    setGoogleTTSClientForTesting({
      streamingSynthesize: () => chirp.stream
    });

    const mockFetch429 = async () => {
      return {
        ok: false,
        status: 429,
        text: async () => JSON.stringify({ detail: { status: 'quota_exceeded', message: 'Quota exceeded' } })
      };
    };

    const stream = openCallTTSStream({
      voice: 'pt-BR-Chirp3-HD-Achernar', // voz de outro personagem no painel: ignorada
      characterId: 'vital',
      context: 'CALL',
      fetchImpl: mockFetch429
    });

    const audioResponses = [];
    stream.on('data', (d) => audioResponses.push(d));
    let streamError = null;
    stream.on('error', (err) => { streamError = err; });

    // Envia sentença com tag que deverá sofrer fallback para o Chirp com a tag removida
    stream.write({ input: { text: '[clears throat] Nossa, que notícia fantástica!' } });
    stream.write({ input: { text: '[pause] Vamos marcar o exame?' } });
    stream.end();

    await new Promise((resolve) => stream.once('finish', resolve));

    // Circuit-breaker de cota deve ter sido marcado
    assert.equal(isElevenLabsQuotaCurrentlyExceeded(), true);
    assert.equal(stream.elevenLabsFailed, true);
    assert.equal(stream.supportsAudioTags, false);
    assert.equal(streamError, null, 'a ligação não cai');

    // Voz fixa do Dr. Vital e texto sem nenhuma tag
    assert.equal(chirp.state.config.voice.name, VOICES.vital.googleFallbackVoice);
    assert.doesNotMatch(chirp.state.text, /\[|\]/);
    assert.ok(chirp.state.text.includes('Nossa, que notícia fantástica!'));
    assert.ok(chirp.state.text.includes('Vamos marcar o exame?'));

    // Áudio do fallback foi entregue
    assert.ok(audioResponses.length > 0);
    assert.equal(audioResponses[0].audioContent.length, 3200);
  });

  it('com a cota já esgotada vai direto ao Google com a voz fixa do personagem', async () => {
    markElevenLabsQuotaExceeded();
    const chirp = fakeChirp();
    setGoogleTTSClientForTesting({ streamingSynthesize: () => chirp.stream });
    const stream = openCallTTSStream({ voice: 'pt-BR-Chirp3-HD-Charon', characterId: 'rafael', context: 'CALL' });
    assert.equal(chirp.state.config.voice.name, VOICES.rafael.googleFallbackVoice);
    stream.write({ input: { text: '[laughs] Oi, tudo bem? ' } });
    assert.equal(chirp.state.text, 'Oi, tudo bem? ', 'o stream do Google também remove tags');
    stream.destroy();
  });

  it('informa o provedor que realmente falou: ElevenLabs, Google na reserva, ou os dois no mesmo turno', async () => {
    const pcm = () => ({ ok: true, status: 200, body: Readable.from([Buffer.alloc(320, 1)]) });
    const onlyEleven = new HybridCallTTSStream({ characterId: 'sirlene', fetchImpl: async () => pcm() });
    assert.equal(onlyEleven.ttsProvider, null, 'antes de falar não há provedor');
    onlyEleven.resume();
    onlyEleven.write({ input: { text: 'Oi.' } });
    onlyEleven.end();
    await new Promise((resolve) => onlyEleven.once('finish', resolve));
    assert.equal(onlyEleven.ttsProvider, 'ELEVENLABS');

    const chirp = fakeChirp();
    setGoogleTTSClientForTesting({ streamingSynthesize: () => chirp.stream });
    let call = 0;
    const mixed = new HybridCallTTSStream({ characterId: 'alex', fetchImpl: async () => (++call === 1 ? pcm()
      : { ok: false, status: 429, text: async () => 'quota_exceeded' }) });
    mixed.resume();
    mixed.write({ input: { text: 'Primeira frase.' } });
    mixed.write({ input: { text: 'Segunda frase.' } });
    mixed.end();
    await new Promise((resolve) => mixed.once('finish', resolve));
    assert.equal(mixed.ttsProvider, 'ELEVENLABS+GOOGLE_CHIRP3_HD');
  });

  it('o stream direto do Google informa o Google como provedor', async () => {
    markElevenLabsQuotaExceeded();
    const chirp = fakeChirp();
    setGoogleTTSClientForTesting({ streamingSynthesize: () => chirp.stream });
    const stream = openCallTTSStream({ characterId: 'vital', context: 'CALL' });
    assert.equal(stream.ttsProvider, 'GOOGLE_CHIRP3_HD');
    stream.destroy();
  });

  it('usa diretamente o Google Chirp 3 HD se ELEVENLABS_API_KEY não estiver configurada', async () => {
    delete process.env.ELEVENLABS_API_KEY;
    delete process.env.ELEVEN_LABS_API_KEY;

    const chirp = fakeChirp();
    setGoogleTTSClientForTesting({
      streamingSynthesize: () => chirp.stream
    });

    const stream = openCallTTSStream({
      voice: 'sirlene',
      context: 'CALL'
    });

    assert.ok(stream);
    assert.equal(chirp.state.config?.streamingAudioConfig?.audioEncoding, 'PCM');
    assert.equal(chirp.state.config?.streamingAudioConfig?.sampleRateHertz, 16000);
    assert.equal(chirp.state.config?.voice?.name, VOICES.sirlene.googleFallbackVoice);
    stream.destroy();
  });
});
