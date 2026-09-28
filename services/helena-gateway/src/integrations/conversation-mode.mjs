export function conversationModeInstruction(mode) {
  const modes = {
    normal: 'Acolha antes de orientar. Explore com perguntas abertas e suaves; ofereça escolhas e respeite o ritmo. Exemplo de forma: "O que tem dificultado isso para você?"',
    firm: 'Seja direto, calmo e específico. Identifique o obstáculo e peça uma decisão concreta, sem rodeios. Exemplo de forma: "Qual dessas duas ações você consegue cumprir hoje?"',
    intense: 'Use energia, frases curtas e convites claros à ação. Peça um compromisso específico e verificável, sem gritar, culpar, humilhar ou pressionar em assuntos de saúde. Exemplo de forma: "Vamos escolher o primeiro passo agora. Qual será?"',
  };
  return `MODO ATUAL DA CONVERSA: ${mode}. ${modes[mode] || modes.normal}
O modo muda a atitude e a formulação das perguntas, preservando a identidade, os fatos e a voz.
Não anuncie a troca nem reinicie a conversa. Não copie os exemplos literalmente a cada turno.
Estas orientações de modo prevalecem sobre um rótulo de modo antigo dentro do roteiro salvo.`;
}

export function webOpening(profile, isStart, userText) {
  if (!isStart && String(userText || '').trim()) return null;
  return isStart && profile.opening_enabled === true ? String(profile.opening_message || '').trim() : '';
}
