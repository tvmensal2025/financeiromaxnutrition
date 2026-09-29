import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createVoiceAgentStore } from '../src/integrations/voice-agent-store.mjs';

describe('Configuração de voz no Supabase', () => {
  it('lê o perfil da empresa e nunca devolve uma chave de API', async () => {
    const store = createVoiceAgentStore(async () => [{
      profile_id: 'VP-VOICE-AGENT-BIZ-002', business_id: 'BIZ-002',
      settings: { voice_agent: { persona: 'Pedro', is_active: true, ai_api_key: 'não-expor' } }
    }]);
    assert.deepEqual(await store.load(), { persona: 'Pedro', is_active: true });
  });

  it('recupera a versão mais recente do conhecimento legado antes do primeiro perfil', async () => {
    const paths = [];
    const store = createVoiceAgentStore(async path => {
      paths.push(path);
      if (path.includes('voice_profiles')) return [];
      if (path.includes('AI_PROVIDER')) return [{ valor: 'DEEPSEEK' }];
      if (path.includes('AI_MODEL')) return [{ valor: 'modelo-configurado' }];
      return [{ valor: path.includes('KNOWLEDGE_BASE') ? 'Catálogo vigente' : 'Persona vigente' }];
    });
    assert.deepEqual(await store.load(), { knowledge_base: 'Catálogo vigente', persona: 'Persona vigente', ai_provider: 'DEEPSEEK', ai_model: 'modelo-configurado' });
    assert.equal(paths.filter(path => path.includes('order=registro_id.desc')).length, 4);
  });

  it('grava somente campos permitidos no perfil da Max Nutrition e exige confirmação', async () => {
    let received;
    const store = createVoiceAgentStore(async (path, options) => {
      received = { path, options };
      return [{ profile_id: 'VP-VOICE-AGENT-BIZ-002', business_id: 'BIZ-002' }];
    });
    const saved = await store.save({ persona: 'Pedro', ai_api_key: 'não-gravar', is_active: false });
    assert.deepEqual(saved, { persona: 'Pedro', is_active: false });
    assert.match(received.path, /on_conflict=profile_id/);
    assert.equal(received.options.method, 'POST');
    const [row] = JSON.parse(received.options.body);
    assert.equal(row.profile_id, 'VP-VOICE-AGENT-BIZ-002');
    assert.equal(row.business_id, 'BIZ-002');
    assert.equal(row.enabled, false);
    assert.equal(JSON.stringify(row).includes('não-gravar'), false);
    const denied = createVoiceAgentStore(async () => []);
    await assert.rejects(denied.save({ persona: 'Pedro' }), /não confirmou/);
  });

  it('recusa perfil retornado de outra empresa', async () => {
    const store = createVoiceAgentStore(async () => [{
      profile_id: 'VP-VOICE-AGENT-BIZ-002', business_id: 'BIZ-001', settings: {}
    }]);
    await assert.rejects(store.load(), /fora da empresa/);
  });

  it('preserva provedor e voz ElevenLabs ao gravar e recarregar o perfil', async () => {
    let rows = [];
    const store = createVoiceAgentStore(async (_path, options) => {
      if (options?.body) rows = JSON.parse(options.body);
      return rows;
    });
    const settings = { voice_provider: 'ELEVENLABS', elevenlabs_voice: 'voice-test', is_active: true };
    await store.save(settings);
    assert.equal(rows[0].provider, 'ELEVENLABS');
    assert.equal(rows[0].voice_id, 'voice-test');
    assert.deepEqual(await store.load(), settings);
    await assert.rejects(store.save({ voice_provider: 'UNKNOWN' }), /não suportado/);
  });

  it('persiste o provedor Google Chirp 3 HD usado em produção', async () => {
    let rows = [];
    const store = createVoiceAgentStore(async (_path, options) => {
      if (options?.body) rows = JSON.parse(options.body);
      return rows;
    });
    const settings = { voice_provider: 'GOOGLE_CHIRP3_HD', call_voice: 'pt-BR-Chirp3-HD-Achernar', is_active: true };
    await store.save(settings);
    assert.equal(rows[0].provider, 'GOOGLE_CHIRP3_HD');
    assert.equal(rows[0].voice_id, 'pt-BR-Chirp3-HD-Achernar');
    assert.deepEqual(await store.load(), settings);
  });
});
