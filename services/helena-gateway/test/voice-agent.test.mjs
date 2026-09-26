import { describe, it } from 'node:test';
import assert from 'node:assert';
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
});
