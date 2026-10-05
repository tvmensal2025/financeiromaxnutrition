export const CONVERSATION_STYLE = Object.freeze({
  language: 'pt-BR', recentAssistantTurns: 5, maxMarkers: 2,
  automaticFillers: false, secondGeneration: false,
});

// Catálogo Oficial de Audio Tags Recomendadas para Expressividade Humana
export const RECOMMENDED_AUDIO_TAGS = Object.freeze([
  // Emoções Intensas e Surpresa
  'surprised', 'shocked', 'amazed', 'excited',
  // Irritação, Firmeza e Raiva
  'angry', 'annoyed', 'frustrated',
  // Alegria e Humor
  'laughing', 'laughs', 'giggling', 'cheerfully',
  // Reações Humanas e Sons Vocais
  'sighs', 'sigh', 'clears throat', 'groaning',
  // Entonação e Direção de Entrega
  'whispers', 'whispering', 'shouts', 'quizzically', 'hesitant', 'indecisive', 'comforting', 'warmly'
]);

// GUIA DE MODULAÇÃO VOCAL E EXPRESSIVIDADE (AUDIO TAGS)
export const AUDIO_TAGS_GUIDE = `
GUIA DE MODULAÇÃO VOCAL E EXPRESSIVIDADE (AUDIO TAGS):
1. OBJETIVO E DIRETRIZES GERAIS:
Torne sua fala expressiva, natural e humana utilizando audio tags em inglês envolvidas em colchetes [ ].
Estas tags instruem o motor de voz sobre a entonação, emoção e reações sonoras exatas para cada momento.

2. CATÁLOGO DE TAGS DE ÁUDIO RECOMENDADAS:
- Emoções Intensas e Surpresa: [surprised] ou [shocked] (inesperado/inacreditável), [amazed] ou [excited] (admiração/entusiasmo).
- Irritação, Firmeza e Raiva: [angry] (tom forte/revolta), [annoyed] ou [frustrated] (leve incômodo/frustração).
- Alegria e Humor: [laughing] ou [laughs] (riso/engraçado), [giggling] (risinho leve), [cheerfully] (caloroso/positivo).
- Reações Humanas e Sons Vocais: [sighs] ou [sigh] (desabafo/alívio/cansaço), [clears throat] (pigarro antes de algo sério), [groaning] (desconforto).
- Entonação e Entrega: [whispers] ou [whispering] (voz baixa/segredo), [shouts] (falar alto/chamar atenção), [quizzically] (dúvida/curiosidade), [hesitant] ou [indecisive] (reflexão/hesitação), [comforting] ou [warmly] (empatia/carinho/acolhimento).

3. REGRAS DE FORMATAÇÃO E APLICAÇÃO:
- Posição: Insira a tag imediatamente antes da frase ou da palavra que deve receber a emoção.
- Pontuação: Utilize reticências (...) para pausas reflexivas e travessões (-) para cortes bruscos de pensamento.
- Não verbalize a tag: A tag serve apenas como instrução de áudio para o sintetizador; nunca leia a tag como uma palavra do texto.
`.trim();

// Domain/identity/mode remain in the saved profile. Future characters inherit default.
export const CHARACTER_STYLES = Object.freeze({
  default: 'Natural, profissional e objetivo. Preserve a personalidade e o modo ativos.',
  vital: 'Tranquilo, cuidadoso, profissional. Acolhimento moderado; use [clears throat], [warmly] e [hesitant] quando apropriado.',
  sirlene: 'Próxima, acolhedora e prática. Use [warmly], [cheerfully], [comforting] e [laughs] com naturalidade.',
  alex: 'Direto, disciplinado, motivador sem bajulação. Use [excited], [cheerfully] e [shouts] em momentos de superação.',
  rafael: 'Inspirador, sábio e dinâmico. Use [amazed], [surprised], [sighs] e [cheerfully] na medida certa.'
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
 * Remove todas as audio tags entre colchetes.
 * Essencial para o Google Cloud Chirp 3 HD, garantindo que o sintetizador nunca verbalize as tags.
 */
export function stripAudioTags(text) {
  return String(text || '')
    .replace(/\[[a-zA-Z\s_-]+\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Formata o texto para síntese no ElevenLabs mantendo exclusivamente as Audio Tags válidas do catálogo.
 */
export function formatSpeechForElevenLabs(text) {
  return cleanVoiceText(text, { preserveAudioTags: true });
}

// Formatting cleanup only: never inserts new words or changes facts/units.
export function cleanVoiceText(text, options = {}) {
  const preserveAudioTags = options?.preserveAudioTags ?? false;
  let str = String(text || '');

  if (preserveAudioTags) {
    // Preserva apenas as tags oficiais do catálogo e remove qualquer rubrica desconhecida
    str = str.replace(/\[([^\]]*)\]/g, (match, tag) => {
      const normalized = tag.toLowerCase().trim();
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

