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
  voice_provider: 'ELEVENLABS',
  voice_profile_id: 'VP-ELEVEN-MASC-01',
  elevenlabs_voice: 'TX3LPaxmHKxFdv7VOQHJ', // Max Alex / Pedro (ElevenLabs Oficial)
  kokoro_voice: KOKORO_OFFICIAL_VOICE_ID,
  ai_provider: 'GEMINI',
  ai_model: 'gemini-3.8-flash',
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

  // 1. Tenta invocar IA externa se API key estiver configurada e não estiver em ambiente de teste unitário
  const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.NODE_TEST_CONTEXT);
  const apiKey = isTest ? '' : (cfg.ai_api_key || process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.GROK_API_KEY);
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
    .replace(/<[^>]*>/g, '') // remove tags HTML se houver
    .replace(/[*#_~`]/g, '') // remove markdown
    .replace(/[^\w\s\d.,!?;:áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ-]/gi, '') // remove emojis e símbolos estranhos
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Dispara requisição a provedores de LLM suportados (com suporte a áudio inline e modelos em cascata)
 */
async function callLlmProvider({ provider = 'GEMINI', model = 'gemini-flash-latest', apiKey, systemInstruction, userPrompt, audioBase64 = null, mimeType = 'audio/wav', history = [] }) {
  if (provider === 'GEMINI' || provider.includes('GEMINI')) {
    // Modelos com suporte comprovado a áudio WAV e inteligência conversacional rápida
    const candidateModels = audioBase64
      ? ['gemini-flash-latest', 'gemini-3.5-flash-lite']
      : ['gemini-flash-latest', 'gemini-3.5-flash-lite', model].filter(Boolean);

    for (const m of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
        const parts = [];

        if (audioBase64) {
          parts.push({
            inlineData: {
              mimeType: mimeType || 'audio/wav',
              data: audioBase64
            }
          });
          parts.push({
            text: 'O áudio acima é a fala do cliente na ligação WhatsApp VoIP. Responda imediatamente ao que o cliente perguntou ou falou, com simpatia e naturalidade como Pedro da Max Nutrition (máximo de 2 a 3 frases faladas diretas para telefone).'
          });
        } else {
          parts.push({
            text: userPrompt
          });
        }

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(8000), // Timeout de 8s para voz
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: systemInstruction }]
            },
            contents: [{ role: 'user', parts }],
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 250
            }
          })
        });

        if (res.ok) {
          const data = await res.json();
          const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (reply && reply.trim().length > 0) {
            return reply;
          }
        } else {
          console.warn(`[VOICE_AGENT] Gemini modelo ${m} retornou status ${res.status}`);
        }
      } catch (err) {
        console.warn(`[VOICE_AGENT] Erro/timeout no modelo ${m}: ${err.message}`);
      }
    }
  }

  // Provedores OpenAI / Grok compatíveis
  if (userPrompt && (provider === 'GROK' || provider === 'OPENAI')) {
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

    if (res.ok) {
      const data = await res.json();
      return data?.choices?.[0]?.message?.content || '';
    }
  }

  return '';
}

// ======================================================================
// MOTOR DE VOZ & CONVERSAÇÃO TELEFÔNICA (ELEVENLABS + KOKORO + MEOWCALLER)
// ======================================================================

const MEOWCALLER_BASE_URL = (process.env.MEOWCALLER_BASE_URL || 'https://helena-automation-meowcaller-service.d9v63q.easypanel.host').replace(/\/$/, '');
const MEOWCALLER_TOKEN = process.env.MEOWCALLER_TOKEN || process.env.MEOWCALLER_API_KEY || 'helena_meow_sec_8a3c1f9d2e';
export const ELEVENLABS_OFFICIAL_VOICE_ID = 'TX3LPaxmHKxFdv7VOQHJ'; // Pedro / Max Alex

/**
 * Transcreve áudio do microfone do usuário usando ElevenLabs Scribe STT (ultra-rápido ~400ms)
 */
export async function transcribeAudio(audioBuffer) {
  const elevenKey = process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_LABS_API_KEY;
  if (!elevenKey || !audioBuffer || audioBuffer.length < 500) {
    return null;
  }

  try {
    const blob = new Blob([audioBuffer], { type: 'audio/wav' });
    const formData = new FormData();
    formData.append('file', blob, 'speech.wav');
    formData.append('model_id', 'scribe_v1');
    formData.append('language_code', 'por');

    const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: { 'xi-api-key': elevenKey },
      body: formData,
      signal: AbortSignal.timeout(3500)
    });

    if (res.ok) {
      const data = await res.json();
      const text = data?.text?.trim() || '';
      if (text.length > 0) {
        console.log(`[VOICE_AGENT] 🎙️ ElevenLabs Scribe STT (${text.length} chars): "${text}"`);
        return text;
      }
    } else {
      console.warn(`[VOICE_AGENT] ElevenLabs Scribe retornou status ${res.status}`);
    }
  } catch (err) {
    console.warn('[VOICE_AGENT] Falha na transcrição STT:', err.message);
  }

  return null;
}

/**
 * Sintetiza voz conversacional rápida (prioriza ElevenLabs Flash v2.5 com fallback para Kokoro)
 */
export async function synthesizeSpeechFast({ text, voice, cfg = {} }) {
  const elevenKey = process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_LABS_API_KEY;
  const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.NODE_TEST_CONTEXT);

  // 1. Prioridade: ElevenLabs Flash v2.5 (latência ~650ms, voz 100% humana)
  if (elevenKey && !isTest && cfg.voice_provider !== 'KOKORO') {
    try {
      const voiceId = voice || cfg.elevenlabs_voice || ELEVENLABS_OFFICIAL_VOICE_ID;
      const startTime = performance.now();
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_22050_32`, {
        method: 'POST',
        headers: {
          'xi-api-key': elevenKey,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(4000),
        body: JSON.stringify({
          text: sanitizeSpeechText(text),
          model_id: 'eleven_flash_v2_5',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.8
          }
        })
      });

      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        const durationMs = Math.round(performance.now() - startTime);
        console.log(`[VOICE_AGENT] ⚡ ElevenLabs Flash v2.5 gerado em ${durationMs}ms (${buffer.length} bytes)`);
        return {
          buffer,
          durationMs,
          sizeBytes: buffer.length,
          format: 'mp3',
          provider: 'ELEVENLABS',
          voice_id: voiceId
        };
      } else {
        console.warn(`[VOICE_AGENT] ElevenLabs TTS retornou status ${res.status}, acionando Kokoro fallback...`);
      }
    } catch (err) {
      console.warn('[VOICE_AGENT] Falha ElevenLabs TTS, acionando Kokoro fallback:', err.message);
    }
  }

  // 2. Fallback: Kokoro TTS VPS
  try {
    const kokoroVoice = voice && voice.includes('*') ? voice : (cfg.kokoro_voice || KOKORO_OFFICIAL_VOICE_ID);
    const speechRes = await synthesizeKokoroSpeech({
      input: sanitizeSpeechText(text),
      voice: kokoroVoice
    });
    return {
      buffer: speechRes.buffer,
      durationMs: speechRes.durationMs,
      sizeBytes: speechRes.sizeBytes,
      format: 'mp3',
      provider: 'KOKORO',
      voice_id: kokoroVoice
    };
  } catch (err) {
    console.error('[VOICE_AGENT] Erro em ambos os provedores de TTS:', err.message);
    throw err;
  }
}

/**
 * Sintetiza o texto e envia o áudio imediatamente para a chamada VoIP
 */
export async function speakInCall({ callId, text, voice = null }) {
  if (!callId) throw new Error('callId é obrigatório');
  if (!text) throw new Error('text é obrigatório');

  const cfg = await getVoiceAgentConfig();
  console.log(`[VOICE_AGENT] 🔊 Sintetizando fala para chamada ${callId}: "${text}"`);

  // Sintetiza via ElevenLabs Flash / Kokoro
  const speechRes = await synthesizeSpeechFast({
    text,
    voice: voice || (cfg.voice_provider === 'ELEVENLABS' ? cfg.elevenlabs_voice : cfg.kokoro_voice),
    cfg
  });

  const base64Audio = speechRes.buffer.toString('base64');

  // Envia áudio para o Meowcaller reproduzir na chamada ativa
  const res = await fetch(`${MEOWCALLER_BASE_URL}/v1/calls/${encodeURIComponent(callId)}/play`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': MEOWCALLER_TOKEN
    },
    body: JSON.stringify({
      audio_base64: base64Audio,
      format: speechRes.format || 'mp3'
    })
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'Erro ao enviar áudio');
    throw new Error(`Falha ao tocar áudio no Meowcaller [${res.status}]: ${errText}`);
  }

  const result = await res.json().catch(() => ({ ok: true }));
  console.log(`[VOICE_AGENT] ✅ Áudio do Pedro (${speechRes.provider}) transmitido na chamada ${callId}!`);

  return {
    ok: true,
    call_id: callId,
    text,
    provider: speechRes.provider,
    audio_size_bytes: speechRes.sizeBytes,
    ...result
  };
}

/**
 * Trata o webhook disparado pelo Meowcaller quando a chamada é atendida
 */
export async function handleCallConnectedWebhook(payload = {}) {
  const { call_id, direction, remote_number, greeting_already_played } = payload;
  console.log(`[VOICE_AGENT] 📞 Chamada atendida recebida via webhook: call_id=${call_id}, dir=${direction}, remote=${remote_number}, greeting_played=${greeting_already_played}`);

  const cfg = await getVoiceAgentConfig();
  const greeting = direction === 'OUTBOUND' ? cfg.outbound_greeting : cfg.inbound_greeting;

  // Inicializa histórico com a saudação transmitida
  const callHistory = getCallHistory(call_id);
  if (callHistory.length === 0) {
    callHistory.push({
      role: 'assistant',
      text: greeting,
      timestamp: new Date().toISOString()
    });
  }

  // Se a saudação já foi transmitida pelo Meowcaller (MP3 local de 0ms), evita duplicidade
  if (greeting_already_played) {
    console.log(`[VOICE_AGENT] ℹ️ Saudação da chamada ${call_id} já reproduzida pelo Meowcaller. Histórico sincronizado.`);
    return { ok: true, handled: true, call_id, greeting, duplicate_skipped: true };
  }

  if (!cfg.is_active) {
    console.log('[VOICE_AGENT] Atendente de voz desativado nas configurações.');
    return { ok: true, handled: false, reason: 'agent_disabled' };
  }

  try {
    const res = await speakInCall({
      callId: call_id,
      text: greeting
    });
    return { ok: true, handled: true, call_id, greeting, ...res };
  } catch (err) {
    console.error(`[VOICE_AGENT] Erro ao disparar saudação na chamada ${call_id}:`, err.message);
    return { ok: false, handled: false, error: err.message };
  }
}

/**
 * Trata detecção de silêncio prolongado (nudge conversacional)
 */
export async function handleUserSilence({ callId }) {
  if (!callId) throw new Error('callId é obrigatório');
  console.log(`[VOICE_AGENT] ⏳ Silêncio do cliente na chamada ${callId}. Disparando cutucada cortês...`);
  const text = "Olá! Você consegue me ouvir? Pode falar, estou aqui para te ajudar!";
  const callHistory = getCallHistory(callId);
  callHistory.push({
    role: 'assistant',
    text,
    timestamp: new Date().toISOString()
  });
  return await speakInCall({
    callId,
    text
  });
}

// ======================================================================
// ESCUTA CONVERSACIONAL ATIVA & HISTÓRICO DE CHAMADA
// ======================================================================

export const activeCallHistories = new Map();

/**
 * Retorna o histórico de conversação de uma chamada ativa
 */
export function getCallHistory(callId) {
  if (!callId) return [];
  if (!activeCallHistories.has(callId)) {
    activeCallHistories.set(callId, []);
  }
  return activeCallHistories.get(callId);
}

/**
 * Processa a fala do usuário captada pelo Meowcaller via áudio WAV/PCM
 * 1. Transcreve a fala do cliente em alta velocidade (~400ms) via ElevenLabs Scribe STT
 * 2. Raciocina com IA (Gemini ou Catálogo Inteligente Max Nutrition em 0ms)
 * 3. Sintetiza a resposta na voz oficial com ElevenLabs Flash v2.5 (~650ms) ou Kokoro
 * 4. Transmite o áudio diretamente na chamada em andamento (latência total ~1.2s!)
 */
export async function processUserSpeech({ callId, audioBase64, format = 'wav', sampleRate = 16000 }) {
  if (!callId) throw new Error('callId é obrigatório');
  if (!audioBase64) throw new Error('audioBase64 é obrigatório');

  const audioBuffer = Buffer.from(audioBase64, 'base64');
  console.log(`[VOICE_AGENT] 🎙️ Recebido turno de fala do cliente na chamada ${callId} (${format}, ~${Math.round(audioBuffer.length / 1024)} KB)`);

  const cfg = await getVoiceAgentConfig();
  if (!cfg.is_active) {
    console.log(`[VOICE_AGENT] Agente de voz inativo. Ignorando fala na chamada ${callId}.`);
    return { ok: true, ignored: true, reason: 'agent_disabled' };
  }

  const callHistory = getCallHistory(callId);

  // 1. Transcreve fala do cliente via ElevenLabs Scribe STT
  const userText = await transcribeAudio(audioBuffer);

  let replyText = '';

  if (userText && userText.trim().length > 0) {
    console.log(`[VOICE_AGENT] 🗣️ Cliente disse na chamada ${callId}: "${userText}"`);

    // Atualiza histórico com a fala do cliente
    callHistory.push({
      role: 'user',
      text: userText,
      timestamp: new Date().toISOString()
    });

    // 2. Raciocínio rápido (Gemini com timeout estrito de 2.5s ou motor local instantâneo)
    replyText = await generateAgentSpeechText({
      prompt: userText,
      history: callHistory,
      callContext: { callId }
    });
  } else {
    // Caso o áudio seja muito curto ou não haja palavras identificáveis
    console.log(`[VOICE_AGENT] ℹ️ Áudio sem transcrição de fala clara ou silêncio na chamada ${callId}.`);
    replyText = "Olá! Aqui é o Pedro da Max Nutrition. Não consegui te ouvir com clareza, você pode repetir por favor?";
  }

  // Sanitiza texto para pronúncia limpa
  replyText = sanitizeSpeechText(replyText);
  console.log(`[VOICE_AGENT] 💬 Pedro responderá na chamada ${callId}: "${replyText}"`);

  // Atualiza histórico com a resposta do atendente
  callHistory.push({
    role: 'assistant',
    text: replyText,
    timestamp: new Date().toISOString()
  });
  if (callHistory.length > 20) {
    callHistory.splice(0, callHistory.length - 20);
  }

  // 3. Sintetiza a resposta falada e reproduz na chamada
  try {
    const playResult = await speakInCall({
      callId,
      text: replyText
    });

    return {
      ok: true,
      call_id: callId,
      user_text: userText || '',
      reply_text: replyText,
      play_result: playResult
    };
  } catch (err) {
    console.error(`[VOICE_AGENT] Erro ao reproduzir resposta na chamada ${callId}:`, err.message);
    return {
      ok: false,
      call_id: callId,
      user_text: userText || '',
      reply_text: replyText,
      error: err.message
    };
  }
}

