/**
 * voice-agent.mjs — Cérebro de Voz e Atendimento da Max Nutrition
 * Integra: Personalidade do Atendente (Pedro/Helena) + Base de Conhecimento ("Comando Gigante")
 * + Síntese Neural Kokoro TTS VPS + Meowcaller (WhatsApp VoIP)
 */

import { synthesizeKokoroSpeech, KOKORO_DEFAULT_PROFILE_ID, KOKORO_OFFICIAL_VOICE_ID } from './kokoro.mjs';

// ======================================================================
// BASE DE CONHECIMENTO & CATÁLOGO PADRÃO DA MAX NUTRITION ("COMANDO GIGANTE")
// ======================================================================

export const DEFAULT_MAX_KNOWLEDGE_BASE = `
===============================================================================
CATÁLOGO OFICIAL DE PRODUTOS, SERVIÇOS & REGRAS COMERCIAIS — MAX NUTRITION
===============================================================================

1. PROTEÍNAS E CONSTRUÇÃO MUSCULAR:
- 100% Whey Protein Concentrado (900g e 1.8kg):
  * 24g de proteína de alto valor biológico e 5.4g de BCAAs por dose.
  * Matéria-prima importada glanbia, rápida digestão.
  * Sabores: Chocolate Belga, Baunilha Bourbon, Morango Silvestre, Cookies & Cream, Banana Flambada e Doce de Leite.
  * Indicação: Ganho de massa muscular magra, recuperação pós-treino e suporte proteico diário.
- Iso Whey 100% Isolado (900g):
  * Microfiltrado por fluxo cruzado (CFM), zero lactose, zero açúcar, zero gordura e zero glúten.
  * 27g de proteína pura por dose.
  * Sabores: Chocolate Puro, Baunilha Suave e Morango.
  * Indicação: Definição muscular, perda de gordura e pessoas com intolerância severa à lactose.
- 3W Whey Protein Blend (900g):
  * Mistura sinérgica de Concentrado, Isolado e Hidrolisado para absorção gradual de aminoácidos.

2. FORÇA, POTÊNCIA & PERFORMANCE MÁXIMA:
- Creatina Monohidratada 100% Pura Micronizada (300g e 500g):
  * 100% pura, grau farmacêutico, sem sabor, dissolução instantânea.
  * Benefícios: Aumento expressivo de força muscular, explosão em treinos intensos, aumento do volume celular e melhora cognitiva.
  * Como tomar: 3g a 5g ao dia, todos os dias, de preferência com uma fonte de carboidrato.
- Creatina Creapure (300g):
  * Matéria-prima com selo Creapure importada da Alemanha, máxima pureza e rastreabilidade mundial.
- Pré-Treino Hórus (300g):
  * Fórmula completa: 2000mg Beta-Alanina, 200mg Cafeína anidra, 1000mg Arginina e 1000mg Taurina.
  * Efeito: Foco mental afiado, resistência à fadiga muscular (diminui queimação) e pump vascular intenso.
  * Sabores: Frutas Vermelhas, Citrus Ice, Maçã Verde e Algodão Doce.
- Pré-Treino Panic Extreme (300g):
  * Alta dosagem para atletas avançados (400mg cafeína por dose).

3. RECUPERAÇÃO, IMUNIDADE & SAÚDE INTEGRAL:
- Glutamina Pura 100% (300g):
  * Fortalecimento da imunidade, recuperação muscular e regeneração da mucosa intestinal.
- BCAA 2:1:1 e 8:1:1 (Pó 300g e 120 cápsulas):
  * Leucina, Isoleucina e Valina para evitar catabolismo muscular durante treinos intensos em jejum.
- Multivitamínico Mega Vita A-Z (90 cápsulas):
  * 23 vitaminas e minerais com 100% do valor diário recomendado para suprir carências nutricionais.
- Ômega 3 Ultra Concentrado (120 cápsulas softgel):
  * Alta concentração de EPA (540mg) e DHA (360mg), livre de metais pesados, ação anti-inflamatória e saúde cardiovascular.

4. SNACKS, PASTAS & ALIMENTAÇÃO SAUDÁVEL:
- Pasta de Amendoim Integral 1kg:
  * Sabores: Tradicional Torrada, Chocowhey com Whey Protein, Cookies & Cream e Crocante.
  * Zero adição de açúcar, rica em gorduras boas e proteínas vegetais.
- Protein Crisp Bar (Caixa com 12 barras):
  * 15g de proteína por barra, cobertura deliciosa, zero glúten. Praticidade para lanches rápidos.

5. POLÍTICAS COMERCIAIS, PAGAMENTO & FRETE:
- Formas de Pagamento:
  * Pix com 5% de desconto imediato à vista e aprovação no mesmo segundo.
  * Cartão de Crédito em até 12x sem juros (todas as bandeiras aceitas).
  * Boleto Bancário à vista (vencimento em 2 dias úteis).
- Frete e Prazos de Entrega:
  * FRETE GRÁTIS para todo o Brasil em compras acima de R$ 199,00.
  * Envio rápido: Despacho em até 24 horas úteis após a confirmação do pagamento.
  * Código de rastreamento enviado automaticamente pelo WhatsApp e por e-mail.
- Garantia & Políticas de Troca:
  * 7 dias corridos para devolução ou troca por arrependimento incondicional.
  * 30 dias para qualquer defeito de fabricação, avaria no transporte ou lacre violado.
- Programa de Assinatura (Clube Max):
  * 15% de desconto perpétuo em todos os suplementos da assinatura mensal.
  * Entrega programada automática todo mês na casa do cliente sem surpresas.
  * Sem fidelidade: o cliente pode pausar ou cancelar quando quiser pelo WhatsApp.
`.trim();

export const DEFAULT_AGENT_PERSONA = `
Você é o Pedro, o consultor e atendente oficial de voz e vendas da Max Nutrition pelo WhatsApp VoIP.
Você está conversando por TELEFONE/VOZ em tempo real com o cliente.

DIRETRIZES DE PERSONALIDADE & VOZ:
1. Tom de Voz: Jovem, dinâmico, enérgico, seguro, prestativo e cordial. Fale com naturalidade brasileira ("Olá!", "Com certeza!", "Perfeito!", "Excelente escolha!").
2. Objetividade Telefônica: NUNCA faça respostas longas. Fale no MÁXIMO 2 ou 3 frases por intervenção (entre 15 e 40 palavras). Em ligações, o cliente quer respostas rápidas e diretas ao ponto.
3. Formato Limpo para Fala (TTS): NUNCA utilize asteriscos (* ou **), hashtags (#), travessões, listas pontuadas ou emojis no texto, pois o texto será falado pelo sintetizador neural de voz.
4. Condução da Conversa: Sempre responda à dúvida do cliente usando a Base de Conhecimento e termine convidando o cliente a avançar (ex: "Quer que eu separe o seu pedido agora?", "Qual sabor você prefere no Whey?").
5. Confiança e Precisão: Forneça informações exatas de preços, frete grátis acima de R$ 199 e pagamento via Pix com 5% de desconto.
`.trim();

export const DEFAULT_INBOUND_GREETING = "Olá! Seja muito bem-vindo à Max Nutrition, aqui é o Pedro! Como posso te ajudar hoje?";
export const DEFAULT_OUTBOUND_GREETING = "Olá! Tudo bem? Aqui é o Pedro da Max Nutrition! Estou ligando para tirar suas dúvidas e te passar novidades sobre seus suplementos!";

// ======================================================================
// GERENCIADOR DE ESTADO & CACHE EM MEMÓRIA
// ======================================================================

let cachedConfig = {
  agent_name: 'Pedro (Consultor Oficial Max Nutrition)',
  persona: DEFAULT_AGENT_PERSONA,
  knowledge_base: DEFAULT_MAX_KNOWLEDGE_BASE,
  inbound_greeting: DEFAULT_INBOUND_GREETING,
  outbound_greeting: DEFAULT_OUTBOUND_GREETING,
  voice_profile_id: 'VP-KOKORO-MASC-03',
  kokoro_voice: KOKORO_OFFICIAL_VOICE_ID,
  ai_provider: 'GEMINI',
  ai_model: 'gemini-1.5-flash',
  ai_api_key: '',
  is_active: true,
  updated_at: new Date().toISOString()
};

/**
 * Retorna as configurações do Agente de Voz e Memória de Produtos
 */
export async function getVoiceAgentConfig() {
  return { ...cachedConfig };
}

/**
 * Atualiza e persiste as configurações do Agente de Voz
 */
export async function updateVoiceAgentConfig(newSettings = {}) {
  cachedConfig = {
    ...cachedConfig,
    ...newSettings,
    updated_at: new Date().toISOString()
  };
  return { ok: true, config: cachedConfig };
}

// ======================================================================
// GERAÇÃO INTELIGENTE DE RESPOSTAS (LLM + FALLBACK CONTEXTUAL)
// ======================================================================

/**
 * Gera texto de resposta do Pedro para uma pergunta ou fala do cliente
 */
export async function generateAgentSpeechText({ prompt = '', history = [], callContext = {} }) {
  const cleanPrompt = String(prompt).trim();
  const cfg = await getVoiceAgentConfig();

  // 1. Tenta invocar IA externa se API key estiver configurada
  const apiKey = cfg.ai_api_key || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.GROK_API_KEY;
  if (apiKey) {
    try {
      const systemInstruction = `${cfg.persona}\n\nBASE DE CONHECIMENTO OFICIAL DA MAX NUTRITION:\n${cfg.knowledge_base}`;
      const responseText = await callLlmProvider({
        provider: cfg.ai_provider,
        model: cfg.ai_model,
        apiKey,
        systemInstruction,
        userPrompt: cleanPrompt,
        history
      });
      if (responseText && responseText.trim().length > 0) {
        return sanitizeSpeechText(responseText);
      }
    } catch (err) {
      console.warn('[VOICE_AGENT] Falha na chamada da IA externa, acionando motor inteligente local:', err.message);
    }
  }

  // 2. Motor Inteligente Heurístico Local (baseado no Catálogo Max Nutrition)
  return sanitizeSpeechText(generateLocalResponse(cleanPrompt, cfg));
}

/**
 * Motor local baseado na Base de Conhecimento quando IA externa não responde
 */
function generateLocalResponse(query, cfg) {
  const q = query.toLowerCase();

  if (!q || q.includes('ola') || q.includes('oi') || q.includes('bom dia') || q.includes('boa tarde')) {
    return cfg.inbound_greeting || DEFAULT_INBOUND_GREETING;
  }

  if (q.includes('creatina')) {
    if (q.includes('creapure') || q.includes('diferenca') || q.includes('diferença')) {
      return "Nossa creatina padrão é monohidratada e cem por cento pura. Já a versão Creapure tem selo de pureza máxima da Alemanha. Ambas garantem aumento de força e ganho de massa. Qual tamanho você prefere, trezentas ou quinhentas gramas?";
    }
    return "Temos a Creatina Monohidratada cem por cento pura de trezentas e quinhentas gramas, e também a linha Creapure alemã. Ela aumenta a força e a recuperação muscular. Quer que eu separe uma no seu pedido?";
  }

  if (q.includes('whey') || q.includes('proteina') || q.includes('proteína')) {
    if (q.includes('isolado') || q.includes('lactose')) {
      return "O nosso Iso Whey é cem por cento isolado, tem vinte e sete gramas de proteína por dose e é totalmente livre de lactose e glúten. Temos sabores chocolate, baunilha e morango. Qual você mais gosta?";
    }
    return "Nosso Whey Concentrado tem vinte e quatro gramas de proteína pura e cinco gramas de BCAAs por dose. Sabores campeões são chocolate belga, baunilha e cookies. Você busca ganho de massa ou definição?";
  }

  if (q.includes('pre treino') || q.includes('pré treino') || q.includes('horus') || q.includes('hórus') || q.includes('panic')) {
    return "Temos o pré-treino Hórus com beta-alanina e cafeína para foco e resistência, e o Panic Extreme com quatrocentos miligramas de cafeína para treinos pesados. Qual a sua intensidade de treino habitual?";
  }

  if (q.includes('frete') || q.includes('entrega') || q.includes('prazo')) {
    return "Temos frete grátis para todo o Brasil em compras acima de cento e noventa e nove reais. Enviamos em até vinte e quatro horas úteis com rastreamento direto no seu WhatsApp. Me fala seu CEP que já calculo o prazo certinho!";
  }

  if (q.includes('pagamento') || q.includes('pix') || q.includes('cartao') || q.includes('cartão') || q.includes('parcel')) {
    return "Você pode pagar no Pix com cinco por cento de desconto à vista, ou parcelar no cartão em até doze vezes sem juros. Também aceitamos boleto bancário. Como fica mais fácil pra você?";
  }

  if (q.includes('troca') || q.includes('devolucao') || q.includes('devolução') || q.includes('garantia')) {
    return "Você tem sete dias corridos de garantia incondicional para troca ou arrependimento, e trinta dias para qualquer defeito de fabricação. Nosso pós-venda é super rápido e resolve tudo pelo WhatsApp!";
  }

  if (q.includes('preco') || q.includes('preço') || q.includes('quanto custa') || q.includes('valor')) {
    return "Temos condições promocionais excelentes hoje, além de cinco por cento de desconto no Pix e frete grátis acima de cento e noventa e nove reais. Qual suplemento você gostaria de conferir o preço?";
  }

  // Resposta padrão ativa e acolhedora do Pedro
  return "Com certeza! Temos o catálogo completo da Max Nutrition com pronta entrega, pagamento no Pix com desconto e frete grátis acima de cento e noventa e nove reais. Me conta, qual o seu objetivo de treino no momento?";
}

/**
 * Remove caracteres que atrapalham a síntese de voz (Kokoro TTS)
 */
function sanitizeSpeechText(text) {
  if (!text) return '';
  return text
    .replace(/[*#_~`]/g, '') // remove markdown
    .replace(/[^\w\s\d.,!?;:áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ-]/gi, '') // remove emojis e símbolos estranhos
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Dispara requisição a provedores de LLM suportados
 */
async function callLlmProvider({ provider = 'GEMINI', model = 'gemini-1.5-flash', apiKey, systemInstruction, userPrompt, history = [] }) {
  if (provider === 'GEMINI' || provider.includes('GEMINI')) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const contents = [
      { role: 'user', parts: [{ text: `${systemInstruction}\n\nCliente disse: "${userPrompt}". Responda em no máximo 2 a 3 frases naturais para telefone:` }] }
    ];

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 120
        }
      })
    });

    if (!res.ok) {
      throw new Error(`Gemini API falhou [${res.status}]: ${await res.text()}`);
    }

    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  // Provedores OpenAI / Grok compatíveis
  const baseUrl = provider === 'GROK' ? 'https://api.x.ai/v1' : 'https://api.openai.com/v1';
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || (provider === 'GROK' ? 'grok-beta' : 'gpt-4o-mini'),
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 120,
      temperature: 0.4
    })
  });

  if (!res.ok) {
    throw new Error(`LLM falhou [${res.status}]: ${await res.text()}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || '';
}

// ======================================================================
// DISPARO DE VOZ NA CHAMADA VIA MEOWCALLER & KOKORO TTS
// ======================================================================

const MEOWCALLER_BASE_URL = (process.env.MEOWCALLER_BASE_URL || 'https://helena-automation-meowcaller-service.d9v63q.easypanel.host').replace(/\/$/, '');
const MEOWCALLER_TOKEN = process.env.MEOWCALLER_TOKEN || process.env.MEOWCALLER_API_KEY || 'helena_meow_sec_8a3c1f9d2e';

/**
 * Sintetiza o texto com Kokoro e envia o áudio imediatamente para a chamada VoIP
 */
export async function speakInCall({ callId, text, voice = KOKORO_OFFICIAL_VOICE_ID }) {
  if (!callId) throw new Error('callId é obrigatório');
  if (!text) throw new Error('text é obrigatório');

  console.log(`[VOICE_AGENT] Sintetizando voz do Pedro (${voice}) para chamada ${callId}: "${text}"`);

  // 1. Sintetiza no Kokoro TTS VPS
  const speechRes = await synthesizeKokoroSpeech({
    input: text,
    voice: voice || KOKORO_OFFICIAL_VOICE_ID
  });

  const audioBuffer = speechRes.buffer;
  const base64Audio = audioBuffer.toString('base64');

  // 2. Envia áudio para o Meowcaller reproduzir na chamada ativa
  const res = await fetch(`${MEOWCALLER_BASE_URL}/v1/calls/${encodeURIComponent(callId)}/play`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': MEOWCALLER_TOKEN
    },
    body: JSON.stringify({
      audio_base64: base64Audio,
      format: 'mp3'
    })
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'Erro ao enviar áudio');
    throw new Error(`Falha ao tocar áudio no Meowcaller [${res.status}]: ${errText}`);
  }

  const result = await res.json().catch(() => ({ ok: true }));
  console.log(`[VOICE_AGENT] ✅ Áudio do Pedro transmitido na chamada ${callId}!`);

  return {
    ok: true,
    call_id: callId,
    text,
    audio_size_bytes: audioBuffer.length,
    ...result
  };
}

/**
 * Trata o webhook disparado pelo Meowcaller quando a chamada é atendida
 */
export async function handleCallConnectedWebhook(payload = {}) {
  const { call_id, direction, remote_number } = payload;
  console.log(`[VOICE_AGENT] 📞 Chamada atendida recebida via webhook: call_id=${call_id}, dir=${direction}, remote=${remote_number}`);

  const cfg = await getVoiceAgentConfig();
  if (!cfg.is_active) {
    console.log('[VOICE_AGENT] Atendente de voz desativado nas configurações.');
    return { ok: true, handled: false, reason: 'agent_disabled' };
  }

  const greeting = direction === 'OUTBOUND' ? cfg.outbound_greeting : cfg.inbound_greeting;

  try {
    // Dispara a fala do Pedro na chamada
    const res = await speakInCall({
      callId: call_id,
      text: greeting,
      voice: cfg.kokoro_voice || KOKORO_OFFICIAL_VOICE_ID
    });
    return { ok: true, handled: true, call_id, greeting, ...res };
  } catch (err) {
    console.error(`[VOICE_AGENT] Erro ao disparar saudação na chamada ${call_id}:`, err.message);
    return { ok: false, handled: false, error: err.message };
  }
}
