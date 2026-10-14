import { workDeliverySchema } from './work-submission.mjs';

// Autoconferencia deterministica antes de submit_work (Fundador, 2026-10-08).
// Barra o que e mecanico nas devolucoes reais: esquema, IDs internos, texto vago,
// rastreabilidade fora do summary, responsaveis sem AGT, checagens insuficientes.
// Nao grava nada e nao julga qualidade: o revisor independente continua obrigatorio.

const INTERNAL = /storage:\/\/|JOB-HR-|MEM-HR-|TSK-HR-|SHA-?256|verified\s*=|```/i;
const VAGUE = /\ba definir\b|\bconforme necess[aá]rio\b|\bTBD\b|\bem breve\b|\bpendente de defini[cç][aã]o\b/i;
const NEEDS_TRACE = /rastreab|por linha|se[cç][aã]o\/trecho|trecho|fonte por|URLs? literais?|chave individual/i;
const NEEDS_AGT = /nome\/AGT|nome e AGT|nome \+ AGT|AGT por linha|dono.{0,20}AGT|revisor.{0,20}AGT/i;
const OWNER_LINE = /\b(dono|respons[aá]vel|revisor)\b[^\n]{0,80}/gi;

function dodItems(definitionOfDone) {
  return String(definitionOfDone || '').split(/[.;\n]+/).map(item => item.trim()).filter(item => item.length >= 25);
}

export function checkDelivery({ delivery, summary = '', definitionOfDone = '' } = {}) {
  const errors = [];
  const warnings = [];
  // Mesmo esquema do submit_work: conteudo ate 8000 e checagens sem evidence_ref (o Gateway cria a referencia).
  const parsed = workDeliverySchema.safeParse(delivery);
  if (!parsed.success) {
    for (const issue of parsed.error.issues.slice(0, 6)) {
      errors.push({ code: 'SCHEMA', field: issue.path.join('.') || 'delivery', message: issue.message });
    }
    return { status: 'CORRECT_BEFORE_SUBMIT', errors, warnings, writes: 0 };
  }
  const d = parsed.data;
  if (String(summary).length > 8000) {
    errors.push({ code: 'SUMMARY_TOO_LONG', field: 'summary', message: `summary tem ${String(summary).length} caracteres; o maximo do submit_work e 8000. Agrupe o mapa por chave e remova repeticoes uma vez.` });
  }
  const publicText = `${d.title}\n${d.content}\n${d.next_steps}\n${d.limitations}`;
  if (INTERNAL.test(`${d.title}\n${d.content}`)) {
    errors.push({ code: 'INTERNAL_IDS', field: 'content', message: 'Material ao Fundador contem codigo interno (JOB-HR, MEM-HR, TSK-HR, storage); mova para o summary.' });
  }
  const vague = publicText.match(VAGUE);
  if (vague) errors.push({ code: 'VAGUE', field: 'content', message: `Texto vago encontrado: "${vague[0]}". Especifique ou marque como LACUNA com dono e proxima acao.` });
  if (/\bplano\b/i.test(d.title) && !/\bplano\b/i.test(definitionOfDone)) {
    warnings.push({ code: 'PLAN_INSTEAD', field: 'title', message: 'Titulo indica plano, mas a definicao de pronto nao pede plano; confirme que a entrega pedida foi produzida.' });
  }
  if (NEEDS_TRACE.test(definitionOfDone) && String(summary).trim().length < 1500) {
    errors.push({ code: 'TRACE_IN_SUMMARY', field: 'summary', message: `A definicao de pronto exige rastreabilidade, mas o summary tem ${String(summary).trim().length} caracteres; coloque o mapa completo linha -> fonte/trecho/versao no summary.` });
  }
  if (NEEDS_AGT.test(definitionOfDone)) {
    const missing = (d.content.match(OWNER_LINE) || []).filter(line => !/AGT-\d{2}/.test(line));
    if (missing.length) errors.push({ code: 'OWNER_WITHOUT_AGT', field: 'content', message: `Responsavel/revisor sem codigo AGT: "${missing[0].slice(0, 80)}".` });
  }
  const expected = Math.min(dodItems(definitionOfDone).length, 8);
  if (expected >= 3 && d.acceptance_checks.length < Math.min(expected, 4)) {
    warnings.push({ code: 'FEW_CHECKS', field: 'acceptance_checks', message: `A definicao de pronto tem cerca de ${expected} itens e a entrega traz ${d.acceptance_checks.length} checagens; cubra cada item principal.` });
  }
  return { status: errors.length ? 'CORRECT_BEFORE_SUBMIT' : 'READY_TO_SUBMIT', errors, warnings, writes: 0,
    note: 'Conferencia mecanica; nao substitui a revisao independente. Use no maximo 2 vezes por execucao.' };
}
