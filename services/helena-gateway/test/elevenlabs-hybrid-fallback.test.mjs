import test from 'node:test';
import assert from 'node:assert';
import {
  routeCallAudio,
  routeCallPreviewAudio
} from '../src/integrations/audio-router.mjs';
import {
  resolveElevenLabsVoice,
  resolveVoiceCharacter,
  elevenLabsSpecForCharacter,
  isElevenLabsQuotaExceeded,
  resetElevenLabsQuotaStatus,
  ELEVENLABS_CHARACTER_VOICES
} from '../src/integrations/elevenlabs.mjs';
import {
  setGoogleTTSClientForTesting
} from '../src/integrations/google-chirp3-hd.mjs';
import ELIVING_VOICE_CONFIG from '../src/integrations/eliving-voice-config.mjs';

const VOICES = ELIVING_VOICE_CONFIG.characters;

test('Estratégia Híbrida ElevenLabs V4 (Prioritário) + Google Chirp 3 HD (Reserva) — voz única por personagem', async (t) => {
  const originalKey = process.env.ELEVENLABS_API_KEY;
  const originalFetch = globalThis.fetch;

  t.after(() => {
    if (originalKey === undefined) delete process.env.ELEVENLABS_API_KEY;
    else process.env.ELEVENLABS_API_KEY = originalKey;
    globalThis.fetch = originalFetch;
    resetElevenLabsQuotaStatus();
    setGoogleTTSClientForTesting(null);
  });

  await t.test('1. Cada personagem resolve para a própria voz da configuração única (Rafael ≠ Alex)', () => {
    assert.strictEqual(resolveElevenLabsVoice('sirlene'), VOICES.sirlene.voiceId);
    assert.strictEqual(resolveElevenLabsVoice('alex'), VOICES.alex.voiceId);
    assert.strictEqual(resolveElevenLabsVoice('vital'), VOICES.vital.voiceId);
    assert.strictEqual(resolveElevenLabsVoice('rafael'), VOICES.rafael.voiceId);
    assert.notStrictEqual(ELEVENLABS_CHARACTER_VOICES.rafael, ELEVENLABS_CHARACTER_VOICES.alex);
    assert.ok(ELEVENLABS_CHARACTER_VOICES.rafael.startsWith('B4ra'));

    // profile_key, nome e voz Google identificam o personagem
    assert.strictEqual(resolveElevenLabsVoice('rafael_intense'), VOICES.rafael.voiceId);
    assert.strictEqual(resolveElevenLabsVoice('Dr. Vital'), VOICES.vital.voiceId);
    assert.strictEqual(resolveElevenLabsVoice('drvital'), VOICES.vital.voiceId);
    assert.strictEqual(resolveElevenLabsVoice('pt-BR-Chirp3-HD-Achernar'), VOICES.sirlene.voiceId);
    assert.strictEqual(resolveElevenLabsVoice('pt-BR-Chirp3-HD-Charon'), VOICES.vital.voiceId);
    assert.strictEqual(resolveElevenLabsVoice('pt-BR-Chirp3-HD-Achird'), VOICES.rafael.voiceId);

    // Compatibilidade: voz legada Uneskee aponta para a Sirlene atual (nunca é usada)
    const uneskee = Object.keys(ELIVING_VOICE_CONFIG.legacyVoiceIds).find(id => ELIVING_VOICE_CONFIG.legacyVoiceIds[id].startsWith('Uneskee'));
    assert.strictEqual(resolveVoiceCharacter(uneskee), 'sirlene');
    assert.strictEqual(resolveElevenLabsVoice(uneskee), VOICES.sirlene.voiceId);

    // Nunca devolve uma voz solta: desconhecida cai na Sirlene
    assert.strictEqual(resolveElevenLabsVoice('voz-desconhecida-123'), VOICES.sirlene.voiceId);
  });

  await t.test('2. Spec por personagem: V4 Turbo ao vivo, V4 gravado e o padrão aprovado do personagem', () => {
    const live = elevenLabsSpecForCharacter('rafael', 'tempoReal');
    assert.deepStrictEqual(live, {
      characterId: 'rafael', voiceId: VOICES.rafael.voiceId, modelId: 'eleven_v4_turbo', voiceSettings: { ...VOICES.rafael.voiceSettings }
    });
    assert.strictEqual(elevenLabsSpecForCharacter('sirlene', 'gravado').modelId, 'eleven_v4');
    assert.throws(() => elevenLabsSpecForCharacter('ninguem'), /personagem desconhecido/);
    assert.throws(() => elevenLabsSpecForCharacter('alex', 'flash'), /uso desconhecido/);
  });

  await t.test('3. Detecção precisa de estouro de cota (HTTP 429 ou erro de créditos)', () => {
    assert.strictEqual(isElevenLabsQuotaExceeded(429), true);
    assert.strictEqual(isElevenLabsQuotaExceeded(401, 'Quota exceeded for this month'), true);
    assert.strictEqual(isElevenLabsQuotaExceeded(400, { detail: { status: 'insufficient_credits' } }), true);
    assert.strictEqual(isElevenLabsQuotaExceeded(200), false);
    assert.strictEqual(isElevenLabsQuotaExceeded(500, 'Internal Server Error'), false);
  });

  await t.test('4. Com cota, usa ElevenLabs V4 Turbo com a voz e o padrão do personagem (mesmo com voz Google de outro)', async () => {
    resetElevenLabsQuotaStatus();
    process.env.ELEVENLABS_API_KEY = 'test_elevenlabs_key_active';
    let elevenLabsUrl = '';
    let body = null;
    let googleCalled = false;

    globalThis.fetch = async (url, options) => {
      if (String(url).includes('elevenlabs.io')) {
        elevenLabsUrl = String(url);
        body = JSON.parse(options.body);
        return new Response(Buffer.from('FAKE_ELEVENLABS_192KBPS_AUDIO'), {
          status: 200,
          headers: { 'Content-Type': 'audio/mpeg' }
        });
      }
      throw new Error(`rede real bloqueada no teste: ${url}`);
    };

    setGoogleTTSClientForTesting({
      synthesizeSpeech: async () => {
        googleCalled = true;
        return [{ audioContent: Buffer.from('FAKE_CHIRP') }];
      }
    });

    const result = await routeCallAudio({
      text: '[curious] Olá! [angry] Como posso ajudar você hoje?',
      callId: 'call-el-123',
      characterId: 'rafael',
      voice: 'pt-BR-Chirp3-HD-Achernar'
    });

    assert.ok(elevenLabsUrl.includes(`/text-to-speech/${VOICES.rafael.voiceId}?`), 'voz do Rafael, nunca a voz do painel');
    assert.ok(elevenLabsUrl.includes('output_format=mp3_44100_192'));
    assert.strictEqual(body.model_id, 'eleven_v4_turbo');
    assert.deepStrictEqual(body.voice_settings, { ...VOICES.rafael.voiceSettings });
    assert.strictEqual(body.text, '[curious] Olá! Como posso ajudar você hoje?', 'tag proibida com o aluno sai antes do envio');
    assert.strictEqual(googleCalled, false, 'Google Chirp NÃO deve ser chamado enquanto houver cota ElevenLabs');
    assert.strictEqual(result.provider, 'ELEVENLABS');
    assert.strictEqual(result.voice_id, VOICES.rafael.voiceId);
  });

  await t.test('5. Sem cota (HTTP 429), comuta para o Google Chirp 3 HD com a voz FIXA do personagem e texto sem tags', async () => {
    resetElevenLabsQuotaStatus();
    process.env.ELEVENLABS_API_KEY = 'test_elevenlabs_key_active';
    let elevenLabsCalled = false;
    let googleRequest = null;

    globalThis.fetch = async (url) => {
      if (String(url).includes('elevenlabs.io')) {
        elevenLabsCalled = true;
        return new Response(JSON.stringify({ detail: { status: 'quota_exceeded', message: 'Monthly character limit reached' } }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      throw new Error(`rede real bloqueada no teste: ${url}`);
    };

    setGoogleTTSClientForTesting({
      synthesizeSpeech: async (request) => {
        googleRequest = request;
        return [{ audioContent: Buffer.from('FAKE_CHIRP3_FALLBACK_AUDIO') }];
      }
    });

    const result = await routeCallAudio({
      text: '[laughs] Continuando nosso atendimento sem interrupções.',
      callId: 'call-fallback-123',
      characterId: 'alex',
      voice: 'pt-BR-Chirp3-HD-Achernar' // voz de outro personagem no painel: ignorada
    });

    assert.strictEqual(elevenLabsCalled, true, 'ElevenLabs foi tentado');
    assert.ok(googleRequest, 'Google Chirp 3 HD DEVE ser acionado como reserva');
    assert.strictEqual(googleRequest.voice.name, VOICES.alex.googleFallbackVoice);
    assert.strictEqual(googleRequest.input.text, 'Continuando nosso atendimento sem interrupções.');
    assert.strictEqual(result.provider, 'google_chirp3_hd');
    assert.strictEqual(result.voice_id, VOICES.alex.googleFallbackVoice);
  });

  await t.test('6. Turno do app: prévia com ElevenLabs primeiro e reserva Google no mesmo formato (audio/mpeg)', async () => {
    resetElevenLabsQuotaStatus();
    process.env.ELEVENLABS_API_KEY = 'test_elevenlabs_key_active';
    let body = null;
    globalThis.fetch = async (url, options) => {
      if (String(url).includes('elevenlabs.io')) {
        assert.ok(String(url).includes(`/text-to-speech/${VOICES.vital.voiceId}?`));
        body = JSON.parse(options.body);
        return new Response(Buffer.from('MP3'), { status: 200, headers: { 'Content-Type': 'audio/mpeg' } });
      }
      throw new Error(`rede real bloqueada no teste: ${url}`);
    };
    const el = await routeCallPreviewAudio({ text: '[clears throat] Olá, aqui é o Dr. Vital.', characterId: 'vital' });
    assert.strictEqual(el.provider, 'ELEVENLABS');
    assert.strictEqual(el.content_type, 'audio/mpeg');
    assert.strictEqual(Buffer.from(el.audio_base64, 'base64').toString(), 'MP3');
    assert.strictEqual(body.model_id, 'eleven_v4_turbo');

    globalThis.fetch = async () => new Response('{"detail":{"status":"quota_exceeded"}}', { status: 429 });
    let googleRequest = null;
    setGoogleTTSClientForTesting({ synthesizeSpeech: async (request) => { googleRequest = request; return [{ audioContent: Buffer.from('CHIRP') }]; } });
    const reserve = await routeCallPreviewAudio({ text: '[clears throat] Olá, aqui é o Dr. Vital.', characterId: 'vital' });
    assert.strictEqual(reserve.provider, 'google_chirp3_hd');
    assert.strictEqual(reserve.content_type, 'audio/mpeg');
    assert.strictEqual(googleRequest.voice.name, VOICES.vital.googleFallbackVoice);
    assert.strictEqual(googleRequest.input.text, 'Olá, aqui é o Dr. Vital.');
  });
});
