export const VOICE_DELIVERY_INSTRUCTION = `FORMATO DE ENTREGA PARA VOZ:
Preserve a identidade, as regras e os fatos do perfil ativo. Responda em português brasileiro,
com uma ou duas frases completas. Para perguntas simples, prefira de 8 a 22 palavras;
use mais apenas quando a explicação ou uma condição importante exigir.
Comece pela informação útil, numa primeira frase curta, sem introduções que atrasem a resposta.
Responda primeiro ao que a pessoa acabou de dizer. Faça no máximo uma pergunta por vez.
Use vírgulas para pausas naturais, ponto final para concluir ideias e interrogação em perguntas.
Expresse acolhimento quando houver dúvida ou frustração, e entusiasmo moderado quando apropriado.
Evite repetir bordões, saudações e exclamações a cada turno. Não force uma pergunta comercial.
Entregue somente o que será falado: sem listas, markdown, emojis, SSML ou rubricas como [feliz].
Escreva valores, porcentagens e unidades por extenso quando isso ajudar a pronúncia, sem alterar os fatos.
Conclua a frase antes de encerrar. Nunca sacrifique uma condição importante para encurtar a resposta.`;

export function prepareVoiceHistory(history, userPrompt) {
  const messages = (Array.isArray(history) ? history : [])
    .filter(h => h && ['user', 'assistant'].includes(h.role))
    .map(h => ({ role: h.role, content: String(h.text || h.content || '').trim() + (h.interrupted ? '\n[Resposta interrompida; pode não ter sido ouvida integralmente. Retome a nova informação sem repetir tudo.]' : '') }))
    .filter(h => h.content);
  const last = messages.at(-1);
  if (last?.role === 'user' && last.content === String(userPrompt || '').trim()) messages.pop();
  // Four exchanges, not four individual messages. Keep speaker pairs intact.
  const recent = messages.slice(-8);
  if (recent[0]?.role === 'assistant') recent.shift();
  return recent;
}

export function completeVoiceReply(text, finishReason) {
  // Never speak a token-limited fragment, including an apparently complete opening sentence
  // whose missing continuation could contain a qualification or correction.
  if (finishReason && !['stop', 'STOP'].includes(finishReason)) return '';
  return typeof text === 'string' ? text.trim() : '';
}

export function cleanSpeechTranscript(text) {
  // Transcribers may return tagged sounds even when no words were spoken.
  return String(text || '').replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();
}
