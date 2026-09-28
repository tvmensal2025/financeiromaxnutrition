import { NATURAL_OPENING_PROMPT } from './conversation-mode.mjs';
/**
 * voice-agent.mjs — Cérebro de Voz e Atendimento da Max Nutrition
 * Integra: 4 Personagens x 3 Modos (12 Perfis) + Base de Conhecimento + GPT
 * + Síntese Neural Google Cloud Chirp 3 HD Exclusiva + Meowcaller (WhatsApp VoIP)
 */

import { VOICE_DELIVERY_INSTRUCTION, prepareVoiceHistory, completeVoiceReply, cleanSpeechTranscript } from './voice-delivery.mjs';
import { buildCallInstruction, loadCallerContext, persistVoiceTurn, persistVoiceUtterance } from './caller-context.mjs';
import { streamReplyToCall } from './call-streaming.mjs';
import { routeCallAudio } from './audio-router.mjs';
import {
  registerCallSession,
  getCallSession,
  recordTurnTelemetry,
  endCallSession,
  getCallEngineConfig,
  getActiveGlobalProfile,
  getActiveGlobalProfileKey,
  getProfileByKey,
  switchCallRuntime,
  getActivePersonality
} from './call-engine.mjs';
import { getActiveCallVoice } from './google-chirp3-hd.mjs';

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
  call_voice: 'pt-BR-Chirp3-HD-Achird',
  ai_provider: 'OPENAI',
  ai_model: 'gpt-6-luna',
  ai_api_key: '',
  is_active: true,
  updated_at: new Date().toISOString()
};

/** Resolve somente a chave GPT das ligações; chaves legadas não entram neste fluxo. */
export async function resolveAiApiKey() {
  return (process.env.OPENAI_API_KEY || '').trim();
}

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
  const { ai_provider, ai_model, ai_api_key, ...allowedSettings } = newSettings;
  cachedConfig = {
    ...cachedConfig,
    ...allowedSettings,
    ai_provider: 'OPENAI',
    ai_model: 'gpt-6-luna',
    ai_api_key: '',
    updated_at: new Date().toISOString()
  };
  return { ok: true, config: cachedConfig };
}

// ======================================================================
// GERAÇÃO INTELIGENTE DE RESPOSTAS (LLM + FALLBACK CONTEXTUAL)
// ======================================================================

/**
 * Gera texto de resposta para a chamada aplicando com rigor o perfil ativo (4 Personagens x 3 Modos)
 * O campo SCRIPT é o SYSTEM PROMPT completo daquele perfil no GPT.
 */
export async function generateAgentSpeechTextDetailed({ prompt = '', history = [], callContext = {}, profileKeyOverride = null }) {
  const cleanPrompt = String(prompt).trim();
  const cfg = await getVoiceAgentConfig();

  // Resolve o perfil ativo da chamada em andamento (Hot-Swap) ou o perfil global
  const call = callContext.webCall || (callContext.callId ? getCallSession(callContext.callId) : null);
  const profileKey = profileKeyOverride || call?.activeProfileKey || getActiveGlobalProfileKey();
  const profile = getProfileByKey(profileKey);

  // O script selecionado é o System Prompt oficial do perfil, sem sobreposição.
  const systemScript = call?.activeSystemScript || profile.system_script;
  const characterName = call?.activeCharacterName || profile.character_name;
  const modeName = call?.activeModeName || profile.mode_name;

  // 1. Tenta invocar GPT se a chave estiver configurada e não for teste unitário estrito.
  const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.NODE_TEST_CONTEXT);
  const apiKey = isTest ? '' : await resolveAiApiKey(cfg);
  if (apiKey) {
    try {
      const systemInstruction = await buildCallInstruction(call, profile);
      const llmResult = await callLlmProviderDetailed({
        provider: 'OPENAI',
        model: cfg.ai_model || 'gpt-6-luna',
        apiKey,
        systemInstruction,
        userPrompt: cleanPrompt,
        history
      });
      if (llmResult?.reply && llmResult.reply.trim().length > 0) {
        return {
          text: sanitizeSpeechText(llmResult.reply),
          usage: llmResult.usage || null,
          latencyMs: llmResult.latencyMs || 0,
          model: llmResult.model || cfg.ai_model,
          profile_key: profile.profile_key,
          character_id: profile.character_id,
          character_name: characterName,
          mode: profile.mode,
          mode_name: modeName,
          personality: `${characterName} / ${modeName}`
        };
      }
    } catch (err) {
      console.warn('[VOICE_AGENT] Falha na chamada do GPT, acionando motor inteligente local:', err.message);
    }
  }

  // 2. Motor Inteligente Heurístico Local (baseado no Catálogo Max Nutrition)
  return {
    text: sanitizeSpeechText(generateLocalResponse(cleanPrompt, cfg)),
    usage: null,
    latencyMs: 0,
    model: 'heuristic-local',
    profile_key: profile.profile_key,
    character_id: profile.character_id,
    character_name: characterName,
    mode: profile.mode,
    mode_name: modeName,
    personality: `${characterName} / ${modeName}`
  };
}

export async function generateAgentSpeechText(params) {
  const res = await generateAgentSpeechTextDetailed(params);
  return res.text;
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
export async function callLlmProviderDetailed({ provider = 'GEMINI', model = 'gemini-flash-latest', apiKey, systemInstruction, userPrompt, audioBase64 = null, mimeType = 'audio/wav', history = [] }) {
  const start = Date.now();
  const deadline = AbortSignal.timeout(6000); // One shared budget, including model fallbacks.
  systemInstruction = `${systemInstruction || ''}\n\n${VOICE_DELIVERY_INSTRUCTION}`;
  const recentHistory = prepareVoiceHistory(history, userPrompt);

  if (provider === 'GEMINI' || provider.includes('GEMINI')) {
    // Modelos com suporte comprovado a áudio WAV e inteligência conversacional rápida
    const candidateModels = audioBase64
      ? ['gemini-flash-latest', 'gemini-3.5-flash-lite']
      : ['gemini-flash-latest', 'gemini-3.5-flash-lite', model].filter(Boolean);

    for (const m of new Set(candidateModels)) {
      if (deadline.aborted) break;
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
          signal: deadline,
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: systemInstruction }]
            },
            contents: [...recentHistory.map(h => ({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.content }] })), { role: 'user', parts }],
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 160
            }
          })
        });

        if (res.ok) {
          const data = await res.json();
          const candidate = data?.candidates?.[0];
          const reply = completeVoiceReply(candidate?.content?.parts?.filter(p => !p.thought).map(p => p.text || '').join(''), candidate?.finishReason);
          if (!reply) break;
          if (reply && reply.trim().length > 0) {
            const usage = data?.usageMetadata ? {
              prompt_tokens: data.usageMetadata.promptTokenCount || 0,
              completion_tokens: data.usageMetadata.candidatesTokenCount || 0,
              total_tokens: data.usageMetadata.totalTokenCount || 0
            } : null;
            return {
              reply,
              usage,
              latencyMs: Date.now() - start,
              model: m
            };
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
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        signal: deadline,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model || (provider === 'GROK' ? 'grok-beta' : 'gpt-6-luna'),
          messages: [
            { role: 'system', content: systemInstruction },
            ...recentHistory,
            { role: 'user', content: userPrompt }
          ],
          ...(provider === 'OPENAI' ? { max_completion_tokens: 200, reasoning_effort: 'none' } : { max_tokens: 120 }),
          temperature: 0.4
        })
      });

      if (res.ok) {
        const data = await res.json();
        const reply = completeVoiceReply(data?.choices?.[0]?.message?.content, data?.choices?.[0]?.finish_reason);
        return {
          reply,
          usage: data?.usage || null,
          latencyMs: Date.now() - start,
          model: model || (provider === 'GROK' ? 'grok-beta' : 'gpt-6-luna')
        };
      }
    } catch (err) {
      console.warn(`[VOICE_AGENT] Falha na chamada ${provider}:`, err.message);
    }
  }

  return { reply: '', usage: null, latencyMs: Date.now() - start, model };
}

async function callLlmProvider(params) {
  const detailed = await callLlmProviderDetailed(params);
  return detailed?.reply || '';
}

// ======================================================================
// MOTOR DE VOZ & CONVERSAÇÃO TELEFÔNICA (ELEVENLABS + KOKORO + MEOWCALLER)
// ======================================================================

const MEOWCALLER_BASE_URL = (process.env.MEOWCALLER_BASE_URL || 'https://helena-automation-meowcaller-service.d9v63q.easypanel.host').replace(/\/$/, '');
const MEOWCALLER_TOKEN = process.env.MEOWCALLER_TOKEN || process.env.MEOWCALLER_API_KEY || 'helena_meow_sec_8a3c1f9d2e';
export const ELEVENLABS_OFFICIAL_VOICE_ID = 'TX3LPaxmHKxFdv7VOQHJ'; // Pedro / Max Alex

/**
 * Transcreve áudio do microfone do usuário usando ElevenLabs Scribe STT (ultra-rápido ~400ms)
 * com fallback e tolerância a ruído
 */
export async function transcribeAudio(audioBuffer, mimeType = 'audio/wav') {
  if (!audioBuffer || audioBuffer.length < 300) {
    return null;
  }

  const elevenKey = process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_LABS_API_KEY;

  // 1. ElevenLabs Scribe STT
  if (elevenKey && elevenKey.trim().length > 0) {
    try {
      const blob = new Blob([audioBuffer], { type: mimeType });
      const formData = new FormData();
      formData.append('file', blob, 'speech.' + (mimeType.includes('webm') ? 'webm' : mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'wav'));
      formData.append('model_id', 'scribe_v1');
      formData.append('language_code', 'por');

      const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
        method: 'POST',
        headers: { 'xi-api-key': elevenKey.trim() },
        body: formData,
        signal: AbortSignal.timeout(7000)
      });

      if (res.ok) {
        const data = await res.json();
        const text = data?.text?.trim() || '';
        if (text.length > 0) {
          console.log(`[VOICE_AGENT] 🎙️ ElevenLabs Scribe STT (${text.length} chars): "${text}"`);
          return text;
        } else {
          console.log(`[VOICE_AGENT] ℹ️ Scribe STT processou áudio mas não detectou palavras claras.`);
          return '';
        }
      } else {
        const errText = await res.text().catch(() => '');
        console.warn(`[VOICE_AGENT] ElevenLabs Scribe retornou status ${res.status}: ${errText}`);
      }
    } catch (err) {
      console.warn('[VOICE_AGENT] Falha na transcrição Scribe STT:', err.message);
    }
  }

  // 2. Fallback Groq Whisper (se disponível)
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey && groqKey.trim().length > 0) {
    try {
      const blob = new Blob([audioBuffer], { type: mimeType });
      const formData = new FormData();
      formData.append('file', blob, 'speech.' + (mimeType.includes('webm') ? 'webm' : mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'wav'));
      formData.append('model', 'whisper-large-v3-turbo');
      formData.append('language', 'pt');

      const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${groqKey.trim()}` },
        body: formData,
        signal: AbortSignal.timeout(6000)
      });

      if (res.ok) {
        const data = await res.json();
        const text = data?.text?.trim() || '';
        if (text.length > 0) {
          console.log(`[VOICE_AGENT] 🎙️ Groq Whisper STT (${text.length} chars): "${text}"`);
          return text;
        }
      }
    } catch (err) {
      console.warn('[VOICE_AGENT] Falha no fallback Groq STT:', err.message);
    }
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
        console.warn(`[VOICE_AGENT] ElevenLabs TTS retornou status ${res.status}`);
      }
    } catch (err) {
      console.warn('[VOICE_AGENT] Falha ElevenLabs TTS:', err.message);
    }
  }

  // Em chamadas (CALL), o único TTS permitido é Google Cloud Chirp 3 HD (através de routeCallAudio).
  throw new Error('[VOICE_AGENT] Provedor de TTS indisponível fora do contexto de chamada telefônica.');
}

/**
 * Sintetiza o texto e envia o áudio imediatamente para a chamada VoIP
 * EXCLUSIVO: Google Cloud Chirp 3 HD
 */
export async function speakInCall({ callId, text, voice = null }) {
  if (!callId) throw new Error('callId é obrigatório');
  if (!text) throw new Error('text é obrigatório');

  // Resolve o perfil ativo da chamada em andamento (Hot-Swap) ou perfil global
  const call = getCallSession(callId);
  const profile = call?.activeProfileKey ? getProfileByKey(call.activeProfileKey) : getActiveGlobalProfile();
  const activeVoice = voice || call?.activeVoice || profile.voice_id || getActiveCallVoice();
  const characterName = call?.activeCharacterName || profile.character_name;
  const modeName = call?.activeModeName || profile.mode_name;

  console.log(`[VOICE_AGENT] 🔊 Sintetizando fala no Google Chirp 3 HD para chamada ${callId} (${characterName} / ${modeName} | voz: ${activeVoice}): "${text}"`);

  // Roteia a síntese de áudio exclusivamente para o contexto CALL (Google Cloud Chirp 3 HD)
  const speechRes = await routeCallAudio({
    text,
    callId,
    voice: activeVoice
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
  console.log(`[VOICE_AGENT] ✅ Áudio (${speechRes.provider} - ${characterName} / ${modeName}) transmitido com sucesso na chamada ${callId}!`);

  return {
    ok: true,
    call_id: callId,
    text,
    voice: activeVoice,
    character: characterName,
    mode: modeName,
    provider: speechRes.provider,
    audio_size_bytes: speechRes.sizeBytes,
    ...result
  };
}

/**
 * Trata o webhook disparado pelo Meowcaller quando a chamada é atendida
 */
const endedVoiceCalls = new Map();

export async function generateNaturalOpening(profile, callId, webCall = null) {
  const result = await generateAgentSpeechTextDetailed({ prompt: NATURAL_OPENING_PROMPT,
    history: [], profileKeyOverride: profile.profile_key, callContext: { callId, webCall } });
  return result.model !== 'heuristic-local' && result.text?.trim()
    ? result.text.trim() : `Olá, aqui é ${profile.character_name}. Como você está hoje?`;
}

export async function handleCallConnectedWebhook(payload = {}, { speak = speakInCall } = {}) {
  const endedKey = String(payload.call_id || "").toUpperCase();
  if (endedVoiceCalls.has(endedKey)) return { ok: true, ignored: true, reason: "already_ended" };
  const { call_id, direction, remote_number } = payload;
  console.log(`[VOICE_AGENT] 📞 Chamada atendida recebida via webhook: call_id=${call_id}, dir=${direction}, remote=${remote_number}`);

  // Registra no call-engine em memória com sincronização
  let call = getCallSession(call_id);
  if (!call || (direction === 'INBOUND' && !call.callerConnected)) {
    call = registerCallSession({
      callId: call_id,
      remoteNumber: remote_number,
      direction: direction || 'OUTBOUND',
      profileKey: direction === 'INBOUND' ? 'sirlene_normal' : null
    });
  }

  if (remote_number) call.remoteNumber = remote_number;
  if (call.greetingPlayed) return { ok: true, handled: true, call_id, greeting_already_played: true };
  if (!call.callerConnected) {
    const characterId = direction === 'INBOUND' ? 'sirlene' : getProfileByKey(call.activeProfileKey).character_id;
    switchCallRuntime({ callId: call_id, characterId, mode: 'normal' });
  }
  call.callerConnected = true;
  const profile = call?.activeProfileKey ? getProfileByKey(call.activeProfileKey) : getActiveGlobalProfile();
  void loadCallerContext(call, profile.character_id);
  // Reserve before awaiting generation to deduplicate connected events.
  call.greetingPlayed = true;
  const greeting = await generateNaturalOpening(profile, call_id);
  if (endedVoiceCalls.has(endedKey)) return { ok: true, ignored: true, reason: 'already_ended' };

  // Inicializa histórico com a abertura oficial do perfil ativo
  const callHistory = getCallHistory(call_id);
  if (callHistory.length === 0) {
    callHistory.push({
      role: 'assistant',
      text: greeting,
      timestamp: new Date().toISOString()
    });
  }

  // Dispara a fala de abertura do perfil ativo no Google Chirp 3 HD se ainda não foi tocada nesta chamada
  {
    try {
      const res = await speak({
        callId: call_id,
        text: greeting,
        voice: profile.voice_id
      });
      await persistVoiceTurn(call, profile, '', greeting);
      return { ok: true, handled: true, call_id, greeting, character: profile.character_name, mode: profile.mode_name, ...res };
    } catch (err) {
      console.error(`[VOICE_AGENT] Erro ao disparar abertura na chamada ${call_id}:`, err.message);
      return { ok: false, handled: false, error: err.message };
    }
  }

  return { ok: true, handled: true, call_id, greeting_already_played: true };
}

/**
 * Trata webhook disparado quando a chamada é finalizada/desconectada
 */
export async function handleCallEndedWebhook(payload = {}) {
  const { call_id, reason } = payload;
  if (!call_id) throw new Error("call_id é obrigatório");
  endedVoiceCalls.set(String(call_id).toUpperCase(), Date.now());
  if (endedVoiceCalls.size > 1000) endedVoiceCalls.delete(endedVoiceCalls.keys().next().value);
  console.log(`[VOICE_AGENT] 📴 Chamada finalizada recebida via webhook: call_id=${call_id}, reason=${reason}`);
  activeVoiceTurns.get(call_id)?.abort(new Error('Call ended'));
  activeVoiceTurns.delete(call_id);
  latestSpeechEpochs.delete(call_id);
  const summary = endCallSession({ callId: call_id, reason: reason || 'normal_hangup' });
  return { ok: true, call_id, summary };
}

/**
 * Trata detecção de silêncio prolongado (nudge conversacional)
 */
export async function handleUserSilence({ callId }) {
  const session = getCallSession(callId);
  const profile = session?.activeProfileKey ? getProfileByKey(session.activeProfileKey) : getActiveGlobalProfile();
  if (profile.opening_enabled !== true && !getCallHistory(callId).some(turn => turn.role === 'user')) return { ok: true, ignored: true, reason: 'waiting_for_customer' };
  if (activeVoiceTurns.has(callId)) return { ok: true, ignored: true, reason: 'response_in_progress' };
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
 * 1. Transcreve a fala do cliente via ElevenLabs Scribe STT
 * 2. Gera o texto com GPT, aplicando o perfil ativo da chamada.
 * 3. Sintetiza a resposta falada exclusivamente com Google Cloud Chirp 3 HD na Voz Ativa da chamada (hot-swap)
 * 4. Transmite o áudio diretamente na chamada e registra telemetria detalhada por turno
 */
const activeVoiceTurns = new Map();
const latestSpeechEpochs = new Map();

export async function processUserSpeech(params) {
  const { callId, speechEpoch } = params;
  if (!callId) throw new Error('callId é obrigatório');
  if (Number.isSafeInteger(speechEpoch)) {
    if (speechEpoch <= (latestSpeechEpochs.get(callId) ?? -1)) return { ok: true, ignored: true, reason: 'stale_speech' };
    latestSpeechEpochs.set(callId, speechEpoch);
  }
  activeVoiceTurns.get(callId)?.abort(new Error('New customer utterance'));
  const controller = new AbortController();
  activeVoiceTurns.set(callId, controller);
  try {
    return await processUserSpeechTurn({ ...params, signal: controller.signal });
  } catch (err) {
    if (controller.signal.aborted) return { ok: true, interrupted: true, call_id: callId };
    throw err;
  } finally {
    if (activeVoiceTurns.get(callId) === controller) activeVoiceTurns.delete(callId);
  }
}

async function processUserSpeechTurn({ callId, audioBase64, format = 'wav', sampleRate = 16000, speechEpoch, signal }) {
  if (!callId) throw new Error('callId é obrigatório');
  if (!audioBase64) throw new Error('audioBase64 é obrigatório');

  const turnStart = Date.now();
  const audioBuffer = Buffer.from(audioBase64, 'base64');
  console.log(`[VOICE_AGENT] 🎙️ Recebido turno de fala do cliente na chamada ${callId} (${format}, ~${Math.round(audioBuffer.length / 1024)} KB)`);

  const cfg = await getVoiceAgentConfig();
  if (!cfg.is_active) {
    console.log(`[VOICE_AGENT] Agente de voz inativo. Ignorando fala na chamada ${callId}.`);
    return { ok: true, ignored: true, reason: 'agent_disabled' };
  }

  // Garante que a chamada está registrada no gerenciador quente de chamadas
  let call = getCallSession(callId);
  if (!call) {
    call = registerCallSession({ callId });
  }

  const callHistory = getCallHistory(callId);

  // 1. Transcreve fala do cliente via ElevenLabs Scribe STT
  const sttStart = Date.now();
  const userText = cleanSpeechTranscript(await transcribeAudio(audioBuffer));
  const sttMs = Date.now() - sttStart;
  signal.throwIfAborted();
  if (!userText) return { ok: true, ignored: true, reason: 'no_spoken_words', call_id: callId };

  let replyText = '';
  let llmUsage = null;
  let llmMs = 0;
  let llmModel = cfg.ai_model || 'gpt-6-luna';
  let usedPersonality = call?.activePersonalityId || getActivePersonality().id;

  if (userText && userText.trim().length > 0) {
    console.log(`[VOICE_AGENT] 🗣️ Cliente disse na chamada ${callId}: "${userText}"`);

    // Atualiza histórico com a fala do cliente
    callHistory.push({
      role: 'user',
      text: userText,
      timestamp: new Date().toISOString()
    });
    // Preserve the customer's words before generation or playback can be interrupted.
    const heardProfile = call?.activeProfileKey ? getProfileByKey(call.activeProfileKey) : getActiveGlobalProfile();
    await persistVoiceUtterance(call, heardProfile, userText);

    if (process.env.CALL_VOICE_STREAMING_ENABLED === 'true' &&
        (cfg.ai_provider || 'OPENAI') === 'OPENAI' && Number.isSafeInteger(speechEpoch)) {
      const apiKey = await resolveAiApiKey(cfg);
      signal.throwIfAborted();
      if (apiKey && !apiKey.startsWith('AIza') && !apiKey.startsWith('AQ.')) {
        return await processStreamingSpeechTurn({ callId, speechEpoch, cfg, apiKey, call, callHistory, userText, sttMs, turnStart, signal });
      }
    }

    // 2. Raciocínio com IA considerando a personalidade ativa da chamada (com hot-swap)
    const llmStart = Date.now();
    const llmResult = await generateAgentSpeechTextDetailed({
      prompt: userText,
      history: callHistory,
      callContext: { callId }
    });
    llmMs = Date.now() - llmStart;
    replyText = llmResult.text;
    llmUsage = llmResult.usage;
    llmModel = llmResult.model || llmModel;
    usedPersonality = llmResult.personality || usedPersonality;
  } else {
    // Caso o áudio seja muito curto ou não haja palavras identificáveis
    const curProfile = call?.activeProfileKey ? getProfileByKey(call.activeProfileKey) : getActiveGlobalProfile();
    console.log(`[VOICE_AGENT] ℹ️ Áudio sem transcrição de fala clara ou silêncio na chamada ${callId}.`);
    replyText = `Olá! Aqui é o ${curProfile.character_name} da Max Nutrition. Não consegui te ouvir com clareza, você pode repetir por favor?`;
  }

  signal.throwIfAborted();
  // Sanitiza texto para pronúncia limpa
  replyText = sanitizeSpeechText(replyText);
  const activeProfile = call?.activeProfileKey ? getProfileByKey(call.activeProfileKey) : getActiveGlobalProfile();
  console.log(`[VOICE_AGENT] 💬 ${activeProfile.character_name} (${activeProfile.mode_name}) responderá na chamada ${callId}: "${replyText}"`);

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
  const ttsStart = Date.now();
  try {
    const playResult = await speakInCall({
      callId,
      text: replyText,
      voice: activeProfile.voice_id
    });
    void persistVoiceTurn(call, activeProfile, '', replyText);
    const ttsMs = Date.now() - ttsStart;
    const turnLatencyMs = Date.now() - turnStart;

    // Registra métricas detalhadas do turno no call-engine
    const turnNumber = (call?.turnCount || 0) + 1;
    const currentVoice = activeProfile.voice_id;
    recordTurnTelemetry({
      callId,
      turnNumber,
      sttMs,
      llmFirstTokenMs: null, // Non-streaming: first-token time is not measured.
      llmTotalMs: llmMs,
      ttsMs,
      turnLatencyMs,
      userText: userText || '',
      replyText,
      voice: currentVoice,
      characterId: activeProfile.character_id,
      characterName: activeProfile.character_name,
      mode: activeProfile.mode,
      modeName: activeProfile.mode_name,
      profileKey: activeProfile.profile_key,
      personality: usedPersonality,
      usage: llmUsage,
      charactersSynthesized: replyText.length,
      error: null
    });

    return {
      ok: true,
      call_id: callId,
      turn_number: turnNumber,
      user_text: userText || '',
      reply_text: replyText,
      character: activeProfile.character_name,
      mode: activeProfile.mode_name,
      voice: currentVoice,
      metrics: {
        stt_ms: sttMs,
        llm_ms: llmMs,
        tts_ms: ttsMs,
        turn_latency_ms: turnLatencyMs,
        usage: llmUsage
      },
      play_result: playResult
    };
  } catch (err) {
    const ttsMs = Date.now() - ttsStart;
    const turnLatencyMs = Date.now() - turnStart;
    console.error(`[VOICE_AGENT] Erro ao reproduzir resposta na chamada ${callId}:`, err.message);

    const turnNumber = (call?.turnCount || 0) + 1;
    const currentVoice = call?.activeVoice || activeProfile.voice_id || getActiveCallVoice();
    recordTurnTelemetry({
      callId,
      turnNumber,
      sttMs,
      llmFirstTokenMs: 0,
      llmTotalMs: llmMs,
      ttsMs,
      turnLatencyMs,
      userText: userText || '',
      replyText,
      voice: currentVoice,
      characterId: activeProfile.character_id,
      characterName: activeProfile.character_name,
      mode: activeProfile.mode,
      modeName: activeProfile.mode_name,
      profileKey: activeProfile.profile_key,
      personality: usedPersonality,
      usage: llmUsage,
      charactersSynthesized: replyText.length,
      error: err.message
    });

    return {
      ok: false,
      call_id: callId,
      user_text: userText || '',
      reply_text: replyText,
      error: err.message
    };
  }
}



async function processStreamingSpeechTurn({ callId, speechEpoch, cfg, apiKey, call, callHistory, userText, sttMs, turnStart, signal }) {
  const profile = call?.activeProfileKey ? getProfileByKey(call.activeProfileKey) : getActiveGlobalProfile();
  const voice = call?.activeVoice || profile.voice_id;
  const baseTelemetry = { callId, userText, sttMs, voice, characterId: profile.character_id,
    characterName: profile.character_name, mode: profile.mode, modeName: profile.mode_name, profileKey: profile.profile_key };
  try {
    const result = await streamReplyToCall({ callId, speechEpoch, apiKey, model: cfg.ai_model,
      systemInstruction: await buildCallInstruction(call, profile),
      userPrompt: userText, history: callHistory, voice, baseUrl: MEOWCALLER_BASE_URL, token: MEOWCALLER_TOKEN, signal });
    signal.throwIfAborted();
    void persistVoiceTurn(call, profile, '', result.text);
    callHistory.push({ role: 'assistant', text: result.text, timestamp: new Date().toISOString() });
    if (callHistory.length > 20) callHistory.splice(0, callHistory.length - 20);
    const metrics = { ...result.metrics, transport: result.playback.metrics, streaming: true };
    recordTurnTelemetry({ ...baseTelemetry, replyText: result.text, usage: result.usage,
      llmFirstTokenMs: metrics.llm_first_token_ms, llmTotalMs: metrics.llm_total_ms,
      ttsMs: metrics.tts_first_audio_ms || 0, turnLatencyMs: Date.now() - turnStart,
      streamMetrics: metrics, charactersSynthesized: result.text.length });
    return { ok: true, streaming: true, call_id: callId, user_text: userText, reply_text: result.text, metrics, play_result: result.playback };
  } catch (err) {
    // Never replay a batch response after a partially spoken or interrupted stream.
    const interrupted = Boolean(err.interrupted || signal.aborted);
    recordTurnTelemetry({ ...baseTelemetry, replyText: err.partialText || '',
      turnLatencyMs: Date.now() - turnStart, streamMetrics: { ...err.streamMetrics, streaming: true, interrupted },
      error: interrupted ? 'stream_interrupted' : err.message });
    return { ok: interrupted, streaming: true, interrupted, call_id: callId, error: interrupted ? null : err.message };
  }
}
