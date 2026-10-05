import test from 'node:test';
import assert from 'node:assert';
import {
  routeCallAudio
} from '../src/integrations/audio-router.mjs';
import {
  resolveElevenLabsVoice,
  isElevenLabsQuotaExceeded,
  synthesizeElevenLabsCallSpeech,
  streamElevenLabsCallSpeech,
  ELEVENLABS_CHARACTER_VOICES,
  ELEVENLABS_HIGH_QUALITY_SETTINGS
} from '../src/integrations/elevenlabs.mjs';
import {
  setGoogleTTSClientForTesting,
  DEFAULT_CHIRP3_HD_VOICE
} from '../src/integrations/google-chirp3-hd.mjs';

test('Estratégia Híbrida ElevenLabs (Prioritário) + Google Chirp 3 HD (Fallback)', async (t) => {
  const originalKey = process.env.ELEVENLABS_API_KEY;
  const originalFetch = globalThis.fetch;

  t.after(() => {
    if (originalKey === undefined) delete process.env.ELEVENLABS_API_KEY;
    else process.env.ELEVENLABS_API_KEY = originalKey;
    globalThis.fetch = originalFetch;
  });

  await t.test('1. Mapeamento de vozes dos personagens para as vozes originais reais', () => {
    assert.strictEqual(resolveElevenLabsVoice('sirlene'), 'EJV7H2baGt5ab95tOoSG');
    assert.strictEqual(resolveElevenLabsVoice('alex'), 'TX3LPaxmHKxFdv7VOQHJ');
    assert.strictEqual(resolveElevenLabsVoice('vital'), 'IKpiSijWzlhOL6uX83EH');
    assert.strictEqual(resolveElevenLabsVoice('rafael'), 'TX3LPaxmHKxFdv7VOQHJ');

    // Mapeamento a partir do nome de voz do Chirp
    assert.strictEqual(resolveElevenLabsVoice('pt-BR-Chirp3-HD-Achernar'), 'EJV7H2baGt5ab95tOoSG');
    assert.strictEqual(resolveElevenLabsVoice('pt-BR-Chirp3-HD-Charon'), 'IKpiSijWzlhOL6uX83EH');
  });

  await t.test('2. Parâmetros de Altíssima Fidelidade (Master Quality) estão ativos', () => {
    assert.strictEqual(ELEVENLABS_HIGH_QUALITY_SETTINGS.stability, 0.50);
    assert.strictEqual(ELEVENLABS_HIGH_QUALITY_SETTINGS.similarity_boost, 0.85);
    assert.strictEqual(ELEVENLABS_HIGH_QUALITY_SETTINGS.style, 0.15);
    assert.strictEqual(ELEVENLABS_HIGH_QUALITY_SETTINGS.use_speaker_boost, true);
  });

  await t.test('3. Detecção precisa de estouro de cota (HTTP 429 ou erro de créditos)', () => {
    assert.strictEqual(isElevenLabsQuotaExceeded(429), true);
    assert.strictEqual(isElevenLabsQuotaExceeded(401, 'Quota exceeded for this month'), true);
    assert.strictEqual(isElevenLabsQuotaExceeded(400, { detail: { status: 'insufficient_credits' } }), true);
    assert.strictEqual(isElevenLabsQuotaExceeded(200), false);
    assert.strictEqual(isElevenLabsQuotaExceeded(500, 'Internal Server Error'), false);
  });

  await t.test('4. Quando a cota do ElevenLabs está ativa, usa ElevenLabs com prioridade máxima', async () => {
    process.env.ELEVENLABS_API_KEY = 'test_elevenlabs_key_active';
    let elevenLabsCalled = false;
    let googleCalled = false;

    globalThis.fetch = async (url, options) => {
      if (String(url).includes('elevenlabs.io')) {
        elevenLabsCalled = true;
        assert.ok(String(url).includes('output_format=mp3_44100_192'), 'Deve usar qualidade de estúdio 192kbps');
        const body = JSON.parse(options.body);
        assert.strictEqual(body.voice_settings.similarity_boost, 0.85);
        assert.strictEqual(body.voice_settings.use_speaker_boost, true);
        return new Response(Buffer.from('FAKE_ELEVENLABS_192KBPS_AUDIO'), {
          status: 200,
          headers: { 'Content-Type': 'audio/mpeg' }
        });
      }
      return originalFetch(url, options);
    };

    setGoogleTTSClientForTesting({
      synthesizeSpeech: async () => {
        googleCalled = true;
        return [{ audioContent: Buffer.from('FAKE_CHIRP') }];
      }
    });

    const result = await routeCallAudio({
      text: 'Olá! Como posso ajudar você hoje?',
      callId: 'call-el-123',
      voice: 'sirlene'
    });

    assert.strictEqual(elevenLabsCalled, true, 'ElevenLabs deve ser chamado prioritariamente');
    assert.strictEqual(googleCalled, false, 'Google Chirp NÃO deve ser chamado enquanto houver cota ElevenLabs');
    assert.strictEqual(result.provider, 'ELEVENLABS');
    assert.strictEqual(result.voice_id, 'EJV7H2baGt5ab95tOoSG');
  });

  await t.test('5. Quando a cota do ElevenLabs acaba (HTTP 429), comuta automaticamente para o Google Chirp 3 HD', async () => {
    process.env.ELEVENLABS_API_KEY = 'test_elevenlabs_key_active';
    let elevenLabsCalled = false;
    let googleCalled = false;

    globalThis.fetch = async (url, options) => {
      if (String(url).includes('elevenlabs.io')) {
        elevenLabsCalled = true;
        return new Response(JSON.stringify({ detail: { status: 'quota_exceeded', message: 'Monthly character limit reached' } }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return originalFetch(url, options);
    };

    setGoogleTTSClientForTesting({
      synthesizeSpeech: async (request) => {
        googleCalled = true;
        assert.strictEqual(request.voice.name, 'pt-BR-Chirp3-HD-Achernar');
        return [{ audioContent: Buffer.from('FAKE_CHIRP3_FALLBACK_AUDIO') }];
      }
    });

    const result = await routeCallAudio({
      text: 'Continuando nosso atendimento sem interrupções.',
      callId: 'call-fallback-123',
      voice: 'sirlene'
    });

    assert.strictEqual(elevenLabsCalled, true, 'ElevenLabs foi tentado');
    assert.strictEqual(googleCalled, true, 'Google Chirp 3 HD DEVE ser acionado como fallback automático');
    assert.strictEqual(result.provider, 'google_chirp3_hd');
    assert.strictEqual(result.voice_id, 'pt-BR-Chirp3-HD-Achernar');
  });
});
