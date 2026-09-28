import { describe, it } from 'node:test';
import assert from 'node:assert';
import { prepareVoiceHistory, completeVoiceReply } from '../src/integrations/voice-delivery.mjs';
import { callLlmProviderDetailed } from '../src/integrations/voice-agent.mjs';
import { transcribeAudio } from '../src/integrations/voice-agent.mjs';

it('transcribes call audio with OpenAI and never contacts ElevenLabs', async (t) => {
  const oldKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-openai';
  t.after(() => { if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey; });
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.strictEqual(String(url), 'https://api.openai.com/v1/audio/transcriptions');
    assert.strictEqual(options.body.get('model'), 'gpt-transcribe');
    assert.strictEqual(options.body.get('language'), 'pt');
    assert.strictEqual(options.headers.Authorization, 'Bearer test-openai');
    return Response.json({ text: '  Olá, tudo bem?  ' });
  });
  assert.strictEqual(await transcribeAudio(Buffer.alloc(320, 1)), 'Olá, tudo bem?');
});

it('keeps Google as the call voice provider when old settings arrive', async () => {
  const cfg = await updateVoiceAgentConfig({ voice_provider: 'ELEVENLABS', elevenlabs_voice: 'old', voice_profile_id: 'old' });
  assert.strictEqual(cfg.config.voice_provider, 'GOOGLE_CHIRP3_HD');
  assert.strictEqual('elevenlabs_voice' in cfg.config, false);
});

describe('Conversational delivery regressions', () => {
  it('keeps four exchanges and does not repeat the current user message', () => {
    const history = Array.from({ length: 10 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', text: `fala ${i}` }));
    history.push({ role: 'user', text: 'Quanto custa?' });
    const recent = prepareVoiceHistory(history, 'Quanto custa?');
    assert.strictEqual(recent.length, 8);
    assert.strictEqual(recent[0].content, 'fala 2');
    assert.ok(!recent.some(h => h.content === 'Quanto custa?'));
    assert.strictEqual(history.length, 11);
  });

  it('rejects truncated or filtered answers without stripping punctuation', () => {
    assert.strictEqual(completeVoiceReply('Sim, temos. Mas o valor depende de', 'length'), '');
    assert.strictEqual(completeVoiceReply('Sim, temos.', 'MAX_TOKENS'), '');
    assert.strictEqual(completeVoiceReply('Sim, temos.', 'content_filter'), '');
    assert.strictEqual(completeVoiceReply('Entendo, vamos conferir. Qual sabor você prefere?', 'stop'), 'Entendo, vamos conferir. Qual sabor você prefere?');
  });

  it('uses GPT with the active profile', async (t) => {
    const requests = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      requests.push({ url: String(url), body: JSON.parse(options.body) });
      return Response.json({ choices: [{ message: { content: 'Claro, vamos conferir. Qual sabor?' }, finish_reason: 'stop' }] });
    });
    const result = await callLlmProviderDetailed({ provider: 'OPENAI', model: 'gpt-6-luna', apiKey: 'test', systemInstruction: 'Você é Helena.', userPrompt: 'Oi', history: [{ role: 'user', text: 'Oi' }] });
    assert.strictEqual(result.reply, 'Claro, vamos conferir. Qual sabor?');
    assert.strictEqual(requests.length, 1);
    assert.strictEqual(requests[0].url, 'https://api.openai.com/v1/chat/completions');
    assert.strictEqual(requests[0].body.model, 'gpt-6-luna');
    assert.strictEqual(requests[0].body.messages.filter(m => m.role === 'user').length, 1);
    assert.match(requests[0].body.messages[0].content, /Você é Helena/);
  });

  it('does not call DeepSeek for a legacy provider value', async (t) => {
    let count = 0;
    t.mock.method(globalThis, 'fetch', async () => { count++; throw new Error('unexpected request'); });
    const result = await callLlmProviderDetailed({ provider: 'DEEPSEEK', model: 'DeepSeek-V4.1-Flash', apiKey: 'test', userPrompt: 'Desconto?' });
    assert.strictEqual(result.reply, '');
    assert.strictEqual(count, 0);
  });
});
import {
  getVoiceAgentConfig,
  updateVoiceAgentConfig,
  generateAgentSpeechText,
  DEFAULT_MAX_KNOWLEDGE_BASE,
  DEFAULT_AGENT_PERSONA,
  DEFAULT_INBOUND_GREETING
} from '../src/integrations/voice-agent.mjs';

describe('Voice Agent & Knowledge Base — Atendente Pedro Max Nutrition', () => {
  it('Configuração inicial contém o catálogo completo da Max Nutrition', async () => {
    const cfg = await getVoiceAgentConfig();
    assert.strictEqual(cfg.is_active, true);
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

  it('Configuração padrão adota OPENAI e modelo gpt-6-luna', async () => {
    const cfg = await getVoiceAgentConfig();
    assert.strictEqual(cfg.ai_provider, 'OPENAI');
    assert.strictEqual(cfg.ai_model, 'gpt-6-luna');
  });

  it('mantém GPT mesmo quando chegam configurações antigas de outro provedor', async () => {
    const result = await updateVoiceAgentConfig({ ai_provider: 'DEEPSEEK', ai_model: 'deepseek-flash', ai_api_key: 'legacy-key' });
    assert.strictEqual(result.config.ai_provider, 'OPENAI');
    assert.strictEqual(result.config.ai_model, 'gpt-6-luna');
    assert.strictEqual(result.config.ai_api_key, '');
  });

  it('resolveAiApiKey usa somente a chave OpenAI', async () => {
    const { resolveAiApiKey } = await import('../src/integrations/voice-agent.mjs');
    const original = process.env.OPENAI_API_KEY;
    try {
      process.env.OPENAI_API_KEY = 'test-gpt';
      assert.strictEqual(await resolveAiApiKey({ ai_provider: 'DEEPSEEK', ai_api_key: 'legacy-key' }), 'test-gpt');
    } finally { if (original === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = original; }
  });
});


 it('OpenAI uses only OPENAI_API_KEY even when a legacy DeepSeek key is configured', async () => {
  const { resolveAiApiKey } = await import('../src/integrations/voice-agent.mjs');
  const original = process.env.OPENAI_API_KEY;
  try {
   process.env.OPENAI_API_KEY = 'test-openai';
   assert.strictEqual(await resolveAiApiKey({ ai_provider: 'OPENAI', ai_api_key: 'legacy-deepseek' }), 'test-openai');
   delete process.env.OPENAI_API_KEY;
   assert.strictEqual(await resolveAiApiKey({ ai_provider: 'OPENAI', ai_api_key: 'legacy-deepseek' }), '');
  } finally { if (original === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = original; }
 });

 it('ends a registered call and ignores repeated termination events', async () => {
  const { registerCallSession, getActiveCallsList } = await import('../src/integrations/call-engine.mjs');
  const { handleCallEndedWebhook, handleCallConnectedWebhook } = await import('../src/integrations/voice-agent.mjs');
  const call_id = 'TERMINATION-REGRESSION';
  registerCallSession({ callId: call_id });
  assert.ok(getActiveCallsList().some(c => c.call_id === call_id));
  const result = await handleCallEndedWebhook({ call_id, reason: 'remote_hangup' });
  assert.ok(result.summary);
  assert.ok(!getActiveCallsList().some(c => c.call_id === call_id));
  assert.equal((await handleCallEndedWebhook({ call_id })).summary, null);
  assert.equal((await handleCallConnectedWebhook({ call_id })).reason, 'already_ended');
 });

it('removes every alias of an ended session', async () => {
 const { registerCallSession, getActiveCallsList, endCallSession } = await import('../src/integrations/call-engine.mjs');
 registerCallSession({callId:'ALIAS-FIRST',remoteNumber:'5511000000000'});
 registerCallSession({callId:'ALIAS-SECOND',remoteNumber:'5511000000000'});
 endCallSession({callId:'ALIAS-SECOND'});
 assert.ok(!getActiveCallsList().some(c=>c.call_id.startsWith('ALIAS-')));
});
