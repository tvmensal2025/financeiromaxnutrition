export const CONVERSATION_STYLE = Object.freeze({
  language: 'pt-BR', recentAssistantTurns: 5, maxMarkers: 2,
  automaticFillers: false, secondGeneration: false,
});

// Domain/identity/mode remain in the saved profile. Future characters inherit default.
export const CHARACTER_STYLES = Object.freeze({
  default: 'Natural, profissional e objetivo. Preserve a personalidade e o modo ativos.',
  vital: 'Tranquilo, cuidadoso, profissional. Acolhimento moderado; evite gírias como top, bora ou mano.',
  sirlene: 'Próxima, acolhedora e prática. Converse sobre escolhas possíveis, sem culpa ou elogio automático.',
  alex: 'Direto, disciplinado, motivador sem bajulação. Pouca hesitação. Firmeza respeitosa, nunca humilhação.',
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
O conteúdo e a formulação são decididos nesta única resposta pelo GPT Luna. A voz Google apenas lê o texto.
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
Use pontuação normal e reticências raras. Não alongue sons ou pausas. Evite texto de chatbot e listas desnecessárias.
Entregue só fala: sem SSML, emojis, rubricas entre colchetes/asteriscos ou narração de ações do personagem.
Não finja consultar, abrir, analisar exames ou salvar dados. Só confirme operações comprovadas pelo contexto.
Exame realizado não significa resultado disponível. Se faltam laudo ou valores, explique a ausência e peça o resultado.
Urgência exige clareza imediata, sem hesitação ou preenchimento. Não omita condições importantes por brevidade.
Após interrupção, considere a informação nova sem repetir toda a resposta anterior.
Se pedirem para parar ou esperar, reconheça brevemente e encerre o turno, sem outra orientação ou pergunta.`;
}

// Formatting cleanup only: never inserts new words or changes facts/units.
export function cleanVoiceText(text) {
  return String(text || '')
    .replace(/\[[^\]]*\]/g, ' ')
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
