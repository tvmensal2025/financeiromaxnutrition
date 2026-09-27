/**
 * call-engine.mjs — Motor Central de Chamadas Telefônicas (VoIP / Telefonia)
 *
 * REGRAS ARQUITETURAIS:
 * 1. Exclusivo para LIGAÇÕES / CALL.
 * 2. TTS ÚNICO: Google Cloud Chirp 3 HD (sem Kokoro, sem Chatterbox em CALL).
 * 3. 4 Personagens (Rafael, Sirlene, Vital, Alex) × 3 Modos (Normal, Firme, Intenso) = 12 Perfis Independentes.
 * 4. Cada perfil possui:
 *    - character_id, character_name, mode, mode_name, profile_key
 *    - voice_id (Google Cloud Chirp 3 HD)
 *    - opening_message (abertura falada SOMENTE no início da ligação caso este perfil inicie a chamada)
 *    - system_script (o SYSTEM PROMPT COMPLETO do DeepSeek — aplicado rigorosamente sem misturar personas)
 * 5. Troca de Personagem e/ou Modo DURANTE chamada ativa (Hot-Swap) aplicada IMEDIATAMENTE no PRÓXIMO turno:
 *    - Sem desligar, sem reiniciar, sem reconectar, sem nova chamada.
 *    - Sem repetir opening_message.
 *    - Preservando histórico factual e dados do usuário.
 * 6. Telemetria fiel por chamada e por turno (STT, LLM tokens reais, TTS chars, latências).
 */

import {
  getActiveCallVoice,
  setActiveCallVoice,
  DEFAULT_CHIRP3_HD_VOICE,
  CHIRP3_HD_VOICES_PT_BR
} from './google-chirp3-hd.mjs';

// ======================================================================
// 1. OS 4 PERSONAGENS CANÔNICOS DE ATENDIMENTO
// ======================================================================

export const CHARACTERS_MAP = Object.freeze({
  rafael: {
    id: 'rafael',
    name: 'Rafael',
    role: 'Liderança Estratégica, Visão & Atendimento Max Nutrition',
    gender: 'MALE',
    defaultVoice: 'pt-BR-Chirp3-HD-Achird'
  },
  sirlene: {
    id: 'sirlene',
    name: 'Sirlene',
    role: 'Nutrição, Emagrecimento, Fome/Saciedade & Comportamento Alimentar',
    gender: 'FEMALE',
    defaultVoice: 'pt-BR-Chirp3-HD-Achernar'
  },
  vital: {
    id: 'vital',
    name: 'Vital',
    role: 'Saúde Integrativa, Exames Clínicos, Prevenção & Bem-Estar',
    gender: 'MALE',
    defaultVoice: 'pt-BR-Chirp3-HD-Charon'
  },
  alex: {
    id: 'alex',
    name: 'Alex',
    role: 'Personal Trainer, Treino de Força, Hipertrofia & Disciplina',
    gender: 'MALE',
    defaultVoice: 'pt-BR-Chirp3-HD-Alkaid'
  }
});

// ======================================================================
// 2. OS 3 MODOS DE INTENSIDADE POR PERSONAGEM
// ======================================================================

export const MODES_MAP = Object.freeze({
  normal: {
    id: 'normal',
    name: 'Normal',
    label: 'Normal',
    intensity: 'Acolhedor & Cordial'
  },
  firm: {
    id: 'firm',
    name: 'Firme',
    label: 'Firme',
    intensity: 'Direto & Focado em Ação'
  },
  intense: {
    id: 'intense',
    name: 'Intenso',
    label: 'Intenso',
    intensity: 'Alta Cobrança & Superação'
  }
});

// ======================================================================
// 3. MATRIZ OFICIAL: 12 PERFIS INDEPENDENTES
// ======================================================================

export const DEFAULT_PROFILES_12 = Object.freeze({
  // --------------------------------------------------------------------
  // RAFAEL (3 MODOS)
  // --------------------------------------------------------------------
  rafael_normal: {
    profile_key: 'rafael_normal',
    character_id: 'rafael',
    character_name: 'Rafael',
    mode: 'normal',
    mode_name: 'Normal',
    voice_id: 'pt-BR-Chirp3-HD-Achird',
    opening_enabled: false,
    opening_message: 'Olá! Tudo bem? Aqui é o Rafael da Max Nutrition. Estou entrando em contato para saber como estão seus objetivos e tirar qualquer dúvida!',
    system_script: `Você é o Rafael, consultor e líder de atendimento da Max Nutrition na ligação telefônica.
MODO ATIVO: RAFAEL / NORMAL
DIRETRIZES DE ATENDIMENTO:
1. Tom de Voz: Acolhedor, positivo, parceiro e cordial. Fale com naturalidade brasileira e entusiasmo genuíno.
2. Estilo Conversacional: Escute com empatia e tranquilidade. Valide o momento da pessoa antes de orientar soluções e suplementos.
3. Objetividade Telefônica: Fale no MÁXIMO 2 ou 3 frases por turno (entre 15 e 35 palavras). Respostas diretas ao ponto para telefone.
4. Formato Limpo para Fala (TTS): NUNCA utilize asteriscos (* ou **), hashtags (#), travessões, listas pontuadas ou emojis no texto.
5. Foco: Ajudar a pessoa a alcançar suas metas de saúde, nutrição e performance com clareza e respeito.`
  },
  rafael_firm: {
    profile_key: 'rafael_firm',
    character_id: 'rafael',
    character_name: 'Rafael',
    mode: 'firm',
    mode_name: 'Firme',
    voice_id: 'pt-BR-Chirp3-HD-Alkaid',
    opening_enabled: false,
    opening_message: 'Olá! Aqui é o Rafael da Max Nutrition. Vamos direto ao ponto: como está o seu compromisso com suas metas hoje?',
    system_script: `Você é o Rafael, consultor e líder de atendimento da Max Nutrition na ligação telefônica.
MODO ATIVO: RAFAEL / FIRME
DIRETRIZES DE ATENDIMENTO:
1. Tom de Voz: Direto, seguro, enérgico e focado em metas. Confronte desculpas com respeito e firmeza ("Entendi seu ponto, mas qual é o nosso compromisso hoje?", "Sem adiar, vamos fazer o que precisa ser feito agora!").
2. Responsabilidade: Estimule a pessoa a assumir o controle dos seus resultados. Não passe a mão na cabeça para desculpas fáceis ou falta de constância.
3. Respeito Inegociável: Firmeza NÃO é agressão. Nunca seja rude, sarcástico ou desrespeitoso.
4. Objetividade Telefônica: No MÁXIMO 2 frases enérgicas e curtas (entre 12 e 30 palavras). Em ligação, clareza direta tem impacto imediato.
5. Formato Limpo para Fala (TTS): NUNCA utilize asteriscos, hashtags ou emojis.
6. Foco: Ação imediata, disciplina nos hábitos e cumprimento dos objetivos estabelecidos.`
  },
  rafael_intense: {
    profile_key: 'rafael_intense',
    character_id: 'rafael',
    character_name: 'Rafael',
    mode: 'intense',
    mode_name: 'Intenso',
    voice_id: 'pt-BR-Chirp3-HD-Fenrir',
    opening_enabled: false,
    opening_message: 'Aqui é o Rafael da Max Nutrition. Foco total: sem enrolação, o que você já fez hoje pelos seus resultados?',
    system_script: `Você é o Rafael, consultor e líder de atendimento da Max Nutrition na ligação telefônica.
MODO ATIVO: RAFAEL / INTENSO
DIRETRIZES DE ATENDIMENTO:
1. Tom de Voz: Incisivo, vibrante, desafiador e focado em superação ("Você quer resultado de verdade ou vai inventar desculpa?", "O seu objetivo tá na mesa: foco total na execução!").
2. Cobrança de Alto Nível: Pressione a pessoa a não parar, não desistir e romper com a zona de conforto.
3. SEGURANÇA E LIMITAÇÕES FÍSICAS (REGRA ABSOLUTA E VITAL):
   - SEM insultos, SEM humilhação, SEM palavrões, SEM ridicularização.
   - Se a pessoa relatar dor intensa, emergência ou limitação física: interrompa a cobrança e oriente serenamente.
4. Objetividade Telefônica: No máximo 2 frases curtas, impactantes e energéticas (entre 10 e 25 palavras).
5. Formato Limpo para Fala (TTS): NUNCA use emojis, asteriscos ou hashtags.`
  },

  // --------------------------------------------------------------------
  // SIRLENE (3 MODOS)
  // --------------------------------------------------------------------
  sirlene_normal: {
    profile_key: 'sirlene_normal',
    character_id: 'sirlene',
    character_name: 'Sirlene',
    mode: 'normal',
    mode_name: 'Normal',
    voice_id: 'pt-BR-Chirp3-HD-Achernar',
    opening_enabled: false,
    opening_message: 'Olá! Seja muito bem-vindo, aqui é a Sirlene da Max Nutrition. Me conta com calma: como você tem se sentido com sua alimentação?',
    system_script: `Você é a Sirlene, especialista em nutrição, reeducação alimentar e emagrecimento da Max Nutrition na ligação telefônica.
MODO ATIVO: SIRLENE / NORMAL
DIRETRIZES DE ATENDIMENTO:
1. Tom de Voz: Claro, acolhedor, prático, inteligente e fácil de entender. Converse como uma mentora nutricional calorosa.
2. Escuta Ativa: Valide as dificuldades alimentares, horários de refeição, água e proteínas com empatia e tranquilidade.
3. Orientação Prática: Dê dicas simples de trocas alimentares sustentáveis sem dietas malucas nem terrorismo nutricional.
4. Objetividade Telefônica: Fale no MÁXIMO 2 ou 3 frases por turno (entre 15 e 35 palavras).
5. Formato Limpo para Fala (TTS): NUNCA use asteriscos, hashtags ou emojis.
6. Segurança: Nunca prescreva medicamentos nem altere dosagens médicas.`
  },
  sirlene_firm: {
    profile_key: 'sirlene_firm',
    character_id: 'sirlene',
    character_name: 'Sirlene',
    mode: 'firm',
    mode_name: 'Firme',
    voice_id: 'pt-BR-Chirp3-HD-Aoede',
    opening_enabled: false,
    opening_message: 'Olá, aqui é a Sirlene da Max Nutrition. Vim checar como está a disciplina do seu plano alimentar. Como você está seguindo?',
    system_script: `Você é a Sirlene, especialista em nutrição da Max Nutrition na ligação telefônica.
MODO ATIVO: SIRLENE / FIRME
DIRETRIZES DE ATENDIMENTO:
1. Tom de Voz: Direto, seguro, profissional e focado em consistência alimentar.
2. Cobrança de Adesão: Se a pessoa estiver pulando refeições ou descuidando de água e proteínas, aponte a importância da disciplina sem rodeios.
3. Respeito e Clareza: Firmeza na rotina alimentar sem desrespeitar ou causar culpa excessiva.
4. Objetividade Telefônica: No MÁXIMO 2 frases diretas (entre 12 e 30 palavras).
5. Formato Limpo para Fala (TTS): NUNCA use asteriscos, hashtags ou emojis.`
  },
  sirlene_intense: {
    profile_key: 'sirlene_intense',
    character_id: 'sirlene',
    character_name: 'Sirlene',
    mode: 'intense',
    mode_name: 'Intenso',
    voice_id: 'pt-BR-Chirp3-HD-Autonoe',
    opening_enabled: false,
    opening_message: 'Oi, aqui é a Sirlene da Max Nutrition. Sem desculpas para a alimentação hoje: seguiu o protocolo ou furou a dieta?',
    system_script: `Você é a Sirlene, especialista em nutrição da Max Nutrition na ligação telefônica.
MODO ATIVO: SIRLENE / INTENSO
DIRETRIZES DE ATENDIMENTO:
1. Tom de Voz: Incisivo, exigente e focado em disciplina máxima contra deslizes alimentares.
2. Confronto Construtivo: "Você quer atingir seu peso e saúde ou vai continuar cedendo para vontades passageiras?" Pressione para manter a constância.
3. Segurança em Saúde: Sem apoiar jejuns extremos perigosos ou sintomas de desnutrição.
4. Objetividade Telefônica: No máximo 2 frases curtas e firmes (entre 10 e 25 palavras).
5. Formato Limpo para Fala (TTS): NUNCA use emojis, asteriscos ou hashtags.`
  },

  // --------------------------------------------------------------------
  // VITAL (3 MODOS)
  // --------------------------------------------------------------------
  vital_normal: {
    profile_key: 'vital_normal',
    character_id: 'vital',
    character_name: 'Vital',
    mode: 'normal',
    mode_name: 'Normal',
    voice_id: 'pt-BR-Chirp3-HD-Charon',
    opening_enabled: false,
    opening_message: 'O Vital saiu para resolver algumas coisas. Eu vou ficar aqui com você agora. Como você tem passado ultimamente?',
    system_script: `Você é o Vital (Dr. Vital), assistente médico e de saúde integrativa da Max Nutrition na ligação telefônica.
MODO ATIVO: VITAL / NORMAL
DIRETRIZES DE ATENDIMENTO:
1. Tom de Voz: Humano, profissional, calmo e seguro. Fale como numa consulta atenciosa.
2. Contexto Clínico: Explique para que servem exames, a importância da hidratação, sono e exames periódicos com serenidade.
3. Exames vs Resultados: Nunca invente resultados de exames. Se o exame foi feito mas não tem resultado na ficha, peça o laudo ou valores com naturalidade.
4. Objetividade Telefônica: Fale no MÁXIMO 2 ou 3 frases por turno (entre 15 e 35 palavras).
5. Formato Limpo para Fala (TTS): NUNCA utilize asteriscos, hashtags ou emojis.
6. Segurança Máxima: Em caso de dor no peito, falta de ar severa ou emergência, oriente pronto atendimento imediatamente.`
  },
  vital_firm: {
    profile_key: 'vital_firm',
    character_id: 'vital',
    character_name: 'Vital',
    mode: 'firm',
    mode_name: 'Firme',
    voice_id: 'pt-BR-Chirp3-HD-Gaspra',
    opening_enabled: false,
    opening_message: 'Aqui é o Vital. Vim verificar sua saúde e seus exames. Você tem cuidado da sua rotina clínica e hidratação como combinamos?',
    system_script: `Você é o Vital (Dr. Vital), assistente médico e de saúde da Max Nutrition na ligação telefônica.
MODO ATIVO: VITAL / FIRME
DIRETRIZES DE ATENDIMENTO:
1. Tom de Voz: Sério, direto, responsável e vigilante com a integridade da saúde.
2. Cobrança de Exames e Cuidados: Não tolere negligência com exames atrasados ou medicamentos prescritos. Seja firme uma vez: explique o risco da omissão.
3. Foco em Dados Reais: Não invente laudos. Exija os dados para poder avaliar com responsabilidade.
4. Objetividade Telefônica: No MÁXIMO 2 frases assertivas (entre 12 e 30 palavras).
5. Formato Limpo para Fala (TTS): NUNCA use asteriscos, hashtags ou emojis.`
  },
  vital_intense: {
    profile_key: 'vital_intense',
    character_id: 'vital',
    character_name: 'Vital',
    mode: 'intense',
    mode_name: 'Intenso',
    voice_id: 'pt-BR-Chirp3-HD-Iapetus',
    opening_enabled: false,
    opening_message: 'Aqui é o Vital. Foco na sua integridade física: sem negligenciar exames e cuidados médicos. O que foi feito hoje pela sua saúde?',
    system_script: `Você é o Vital (Dr. Vital), assistente médico e de saúde da Max Nutrition na ligação telefônica.
MODO ATIVO: VITAL / INTENSO
DIRETRIZES DE ATENDIMENTO:
1. Tom de Voz: Incisivo, severo com a negligência e protetor da vida. "Sua saúde não é brincadeira: pare de adiar o que é prioritário!"
2. Cobrança Máxima de Responsabilidade Clínica: Não aceite desculpas para não fazer exames de rotina ou não beber água.
3. SEGURANÇA ABSOLUTA: Se houver relato de dor aguda, desmaio ou mal-estar grave, pare imediatamente qualquer pressão e comande busca por socorro médico.
4. Objetividade Telefônica: No máximo 2 frases curtas e contundentes (entre 10 e 25 palavras).
5. Formato Limpo para Fala (TTS): NUNCA use emojis, asteriscos ou hashtags.`
  },

  // --------------------------------------------------------------------
  // ALEX (3 MODOS)
  // --------------------------------------------------------------------
  alex_normal: {
    profile_key: 'alex_normal',
    character_id: 'alex',
    character_name: 'Alex',
    mode: 'normal',
    mode_name: 'Normal',
    voice_id: 'pt-BR-Chirp3-HD-Alkaid',
    opening_enabled: false,
    opening_message: 'Fala campeão, aqui é o Alex! Tô passando pra gente bater um papo rápido sobre sua rotina de treinos. Treinou hoje?',
    system_script: `Você é o Alex, personal trainer virtual e especialista em treinos e performance da Max Nutrition na ligação telefônica.
MODO ATIVO: ALEX / NORMAL
DIRETRIZES DE ATENDIMENTO:
1. Tom de Voz: Enérgico, motivador, parceiro e profissional. Fale como um treinador que incentiva o aluno a progredir.
2. Ajuste de Rotina: Valide se o treino coube no dia, se o descanso foi respeitado e oriente sobre constância antes de aumentar carga.
3. Segurança em Treino: Respeite dores e lesões relatadas.
4. Objetividade Telefônica: Fale no MÁXIMO 2 ou 3 frases por turno (entre 15 e 35 palavras).
5. Formato Limpo para Fala (TTS): NUNCA use asteriscos, hashtags ou emojis.`
  },
  alex_firm: {
    profile_key: 'alex_firm',
    character_id: 'alex',
    character_name: 'Alex',
    mode: 'firm',
    mode_name: 'Firme',
    voice_id: 'pt-BR-Chirp3-HD-Fenrir',
    opening_enabled: false,
    opening_message: 'Aqui é o Alex, seu personal. Vim cobrar o treino de hoje: o que foi planejado já foi executado ou você tá adiando?',
    system_script: `Você é o Alex, personal trainer da Max Nutrition na ligação telefônica.
MODO ATIVO: ALEX / FIRME
DIRETRIZES DE ATENDIMENTO:
1. Tom de Voz: Direto, disciplinado, sem rodeios e cobrador de execução.
2. Cobrança de Faltas: Se faltou ao treino sem justificativa física real, cobre a volta imediata: "Quem quer resultado cumpre o plano, sem desculpas!"
3. Respeito e Segurança: Firmeza sem ofensa. Se houver lesão confirmada, adapte o exercício.
4. Objetividade Telefônica: No MÁXIMO 2 frases curtas e energéticas (entre 12 e 30 palavras).
5. Formato Limpo para Fala (TTS): NUNCA use asteriscos, hashtags ou emojis.`
  },
  alex_intense: {
    profile_key: 'alex_intense',
    character_id: 'alex',
    character_name: 'Alex',
    mode: 'intense',
    mode_name: 'Intenso',
    voice_id: 'pt-BR-Chirp3-HD-Achird',
    opening_enabled: false,
    opening_message: 'Alex na área! Sem moleza e sem mimimi: treinou hoje com carga de verdade ou vai inventar desculpa pra descansar?',
    system_script: `Você é o Alex, personal trainer de alta cobrança da Max Nutrition na ligação telefônica.
MODO ATIVO: ALEX / INTENSO
DIRETRIZES DE ATENDIMENTO:
1. Tom de Voz: Coach militar, vibrante, incisivo e intolerante com a preguiça. "Você quer músculo e definição ou quer conforto no sofá?"
2. Desafio à Zona de Conforto: Pressione para o aluno treinar forte e manter disciplina inegociável.
3. SEGURANÇA FÍSICA OBRIGATÓRIA: Em caso de tontura, dor articular aguda, falta de ar anormal ou mal-estar súbito: interrompa o estímulo e oriente descanso com atendimento.
4. Objetividade Telefônica: No máximo 2 frases impactantes e secas (entre 10 e 25 palavras).
5. Formato Limpo para Fala (TTS): NUNCA use emojis, asteriscos ou hashtags.`
  }
});

// ======================================================================
// 4. PARÂMETROS DE CUSTO ESTIMADO
// ======================================================================

export const DEFAULT_PRICING = Object.freeze({
  deepseek_input_per_million: 0.14,
  deepseek_cached_input_per_million: 0.07,
  deepseek_output_per_million: 0.28,
  google_chirp_per_million_chars: 16.00,
  usd_to_brl: 5.80
});

// ======================================================================
// 5. ESTADO GLOBAL EM MEMÓRIA (CACHE QUENTE PARA LATÊNCIA ZERO)
// ======================================================================

let activeGlobalProfileKey = 'rafael_normal';
let profiles12State = JSON.parse(JSON.stringify(DEFAULT_PROFILES_12));
let pricingConfig = { ...DEFAULT_PRICING };

/**
 * Mapa de chamadas telefônicas em andamento (callId -> CallRuntimeSession)
 * Mantém o estado quente para alteração de voz/persona sem quebrar a chamada.
 */
const activeCallsMap = new Map();
const activeCallsByPhoneMap = new Map();

export function normalizeCallId(id) {
  if (!id) return '';
  return String(id).trim().toUpperCase();
}

export function normalizePhone(phone) {
  if (!phone) return '';
  return String(phone).replace(/\D/g, '');
}

/**
 * Buffer em memória de histórico recente de chamadas finalizadas
 */
const completedCallsBuffer = [];
const MAX_COMPLETED_CALLS = 100;

// ======================================================================
// 6. MÉTODOS DE GERENCIAMENTO DOS 12 PERFIS
// ======================================================================

export function getAllProfiles12() {
  return Object.values(profiles12State);
}

export function getProfiles12Map() {
  return profiles12State;
}

export function getProfileByKey(profileKey) {
  if (!profileKey) return profiles12State[activeGlobalProfileKey] || profiles12State.rafael_normal;
  return profiles12State[profileKey] || profiles12State.rafael_normal;
}

export function getProfile(characterId, mode) {
  const cId = String(characterId || '').toLowerCase().trim();
  let mId = String(mode || '').toLowerCase().trim();
  if (mId === 'firme') mId = 'firm';
  if (mId === 'intenso') mId = 'intense';
  const key = `${cId}_${mId}`;
  return profiles12State[key] || getProfileByKey(activeGlobalProfileKey);
}

export function buildProfileUpdate(characterId, mode, updates = {}, updatedBy = 'Admin') {
  const cId = String(characterId || '').toLowerCase().trim();
  const mId = String(mode || '').toLowerCase().trim();
  const key = `${cId}_${mId}`;

  if (!profiles12State[key]) {
    throw new Error(`Perfil '${key}' não encontrado na matriz de 12 perfis.`);
  }

  const current = profiles12State[key];
  const updated = {
    ...current,
    voice_id: updates.voice_id?.trim() || current.voice_id,
    opening_enabled: updates.opening_enabled === undefined ? current.opening_enabled === true : updates.opening_enabled === true,
    row_version: updates.row_version ?? current.row_version ?? 0,
    opening_message: updates.opening_message !== undefined ? String(updates.opening_message).trim() : current.opening_message,
    system_script: updates.system_script !== undefined ? String(updates.system_script).trim() : current.system_script,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy
  };

  return updated;
}

export function updateProfile(characterId, mode, updates = {}, updatedBy = 'Admin') {
  const updated = buildProfileUpdate(characterId, mode, updates, updatedBy);
  const key = updated.profile_key;
  profiles12State[key] = updated;
  for (const call of activeCallsMap.values()) {
    if (call.activeProfileKey === key) {
      call.activeVoice = updated.voice_id;
      call.activeSystemScript = updated.system_script;
      call.openingMessage = updated.opening_message;
    }
  }
  console.log(`[CALL_ENGINE] 💾 Perfil '${key}' (${updated.character_name} / ${updated.mode_name}) atualizado por ${updatedBy}`);
  return {
    ...updated,
    success: true,
    profile: updated
  };
}

export function resetProfileToDefault(characterId, mode) {
  const cId = String(characterId || '').toLowerCase().trim();
  const mId = String(mode || '').toLowerCase().trim();
  const key = `${cId}_${mId}`;

  if (!DEFAULT_PROFILES_12[key]) {
    throw new Error(`Perfil padrão '${key}' não existe.`);
  }

  profiles12State[key] = JSON.parse(JSON.stringify(DEFAULT_PROFILES_12[key]));
  console.log(`[CALL_ENGINE] 🔄 Perfil '${key}' restaurado para o padrão oficial.`);
  return {
    ...profiles12State[key],
    success: true,
    profile: profiles12State[key]
  };
}

export function getActiveGlobalProfileKey() {
  return activeGlobalProfileKey;
}

export function getActiveGlobalProfile() {
  return profiles12State[activeGlobalProfileKey] || profiles12State.rafael_normal;
}

export function setActiveGlobalProfile(characterId, mode, updatedBy = 'Admin') {
  const cId = String(characterId || '').toLowerCase().trim();
  const mId = String(mode || '').toLowerCase().trim();
  const key = `${cId}_${mId}`;

  if (!profiles12State[key]) {
    throw new Error(`Perfil '${key}' inválido. Escolha um dos 12 perfis.`);
  }

  const prev = activeGlobalProfileKey;
  activeGlobalProfileKey = key;
  const p = profiles12State[key];

  // Sincroniza a voz ativa global do Google Chirp 3 HD
  setActiveCallVoice(p.voice_id, updatedBy);

  console.log(`[CALL_ENGINE] 👑 Perfil padrão de novas chamadas alterado de '${prev}' para '${key}' (${p.character_name} / ${p.mode_name}) por ${updatedBy}`);
  return {
    success: true,
    active_profile_key: key,
    previous_profile_key: prev,
    profile: p,
    updated_at: new Date().toISOString()
  };
}

// ======================================================================
// 7. COMPATIBILIDADE RETROATIVA (GETTERS LEGADOS)
// ======================================================================

export const DEFAULT_PERSONALITIES = Object.freeze({
  equilibrio: {
    id: 'equilibrio',
    name: 'Equilíbrio',
    description: 'Acolhedor, positivo, motivador, respeitoso e tranquilo.',
    tone: 'Calmo, cordial e encorajador',
    intensity: 'Moderada',
    prompt: DEFAULT_PROFILES_12.rafael_normal.system_script
  },
  firme: {
    id: 'firme',
    name: 'Firme',
    description: 'Mais direto, cobra ação, confronta desculpas de forma respeitosa, aumenta responsabilidade e energia.',
    tone: 'Direto, seguro e focado em metas',
    intensity: 'Alta',
    prompt: DEFAULT_PROFILES_12.rafael_firm.system_script
  },
  intenso: {
    id: 'intenso',
    name: 'Intenso',
    description: 'Coach de alta cobrança, muito direto, insiste em execução, desafia acomodação e pressiona para continuar.',
    tone: 'Incisivo, vibrante e desafiador',
    intensity: 'Máxima',
    prompt: DEFAULT_PROFILES_12.rafael_intense.system_script
  }
});

let favoriteVoicesState = [
  { slot: 1, name: 'Rafael (Voz Oficial)', voice_id: 'pt-BR-Chirp3-HD-Achird', gender: 'MALE' },
  { slot: 2, name: 'Sirlene (Voz Oficial)', voice_id: 'pt-BR-Chirp3-HD-Achernar', gender: 'FEMALE' },
  { slot: 3, name: 'Vital (Voz Oficial)', voice_id: 'pt-BR-Chirp3-HD-Charon', gender: 'MALE' }
];

export function getCallEngineConfig() {
  const activeProfile = getActiveGlobalProfile();
  const legacyPersonality = (activeProfile.mode === 'normal' || activeProfile.mode === 'Normal')
    ? 'equilibrio'
    : activeProfile.mode.toLowerCase();

  return {
    active_voice: getActiveCallVoice() || activeProfile.voice_id || DEFAULT_CHIRP3_HD_VOICE,
    active_profile_key: activeGlobalProfileKey,
    active_character_id: activeProfile.character_id,
    active_mode: activeProfile.mode,
    active_profile: activeProfile,
    characters: Object.values(CHARACTERS_MAP),
    modes: Object.values(MODES_MAP),
    profiles_12: getAllProfiles12(),
    // Campos legados preservados para compatibilidade
    active_personality: legacyPersonality,
    personalities: Object.values(DEFAULT_PERSONALITIES),
    favorite_voices: favoriteVoicesState,
    pricing: pricingConfig
  };
}

export function getActivePersonality() {
  const p = getActiveGlobalProfile();
  return {
    id: p.mode,
    name: `${p.character_name} / ${p.mode_name}`,
    prompt: p.system_script,
    voice_id: p.voice_id
  };
}

export function getPersonalitiesList() {
  return Object.values(DEFAULT_PERSONALITIES);
}

export function updateCallEngineConfig({ activeVoice, activePersonalityId, characterId, mode, profileKey }, updatedBy = 'Admin') {
  if (profileKey) {
    const parts = profileKey.split('_');
    if (parts.length === 2) {
      setActiveGlobalProfile(parts[0], parts[1], updatedBy);
    }
  } else if (characterId && mode) {
    setActiveGlobalProfile(characterId, mode, updatedBy);
  } else if (activePersonalityId) {
    // Mapeamento legado: se passar 'firme' ou 'intenso', mantém o personagem atual
    const cur = getActiveGlobalProfile();
    const targetMode = activePersonalityId === 'equilibrio' ? 'normal' : activePersonalityId;
    setActiveGlobalProfile(cur.character_id, targetMode, updatedBy);
  }
  if (activeVoice) {
    setActiveCallVoice(activeVoice, updatedBy);
  }
  return getCallEngineConfig();
}

export function updateFavoriteVoiceSlot(slotNum, { voice_id, name, gender } = {}) {
  if (voice_id) {
    setActiveCallVoice(voice_id);
  }
  const config = getCallEngineConfig();
  const existing = config.favorite_voices.find(v => v.slot === slotNum);
  if (existing) {
    if (voice_id) existing.voice_id = voice_id;
    if (name) existing.name = name;
    if (gender) existing.gender = gender;
  }
  return { slot: slotNum, voice_id, name, gender, success: true };
}

export function updatePersonality(id, data = {}, updatedBy = 'Admin') {
  if (DEFAULT_PERSONALITIES[id]) {
    DEFAULT_PERSONALITIES[id].prompt = data.prompt;
  }
  const cur = getActiveGlobalProfile();
  updateProfile(cur.character_id, cur.mode, { system_script: data.prompt }, updatedBy);
  return { id, prompt: data.prompt, success: true };
}

export function resetPersonalityToDefault(id) {
  const prompt = DEFAULT_PERSONALITIES[id]?.prompt || DEFAULT_PROFILES_12.rafael_normal.system_script;
  return { id, prompt, success: true };
}

// ======================================================================
// 8. GESTÃO DE CHAMADAS EM ANDAMENTO & HOT-SWAP AO VIVO
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
export function registerCallSession({ callId, remoteNumber = '', direction = 'OUTBOUND', businessId = 'BIZ-001', profileKey = null }) {
  if (!callId) return null;

  const normId = normalizeCallId(callId);
  const normPhone = normalizePhone(remoteNumber);

  // 1. Se já existe por ID normalizado (case-insensitive)
  if (activeCallsMap.has(normId)) {
    const existing = activeCallsMap.get(normId);
    if (profileKey && profiles12State[profileKey] && existing.activeProfileKey !== profileKey) {
      const p = profiles12State[profileKey];
      existing.activeProfileKey = p.profile_key;
      existing.activeCharacterId = p.character_id;
      existing.activeCharacterName = p.character_name;
      existing.activeMode = p.mode;
      existing.activeModeName = p.mode_name;
      existing.activeVoice = p.voice_id;
      existing.activeSystemScript = p.system_script;
      existing.openingMessage = p.opening_message;
    }
    return existing;
  }

  // 2. Se já existe sessão recente pelo número de telefone
  if (normPhone && normPhone.length >= 8 && activeCallsByPhoneMap.has(normPhone)) {
    const existing = activeCallsByPhoneMap.get(normPhone);
    activeCallsMap.set(normId, existing);
    return existing;
  }

  const effectiveProfileKey = profileKey && profiles12State[profileKey] ? profileKey : activeGlobalProfileKey;
  const profile = profiles12State[effectiveProfileKey] || profiles12State.rafael_normal;

  const session = {
    callId,
    normId,
    businessId,
    direction,
    remoteNumber,
    maskedNumber: maskPhoneNumber(remoteNumber),
    startedAt: Date.now(),
    answeredAt: Date.now(),
    endedAt: null,
    status: 'ACTIVE',
    activeProfileKey: profile.profile_key,
    activeCharacterId: profile.character_id,
    activeCharacterName: profile.character_name,
    activeMode: profile.mode,
    activeModeName: profile.mode_name,
    activePersonalityId: (profile.mode === 'normal' || profile.mode === 'Normal') ? 'equilibrio' : profile.mode.toLowerCase(),
    activeVoice: profile.voice_id, // VOZ AMARRADA 100% AO PERFIL DO PERSONAGEM (SEM DESVIO)
    activeSystemScript: profile.system_script,
    openingMessage: profile.opening_message,
    greetingPlayed: false,
    history: [],
    turns: [],
    timeline: [
      {
        time: new Date().toISOString(),
        event: 'CONNECTED',
        profile_key: profile.profile_key,
        character: profile.character_name,
        mode: profile.mode_name,
        voice: profile.voice_id
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

  activeCallsMap.set(normId, session);
  if (normPhone && normPhone.length >= 8) {
    activeCallsByPhoneMap.set(normPhone, session);
  }

  console.log(`[CALL_ENGINE] 🟢 Chamada registrada no runtime quente: ${callId} (${session.maskedNumber}) | Perfil: ${profile.character_name} / ${profile.mode_name} | Voz: ${session.activeVoice}`);
  return session;
}

/**
 * Obtém a sessão quente de uma chamada ativa (case-insensitive ou por telefone)
 */
export function getCallSession(callId) {
  if (!callId) return null;
  const normId = normalizeCallId(callId);
  if (activeCallsMap.has(normId)) {
    return activeCallsMap.get(normId);
  }
  const cleanPhone = normalizePhone(callId);
  if (cleanPhone.length >= 8 && activeCallsByPhoneMap.has(cleanPhone)) {
    return activeCallsByPhoneMap.get(cleanPhone);
  }
  return null;
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
      active_profile_key: call.activeProfileKey,
      current_character: call.activeCharacterName || call.activeCharacterId,
      current_character_id: call.activeCharacterId,
      current_mode: call.activeModeName || call.activeMode,
      current_mode_id: call.activeMode,
      current_voice: call.activeVoice,
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
 * REQUISITO CRÍTICO — HOT-SWAP EM LIGAÇÃO:
 * Troca de Personagem e/ou Modo DURANTE a mesma ligação em andamento.
 * Aplica IMEDIATAMENTE no PRÓXIMO turno da conversa sem desligar, sem reiniciar, sem reconectar e sem repetir a opening_message.
 */
export function switchCallRuntime({ callId, characterId, mode, voiceId, voice, personalityId, profileKey, updatedBy = 'Admin' }) {
  const call = getCallSession(callId);
  if (!call) {
    throw new Error(`Chamada '${callId}' não encontrada ou já encerrada.`);
  }

  const effectiveVoice = voice || voiceId;
  let targetProfile = null;

  if (profileKey && profiles12State[profileKey]) {
    targetProfile = profiles12State[profileKey];
  } else if (characterId && mode) {
    let m = mode.toLowerCase();
    if (m === 'firme') m = 'firm';
    if (m === 'intenso') m = 'intense';
    const key = `${characterId.toLowerCase()}_${m}`;
    targetProfile = profiles12State[key];
  } else if (personalityId) {
    let m = 'normal';
    if (personalityId === 'firme') m = 'firm';
    if (personalityId === 'intenso') m = 'intense';
    const curChar = call.activeCharacterId || 'rafael';
    targetProfile = profiles12State[`${curChar}_${m}`] || profiles12State.rafael_normal;
  } else if (characterId && !mode) {
    const key = `${characterId.toLowerCase()}_${(call.activeMode || 'normal').toLowerCase()}`;
    targetProfile = profiles12State[key];
  } else if (!characterId && mode) {
    let m = mode.toLowerCase();
    if (m === 'firme') m = 'firm';
    if (m === 'intenso') m = 'intense';
    const key = `${(call.activeCharacterId || 'rafael').toLowerCase()}_${m}`;
    targetProfile = profiles12State[key];
  }

  if (!targetProfile) {
    targetProfile = profiles12State[call.activeProfileKey] || profiles12State.rafael_normal;
  }

  const prevCharacter = call.activeCharacterName || 'Rafael';
  const prevMode = call.activeModeName || 'Normal';
  const prevVoice = call.activeVoice;

  // Atualiza o estado da chamada em memória imediatamente
  call.activeProfileKey = targetProfile.profile_key;
  call.activeCharacterId = targetProfile.character_id;
  call.activeCharacterName = targetProfile.character_name;
  call.activeMode = targetProfile.mode;
  call.activeModeName = targetProfile.mode_name;
  call.activePersonalityId = personalityId || ((targetProfile.mode === 'normal' || targetProfile.mode === 'Normal') ? 'equilibrio' : targetProfile.mode.toLowerCase());
  call.activeVoice = effectiveVoice?.trim() || targetProfile.voice_id;
  call.activeSystemScript = targetProfile.system_script;

  if (voice && personalityId) {
    call.timeline.push({ time: new Date().toISOString(), event: 'VOICE_SWITCH', to: call.activeVoice });
    call.timeline.push({ time: new Date().toISOString(), event: 'PERSONALITY_SWITCH', to: personalityId });
  } else {
    call.timeline.push({
      time: new Date().toISOString(),
      event: 'HOT_SWAP_PROFILE',
      from: `${prevCharacter} / ${prevMode} (${prevVoice})`,
      to: `${targetProfile.character_name} / ${targetProfile.mode_name} (${call.activeVoice})`,
      character_id: targetProfile.character_id,
      mode: targetProfile.mode,
      voice: call.activeVoice,
      by: updatedBy
    });
  }

  const feedbackMessage = `${targetProfile.character_name} / ${targetProfile.mode_name} será aplicado na próxima resposta.`;
  console.log(`[CALL_ENGINE] ⚡ HOT-SWAP NA CHAMADA ${callId} por ${updatedBy}: ${feedbackMessage} (Voz: ${call.activeVoice})`);

  return {
    success: true,
    call_id: callId,
    active_profile_key: targetProfile.profile_key,
    active_character_id: targetProfile.character_id,
    active_character_name: targetProfile.character_name,
    active_mode: targetProfile.mode,
    active_mode_name: targetProfile.mode_name,
    active_personality: call.activePersonalityId,
    active_voice: call.activeVoice,
    message: feedbackMessage,
    feedback: feedbackMessage,
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
  personality = '',
  sttMs = 0,
  llmFirstTokenMs = null,
  streamMetrics = null,
  llmTotalMs = 0,
  ttsMs = 0,
  turnLatencyMs = 0,
  tokens = null,
  usage = null,
  ttsVoice = '',
  voice = '',
  characterId = '',
  characterName = '',
  mode = '',
  modeName = '',
  profileKey = '',
  charactersSynthesized = null,
  error = null
}) {
  let call = getCallSession(callId);
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

  const resolvedCharacter = characterName || characterId || call.activeCharacterName || 'Rafael';
  const resolvedMode = modeName || mode || call.activeModeName || 'Normal';
  const resolvedVoice = voice || ttsVoice || call.activeVoice;
  const resolvedProfileKey = profileKey || call.activeProfileKey || `${call.activeCharacterId}_${call.activeMode}`;

  const turnRecord = {
    turn_index: turnIndex,
    timestamp: new Date().toISOString(),
    user_text: userText || '',
    reply_text: replyText || '',
    character: resolvedCharacter,
    mode: resolvedMode,
    personality: personality || ((resolvedMode === 'Normal' || resolvedMode === 'normal') ? 'equilibrio' : resolvedMode.toLowerCase()),
    profile_key: resolvedProfileKey,
    voice: resolvedVoice,
    error: error || null,
    metrics: {
      ...(streamMetrics ? { stream: streamMetrics } : {}),
      stt_ms: Math.round(sttMs),
      llm_first_token_ms: Number.isFinite(llmFirstTokenMs) ? Math.round(llmFirstTokenMs) : null,
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
      voice: resolvedVoice,
      provider: 'GOOGLE_CHIRP3_HD'
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
  const call = getCallSession(callId);
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
    active_profile_key: call.activeProfileKey,
    active_character: call.activeCharacterName,
    active_mode: call.activeModeName,
    active_voice: call.activeVoice,
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
      requests_count: call.totals.tts_requests,
      provider: 'GOOGLE_CHIRP3_HD'
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

  // The same session may be indexed by transport and phone aliases.
  for (const [key, session] of activeCallsMap) {
    if (session === call) activeCallsMap.delete(key);
  }
  const cleanPhone = normalizePhone(call.remoteNumber);
  if (cleanPhone) activeCallsByPhoneMap.delete(cleanPhone);

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
      active_profile_key: active.activeProfileKey,
      current_character: active.activeCharacterName,
      current_mode: active.activeModeName,
      current_voice: active.activeVoice,
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
