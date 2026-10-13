import { buildNaturalnessInstruction, cleanVoiceText, stripAudioTags } from './conversation-naturalness.mjs';
import { NATURAL_OPENING_PROMPT } from './conversation-mode.mjs';
/**
 * voice-agent.mjs — Cérebro de Voz e Atendimento da Max Nutrition
 * Integra: 4 Personagens x 3 Modos (12 Perfis) + Base de Conhecimento + GPT
 * + Síntese Neural Google Cloud Chirp 3 HD Exclusiva + Meowcaller (WhatsApp VoIP)
 */

import { VOICE_DELIVERY_INSTRUCTION, prepareVoiceHistory, completeVoiceReply, cleanSpeechTranscript } from './voice-delivery.mjs';
import { buildCallInstruction, loadCallerContext, persistVoiceTurn, persistVoiceUtterance } from './caller-context.mjs';
import { streamReplyToCall } from './call-streaming.mjs';
import { isVoiceStreamingEnabled } from './voice-streaming-config.mjs';
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
  getProfile,
  normalizeCallMode,
  switchCallRuntime,
  getActivePersonality
} from './call-engine.mjs';
import { getActiveCallVoice } from './google-chirp3-hd.mjs';
import { publicVoiceConfig } from './voice-agent-store.mjs';
import { hangupCall, resolveMeowcallerToken } from './meowcaller.mjs';
import {
  ELIVING_FALLBACK_MODEL,
  closingDelayMs,
  elivingFallbackSpeech,
  isElivingCharacter,
  nextElivingFallback,
  resetElivingFallback
} from './call-fallback.mjs';
import {
  awaitCallGate,
  decideInboundCall,
  forgetCallGate,
  isCallAllowedNow,
  settleCallGate
} from './inbound-call-gate.mjs';

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
  voice_provider: 'GOOGLE_CHIRP3_HD',
  call_voice: 'pt-BR-Chirp3-HD-Achird',
  ai_provider: 'OPENAI',
  ai_model: 'gpt-6-luna',
  ai_api_key: '',
  is_active: true,
  updated_at: new Date().toISOString()
};

let configStore = null;
let configLoadedFromStore = false;

export function configureVoiceAgentStore(store) {
  configStore = store;
  configLoadedFromStore = false;
}

/** Resolve somente a chave GPT das ligações; chaves legadas não entram neste fluxo. */
export async function resolveAiApiKey(config = {}) {
  return (process.env.OPENAI_API_KEY || '').trim();
}

/**
 * Retorna as configurações do Agente de Voz e Memória de Produtos
 */
export async function getVoiceAgentConfig({ allowStale = false } = {}) {
  if (configStore) {
    try {
      const persisted = await configStore.load();
      cachedConfig = {
        ...cachedConfig,
        ...publicVoiceConfig(persisted),
        ai_provider: 'OPENAI',
        ai_model: 'gpt-6-luna',
        ai_api_key: '',
        voice_provider: 'GOOGLE_CHIRP3_HD'
      };
      configLoadedFromStore = true;
    } catch (error) {
      if (!allowStale || !configLoadedFromStore) throw error;
      console.warn('[VOICE_AGENT] Supabase indisponível; usando a última configuração carregada.');
    }
  }
  return { ...cachedConfig, ai_api_key: '' };
}

/**
 * Atualiza e persiste as configurações do Agente de Voz
 */
export async function updateVoiceAgentConfig(newSettings = {}) {
  const { ai_provider, ai_model, ai_api_key, voice_provider, voice_profile_id, elevenlabs_voice, ...allowedSettings } = newSettings;
  const next = {
    ...cachedConfig,
    ...publicVoiceConfig(allowedSettings),
    ai_provider: 'OPENAI',
    ai_model: 'gpt-6-luna',
    ai_api_key: '',
    voice_provider: 'GOOGLE_CHIRP3_HD',
    updated_at: new Date().toISOString()
  };
  if (configStore) await configStore.save(next);
  cachedConfig = next;
  if (configStore) configLoadedFromStore = true;
  return { ok: true, config: { ...cachedConfig } };
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
        systemInstruction, profile,
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
      console.warn('[VOICE_AGENT] Falha na chamada do GPT, acionando a resposta de reserva:', err.message);
    }
  }

  // 2. Ligação de um personagem do eLiving: fala fixa e segura do próprio personagem (pede para repetir).
  //    Nunca o motor local de outra empresa ("Pedro", catálogo de suplementos) para um aluno do eLiving.
  const boundToCall = Boolean(call || callContext.callId || callContext.webCall || profileKeyOverride);
  if (boundToCall && isElivingCharacter(profile.character_id)) {
    console.warn(`[VOICE_FALLBACK] GPT sem resposta; fala de reserva do personagem ${profile.character_id}.`);
    return {
      text: sanitizeSpeechText(elivingFallbackSpeech(profile.character_id, 1).text),
      usage: null,
      latencyMs: 0,
      model: ELIVING_FALLBACK_MODEL,
      fallback: true,
      profile_key: profile.profile_key,
      character_id: profile.character_id,
      character_name: characterName,
      mode: profile.mode,
      mode_name: modeName,
      personality: `${characterName} / ${modeName}`
    };
  }

  // 3. Fora de ligação do eLiving (teste do painel / outra empresa): motor local do agente de voz configurado.
  return {
    text: sanitizeSpeechText(generateLocalResponse(cleanPrompt, cfg)),
    usage: null,
    latencyMs: 0,
    model: 'heuristic-local',
    fallback: true,
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

// Shared speech formatting; preserves punctuation, numbers and units.
// Mantém as [tags] do dono para a fala: os roteadores aplicam formatSpeechForElevenLabs (ElevenLabs)
// e tiram as tags antes do Google. Tela, histórico, banco e telemetria usam stripAudioTags.
const sanitizeSpeechText = text => cleanVoiceText(text, { preserveAudioTags: true });

/**
 * Dispara requisição a provedores de LLM suportados (com suporte a áudio inline e modelos em cascata)
 */
export async function callLlmProviderDetailed({ provider = 'GEMINI', model = 'gemini-flash-latest', apiKey, systemInstruction, userPrompt, audioBase64 = null, mimeType = 'audio/wav', history = [], profile = {} }) {
  const start = Date.now();
  const deadline = AbortSignal.timeout(6000); // One shared budget, including model fallbacks.
  systemInstruction = `${systemInstruction || ''}\n\n${VOICE_DELIVERY_INSTRUCTION}\n\n${buildNaturalnessInstruction({ profile, history })}`;
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
// MOTOR DE VOZ & CONVERSAÇÃO TELEFÔNICA (OPENAI STT + GOOGLE TTS + MEOWCALLER)
// ======================================================================

const MEOWCALLER_BASE_URL = (process.env.MEOWCALLER_BASE_URL || 'https://helena-automation-meowcaller-service.d9v63q.easypanel.host').replace(/\/$/, '');
/**
 * Token do meowcaller (MEOWCALLER_TOKEN, igual a INTERNAL_API_KEY do meowcaller-service), lido na hora de usar.
 * Sem a variável, falha fechada: nada é sintetizado nem enviado, e o log diz qual variável falta (sem valor).
 */
function requireMeowcallerToken() {
  const token = resolveMeowcallerToken();
  if (token) return token;
  console.error('[VOICE_AGENT] MEOWCALLER_TOKEN não configurado: a ligação não toca áudio nem encerra chamada até a variável existir (igual a INTERNAL_API_KEY do meowcaller-service).');
  throw new Error('MEOWCALLER_TOKEN não configurado no backend');
}
/** Transcreve o turno concluído usando a mesma conta OpenAI do agente. */
export async function transcribeAudio(audioBuffer, mimeType = 'audio/wav', { signal } = {}) {
  if (!audioBuffer || audioBuffer.length < 300) {
    return null;
  }
  const apiKey = await resolveAiApiKey();
  if (!apiKey) throw new Error('OPENAI_API_KEY não configurada para transcrição');
  const extension = mimeType.includes('webm') ? 'webm' : mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'wav';
  const formData = new FormData();
  formData.append('file', new Blob([audioBuffer], { type: mimeType }), `speech.${extension}`);
  formData.append('model', 'gpt-transcribe');
  formData.append('language', 'pt');
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
    signal: AbortSignal.any([AbortSignal.timeout(10000), ...(signal ? [signal] : [])])
  });
  if (!res.ok) throw new Error(`OpenAI STT HTTP ${res.status}`);
  const data = await res.json();
  return data?.text?.trim() || '';
}

/**
 * Sintetiza o texto e envia o áudio imediatamente para a chamada VoIP.
 * ElevenLabs V4 Turbo primeiro (com as [tags]); Google Cloud Chirp 3 HD só como reserva (sem tags).
 * O `text` devolvido é o de tela, sem tags.
 */
export async function speakInCall({ callId, text, voice = null }) {
  if (!callId) throw new Error('callId é obrigatório');
  if (!text) throw new Error('text é obrigatório');
  // Sem o token do meowcaller não há como tocar: falha antes de gastar a síntese de voz.
  const meowcallerToken = requireMeowcallerToken();

  // Resolve o perfil ativo da chamada em andamento (Hot-Swap) ou perfil global
  const call = getCallSession(callId);
  const profile = call?.activeProfileKey ? getProfileByKey(call.activeProfileKey) : getActiveGlobalProfile();
  const activeVoice = voice || call?.activeVoice || profile.voice_id || getActiveCallVoice();
  const characterId = call?.activeCharacterId || profile.character_id;
  const characterName = call?.activeCharacterName || profile.character_name;
  const modeName = call?.activeModeName || profile.mode_name;

  console.log(`[VOICE_AGENT] 🔊 Sintetizando fala para chamada ${callId} (${characterName} / ${modeName}): "${text}"`);

  // ElevenLabs V4 Turbo com a voz do PERSONAGEM; Google Chirp 3 HD só como reserva (voz fixa do personagem).
  const speechRes = await routeCallAudio({
    text,
    callId,
    voice: activeVoice,
    characterId
  });

  const base64Audio = speechRes.buffer.toString('base64');

  // Envia áudio para o Meowcaller reproduzir na chamada ativa
  const res = await fetch(`${MEOWCALLER_BASE_URL}/v1/calls/${encodeURIComponent(callId)}/play`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': meowcallerToken
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
    text: stripAudioTags(text),
    voice: activeVoice,
    character: characterName,
    mode: modeName,
    provider: speechRes.provider,
    audio_size_bytes: speechRes.sizeBytes,
    ...result
  };
}

/** Encerra a ligação pelo meowcaller com a mesma conexão usada para tocar o áudio. */
function hangupInCall(callId) {
  return hangupCall(callId, { baseUrl: MEOWCALLER_BASE_URL, token: requireMeowcallerToken() });
}

function waitMs(ms) {
  return new Promise(resolve => { const timer = setTimeout(resolve, ms); timer.unref?.(); });
}

/** Desliga depois que a despedida tocar: o /play do meowcaller responde antes de o áudio terminar. */
async function closeCallAfterFarewell(callId, text, { hangup = hangupInCall, wait = waitMs } = {}) {
  try {
    await wait(closingDelayMs(text));
    await hangup(callId);
    console.warn(`[VOICE_FALLBACK] Ligação ${callId} encerrada: o GPT seguiu sem responder depois dos pedidos de repetição.`);
  } catch (err) {
    console.error(`[VOICE_FALLBACK] Não foi possível encerrar a ligação ${callId}:`, err.message);
  }
}

/** Fala de reserva do personagem (pede para repetir; na 3ª falha seguida despede-se e desliga). */
async function speakElivingFallback({ callId, call, profile, callHistory, deps = {} }) {
  const { speak = speakInCall } = deps;
  const fallback = nextElivingFallback(call, profile.character_id);
  callHistory?.push({ role: 'assistant', text: stripAudioTags(fallback.text), timestamp: new Date().toISOString() });
  try {
    await speak({ callId, text: fallback.text, voice: call?.activeVoice || profile.voice_id });
  } catch (err) {
    console.error(`[VOICE_FALLBACK] Não foi possível tocar a fala de reserva na ligação ${callId}:`, err.message);
  }
  if (fallback.hangup) void closeCallAfterFarewell(callId, fallback.text, deps);
  return fallback;
}

/**
 * Trata o webhook disparado pelo Meowcaller quando a chamada é atendida
 */
const endedVoiceCalls = new Map();

export async function generateNaturalOpening(profile, callId, webCall = null) {
  const result = await generateAgentSpeechTextDetailed({ prompt: NATURAL_OPENING_PROMPT,
    history: [], profileKeyOverride: profile.profile_key, callContext: { callId, webCall } });
  // Qualquer resposta de reserva (pedido de repetição ou motor local) não serve de abertura.
  return !result.fallback && result.text?.trim()
    ? result.text.trim() : `Olá, aqui é ${profile.character_name}. Como você está hoje?`;
}

export async function handleCallConnectedWebhook(payload = {}, {
  speak = speakInCall,
  generateOpening = generateNaturalOpening,
  decideInbound = decideInboundCall,
  hangup = hangupInCall
} = {}) {
  const endedKey = String(payload.call_id || "").toUpperCase();
  if (endedVoiceCalls.has(endedKey)) return { ok: true, ignored: true, reason: "already_ended" };
  const { call_id, remote_number } = payload;
  let call = getCallSession(call_id);
  const direction = String(payload.direction || call?.direction || 'INBOUND').trim().toUpperCase();
  const isInbound = direction === 'INBOUND';
  console.log(`[VOICE_AGENT] 📞 Chamada atendida recebida via webhook: call_id=${call_id}, dir=${direction}, remote=${remote_number}`);

  // Registra no call-engine em memória com sincronização
  if (!call) {
    call = registerCallSession({
      callId: call_id,
      remoteNumber: remote_number,
      direction,
      profileKey: isInbound ? 'sirlene_normal' : null
    });
  }

  if (remote_number) call.remoteNumber = remote_number;
  if (isInbound) {
    // Ligação RECEBIDA: a IA só atende aluno conhecido do eLiving (VOICE_INBOUND_CALL_POLICY, padrão restrito).
    // Webhooks repetidos reaproveitam a mesma consulta.
    call.inboundGate ||= Promise.resolve().then(() => decideInbound(call))
      .catch(() => ({ allowed: false, reason: 'context_unavailable' }));
    const decision = settleCallGate(call_id, await call.inboundGate);
    if (!decision.allowed) {
      if (!call.inboundRefused) {
        call.inboundRefused = decision.reason;
        console.warn(`[VOICE_GATE] Ligação recebida ${call_id} não atendida pela IA (${decision.reason}); encerrando sem gastar STT, GPT ou voz.`);
        try {
          await hangup(call_id);
        } catch (err) {
          console.error(`[VOICE_GATE] Não foi possível encerrar a ligação recusada ${call_id}:`, err.message);
        }
      }
      return { ok: true, handled: false, refused: true, reason: decision.reason, call_id };
    }
    if (endedVoiceCalls.has(endedKey)) return { ok: true, ignored: true, reason: 'already_ended' };
  } else {
    settleCallGate(call_id, { allowed: true, reason: 'outbound' });
  }
  if (call.greetingPlayed) return { ok: true, handled: true, call_id, greeting_already_played: true };
  if (!call.callerConnected) {
    call.direction = direction;
    const characterId = isInbound ? 'sirlene' : getProfileByKey(call.activeProfileKey).character_id;
    // Entrada: sempre Sirlene Normal. Saída: mantém o modo pedido no app (call-phone).
    const mode = isInbound ? 'normal' : normalizeCallMode(call.activeMode);
    switchCallRuntime({ callId: call_id, characterId, mode });
  }
  call.callerConnected = true;
  const profile = getProfileByKey(call.activeProfileKey);
  void loadCallerContext(call, profile.character_id);
  // Reserve before awaiting generation to deduplicate connected events.
  call.greetingPlayed = true;
  // A abertura é sempre no modo Normal do personagem (NATURAL_OPENING_PROMPT), como na reserva do app;
  // o modo pedido vale a partir da primeira resposta. A fala vai COM as [tags] para a voz; tela,
  // histórico e banco recebem o texto sem tags.
  const greeting = await generateOpening(getProfile(profile.character_id, 'normal'), call_id);
  const greetingText = stripAudioTags(greeting);
  if (endedVoiceCalls.has(endedKey)) return { ok: true, ignored: true, reason: 'already_ended' };

  // Inicializa histórico com a abertura oficial do perfil ativo
  const callHistory = getCallHistory(call_id);
  if (callHistory.length === 0) {
    callHistory.push({
      role: 'assistant',
      text: greetingText,
      timestamp: new Date().toISOString()
    });
  }

  // Dispara a fala de abertura (ElevenLabs V4 Turbo primeiro; Google Chirp 3 HD só como reserva)
  {
    try {
      const res = await speak({
        callId: call_id,
        text: greeting,
        voice: profile.voice_id
      });
      await persistVoiceTurn(call, profile, '', greetingText);
      return { ok: true, handled: true, call_id, character: profile.character_name, mode: profile.mode_name, ...res, greeting: greetingText };
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
  abortActiveVoiceTurn(call_id, 'call_ended', 'Call ended');
  activeVoiceTurns.delete(call_id);
  forgetCallGate(call_id);
  latestSpeechEpochs.delete(call_id);
  const summary = endCallSession({ callId: call_id, reason: reason || 'normal_hangup' });
  return { ok: true, call_id, summary };
}

/**
 * Trata detecção de silêncio prolongado (nudge conversacional)
 */
export async function handleUserSilence({ callId }) {
  if (!callId) throw new Error('callId é obrigatório');
  // Ligação recusada, ainda sem decisão ou já se despedindo: nenhuma cutucada (nada de voz).
  if (!isCallAllowedNow(callId)) return { ok: true, ignored: true, reason: 'call_not_allowed' };
  if (getCallSession(callId)?.closingAfterFailures) return { ok: true, ignored: true, reason: 'call_closing' };
  const session = getCallSession(callId) || registerCallSession({ callId, direction: 'INBOUND', profileKey: 'sirlene_normal' });
  const profile = session?.activeProfileKey ? getProfileByKey(session.activeProfileKey) : getProfileByKey('sirlene_normal');
  if (profile.opening_enabled !== true && !getCallHistory(callId).some(turn => turn.role === 'user')) return { ok: true, ignored: true, reason: 'waiting_for_customer' };
  if (activeVoiceTurns.has(callId)) return { ok: true, ignored: true, reason: 'response_in_progress' };
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
 * 1. Transcreve a fala do cliente via OpenAI STT
 * 2. Gera o texto com GPT, aplicando o perfil ativo da chamada.
 * 3. Sintetiza a resposta com a voz do personagem: ElevenLabs V4 Turbo primeiro, Google Chirp 3 HD como reserva
 * 4. Transmite o áudio diretamente na chamada e registra telemetria detalhada por turno
 */
const activeVoiceTurns = new Map();
const latestSpeechEpochs = new Map();

function abortActiveVoiceTurn(callId, interruptionReason, message) {
  const controller = activeVoiceTurns.get(callId);
  if (!controller || controller.signal.aborted) return false;
  const reason = new Error(message);
  reason.interruptionReason = interruptionReason;
  controller.abort(reason);
  return true;
}

function resolveVoiceInterruptionReason(error, signal) {
  if (error?.interruptionReason) return error.interruptionReason;
  if (signal?.reason?.interruptionReason) return signal.reason.interruptionReason;
  if (error?.name === 'TimeoutError' || signal?.reason?.name === 'TimeoutError') return 'stream_timeout';
  if (signal?.aborted) return 'stream_cancelled';
  return 'stream_error';
}

export async function processUserSpeech(params, deps = {}) {
  const { callId, speechEpoch } = params;
  if (endedVoiceCalls.has(String(callId).toUpperCase())) return { ok: true, ignored: true, reason: 'already_ended' };
  if (!callId) throw new Error('callId é obrigatório');
  // Depois da despedida por falhas seguidas do GPT, nada mais é processado nem falado.
  if (getCallSession(callId)?.closingAfterFailures) return { ok: true, ignored: true, reason: 'call_closing', call_id: callId };
  // Ligação recebida de quem não é aluno conhecido: nada de STT, GPT ou voz (inclui o áudio em lote).
  const gate = await awaitCallGate(callId);
  if (!gate.allowed) return { ok: true, ignored: true, reason: 'call_not_allowed', call_id: callId };
  if (endedVoiceCalls.has(String(callId).toUpperCase())) return { ok: true, ignored: true, reason: 'already_ended' };
  if (Number.isSafeInteger(speechEpoch)) {
    if (speechEpoch <= (latestSpeechEpochs.get(callId) ?? -1)) return { ok: true, ignored: true, reason: 'stale_speech' };
    latestSpeechEpochs.set(callId, speechEpoch);
  }
  abortActiveVoiceTurn(callId, 'new_user_speech', 'New customer utterance');
  const controller = new AbortController();
  controller.speechEpoch = speechEpoch;
  controller.startedAt = Date.now();
  activeVoiceTurns.set(callId, controller);
  try {
    controller.done = processUserSpeechTurn({ ...params, signal: controller.signal }, deps);
    return await controller.done;
  } catch (err) {
    if (controller.signal.aborted) {
      const interruptionReason = resolveVoiceInterruptionReason(err, controller.signal);
      const call = getCallSession(callId);
      if (call && !endedVoiceCalls.has(String(callId).toUpperCase())) {
        const profile = getProfileByKey(call.activeProfileKey);
        recordTurnTelemetry({ callId, userText: controller.userText || '', replyText: '',
          characterId: profile.character_id, characterName: profile.character_name, mode: profile.mode,
          modeName: profile.mode_name, profileKey: profile.profile_key, voice: call.activeVoice,
          turnLatencyMs: Date.now() - controller.startedAt,
          streamMetrics: { streaming: false, interrupted: true, interruption_reason: interruptionReason },
          error: 'stream_interrupted' });
      }
      return { ok: true, interrupted: true, interruption_reason: interruptionReason, call_id: callId };
    }
    throw err;
  } finally {
    if (activeVoiceTurns.get(callId) === controller) activeVoiceTurns.delete(callId);
  }
}

async function processUserSpeechTurn({ callId, audioBase64, userText: liveText, sttMetrics, format = 'wav', sampleRate = 16000, speechEpoch, signal },
  deps = {}) {
  const { speak = speakInCall } = deps;
  if (!callId) throw new Error('callId é obrigatório');
  if (!audioBase64 && typeof liveText !== 'string') throw new Error('Áudio ou transcrição é obrigatório');

  const turnStart = Date.now();
  const audioBuffer = audioBase64 ? Buffer.from(audioBase64, 'base64') : null;
  console.log(`[VOICE_AGENT] 🎙️ Recebido turno de fala do cliente na chamada ${callId} (${liveText !== undefined ? 'STT ao vivo' : format}${audioBuffer ? `, ~${Math.round(audioBuffer.length / 1024)} KB` : ''})`);

  const cfg = await getVoiceAgentConfig();
  if (!cfg.is_active) {
    console.log(`[VOICE_AGENT] Agente de voz inativo. Ignorando fala na chamada ${callId}.`);
    return { ok: true, ignored: true, reason: 'agent_disabled' };
  }

  // Garante que a chamada está registrada no gerenciador quente de chamadas
  let call = getCallSession(callId);
  if (!call) {
    call = registerCallSession({ callId, direction: 'INBOUND', profileKey: 'sirlene_normal' });
  }

  const callHistory = getCallHistory(callId);

  // 1. Transcreve fala do cliente via OpenAI STT
  const sttStart = Date.now();
  const userText = cleanSpeechTranscript(typeof liveText === 'string' ? liveText : await transcribeAudio(audioBuffer, 'audio/wav', { signal }));
  const sttMs = typeof liveText === 'string' ? (sttMetrics?.stt_after_commit_ms ?? 0) : Date.now() - sttStart;
  signal.throwIfAborted();
  if (!userText) return { ok: true, ignored: true, reason: 'no_spoken_words', call_id: callId };

  let replyText = '';
  let replyFailed = false; // GPT sem resposta: fala de reserva do personagem
  let closeAfterReply = false; // despedida após falhas seguidas: desligar depois de falar
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
    void persistVoiceUtterance(call, heardProfile, userText);
    if (activeVoiceTurns.get(callId)?.signal === signal) activeVoiceTurns.get(callId).userText = userText;

    const isStreamingEnabled = isVoiceStreamingEnabled();
    if (isStreamingEnabled &&
        (cfg.ai_provider || 'OPENAI') === 'OPENAI' && Number.isSafeInteger(speechEpoch)) {
      const apiKey = await resolveAiApiKey(cfg);
      signal.throwIfAborted();
      if (apiKey && !apiKey.startsWith('AIza') && !apiKey.startsWith('AQ.')) {
        return await processStreamingSpeechTurn({ callId, speechEpoch, cfg, apiKey, call, callHistory, userText, sttMs, sttMetrics, turnStart, signal, deps });
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
    if (llmResult.fallback && isElivingCharacter(llmResult.character_id)) {
      // Pede para repetir (no máximo 2 vezes seguidas) e, na falha seguinte, despede-se e desliga.
      const fallback = nextElivingFallback(call, llmResult.character_id);
      replyText = fallback.text;
      replyFailed = true;
      closeAfterReply = fallback.hangup;
    } else if (!llmResult.fallback) {
      resetElivingFallback(call);
    }
  } else {
    // Caso o áudio seja muito curto ou não haja palavras identificáveis
    const curProfile = call?.activeProfileKey ? getProfileByKey(call.activeProfileKey) : getActiveGlobalProfile();
    console.log(`[VOICE_AGENT] ℹ️ Áudio sem transcrição de fala clara ou silêncio na chamada ${callId}.`);
    replyText = `Olá! Aqui é ${curProfile.character_id === 'sirlene' ? 'a' : 'o'} ${curProfile.character_name}, do eLiving. Não consegui te ouvir com clareza, você pode repetir por favor?`;
  }

  signal.throwIfAborted();
  // Sanitiza texto para pronúncia limpa (mantém as [tags] do dono para a voz)
  replyText = sanitizeSpeechText(replyText);
  // Texto para tela, histórico, banco e telemetria: sem tags.
  const replyDisplay = stripAudioTags(replyText);
  const activeProfile = call?.activeProfileKey ? getProfileByKey(call.activeProfileKey) : getActiveGlobalProfile();
  console.log(`[VOICE_AGENT] 💬 ${activeProfile.character_name} (${activeProfile.mode_name}) responderá na chamada ${callId}: "${replyText}"`);

  // Atualiza histórico com a resposta do atendente
  callHistory.push({
    role: 'assistant',
    text: replyDisplay,
    timestamp: new Date().toISOString()
  });
  if (callHistory.length > 20) {
    callHistory.splice(0, callHistory.length - 20);
  }

  // 3. Sintetiza a resposta falada e reproduz na chamada
  const ttsStart = Date.now();
  try {
    const playResult = await speak({
      callId,
      text: replyText,
      voice: activeProfile.voice_id
    });
    // A fala de reserva é operacional: não entra na memória do aluno.
    if (!replyFailed) void persistVoiceTurn(call, activeProfile, '', replyDisplay);
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
      replyText: replyDisplay,
      voice: currentVoice,
      characterId: activeProfile.character_id,
      characterName: activeProfile.character_name,
      mode: activeProfile.mode,
      modeName: activeProfile.mode_name,
      profileKey: activeProfile.profile_key,
      personality: usedPersonality,
      usage: llmUsage,
      charactersSynthesized: replyDisplay.length,
      ttsProvider: playResult?.provider ?? null,
      error: replyFailed ? 'llm_unavailable' : null
    });
    if (closeAfterReply) void closeCallAfterFarewell(callId, replyText, deps);

    return {
      ok: true,
      call_id: callId,
      turn_number: turnNumber,
      user_text: userText || '',
      reply_text: replyDisplay,
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
      replyText: replyDisplay,
      voice: currentVoice,
      characterId: activeProfile.character_id,
      characterName: activeProfile.character_name,
      mode: activeProfile.mode,
      modeName: activeProfile.mode_name,
      profileKey: activeProfile.profile_key,
      personality: usedPersonality,
      usage: llmUsage,
      charactersSynthesized: replyDisplay.length,
      error: err.message
    });
    if (closeAfterReply) void closeCallAfterFarewell(callId, replyText, deps);

    return {
      ok: false,
      call_id: callId,
      user_text: userText || '',
      reply_text: replyDisplay,
      error: err.message
    };
  }
}



/** Retoma a resposta corrente com o perfil novo após encerrar o áudio antigo. */
export async function restartActiveReplyForProfile(callId) {
  const previous = activeVoiceTurns.get(callId);
  if (!previous?.userText || !Number.isSafeInteger(previous.speechEpoch)) return false;
  abortActiveVoiceTurn(callId, 'profile_changed', 'Active profile changed');
  await previous.done?.catch(() => {});
  if (activeVoiceTurns.get(callId) === previous) activeVoiceTurns.delete(callId);
  if (activeVoiceTurns.has(callId) || latestSpeechEpochs.get(callId) !== previous.speechEpoch) return false;
  const call = getCallSession(callId);
  const apiKey = await resolveAiApiKey();
  if (!call || !apiKey || !isVoiceStreamingEnabled()) return false;
  const controller = new AbortController();
  controller.speechEpoch = previous.speechEpoch;
  controller.userText = previous.userText;
  activeVoiceTurns.set(callId, controller);
  controller.done = processStreamingSpeechTurn({ callId, speechEpoch: previous.speechEpoch,
    cfg: await getVoiceAgentConfig(), apiKey, call, callHistory: getCallHistory(callId),
    userText: previous.userText, sttMs: 0, turnStart: Date.now(), signal: controller.signal });
  void controller.done.finally(() => {
    if (activeVoiceTurns.get(callId) === controller) activeVoiceTurns.delete(callId);
  }).catch(err => console.error('[VOICE_AGENT] Falha ao retomar resposta após troca de perfil:', err.message));
  return true;
}

async function processStreamingSpeechTurn({ callId, speechEpoch, cfg, apiKey, call, callHistory, userText, sttMs, sttMetrics, turnStart, signal, deps = {} }) {
  const profile = call?.activeProfileKey ? getProfileByKey(call.activeProfileKey) : getActiveGlobalProfile();
  const voice = call?.activeVoice || profile.voice_id;
  const baseTelemetry = { callId, userText, sttMs, voice, characterId: profile.character_id,
    characterName: profile.character_name, mode: profile.mode, modeName: profile.mode_name, profileKey: profile.profile_key };
  try {
    // Sem o token do meowcaller a resposta não teria como tocar: falha antes de chamar o GPT.
    const meowcallerToken = requireMeowcallerToken();
    const result = await streamReplyToCall({ callId, speechEpoch, apiKey, model: cfg.ai_model,
      systemInstruction: buildCallInstruction(call, profile), profile,
      userPrompt: userText, history: callHistory, voice, baseUrl: MEOWCALLER_BASE_URL, token: meowcallerToken, signal });
    signal.throwIfAborted();
    resetElivingFallback(call);
    void persistVoiceTurn(call, profile, '', result.text);
    callHistory.push({ role: 'assistant', text: result.text, timestamp: new Date().toISOString() });
    if (callHistory.length > 20) callHistory.splice(0, callHistory.length - 20);
    const metrics = { ...sttMetrics, ...result.metrics,
      input_end_to_first_audio_ms: sttMetrics?.input_ended_at && result.metrics.first_audio_sent_at
        ? result.metrics.first_audio_sent_at - sttMetrics.input_ended_at : null, transport: result.playback.metrics, streaming: true };
    recordTurnTelemetry({ ...baseTelemetry, replyText: result.text, usage: result.usage,
      llmFirstTokenMs: metrics.llm_first_token_ms, llmTotalMs: metrics.llm_total_ms,
      ttsMs: metrics.tts_first_audio_ms || 0, turnLatencyMs: Date.now() - turnStart,
      streamMetrics: metrics, charactersSynthesized: result.text.length, ttsProvider: result.ttsProvider });
    return { ok: true, streaming: true, call_id: callId, user_text: userText, reply_text: result.text, metrics, play_result: result.playback };
  } catch (err) {
    // Never replay a batch response after a partially spoken or interrupted stream.
    const interrupted = Boolean(err.interrupted || signal.aborted);
    const interruptionReason = resolveVoiceInterruptionReason(err, signal);
    if (interrupted && err.partialText?.trim()) {
      callHistory.push({ role: 'assistant', text: err.partialText, interrupted: true, timestamp: new Date().toISOString() });
      if (callHistory.length > 20) callHistory.splice(0, callHistory.length - 20);
    }
    recordTurnTelemetry({ ...baseTelemetry, replyText: err.partialText || '',
      turnLatencyMs: Date.now() - turnStart, ttsProvider: err.streamMetrics?.tts_provider ?? null,
      streamMetrics: { ...err.streamMetrics, streaming: true, interrupted,
        interruption_reason: interrupted ? interruptionReason : null,
        failure_reason: interrupted ? null : interruptionReason,
        playback_http_status: err.playbackHttpStatus ?? err.streamMetrics?.playback_http_status ?? null },
      error: interrupted ? 'stream_interrupted' : err.message });
    // Falhou sem falar nada (nem foi interrompido): a pessoa ouve a fala de reserva do personagem, não o silêncio.
    if (!interrupted && !err.partialText?.trim() && !signal.aborted && isElivingCharacter(profile.character_id)) {
      const fallback = await speakElivingFallback({ callId, call, profile, callHistory, deps });
      return { ok: false, streaming: true, interrupted: false, fallback: true, closing: fallback.hangup,
        call_id: callId, error: err.message };
    }
    return { ok: interrupted, streaming: true, interrupted,
      ...(interrupted ? { interruption_reason: interruptionReason } : {}),
      call_id: callId, error: interrupted ? null : err.message };
  }
}


// Prepare context and cancel superseded generation while incoming PCM is still arriving.
export function prepareLiveSpeech(callId, speechEpoch) {
  const previous = activeVoiceTurns.get(callId);
  if (previous && speechEpoch > previous.speechEpoch) {
    abortActiveVoiceTurn(callId, 'new_user_speech', 'New customer speech started');
  }
  const call = getCallSession(callId);
  const profile = call?.activeProfileKey ? getProfileByKey(call.activeProfileKey) : getActiveGlobalProfile();
  if (call) void loadCallerContext(call, profile.character_id);
}
