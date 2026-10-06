import ELIVING_VOICE_CONFIG from './eliving-voice-config.mjs';

export const CONVERSATION_STYLE = Object.freeze({
  language: 'pt-BR', recentAssistantTurns: 5, maxMarkers: 2,
  automaticFillers: false, secondGeneration: false,
});

// Tags de áudio: SÓ a lista do dono (eliving-voice-config.mjs, gerado da fonte única do app).
export const RECOMMENDED_AUDIO_TAGS = ELIVING_VOICE_CONFIG.audioTagsDono;

/** Regra do dono: de 1 a 3 tags por fala. */
export const MAX_AUDIO_TAGS_PER_FALA = 3;

const FORBIDDEN_RULES = ELIVING_VOICE_CONFIG.forbiddenWithStudent;
const FORBIDDEN_ALWAYS = FORBIDDEN_RULES.filter(rule => rule.exceto.length === 0).map(rule => rule.tag);
const FORBIDDEN_CELEBRATION_ONLY = FORBIDDEN_RULES.filter(rule => rule.exceto.length > 0);
const ALLOWED_WITH_STUDENT = RECOMMENDED_AUDIO_TAGS.filter(tag => !FORBIDDEN_RULES.some(rule => rule.tag === tag));
const TAG_PATTERN = /\[([^[\]\r\n]*)\]/g;

const bracket = tags => tags.map(tag => `[${tag}]`).join(' ');
const normalizeTag = raw => String(raw).replace(/\s+/g, ' ').trim().toLowerCase();
const celebrationTags = [...new Set(FORBIDDEN_CELEBRATION_ONLY.flatMap(rule => rule.exceto))];

// GUIA DE MODULAÇÃO VOCAL E EXPRESSIVIDADE (AUDIO TAGS) — regras do dono, vindas da configuração única.
export const AUDIO_TAGS_GUIDE = `
GUIA DE MODULAÇÃO VOCAL E EXPRESSIVIDADE (AUDIO TAGS):
1. Use de 1 a ${MAX_AUDIO_TAGS_PER_FALA} tags de áudio por fala, SEMPRE entre colchetes e em inglês, logo antes do trecho que modificam. Exemplo: "[curious] Me conta, como foi o seu dia?" ou "Entendi. [short pause] Vamos juntos."
2. Use SOMENTE estas tags (lista fechada; qualquer outra é removida antes da voz): ${bracket(ALLOWED_WITH_STUDENT)}.
3. ${bracket(FORBIDDEN_CELEBRATION_ONLY.map(rule => rule.tag))} só para comemorar junto, na mesma fala com ${bracket(celebrationTags)}. [sighs] e [sighing] só como alívio ou acolhimento, nunca como decepção. [whispers] é cumplicidade.
4. PROIBIDAS com a pessoa (soam como bronca, deboche ou desconforto): ${bracket(FORBIDDEN_ALWAYS)}.
5. Pausa é [pause] ou [short pause]. Não empilhe duas emoções seguidas.
6. Não verbalize a tag: ela só dirige a voz, não é falada nem aparece na tela. Colchetes só para tags; nunca use chaves { }.
`.trim();

function paletteText(characterId) {
  return bracket(ELIVING_VOICE_CONFIG.speakerTagPalette[characterId] || []);
}

// Domain/identity/mode remain in the saved profile. Future characters inherit default.
export const CHARACTER_STYLES = Object.freeze({
  default: 'Natural, profissional e objetivo. Preserve a personalidade e o modo ativos.',
  vital: `Sereno, cuidadoso e profissional, com acolhimento moderado. Tags preferidas: ${paletteText('vital')}.`,
  sirlene: `Próxima, acolhedora e prática. Tags preferidas: ${paletteText('sirlene')}.`,
  alex: `Energético e parceiro, motivador sem bajulação, segurança antes da intensidade. Tags preferidas: ${paletteText('alex')}.`,
  rafael: `Presente, calmo e parceiro, firmeza com respeito. Tags preferidas: ${paletteText('rafael')}.`
});


const OPENING = /^(hum+|hmm+|uhum|aham|ah(?:,?\s+(?:entendi|certo))?|entendi(?:\s+você)?|entendo|sinto muito|certo|então|bom|olha|vamos lá|vamos por partes|na verdade|perfeito|exatamente|deixa eu (?:ver|pensar|conferir))(?=[\s,.!?…:]|$)/iu;

export function recentConversationMarkers(history = []) {
  return history.filter(x => x?.role === 'assistant').slice(-CONVERSATION_STYLE.recentAssistantTurns)
    .map(x => String(x.text || x.content || '').trim().match(OPENING)?.[1]?.toLowerCase())
    .filter(Boolean);
}

export function buildNaturalnessInstruction({ profile = {}, history = [] } = {}) {
  const markers = recentConversationMarkers(history);
  return `NATURALIDADE CONVERSACIONAL — pt-BR:
O conteúdo e a formulação são decididos nesta única resposta pelo GPT Luna. A voz apenas sintetiza o texto.
Estilo complementar: ${CHARACTER_STYLES[profile.character_id] || CHARACTER_STYLES.default}
Preserve a identidade, o domínio, o modo e todos os fatos e limites do perfil recebido.
Responda ao último comentário como continuação da conversa, sem nova apresentação.
Pergunta simples merece resposta direta. Muitas respostas não precisam de marcador algum.
Não termine sempre com uma pergunta; só pergunte se faltar informação necessária. Não junte duas perguntas numa só frase.
Evite acolhimento automático como "entendo" ou "sinto muito" quando não houver sofrimento ou emoção a reconhecer.
Se o contexto justificar, use uma reação breve integrada à informação útil: reconhecimento de informação nova,
transição na explicação, confirmação de entendimento ou correção real. Não acrescente hesitações só para soar humano.
Use zero ou um marcador principal; no máximo dois em explicação complexa. Nunca encadeie bordões.
Não comece com um Hum/Hmm isolado. Prefira a primeira ideia útil em uma frase curta.
Não use marcadores em turnos consecutivos. Aberturas nas últimas cinco respostas: ${JSON.stringify(markers)}.
Evite reutilizar essas aberturas; se houve uma recentemente, comece diretamente com conteúdo.
Use pontuação normal e reticências (...) para pausas reflexivas e travessões (-) para cortes bruscos.

${AUDIO_TAGS_GUIDE}

Entregue só fala com audio tags válidas entre colchetes quando expressivo. Sem SSML, sem emojis ou narração teatral de ações.
Não finja consultar, abrir, analisar exames ou salvar dados. Só confirme operações comprovadas pelo contexto.
Exame realizado não significa resultado disponível. Se faltam laudo ou valores, explique a ausência e peça o resultado.
Urgência exige clareza imediata, sem hesitação ou preenchimento. Não omita condições importantes por brevidade.
Após interrupção, considere a informação nova sem repetir toda a resposta anterior.
Se pedirem para parar ou esperar, reconheça brevemente e encerre o turno, sem outra orientação ou pergunta.`;
}

/**
 * Remove QUALQUER trecho entre colchetes [..].
 * Essencial para o Google Cloud Chirp 3 HD (reserva), garantindo que o sintetizador nunca verbalize as tags.
 */
export function stripAudioTags(text) {
  return String(text || '')
    .replace(TAG_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?…])/g, '$1')
    .trim();
}

/**
 * true se a tag pode soar com o aluno nesta fala: está na lista do dono e não é proibida; as de
 * comemoração ([shouts]/[yelling]) só passam quando a fala também tem [excited] ou [enthusiastic].
 */
export function isAudioTagAllowed(tag, tagsDaFala = []) {
  const normalized = normalizeTag(tag);
  if (!RECOMMENDED_AUDIO_TAGS.includes(normalized)) return false;
  const rule = FORBIDDEN_RULES.find(item => item.tag === normalized);
  if (!rule) return true;
  return rule.exceto.length > 0 && rule.exceto.some(exception => tagsDaFala.includes(exception));
}

function tagsOf(text) {
  return [...String(text || '').matchAll(TAG_PATTERN)].map(match => normalizeTag(match[1]));
}

/**
 * Formata o texto para a ElevenLabs: mantém só as tags do dono permitidas com o aluno (no máximo
 * `maxTags`, regra de 1 a 3 por fala), remove as proibidas, as desconhecidas e qualquer { } (variável
 * não resolvida). `contexto` é o que já foi dito nesta mesma fala (vale para a exceção de comemoração).
 */
export function formatSpeechForElevenLabs(text, { contexto = '', maxTags = MAX_AUDIO_TAGS_PER_FALA } = {}) {
  const source = String(text || '');
  const tagsDaFala = tagsOf(`${contexto} ${source}`);
  let kept = 0;
  const curated = source
    .replace(TAG_PATTERN, (_match, raw) => {
      const tag = normalizeTag(raw);
      if (kept >= maxTags || !isAudioTagAllowed(tag, tagsDaFala)) return ' ';
      kept += 1;
      return `[${tag}]`;
    })
    .replace(/\{[^{}]*\}/g, ' ')
    .replace(/[{}]/g, ' ');
  return cleanVoiceText(curated, { preserveAudioTags: true }).replace(/\s+([,.;:!?…])/g, '$1');
}

/** Quantas tags de áudio há no texto. */
export function countAudioTags(text) {
  return tagsOf(text).length;
}

// Formatting cleanup only: never inserts new words or changes facts/units.
export function cleanVoiceText(text, options = {}) {
  const preserveAudioTags = options?.preserveAudioTags ?? false;
  let str = String(text || '');

  if (preserveAudioTags) {
    // Preserva apenas as tags da lista do dono e remove qualquer rubrica desconhecida
    str = str.replace(/\[([^\]]*)\]/g, (match, tag) => {
      const normalized = normalizeTag(tag);
      return RECOMMENDED_AUDIO_TAGS.includes(normalized) ? `[${normalized}]` : ' ';
    });
  } else {
    // Remove todas as tags entre colchetes (para Google Chirp 3 HD ou texto limpo)
    str = str.replace(/\[[^\]]*\]/g, ' ');
  }

  return str
    .replace(/\*(?:pausa|respira(?: fundo)?|suspira|pensando|thinking|pause)\*/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/[*#_~`]/g, '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\.{3,}/g, '…').replace(/…{2,}/g, '…')
    .replace(/\s+/g, ' ').trim();
}

export function isStandaloneMarker(text) {
  const clean = cleanVoiceText(text).replace(/[.!?…,:;]+$/g, '').trim();
  const match = clean.match(OPENING);
  return Boolean(match && match[0].length === clean.length);
}

