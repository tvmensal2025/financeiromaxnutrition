import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  getVoiceAgentConfig,
  updateVoiceAgentConfig,
  generateAgentSpeechText,
  DEFAULT_MAX_KNOWLEDGE_BASE,
  DEFAULT_AGENT_PERSONA,
  DEFAULT_INBOUND_GREETING,
  configureVoiceAgentStore
} from '../src/integrations/voice-agent.mjs';

describe('Voice Agent & Knowledge Base — Atendente Pedro Max Nutrition', () => {
  it('Configuração inicial contém o catálogo completo da Max Nutrition', async () => {
    const cfg = await getVoiceAgentConfig();
    assert.strictEqual(cfg.is_active, true);
    assert.strictEqual(cfg.voice_provider, 'KOKORO');
    assert.ok(cfg.agent_name.includes('Pedro'));
    assert.ok(cfg.knowledge_base.includes('100% Whey Protein Concentrado'));
    assert.ok(cfg.knowledge_base.includes('Creatina Monohidratada'));
    assert.ok(cfg.knowledge_base.includes('FRETE GRÁTIS'));
    assert.ok(cfg.persona.includes('Pedro'));
    assert.strictEqual(cfg.inbound_greeting, DEFAULT_INBOUND_GREETING);
  });

  it('Gera resposta sobre creatina com foco em vendas e brevidade para telefone', async () => {
    const text = await generateAgentSpeechText({ prompt: 'Qual a diferença entre a creatina e a creapure?' });
    assert.ok(text.length > 10);
    assert.ok(!text.includes('*'), 'Não deve conter asteriscos de markdown');
    assert.ok(!text.includes('#'), 'Não deve conter hashtags de markdown');
    assert.ok(text.toLowerCase().includes('creatina') || text.toLowerCase().includes('creapure'));
  });

  it('Gera resposta sobre frete grátis com as regras oficiais (R$ 199)', async () => {
    const text = await generateAgentSpeechText({ prompt: 'Vocês têm frete grátis?' });
    assert.ok(text.toLowerCase().includes('frete grátis') || text.toLowerCase().includes('cento e noventa e nove'));
    assert.ok(!text.includes('*'));
  });

  it('Gera resposta sobre pagamento informando Pix com desconto', async () => {
    const text = await generateAgentSpeechText({ prompt: 'Como funciona o pagamento no Pix?' });
    assert.ok(text.toLowerCase().includes('pix') || text.toLowerCase().includes('cinco por cento'));
  });

  it('Permite atualizar o "comando gigante" de conhecimento e a persona', async () => {
    const novoConhecimento = DEFAULT_MAX_KNOWLEDGE_BASE + '\nPRODUTO NOVO: Barra de Proteína Vegan 15g';
    await updateVoiceAgentConfig({
      knowledge_base: novoConhecimento,
      inbound_greeting: 'Olá! Sou o Pedro da Max Nutrition, como posso te ajudar?'
    });

    const updated = await getVoiceAgentConfig();
    assert.ok(updated.knowledge_base.includes('Barra de Proteína Vegan'));
    assert.strictEqual(updated.inbound_greeting, 'Olá! Sou o Pedro da Max Nutrition, como posso te ajudar?');
  });

  it('getCallHistory retorna histórico vazio inicial e persiste diálogos', async () => {
    const { getCallHistory } = await import('../src/integrations/voice-agent.mjs');
    const callId = 'test-call-' + Date.now();
    const history = getCallHistory(callId);
    assert.ok(Array.isArray(history));
    assert.strictEqual(history.length, 0);

    history.push({ role: 'user', text: 'Oi Pedro' });
    const check = getCallHistory(callId);
    assert.strictEqual(check.length, 1);
    assert.strictEqual(check[0].text, 'Oi Pedro');
  });

  it('Configuração padrão adota DEEPSEEK e modelo DeepSeek-V4.1-Flash', async () => {
    const cfg = await getVoiceAgentConfig();
    assert.strictEqual(cfg.ai_provider, 'DEEPSEEK');
    assert.strictEqual(cfg.ai_model, 'DeepSeek-V4.1-Flash');
  });

  it('resolveAiApiKey prioriza chave explícita e respeita variáveis de ambiente', async () => {
    const { resolveAiApiKey } = await import('../src/integrations/voice-agent.mjs');
    const keyCustom = await resolveAiApiKey({ ai_api_key: 'sk-custom-test-123' });
    assert.strictEqual(keyCustom, 'sk-custom-test-123');

    const origEnv = process.env.DEEPSEEK_API_KEY;
    process.env.DEEPSEEK_API_KEY = 'sk-env-deepseek-test';
    const keyEnv = await resolveAiApiKey({});
    assert.strictEqual(keyEnv, 'sk-env-deepseek-test');
    if (origEnv !== undefined) {
      process.env.DEEPSEEK_API_KEY = origEnv;
    } else {
      delete process.env.DEEPSEEK_API_KEY;
    }
  });

  it('falha na leitura administrativa mas mantém a configuração em cache para chamadas', async () => {
    let unavailable = false;
    configureVoiceAgentStore({ load: async () => {
      if (unavailable) throw new Error('Supabase indisponível');
      return { agent_name: 'Pedro vigente', is_active: true };
    } });
    try {
      await getVoiceAgentConfig();
      unavailable = true;
      await assert.rejects(getVoiceAgentConfig(), /Supabase indisponível/);
      const cached = await getVoiceAgentConfig({ allowStale: true });
      assert.strictEqual(cached.agent_name, 'Pedro vigente');
      assert.strictEqual(cached.ai_api_key, '');
    } finally {
      configureVoiceAgentStore(null);
    }
  });

  it('nunca entrega uma credencial de outro provedor ao modelo selecionado', async () => {
    const { resolveAiApiKey } = await import('../src/integrations/voice-agent.mjs');
    const names = ['DEEPSEEK_API_KEY', 'OPENAI_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
    const original = Object.fromEntries(names.map(name => [name, process.env[name]]));
    try {
      process.env.DEEPSEEK_API_KEY = 'deepseek-test-only';
      process.env.OPENAI_API_KEY = 'openai-test-only';
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      assert.strictEqual(await resolveAiApiKey({ ai_provider: 'OPENAI' }), 'openai-test-only');
      delete process.env.DEEPSEEK_API_KEY;
      assert.strictEqual(await resolveAiApiKey({ ai_provider: 'DEEPSEEK' }), '');
    } finally {
      for (const name of names) {
        if (original[name] === undefined) delete process.env[name];
        else process.env[name] = original[name];
      }
    }
  });

  it('sem leitura inicial do Supabase recusa atendimento com configuração padrão', async () => {
    configureVoiceAgentStore({ load: async () => { throw new Error('Supabase indisponível'); } });
    try {
      await assert.rejects(getVoiceAgentConfig({ allowStale: true }), /Supabase indisponível/);
    } finally {
      configureVoiceAgentStore(null);
    }
  });
});

