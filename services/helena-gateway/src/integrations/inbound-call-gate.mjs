/**
 * inbound-call-gate.mjs — Quem a IA atende numa ligação RECEBIDA pelo WhatsApp.
 *
 * Decisão do dono (13/10/2026): "ligação no WhatsApp não é bloqueada; a Sirlene atende com o prompt que tem no
 * Admin, convertendo e explicando". Por isso o padrão é "all": todo número é atendido pela Sirlene; o aluno conhecido
 * conversa com a ficha dele e quem não é aluno ouve o roteiro de conversão salvo no Admin (prospect_script da
 * Sirlene Normal, caller-context.mjs).
 *
 * Interruptor VOICE_INBOUND_CALL_POLICY: all (padrão; também quando ausente ou inválido) | students (só aluno
 * conhecido: ficha encontrada pelo telefone na Edge voice-caller-context; os demais são desligados sem abertura,
 * STT, GPT nem voz) | none (nenhuma ligação recebida é atendida pela IA). O meowcaller aceita o VoIP na hora (o
 * WhatsApp exige), então este filtro fica no gateway, antes de qualquer gasto.
 * Ligação de SAÍDA (aberta pelo app em call-phone) não passa por este filtro.
 */
import { loadCallerContext } from './caller-context.mjs';
import { getCallSession, normalizeCallId } from './call-engine.mjs';

export const INBOUND_CALL_POLICIES = Object.freeze(['students', 'all', 'none']);
export const DEFAULT_INBOUND_CALL_POLICY = 'all';
/** Quanto uma fala que chegou antes do webhook de atendimento espera pela decisão. */
export const INBOUND_GATE_WAIT_MS = 8000;

export function inboundCallPolicy(env = process.env) {
  const value = String(env?.VOICE_INBOUND_CALL_POLICY ?? '').trim().toLowerCase();
  return INBOUND_CALL_POLICIES.includes(value) ? value : DEFAULT_INBOUND_CALL_POLICY;
}

/** Decide se a IA atende uma ligação recebida: { allowed, reason }. Falha da consulta = não atende. */
export async function decideInboundCall(call, { policy = inboundCallPolicy(), loadContext = loadCallerContext } = {}) {
  if (policy === 'all') return { allowed: true, reason: 'policy_all' };
  if (policy === 'none') return { allowed: false, reason: 'policy_none' };
  let status;
  try {
    // Mesmo personagem da ligação recebida (Sirlene): a ficha fica no cache da conversa, sem segunda consulta.
    status = (await loadContext(call, 'sirlene'))?.status;
  } catch {
    status = 'unavailable';
  }
  if (status === 'matched') return { allowed: true, reason: 'known_student' };
  if (status === 'unavailable') return { allowed: false, reason: 'context_unavailable' };
  return { allowed: false, reason: `caller_${status === 'ambiguous' ? 'ambiguous' : 'unidentified'}` };
}

// Decisão por ligação (callId normalizado). Limitado para não crescer sem fim; apagado no fim da ligação.
const gates = new Map();
const MAX_GATES = 2000;

function gateEntry(callId) {
  const key = normalizeCallId(callId);
  let entry = gates.get(key);
  if (!entry) {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    entry = { decision: null, promise, resolve };
    gates.set(key, entry);
    if (gates.size > MAX_GATES) gates.delete(gates.keys().next().value);
  }
  return entry;
}

/** Grava a decisão da ligação (a primeira vale) e libera quem estava esperando. */
export function settleCallGate(callId, decision) {
  const entry = gateEntry(callId);
  if (!entry.decision) {
    entry.decision = { allowed: decision?.allowed === true, reason: String(decision?.reason || 'unknown') };
    entry.resolve(entry.decision);
  }
  return entry.decision;
}

export function callGateDecision(callId) {
  return gates.get(normalizeCallId(callId))?.decision || null;
}

export function forgetCallGate(callId) {
  gates.delete(normalizeCallId(callId));
}

/** Decisão já conhecida agora, sem esperar (silêncio, cutucada). A decisão da ligação vale antes da política. */
export function isCallAllowedNow(callId, { policy = inboundCallPolicy() } = {}) {
  const decided = callGateDecision(callId);
  if (decided) return decided.allowed;
  if (policy === 'all') return true;
  return getCallSession(callId)?.direction === 'OUTBOUND';
}

/**
 * Espera a decisão antes de gastar STT/GPT/voz com a fala da ligação. A fala que chega antes do webhook de
 * atendimento aguarda até `timeoutMs`; sem decisão nesse prazo, não é processada.
 */
export async function awaitCallGate(callId, { policy = inboundCallPolicy(), timeoutMs = INBOUND_GATE_WAIT_MS } = {}) {
  const decided = callGateDecision(callId);
  if (decided) return decided;
  if (policy === 'all') return { allowed: true, reason: 'policy_all' };
  if (getCallSession(callId)?.direction === 'OUTBOUND') return { allowed: true, reason: 'outbound' };
  const entry = gateEntry(callId);
  let timer;
  const timeout = new Promise(resolve => {
    timer = setTimeout(() => resolve({ allowed: false, reason: 'gate_timeout' }), timeoutMs);
  });
  try {
    return await Promise.race([entry.promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
