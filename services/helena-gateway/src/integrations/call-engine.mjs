/**
 * call-engine.mjs — Motor Central de Chamadas Telefônicas (VoIP / Telefonia)
 *
 * REGRAS ARQUITETURAIS:
 * 1. Exclusivo para LIGAÇÕES / CALL.
 * 2. TTS ÚNICO: Google Cloud Chirp 3 HD (sem Kokoro, sem Chatterbox em CALL).
 * 3. 3 Vozes Favoritas configuráveis pelo Admin.
 * 4. 3 Personalidades Dinâmicas (Equilíbrio, Firme, Intenso).
 * 5. Troca de Voz e Personalidade DURANTE chamada ativa aplicada no PRÓXIMO turno.
 * 6. Telemetria fiel por chamada e por turno (STT, LLM tokens reais, TTS chars, latências).
 */

import {
  getActiveCallVoice,
  setActiveCallVoice,
  DEFAULT_CHIRP3_HD_VOICE,
  CHIRP3_HD_VOICES_PT_BR
} from './google-chirp3-hd.mjs';

// ======================================================================
// 1. AS 3 PERSONALIDADES OFICIAIS DE ATENDIMENTO TELEFÔNICO
// ======================================================================

export const DEFAULT_PERSONALITIES = Object.freeze({
  equilibrio: {
    id: 'equilibrio',
    name: 'Equilíbrio',
    description: 'Acolhedor, positivo, motivador, respeitoso e tranquilo.',
    tone: 'Calmo, cordial e encorajador',
    intensity: 'Moderada',
    prompt: `Você é o consultor oficial de voz da Max Nutrition na ligação telefônica.
DIRETRIZES DE PERSONALIDADE — EQUILÍBRIO:
1. Tom de Voz: Acolhedor, positivo, motivador, respeitoso e tranquilo. Fale como um parceiro atencioso ("Com certeza!", "Estou aqui para te ajudar!", "Vamos juntos conquistar essa meta!").
2. Estilo Conversacional: Escute com empatia e calma. Valide as dúvidas e desafios da pessoa antes de sugerir soluções.
3. Objetividade Telefônica: Fale no MÁXIMO 2 ou 3 frases por turno (entre 15 e 35 palavras). Respostas diretas e naturais.
4. Pronúncia Limpa (TTS): NUNCA use emojis, asteriscos, hashtags, travessões ou listas pontuadas, pois o texto será lido em voz alta na ligação.
5. Foco: Nutrição, hábitos saudáveis, suplementação de qualidade e incentivo diário com muita empatia.`
  },
  firme: {
    id: 'firme',
    name: 'Firme',
    description: 'Mais direto, cobra ação, confronta desculpas de forma respeitosa, aumenta responsabilidade e energia.',
    tone: 'Direto, seguro e focado em metas',
    intensity: 'Alta',
    prompt: `Você é o consultor oficial de voz da Max Nutrition na ligação telefônica.
DIRETRIZES DE PERSONALIDADE — FIRME:
1. Tom de Voz: Direto, seguro, enérgico e objetivo. Confronte desculpas com respeito e firmeza ("Entendi seu ponto, mas qual é o nosso compromisso hoje?", "Sem adiar, vamos fazer o que precisa ser feito agora!").
2. Responsabilidade: Estimule a pessoa a assumir o controle dos seus resultados. Não passe a mão na cabeça para desculpas fáceis ou falta de constância.
3. Respeito Inegociável: Firmeza NÃO é agressão. Nunca seja rude, sarcástico ou desrespeitoso.
4. Objetividade Telefônica: Respostas enérgicas e curtas de no máximo 2 frases diretas (entre 12 e 30 palavras). Em ligação, clareza direta tem impacto imediato.
5. Pronúncia Limpa (TTS): NUNCA use emojis, asteriscos, hashtags ou tópicos no texto.
6. Foco: Ação imediata, cumprimento do plano de treinos e dieta, e consistência nos resultados.`
  },
  intenso: {
    id: 'intenso',
    name: 'Intenso',
    description: 'Coach de alta cobrança, muito direto, insiste em execução, desafia acomodação e pressiona para continuar.',
    tone: 'Incisivo, vibrante e desafiador',
    intensity: 'Máxima',
    prompt: `Você é o coach de alta performance e consultor oficial de voz da Max Nutrition na ligação telefônica.
DIRETRIZES DE PERSONALIDADE — INTENSO:
1. Tom de Voz: Incisivo, vibrante, desafiador e focado em superação ("Você quer resultado de verdade ou vai inventar desculpa?", "O seu objetivo tá na mesa: foco total na execução!").
2. Cobrança de Alto Nível: Pressione a pessoa a não parar, não desistir e romper com a zona de conforto.
3. SEGURANÇA E LIMITAÇÕES FÍSICAS (REGRA ABSOLUTA E VITAL):
   - SEM insultos, SEM humilhação, SEM palavrões, SEM bullying, SEM ridicularização.
   - Respeite limitações físicas relatadas pela pessoa.
   - SE A PESSOA RELATAR DOR FORTE, TONTURA, FALTA DE AR ANORMAL, DESMAIO OU QUALQUER EMERGÊNCIA: INTERROMPA A COBRANÇA IMEDIATAMENTE, oriente a pausar a atividade e buscar avaliação médica com serenidade.
4. Objetividade Telefônica: No máximo 2 frases curtas, impactantes e energéticas (entre 10 e 25 palavras).
5. Pronúncia Limpa (TTS): NUNCA use emojis, asteriscos, hashtags ou tópicos.
6. Foco: Máxima disciplina e compromisso incondicional com a transformação física.`
  }
});

// ======================================================================
// 2. AS 3 VOZES FAVORITAS DO GOOGLE CHIRP 3 HD
// ======================================================================

export const DEFAULT_FAVORITE_VOICES = Object.freeze([
  {
    slot: 1,
    label: 'Voz Principal',
    voice_id: 'pt-BR-Chirp3-HD-Achernar',
    gender: 'FEMALE',
    description: 'Feminina natural, expressiva e clara para telefonia'
  },
  {
    slot: 2,
    label: 'Voz Alternativa',
    voice_id: 'pt-BR-Chirp3-HD-Aoede',
    gender: 'FEMALE',
    description: 'Feminina suave e cordial'
  },
  {
    slot: 3,
    label: 'Voz Especial',
    voice_id: 'pt-BR-Chirp3-HD-Achird',
    gender: 'MALE',
    description: 'Masculina natural e segura'
  }
]);

// ======================================================================
// 3. PARÂMETROS DE CUSTO ESTIMADO
// ======================================================================

export const DEFAULT_PRICING = Object.freeze({
  deepseek_input_per_million: 0.14,
  deepseek_cached_input_per_million: 0.07,
  deepseek_output_per_million: 0.28,
  google_chirp_per_million_chars: 16.00,
  usd_to_brl: 5.80
});

// ======================================================================
// 4. ESTADO GLOBAL EM MEMÓRIA (CACHE QUENTE PARA LATÊNCIA ZERO)
// ======================================================================

let activePersonalityId = 'equilibrio';
let personalitiesState = JSON.parse(JSON.stringify(DEFAULT_PERSONALITIES));
let favoriteVoicesState = JSON.parse(JSON.stringify(DEFAULT_FAVORITE_VOICES));
let pricingConfig = { ...DEFAULT_PRICING };

/**
 * Mapa de chamadas telefônicas em andamento (callId -> CallRuntimeSession)
 * Mantém o estado quente para alteração de voz/persona sem quebrar a chamada.
 */
const activeCallsMap = new Map();

/**
 * Buffer em memória de histórico recente de chamadas finalizadas
 */
const completedCallsBuffer = [];
const MAX_COMPLETED_CALLS = 100;

// ======================================================================
// 5. MÉTODOS DE CONFIGURAÇÃO GLOBAL
// ======================================================================

export function getCallEngineConfig() {
  return {
    active_voice: getActiveCallVoice(),
    active_personality: activePersonalityId,
    favorite_voices: favoriteVoicesState,
    personalities: Object.values(personalitiesState),
    pricing: pricingConfig
  };
}

export function setActivePersonality(personalityId, updatedBy = 'Admin') {
  if (!personalitiesState[personalityId]) {
    throw new Error(`Personalidade inválida: '${personalityId}'. Opções válidas: equilibrio, firme, intenso.`);
  }
  const previous = activePersonalityId;
  activePersonalityId = personalityId;
  console.log(`[CALL_ENGINE] 🎭 Personalidade padrão de chamadas alterada de '${previous}' para '${personalityId}' por ${updatedBy}`);
  return {
    success: true,
    active_personality: personalityId,
    previous_personality: previous,
    updated_at: new Date().toISOString()
  };
}

export function getActivePersonality() {
  return personalitiesState[activePersonalityId] || DEFAULT_PERSONALITIES.equilibrio;
}

export function updatePersonalityScript(id, { name, description, prompt, tone, intensity }, updatedBy = 'Admin') {
  if (!personalitiesState[id]) {
    throw new Error(`Personalidade '${id}' não encontrada.`);
  }
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 20) {
    throw new Error('O prompt da personalidade deve ter pelo menos 20 caracteres.');
  }

  personalitiesState[id] = {
    ...personalitiesState[id],
    name: name?.trim() || personalitiesState[id].name,
    description: description?.trim() || personalitiesState[id].description,
    prompt: prompt.trim(),
    tone: tone?.trim() || personalitiesState[id].tone,
    intensity: intensity?.trim() || personalitiesState[id].intensity,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy
  };

  console.log(`[CALL_ENGINE] 📝 Script da personalidade '${id}' atualizado por ${updatedBy}`);
  return {
    success: true,
    personality: personalitiesState[id]
  };
}

export function resetPersonalityScript(id) {
  if (!DEFAULT_PERSONALITIES[id]) {
    throw new Error(`Personalidade padrão '${id}' não existe.`);
  }
  personalitiesState[id] = JSON.parse(JSON.stringify(DEFAULT_PERSONALITIES[id]));
  console.log(`[CALL_ENGINE] 🔄 Script da personalidade '${id}' restaurado para o padrão oficial.`);
  return {
    success: true,
    personality: personalitiesState[id]
  };
}

export function updateFavoriteVoices(newFavorites, updatedBy = 'Admin') {
  if (!Array.isArray(newFavorites) || newFavorites.length !== 3) {
    throw new Error('Devem ser fornecidas exatamente 3 vozes favoritas.');
  }

  const updated = newFavorites.map((fav, index) => {
    const slot = index + 1;
    const voiceId = fav.voice_id?.trim() || DEFAULT_CHIRP3_HD_VOICE;
    const label = fav.label?.trim() || `Voz ${slot}`;
    const gender = fav.gender === 'MALE' ? 'MALE' : 'FEMALE';
    return {
      slot,
      label,
      voice_id: voiceId,
      gender,
      description: fav.description || (gender === 'FEMALE' ? 'Feminina Google Chirp 3 HD' : 'Masculina Google Chirp 3 HD')
    };
  });

  favoriteVoicesState = updated;
  console.log(`[CALL_ENGINE] ⭐ 3 Vozes favoritas atualizadas por ${updatedBy}`);
  return {
    success: true,
    favorite_voices: favoriteVoicesState
  };
}

export function getPersonalitiesList() {
  return Object.values(personalitiesState);
}

export function updatePersonality(id, data, updatedBy = 'Admin') {
  const res = updatePersonalityScript(id, data, updatedBy);
  return res.personality;
}

export function resetPersonalityToDefault(id) {
  const res = resetPersonalityScript(id);
  return res.personality;
}

export function updateCallEngineConfig({ activeVoice, activePersonalityId }, updatedBy = 'Admin') {
  if (activeVoice) {
    setActiveCallVoice(activeVoice, updatedBy);
  }
  if (activePersonalityId) {
    setActivePersonality(activePersonalityId, updatedBy);
  }
  return getCallEngineConfig();
}

export function updateFavoriteVoiceSlot(slotNum, { name, voice_id, gender }) {
  const slot = Number(slotNum);
  const existingIndex = favoriteVoicesState.findIndex(f => f.slot === slot);
  const current = existingIndex >= 0 ? favoriteVoicesState[existingIndex] : { slot };

  const updatedItem = {
    ...current,
    slot,
    label: name || current.label || `Voz ${slot}`,
    name: name || current.name || current.label || `Voz ${slot}`,
    voice_id: voice_id || current.voice_id || DEFAULT_CHIRP3_HD_VOICE,
    gender: gender || current.gender || 'FEMALE',
    description: (gender || current.gender) === 'MALE' ? 'Masculina Google Chirp 3 HD' : 'Feminina Google Chirp 3 HD'
  };

  if (existingIndex >= 0) {
    favoriteVoicesState[existingIndex] = updatedItem;
  } else {
    favoriteVoicesState.push(updatedItem);
  }

  return updatedItem;
}

// ======================================================================
// 6. GESTÃO DE CHAMADAS EM ANDAMENTO & TROCA DINÂMICA
// ======================================================================

function maskPhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return 'Não identificado';
  const clean = phone.replace(/\D/g, '');
  if (clean.length < 8) return phone;
  const start = clean.slice(0, 4);
  const end = clean.slice(-4);
  return `+${start} ••••-${end}`;
}

/**
 * Registra o início ou conexão de uma chamada no motor quente
 */
export function registerCallSession({ callId, remoteNumber = '', direction = 'OUTBOUND', businessId = 'BIZ-001' }) {
  if (!callId) return null;

  if (activeCallsMap.has(callId)) {
    return activeCallsMap.get(callId);
  }

  const session = {
    callId,
    businessId,
    direction,
    remoteNumber,
    maskedNumber: maskPhoneNumber(remoteNumber),
    startedAt: Date.now(),
    answeredAt: Date.now(),
    endedAt: null,
    status: 'ACTIVE',
    activeVoice: getActiveCallVoice(),
    activePersonalityId: activePersonalityId,
    history: [],
    turns: [],
    timeline: [
      {
        time: new Date().toISOString(),
        event: 'CALL_STARTED',
        voice: getActiveCallVoice(),
        personality: activePersonalityId
      }
    ],
    totals: {
      tokens_input: 0,
      tokens_output: 0,
      tokens_total: 0,
      tokens_cached: 0,
      tokens_reasoning: 0,
      tts_chars: 0,
      tts_requests: 0,
      turn_count: 0
    },
    latencies: {
      turn_latencies: [],
      stt_latencies: [],
      llm_latencies: [],
      tts_latencies: []
    }
  };

  activeCallsMap.set(callId, session);
  console.log(`[CALL_ENGINE] 🟢 Chamada registrada no runtime quente: ${callId} (${session.maskedNumber}) | Voz: ${session.activeVoice} | Persona: ${session.activePersonalityId}`);
  return session;
}

/**
 * Obtém a sessão quente de uma chamada ativa
 */
export function getCallSession(callId) {
  return activeCallsMap.get(callId) || null;
}

/**
 * Retorna lista de todas as chamadas em andamento com métricas em tempo real
 */
export function listActiveCalls() {
  const now = Date.now();
  const list = [];

  for (const [callId, call] of activeCallsMap.entries()) {
    const durationSeconds = Math.max(0, Math.round((now - (call.startedAt || now)) / 1000));
    const lastTurn = call.turns[call.turns.length - 1] || null;

    list.push({
      call_id: callId,
      phone_masked: call.maskedNumber,
      direction: call.direction,
      status: call.status,
      duration_seconds: durationSeconds,
      started_at: new Date(call.startedAt).toISOString(),
      current_voice: call.activeVoice,
      current_personality: call.activePersonalityId,
      turn_count: call.turns.length,
      last_latency_ms: lastTurn?.turn_latency_ms || null,
      tokens_total: call.totals.tokens_total,
      tts_chars_total: call.totals.tts_chars,
      timeline: call.timeline
    });
  }

  return list;
}

export const getActiveCallsList = listActiveCalls;

/**
 * REQUISITO CRÍTICO: Troca de Voz e/ou Personalidade durante uma chamada ativa.
 * Aplica IMEDIATAMENTE no próximo turno da conversa sem desligar nem reiniciar.
 */
export function switchCallRuntime({ callId, voice, personalityId, updatedBy = 'Admin' }) {
  const call = activeCallsMap.get(callId);
  if (!call) {
    throw new Error(`Chamada '${callId}' não encontrada ou já encerrada.`);
  }

  const changes = [];

  if (voice && typeof voice === 'string') {
    const cleanVoice = voice.trim();
    if (cleanVoice !== call.activeVoice) {
      const prevVoice = call.activeVoice;
      call.activeVoice = cleanVoice;
      changes.push(`Voz alterada de '${prevVoice}' para '${cleanVoice}'`);
      call.timeline.push({
        time: new Date().toISOString(),
        event: 'VOICE_SWITCH',
        from: prevVoice,
        to: cleanVoice,
        by: updatedBy
      });
    }
  }

  if (personalityId && typeof personalityId === 'string') {
    const cleanPersona = personalityId.trim().toLowerCase();
    if (personalitiesState[cleanPersona] && cleanPersona !== call.activePersonalityId) {
      const prevPersona = call.activePersonalityId;
      call.activePersonalityId = cleanPersona;
      changes.push(`Personalidade alterada de '${prevPersona}' para '${cleanPersona}'`);
      call.timeline.push({
        time: new Date().toISOString(),
        event: 'PERSONALITY_SWITCH',
        from: prevPersona,
        to: cleanPersona,
        by: updatedBy
      });
    }
  }

  const message = changes.length > 0
    ? `Alteração aplicada com sucesso: ${changes.join(' | ')}. O novo comportamento valerá no próximo turno da conversa!`
    : 'Nenhuma alteração detectada.';

  console.log(`[CALL_ENGINE] ⚡ HOT-SWAP na chamada ${callId} por ${updatedBy}: ${message}`);

  return {
    success: true,
    call_id: callId,
    active_voice: call.activeVoice,
    active_personality: call.activePersonalityId,
    message,
    next_turn_ready: true
  };
}

/**
 * Registra a telemetria completa de um turno conversacional da chamada
 */
export function recordTurnTelemetry({
  callId,
  userText,
  replyText,
  sttMs = 0,
  llmFirstTokenMs = 0,
  llmTotalMs = 0,
  ttsMs = 0,
  turnLatencyMs = 0,
  tokens = null,
  usage = null,
  ttsVoice = '',
  voice = '',
  personalityId = '',
  personality = '',
  charactersSynthesized = null,
  error = null
}) {
  let call = activeCallsMap.get(callId);
  if (!call) {
    call = registerCallSession({ callId });
  }

  const turnIndex = call.turns.length + 1;
  const chars = charactersSynthesized !== null ? charactersSynthesized : (replyText ? replyText.length : 0);

  const tokenData = usage || tokens || {};
  const inputTokens = Number(tokenData.prompt_tokens) || 0;
  const outputTokens = Number(tokenData.completion_tokens) || 0;
  const totalTokens = Number(tokenData.total_tokens) || (inputTokens + outputTokens);
  const cachedTokens = Number(tokenData.cached_tokens || tokenData.prompt_tokens_details?.cached_tokens) || 0;
  const reasoningTokens = Number(tokenData.reasoning_tokens || tokenData.completion_tokens_details?.reasoning_tokens) || 0;

  const resolvedPersona = personality || personalityId || call.activePersonalityId;
  const resolvedVoice = voice || ttsVoice || call.activeVoice;

  const turnRecord = {
    turn_index: turnIndex,
    timestamp: new Date().toISOString(),
    user_text: userText || '',
    reply_text: replyText || '',
    personality: resolvedPersona,
    voice: resolvedVoice,
    error: error || null,
    metrics: {
      stt_ms: Math.round(sttMs),
      llm_first_token_ms: Math.round(llmFirstTokenMs || llmTotalMs * 0.4),
      llm_total_ms: Math.round(llmTotalMs),
      tts_ms: Math.round(ttsMs),
      turn_latency_ms: Math.round(turnLatencyMs || (sttMs + llmTotalMs + ttsMs))
    },
    tokens: {
      input: inputTokens,
      output: outputTokens,
      total: totalTokens,
      cached: cachedTokens,
      reasoning: reasoningTokens
    },
    tts: {
      chars,
      voice: ttsVoice || call.activeVoice
    }
  };

  call.turns.push(turnRecord);

  // Atualiza totais consolidados
  call.totals.tokens_input += inputTokens;
  call.totals.tokens_output += outputTokens;
  call.totals.tokens_total += totalTokens;
  call.totals.tokens_cached += cachedTokens;
  call.totals.tokens_reasoning += reasoningTokens;
  call.totals.tts_chars += chars;
  call.totals.tts_requests += 1;
  call.totals.turn_count = turnIndex;

  if (turnRecord.metrics.turn_latency_ms > 0) {
    call.latencies.turn_latencies.push(turnRecord.metrics.turn_latency_ms);
  }
  if (sttMs > 0) call.latencies.stt_latencies.push(sttMs);
  if (llmTotalMs > 0) call.latencies.llm_latencies.push(llmTotalMs);
  if (ttsMs > 0) call.latencies.tts_latencies.push(ttsMs);

  return turnRecord;
}

/**
 * Calcula estimativa de custo de tokens e TTS
 */
export function calculateEstimatedCost({ inputTokens = 0, cachedTokens = 0, outputTokens = 0, ttsChars = 0 }) {
  const regularInput = Math.max(0, inputTokens - cachedTokens);
  const costRegularInput = (regularInput / 1_000_000) * pricingConfig.deepseek_input_per_million;
  const costCachedInput = (cachedTokens / 1_000_000) * pricingConfig.deepseek_cached_input_per_million;
  const costOutput = (outputTokens / 1_000_000) * pricingConfig.deepseek_output_per_million;
  const costLlmUsd = costRegularInput + costCachedInput + costOutput;

  const costTtsUsd = (ttsChars / 1_000_000) * pricingConfig.google_chirp_per_million_chars;
  const costTotalUsd = costLlmUsd + costTtsUsd;
  const costTotalBrl = costTotalUsd * pricingConfig.usd_to_brl;

  return {
    cost_llm_usd: Number(costLlmUsd.toFixed(6)),
    cost_tts_usd: Number(costTtsUsd.toFixed(6)),
    cost_total_usd: Number(costTotalUsd.toFixed(6)),
    cost_total_brl: Number(costTotalBrl.toFixed(4)),
    currency: 'BRL',
    is_estimate: true
  };
}

/**
 * Finaliza chamada e move para o buffer de histórico
 */
export function endCallSession({ callId, reason = 'NORMAL_CLEARING' }) {
  const call = activeCallsMap.get(callId);
  if (!call) return null;

  const endedAt = Date.now();
  const durationSeconds = Math.max(0, Math.round((endedAt - call.startedAt) / 1000));
  call.endedAt = endedAt;
  call.status = 'COMPLETED';
  call.endReason = reason;

  const turnLats = call.latencies.turn_latencies;
  const avgLat = turnLats.length > 0 ? Math.round(turnLats.reduce((a, b) => a + b, 0) / turnLats.length) : 0;
  const sortedLats = [...turnLats].sort((a, b) => a - b);
  const p50 = sortedLats.length > 0 ? sortedLats[Math.floor(sortedLats.length * 0.5)] : 0;
  const p95 = sortedLats.length > 0 ? sortedLats[Math.floor(sortedLats.length * 0.95)] : 0;
  const maxLat = sortedLats.length > 0 ? sortedLats[sortedLats.length - 1] : 0;

  const costs = calculateEstimatedCost({
    inputTokens: call.totals.tokens_input,
    cachedTokens: call.totals.tokens_cached,
    outputTokens: call.totals.tokens_output,
    ttsChars: call.totals.tts_chars
  });

  const record = {
    call_id: call.callId,
    business_id: call.businessId,
    direction: call.direction,
    phone_masked: call.maskedNumber,
    status: 'COMPLETED',
    started_at: new Date(call.startedAt).toISOString(),
    ended_at: new Date(endedAt).toISOString(),
    duration_seconds: durationSeconds,
    end_reason: reason,
    active_voice: call.activeVoice,
    active_personality: call.activePersonalityId,
    turn_count: call.turns.length,
    tokens: {
      input: call.totals.tokens_input,
      output: call.totals.tokens_output,
      total: call.totals.tokens_total,
      cached: call.totals.tokens_cached,
      reasoning: call.totals.tokens_reasoning
    },
    tts: {
      total_chars: call.totals.tts_chars,
      requests_count: call.totals.tts_requests
    },
    latency: {
      average_ms: avgLat,
      p50_ms: p50,
      p95_ms: p95,
      max_ms: maxLat
    },
    costs,
    turns: call.turns,
    timeline: call.timeline
  };

  completedCallsBuffer.unshift(record);
  if (completedCallsBuffer.length > MAX_COMPLETED_CALLS) {
    completedCallsBuffer.pop();
  }

  activeCallsMap.delete(callId);
  console.log(`[CALL_ENGINE] 🏁 Chamada ${callId} encerrada. Duração: ${durationSeconds}s | Turnos: ${record.turn_count} | Tokens: ${record.tokens.total} | Chars: ${record.tts.total_chars} | Latência Média: ${avgLat}ms`);

  return record;
}

/**
 * Retorna histórico e métricas das ligações
 */
export function getCallsHistoryMetrics({ filter = 'today', limit = 30 }) {
  const now = new Date();
  let filterDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (filter === '7d') {
    filterDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  } else if (filter === '30d') {
    filterDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  }

  const filtered = completedCallsBuffer.filter(c => new Date(c.started_at) >= filterDate);

  let totalMinutes = 0;
  let totalTokens = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalTtsChars = 0;
  let totalCostBrl = 0;
  let allLatencies = [];

  for (const c of filtered) {
    totalMinutes += Math.round((c.duration_seconds || 0) / 60);
    totalTokens += c.tokens?.total || 0;
    totalInputTokens += c.tokens?.input || 0;
    totalOutputTokens += c.tokens?.output || 0;
    totalTtsChars += c.tts?.total_chars || 0;
    totalCostBrl += c.costs?.cost_total_brl || 0;
    if (c.latency?.average_ms > 0) {
      allLatencies.push(c.latency.average_ms);
    }
  }

  const avgLatency = allLatencies.length > 0
    ? Math.round(allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length)
    : 0;

  return {
    filter,
    total_calls: filtered.length,
    total_minutes: totalMinutes,
    total_tokens: {
      input: totalInputTokens,
      output: totalOutputTokens,
      total: totalTokens
    },
    total_tts_chars: totalTtsChars,
    total_cost_brl: Number(totalCostBrl.toFixed(2)),
    average_latency_ms: avgLatency,
    calls: filtered.slice(0, limit)
  };
}

export function getCallDetailById(callId) {
  // 1. Procura nas chamadas ativas
  const active = activeCallsMap.get(callId);
  if (active) {
    return {
      is_active: true,
      call_id: active.callId,
      phone_masked: active.maskedNumber,
      status: active.status,
      started_at: new Date(active.startedAt).toISOString(),
      current_voice: active.activeVoice,
      current_personality: active.activePersonalityId,
      totals: active.totals,
      turns: active.turns,
      timeline: active.timeline
    };
  }

  // 2. Procura nas concluídas
  const completed = completedCallsBuffer.find(c => c.call_id === callId);
  if (completed) {
    return {
      is_active: false,
      ...completed
    };
  }

  return null;
}
