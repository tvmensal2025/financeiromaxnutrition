/**
 * log-privacy.mjs — Privacidade em logs e respostas internas do gateway.
 *
 * Regra: log de ligação/mensagem só leva ids, tamanhos, tempos e motivos. Telefone aparece só mascarado (4 últimos
 * dígitos) e nenhuma fala (da pessoa ou do personagem) nem conteúdo de saúde vai para log ou para a resposta dos
 * webhooks do meowcaller (o meowcaller grava o corpo da resposta no log dele e no diagnóstico).
 */

/** Telefone para log e painel: só os 4 últimos dígitos ('••••4321'); sem dígitos, 'Não identificado'. */
export function maskPhone(phone) {
  const digits = String(phone ?? '').split('@')[0].replace(/\D/g, '');
  if (!digits) return 'Não identificado';
  return digits.length <= 4 ? '••••' : `••••${digits.slice(-4)}`;
}

/** Campos que carregam fala ou transcrição: nunca saem em resposta a webhook interno. */
const SPEECH_KEYS = new Set(['text', 'user_text', 'reply_text', 'greeting', 'transcript', 'partial_text', 'prompt']);

/** Cópia do resultado sem nenhum campo de fala, em qualquer nível (ids, métricas e motivos ficam). */
export function withoutSpeechContent(value) {
  if (Array.isArray(value)) return value.map(withoutSpeechContent);
  if (!value || typeof value !== 'object' || Buffer.isBuffer(value)) return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !SPEECH_KEYS.has(key))
    .map(([key, item]) => [key, withoutSpeechContent(item)]));
}
