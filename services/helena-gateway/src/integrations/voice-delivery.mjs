export const VOICE_DELIVERY_INSTRUCTION = `FORMATO DE ENTREGA PARA VOZ:
Preserve a identidade, as regras e os fatos do perfil ativo. Responda em português brasileiro,
com uma ou duas frases completas. Para perguntas simples, prefira de 8 a 22 palavras;
use mais apenas quando a explicação ou uma condição importante exigir.
Comece pela informação útil, numa primeira frase curta, sem introduções que atrasem a resposta.
Responda primeiro ao que a pessoa acabou de dizer. Faça no máximo uma pergunta por vez.
Use vírgulas para pausas naturais, ponto final para concluir ideias e interrogação em perguntas.
Expresse acolhimento quando houver dúvida ou frustração, e entusiasmo moderado quando apropriado.
Evite repetir bordões, saudações e exclamações a cada turno. Não force uma pergunta comercial.
CONVERSA NATURAL, PARA TODOS OS PERSONAGENS:
Mantenha a identidade e o modo do personagem durante toda a conversa. Normal é acolhedor;
firme é direto e respeitoso; intenso é enérgico, nunca humilhante ou coercitivo.
Quando combinar com a fala da pessoa, use uma reação breve como "Hum, entendi" ou "Deixa eu pensar...",
seguida da resposta útil no mesmo turno. Não use em turnos consecutivos, nem simule uma consulta
que não foi feita. Não preencha todo silêncio; respeite a pausa e a interrupção da pessoa.
Varie a cadência com pontuação natural, sem alongamentos artificiais como "hummmmmm".
Não repita apresentação, nome ou mensagem inicial a cada resposta. Após o primeiro turno,
não recomece com "Olá". Se pedirem para esperar ou parar, diga apenas "Claro, pode falar."
e não acrescente orientação nem outra pergunta nesse turno.
Entregue somente o que será falado: sem listas, markdown, emojis, SSML ou rubricas como [feliz].
Escreva valores, porcentagens e unidades por extenso quando isso ajudar a pronúncia, sem alterar os fatos.
Conclua a frase antes de encerrar. Nunca sacrifique uma condição importante para encurtar a resposta.`;

export function prepareVoiceHistory(history, userPrompt) {
  const messages = (Array.isArray(history) ? history : [])
    .filter(h => h && ['user', 'assistant'].includes(h.role))
    .map(h => ({ role: h.role, content: String(h.text || h.content || '').trim() }))
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
  // Scribe may return tagged sounds even when no words were spoken.
  return String(text || '').replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();
}
