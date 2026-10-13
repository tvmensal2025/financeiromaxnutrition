import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isKokoroConfigured,
  getKokoroVoices,
  KOKORO_VOICES,
  KOKORO_OFFICIAL_VOICE_ID,
  KOKORO_DEFAULT_PROFILE_ID
} from '../src/integrations/kokoro.mjs';

test('Kokoro TTS - Verificação de Configuração e Vozes Oficiais', async (t) => {
  await t.test('isKokoroConfigured só liga com a chave no ambiente (sem valor padrão no código)', () => {
    const saved = [process.env.KW_SECRET_API_KEY, process.env.KOKORO_API_KEY];
    delete process.env.KW_SECRET_API_KEY; delete process.env.KOKORO_API_KEY;
    assert.equal(isKokoroConfigured(), false);
    process.env.KW_SECRET_API_KEY = 'chave-kokoro-de-teste';
    assert.equal(isKokoroConfigured(), true);
    if (saved[1] !== undefined) process.env.KOKORO_API_KEY = saved[1];
  });

  await t.test('getKokoroVoices retorna Kokoro como motor oficial e Pedro como voz padrão', async () => {
    const data = await getKokoroVoices();
    assert.equal(data.configured, true);
    assert.equal(data.provider, 'KOKORO');
    assert.equal(data.is_official_engine, true);
    assert.equal(data.default_voice_id, 'pm_alex*0.7+am_liam*0.3');
    assert.equal(data.default_profile_id, 'VP-KOKORO-MASC-03');
    assert.equal(data.official_voice.voice_id, 'pm_alex*0.7+am_liam*0.3');
    assert.equal(data.official_voice.is_official, true);
    assert.equal(data.official_voice.is_default, true);
    assert.ok(data.voices_pt_br.length >= 4);

    const voiceIds = data.voices_pt_br.map(v => v.voice_id);
    assert.ok(voiceIds.includes('pm_alex*0.7+am_liam*0.3'), 'Deve conter Pedro Oficial');
    assert.ok(voiceIds.includes('pm_santa'), 'Deve conter voz Santa / Dr. Vital');
    assert.ok(voiceIds.includes('pf_dora*0.7+af_heart*0.3'), 'Deve conter voz Assistente Sirlene');
  });

  await t.test('KOKORO_VOICES possui metadados válidos de gênero e idioma', () => {
    for (const v of KOKORO_VOICES.PT_BR) {
      assert.ok(v.voice_id);
      assert.ok(v.name);
      assert.ok(['female', 'male'].includes(v.gender));
      assert.equal(v.lang, 'pt-BR');
    }
  });

  await t.test('KOKORO_OFFICIAL_VOICE_ID está fixado no blend Pedro aprovado', () => {
    assert.equal(KOKORO_OFFICIAL_VOICE_ID, 'pm_alex*0.7+am_liam*0.3');
    assert.equal(KOKORO_DEFAULT_PROFILE_ID, 'VP-KOKORO-MASC-03');
  });
});
