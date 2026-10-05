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

describe('call-tts-stream — Híbrido Telefônico (ElevenLabs + Google Chirp 3 HD)', () => {
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

  it('usa ElevenLabs prioritariamente com PCM 16kHz e preserva Audio Tags oficiais', async () => {
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

    // Escreve sentença com audio tag
    stream.write({ input: { text: '[warmly] Olá! Que prazer conversar com você.' } });
    stream.end();

    await new Promise((resolve) => stream.once('finish', resolve));

    assert.ok(capturedUrl.includes('api.elevenlabs.io/v1/text-to-speech'));
    assert.ok(capturedUrl.includes('output_format=pcm_16000'));
    assert.equal(capturedHeaders['xi-api-key'], 'test-eleven-key');
    assert.equal(capturedHeaders['Accept'], 'audio/pcm');
    // Verifica que a tag foi preservada no payload enviado ao ElevenLabs
    assert.ok(capturedBody.text.includes('[warmly]'));
    assert.equal(capturedBody.model_id, 'eleven_multilingual_v2');

    // Verifica que os chunks de áudio chegaram
    assert.ok(receivedChunks.length >= 2);
    assert.equal(receivedChunks[0].audioContent.length, 1600);
  });

  it('aciona fallback instantâneo para Google Chirp 3 HD quando cota do ElevenLabs esgota (HTTP 429)', async () => {
    let chirpWrittenText = '';
    const fakeChirpStream = new Transform({
      objectMode: true,
      transform(msg, _enc, cb) {
        if (msg.input?.text) {
          chirpWrittenText += msg.input.text;
          this.push({ audioContent: Buffer.alloc(3200, 2) });
        }
        cb();
      }
    });

    setGoogleTTSClientForTesting({
      streamingSynthesize: () => fakeChirpStream
    });

    const mockFetch429 = async () => {
      return {
        ok: false,
        status: 429,
        text: async () => JSON.stringify({ detail: { status: 'quota_exceeded', message: 'Quota exceeded' } })
      };
    };

    const stream = openCallTTSStream({
      voice: 'sirlene',
      context: 'CALL',
      fetchImpl: mockFetch429
    });

    const audioResponses = [];
    stream.on('data', (d) => audioResponses.push(d));

    // Envia sentença com tag que deverá sofrer fallback para o Chirp com a tag removida
    stream.write({ input: { text: '[laughs] Nossa, que notícia fantástica!' } });
    stream.end();

    await new Promise((resolve) => stream.once('finish', resolve));

    // Circuit-breaker de cota deve ter sido marcado
    assert.equal(isElevenLabsQuotaCurrentlyExceeded(), true);
    assert.equal(stream.elevenLabsFailed, true);
    assert.equal(stream.supportsAudioTags, false);

    // No Google Chirp 3 HD, a tag deve ser estritamente removida
    assert.ok(!chirpWrittenText.includes('[laughs]'));
    assert.ok(chirpWrittenText.includes('Nossa, que notícia fantástica!'));

    // Áudio do fallback foi entregue
    assert.ok(audioResponses.length > 0);
    assert.equal(audioResponses[0].audioContent.length, 3200);
  });

  it('usa diretamente o Google Chirp 3 HD se ELEVENLABS_API_KEY não estiver configurada', async () => {
    delete process.env.ELEVENLABS_API_KEY;
    delete process.env.ELEVEN_LABS_API_KEY;

    let configSent = null;
    const fakeChirpStream = new Transform({
      objectMode: true,
      transform(msg, _enc, cb) {
        if (msg.streamingConfig) configSent = msg.streamingConfig;
        cb();
      }
    });

    setGoogleTTSClientForTesting({
      streamingSynthesize: () => fakeChirpStream
    });

    const stream = openCallTTSStream({
      voice: 'sirlene',
      context: 'CALL'
    });

    assert.ok(stream);
    assert.equal(configSent?.streamingAudioConfig?.audioEncoding, 'PCM');
    assert.equal(configSent?.streamingAudioConfig?.sampleRateHertz, 16000);
    stream.destroy();
  });
});
