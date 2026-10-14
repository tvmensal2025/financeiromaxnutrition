import crypto from 'node:crypto';

// Lancamento financeiro feito pelo Caio (AGT-05) dentro de um job proprio em execucao.
// O gatilho helena_financeiro_antes continua sendo a regra final no banco
// (valor >= 0, conta da mesma empresa, transferencia, estorno, campos calculados).
// Aqui ficam escopo, idempotencia, suspeita de duplicidade e rastreabilidade.

export const FLUXOS = ['ENTRADA', 'SAÍDA', 'TRANSFERÊNCIA'];
export const STATUS = ['PREVISTO', 'ABERTO', 'PARCIAL', 'PAGO', 'RECEBIDO', 'CANCELADO'];
const LIQUIDADO = new Set(['PAGO', 'RECEBIDO']);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;
const enc = encodeURIComponent;
const first = rows => Array.isArray(rows) ? rows[0] : null;
const fail = message => { throw new Error(message); };

// Aceita 1000 | 1.000,00 | 1000.50 | 49,90; devolve centavos inteiros ou null.
export function parseValorCentavos(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : null;
  const text = String(value ?? '').replace(/R\$|\s/g, '');
  if (!text) return null;
  let normal;
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(text) || /^\d+(,\d{1,2})$/.test(text)) normal = text.replace(/\./g, '').replace(',', '.');
  else if (/^\d+(\.\d{1,2})?$/.test(text)) normal = text;
  else return null;
  const cents = Math.round(Number(normal) * 100);
  return cents > 0 ? cents : null;
}

const normalizar = text => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function validarLancamento(args) {
  const descricao = String(args.descricao || '').trim();
  if (descricao.length < 3) fail('Descricao obrigatoria (minimo 3 caracteres)');
  if (!FLUXOS.includes(args.fluxo)) fail(`Fluxo invalido; use ${FLUXOS.join(', ')}`);
  if (!STATUS.includes(args.status)) fail(`Status invalido; use ${STATUS.join(', ')}`);
  const cents = parseValorCentavos(args.valor);
  if (cents === null) fail('Valor invalido; informe valor positivo (ex.: 1000, 1.000,00 ou 49,90). O sentido fica no fluxo');
  if (!args.conta_id) fail('Conta de origem obrigatoria; o sistema nao cria conta sozinho');
  if (args.fluxo === 'TRANSFERÊNCIA' && !args.conta_destino_id) fail('Transferencia exige conta de destino');
  if (args.fluxo !== 'TRANSFERÊNCIA' && args.conta_destino_id) fail('Conta de destino so vale para transferencia');
  for (const field of ['vencimento', 'liquidacao']) {
    if (args[field] && !DATE.test(args[field])) fail(`${field} deve estar no formato AAAA-MM-DD`);
  }
  if (args.competencia && !MONTH.test(args.competencia)) fail('competencia deve estar no formato AAAA-MM');
  if (LIQUIDADO.has(args.status) && !args.liquidacao) fail('PAGO/RECEBIDO exige data de liquidacao');
  if (!LIQUIDADO.has(args.status) && args.liquidacao) fail('Liquidacao so vale para PAGO ou RECEBIDO');
  if (!args.vencimento && !args.liquidacao) fail('Informe vencimento ou liquidacao');
  if (!String(args.evidencia || '').trim()) fail('Evidencia obrigatoria (origem do lancamento: extrato, nota, mensagem do fundador)');
  if (!/^[A-Za-z0-9:_-]{8,120}$/.test(args.idempotency_key || '')) fail('idempotency_key obrigatoria (8-120 caracteres)');
  return { descricao, cents };
}

export async function registrarLancamento(db, args, identity = {}) {
  const { descricao, cents } = validarLancamento(args);
  const businessId = identity.bindingVerified ? identity.businessId : args.business_id;
  if (!businessId) fail('Empresa do lancamento nao definida');

  const existing = first(await db(`/rest/v1/financeiro?select=finance_id,row_version,status&business_id=eq.${enc(businessId)}&idempotency_key=eq.${enc(args.idempotency_key)}&limit=1`));
  if (existing) return { status: 'ALREADY_RECORDED', finance_id: existing.finance_id, row_version: existing.row_version };

  const conta = first(await db(`/rest/v1/contas_financeiras?select=conta_id,business_id&conta_id=eq.${enc(args.conta_id)}&limit=1`));
  if (!conta) fail('Conta de origem nao cadastrada; registre a falta e peca o cadastro a Helena');
  if (conta.business_id && conta.business_id !== businessId) fail('Conta de origem pertence a outra empresa');
  if (args.plano_conta_id) {
    const plano = first(await db(`/rest/v1/plano_contas?select=plano_conta_id&plano_conta_id=eq.${enc(args.plano_conta_id)}&limit=1`));
    if (!plano) fail('Plano de contas inexistente; use um plano_conta_id cadastrado');
  }

  // Mesma empresa, conta, fluxo, valor e data com descricao equivalente = provavel duplicidade.
  const data = args.liquidacao || args.vencimento;
  const valor = (cents / 100).toFixed(2);
  const candidates = await db(`/rest/v1/financeiro?select=finance_id,descricao,valor_original,vencimento,liquidacao,status&business_id=eq.${enc(businessId)}&conta_id=eq.${enc(args.conta_id)}&fluxo=eq.${enc(args.fluxo)}&or=(vencimento.eq.${enc(data)},liquidacao.eq.${enc(data)})&limit=50`);
  const duplicates = (Array.isArray(candidates) ? candidates : []).filter(row =>
    parseValorCentavos(row.valor_original) === cents && row.status !== 'CANCELADO'
    && normalizar(row.descricao) === normalizar(descricao));
  if (duplicates.length && String(args.nao_e_duplicado_motivo || '').trim().length < 20) {
    return { status: 'DUPLICATE_SUSPECT', recorded: false, matches: duplicates.map(row => row.finance_id),
      next_step: 'Confira os lancamentos citados. Se for outro fato real, repita com nao_e_duplicado_motivo (20+ caracteres).' };
  }

  const financeId = `FIN-HR-${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
  const row = {
    finance_id: financeId,
    business_id: businessId,
    fluxo: args.fluxo,
    status: args.status,
    descricao,
    contraparte: args.contraparte?.trim() || null,
    valor_original: valor,
    moeda: 'BRL',
    vencimento: args.vencimento || null,
    liquidacao: args.liquidacao || null,
    competencia: args.competencia || String(data).slice(0, 7),
    conta_id: args.conta_id,
    conta_destino_id: args.conta_destino_id || null,
    categoria: args.categoria || null,
    plano_conta_id: args.plano_conta_id || null,
    evidencia: String(args.evidencia).trim(),
    idempotency_key: args.idempotency_key,
    source_system: 'HERMES',
    related_object_type: args.job_id ? 'agent_job' : null,
    related_object_id: args.job_id || null,
    execution_id: identity.profileSlug || null,
  };
  const inserted = first(await db('/rest/v1/financeiro', {
    method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row)
  }));
  if (!inserted?.finance_id) fail('Lancamento nao confirmado pelo banco');

  if (args.job_id) {
    await db('/rest/v1/agent_job_events', { method: 'POST', body: JSON.stringify({
      job_id: args.job_id, agent_id: identity.agentId || null, business_id: businessId,
      event_type: 'FINANCE_RECORDED', status: 'RUNNING',
      message: `Lancamento ${financeId} (${args.fluxo} ${valor} ${args.status}) registrado`,
      payload: { finance_id: financeId, idempotency_key: args.idempotency_key, duplicate_override: duplicates.length ? args.nao_e_duplicado_motivo : null }
    }) });
  }
  return { status: 'RECORDED', recorded: true, finance_id: inserted.finance_id, row_version: inserted.row_version,
    evidence_ref: `financeiro:${inserted.finance_id}` };
}
