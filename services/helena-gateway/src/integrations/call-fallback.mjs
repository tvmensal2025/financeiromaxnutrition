/**
 * call-fallback.mjs — Fala de reserva SEGURA de uma ligação do eLiving.
 *
 * Quando o GPT não responde, a ligação de um personagem do eLiving (Sirlene, Alex, Vital, Rafael) NUNCA cai no
 * motor local de outra empresa do Helena (ex.: o "Pedro" da Max Nutrition, com catálogo de suplementos). Ela
 * fala uma frase curta e fixa, com a voz do próprio personagem, pedindo para a pessoa repetir; depois de
 * MAX_PEDIDOS_DE_REPETICAO falhas seguidas, despede-se com educação e a ligação é encerrada.
 *
 * Isolamento por personagem: só os personagens do eLiving (CHARACTERS_MAP) usam esta reserva; quem não é do
 * eLiving (teste do painel, outra empresa) continua no motor local configurado no agente de voz.
 * As [tags] seguem a paleta do personagem (eliving-voice-config.mjs); o Google recebe o texto sem tags.
 */
import ELIVING_VOICE_CONFIG from './eliving-voice-config.mjs';
import { CHARACTERS_MAP } from './call-engine.mjs';

/** Rótulo do "modelo" quando a resposta veio desta reserva (telemetria e testes). */
export const ELIVING_FALLBACK_MODEL = 'fallback-eliving';

/** Quantas vezes seguidas o personagem pede para a pessoa repetir antes de encerrar. */
export const MAX_PEDIDOS_DE_REPETICAO = 2;

/** true para Sirlene, Alex, Vital e Rafael (personagens do eLiving). */
export function isElivingCharacter(characterId) {
  return Object.hasOwn(CHARACTERS_MAP, String(characterId || '').trim().toLowerCase());
}

/** Pausa da paleta do personagem ([pause] ou [short pause]); vazio se a paleta não tiver nenhuma. */
function pausaDoPersonagem(characterId) {
  const paleta = ELIVING_VOICE_CONFIG.speakerTagPalette?.[characterId] || [];
  if (paleta.includes('pause')) return '[pause] ';
  if (paleta.includes('short pause')) return '[short pause] ';
  return '';
}

// Duas frases diferentes: a segunda tentativa não repete a primeira (regra de naturalidade).
const PEDIDOS_DE_REPETICAO = Object.freeze([
  pausa => `Tive um probleminha para te responder agora. ${pausa}Pode repetir, por favor?`,
  pausa => `Ainda não consegui te responder. ${pausa}Pode falar de novo, por favor?`
]);
const ENCERRAMENTO = pausa => `Vou encerrar por aqui. ${pausa}Tente de novo em alguns minutos pelo app.`;

/**
 * Fala de reserva para a N-ésima falha seguida (1, 2, 3...). Até MAX_PEDIDOS_DE_REPETICAO pede para repetir;
 * depois devolve a despedida com `hangup: true`.
 */
export function elivingFallbackSpeech(characterId, failureNumber = 1) {
  const n = Math.max(1, Math.floor(Number(failureNumber) || 1));
  const pausa = pausaDoPersonagem(String(characterId || '').trim().toLowerCase());
  if (n > MAX_PEDIDOS_DE_REPETICAO) return { text: ENCERRAMENTO(pausa), hangup: true };
  return { text: PEDIDOS_DE_REPETICAO[(n - 1) % PEDIDOS_DE_REPETICAO.length](pausa), hangup: false };
}

/** Registra mais uma falha seguida na ligação e devolve a fala de reserva correspondente. */
export function nextElivingFallback(call, characterId) {
  const failures = (call?.replyFailures || 0) + 1;
  if (call) call.replyFailures = failures;
  const speech = elivingFallbackSpeech(characterId, failures);
  if (speech.hangup && call) call.closingAfterFailures = true;
  return { ...speech, failures };
}

/** Uma resposta de verdade chegou: zera a contagem de falhas seguidas. */
export function resetElivingFallback(call) {
  if (call) call.replyFailures = 0;
}

/** Tempo para a despedida tocar antes de desligar (o /play do meowcaller não espera o fim do áudio). */
export function closingDelayMs(text) {
  const spoken = String(text || '').replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();
  return Math.min(12000, Math.max(3000, spoken.length * 75 + 1500));
}
