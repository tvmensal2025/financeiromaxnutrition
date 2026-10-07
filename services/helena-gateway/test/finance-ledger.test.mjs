import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseValorCentavos, registrarLancamento } from '../src/finance-ledger.mjs';
import { authorizeGatewayTool } from '../src/runtime-access.mjs';

const JOB = 'JOB-HR-' + 'f'.repeat(32);
const caio = { agentId: 'AGT-05', businessId: 'BIZ-001', bindingVerified: true, profileSlug: 'caio--biz001' };
const base = {
  job_id: JOB, fluxo: 'SAÍDA', status: 'PAGO', descricao: 'Energia escritório setembro', valor: '1.250,40',
  conta_id: 'CTA-BIZ001', liquidacao: '2026-10-05', evidencia: 'Extrato enviado pelo fundador', idempotency_key: 'caio-energia-2026-09'
};

function fakeDb({ existing = null, conta = { conta_id: 'CTA-BIZ001', business_id: 'BIZ-001' }, plano = { plano_conta_id: 'PC-1' }, rows = [] } = {}) {
  const calls = [];
  const db = async (path, options = {}) => {
    calls.push({ path, options });
    if (options.method === 'POST' && path === '/rest/v1/financeiro') return [{ ...JSON.parse(options.body), row_version: 7 }];
    if (options.method === 'POST') return null;
    if (path.includes('idempotency_key=eq.')) return existing ? [existing] : [];
    if (path.startsWith('/rest/v1/contas_financeiras')) return conta ? [conta] : [];
    if (path.startsWith('/rest/v1/plano_contas')) return plano ? [plano] : [];
    if (path.startsWith('/rest/v1/financeiro?')) return rows;
    throw new Error('caminho inesperado ' + path);
  };
  return { db, calls };
}

test('valores em formato brasileiro viram centavos exatos', () => {
  assert.equal(parseValorCentavos('1.250,40'), 125040);
  assert.equal(parseValorCentavos('49,90'), 4990);
  assert.equal(parseValorCentavos('1000'), 100000);
  assert.equal(parseValorCentavos('1000.5'), 100050);
  assert.equal(parseValorCentavos('R$ 2.000'), 200000);
  for (const bad of ['0', '-10', 'abc', '1,2,3', '']) assert.equal(parseValorCentavos(bad), null);
});

test('registra com empresa do job, evidencia, rastreio e evento', async () => {
  const { db, calls } = fakeDb();
  const result = await registrarLancamento(db, { ...base, business_id: 'BIZ-OUTRA' }, caio);
  assert.equal(result.status, 'RECORDED');
  const insert = JSON.parse(calls.find(c => c.options.method === 'POST' && c.path === '/rest/v1/financeiro').options.body);
  assert.equal(insert.business_id, 'BIZ-001');
  assert.equal(insert.valor_original, '1250.40');
  assert.equal(insert.competencia, '2026-10');
  assert.equal(insert.related_object_id, JOB);
  assert.equal(insert.source_system, 'HERMES');
  assert.match(insert.finance_id, /^FIN-HR-[a-f0-9]{24}$/);
  const event = JSON.parse(calls.find(c => c.path === '/rest/v1/agent_job_events').options.body);
  assert.equal(event.event_type, 'FINANCE_RECORDED');
  assert.equal(result.evidence_ref, `financeiro:${insert.finance_id}`);
});

test('mesma idempotency_key nao grava de novo', async () => {
  const { db, calls } = fakeDb({ existing: { finance_id: 'FIN-HR-x', row_version: 3 } });
  const result = await registrarLancamento(db, base, caio);
  assert.deepEqual(result, { status: 'ALREADY_RECORDED', finance_id: 'FIN-HR-x', row_version: 3 });
  assert.ok(!calls.some(c => c.options.method === 'POST'));
});

test('suspeita de duplicidade bloqueia ate haver motivo explicito', async () => {
  const rows = [{ finance_id: 'FIN-OLD', descricao: 'energia  ESCRITORIO setembro', valor_original: '1250.4', status: 'PAGO' }];
  const first = await registrarLancamento(fakeDb({ rows }).db, base, caio);
  assert.equal(first.status, 'DUPLICATE_SUSPECT');
  assert.deepEqual(first.matches, ['FIN-OLD']);
  const second = await registrarLancamento(fakeDb({ rows }).db, { ...base, nao_e_duplicado_motivo: 'Segunda fatura do mesmo mês, unidade filial' }, caio);
  assert.equal(second.status, 'RECORDED');
});

test('recusa conta de outra empresa, conta inexistente e plano inexistente', async () => {
  await assert.rejects(registrarLancamento(fakeDb({ conta: { conta_id: 'CTA-BIZ001', business_id: 'BIZ-002' } }).db, base, caio), /outra empresa/);
  await assert.rejects(registrarLancamento(fakeDb({ conta: null }).db, base, caio), /nao cadastrada/);
  await assert.rejects(registrarLancamento(fakeDb({ plano: null }).db, { ...base, plano_conta_id: 'PC-X' }, caio), /Plano de contas/);
});

test('regras de preenchimento', async () => {
  const { db } = fakeDb();
  const cases = [
    [{ valor: '-5' }, /Valor invalido/], [{ fluxo: 'SAIDA' }, /Fluxo/], [{ liquidacao: undefined }, /liquidacao/],
    [{ status: 'PREVISTO' }, /Liquidacao so vale/], [{ fluxo: 'TRANSFERÊNCIA' }, /destino/],
    [{ conta_destino_id: 'CTA-2' }, /so vale para transferencia/], [{ evidencia: ' ' }, /Evidencia/],
    [{ idempotency_key: 'x' }, /idempotency_key/], [{ liquidacao: '05/10/2026' }, /AAAA-MM-DD/]
  ];
  for (const [change, error] of cases) await assert.rejects(registrarLancamento(db, { ...base, ...change }, caio), error);
});

function reader({ runtime, job }) {
  return async path => path.includes('agent_runtime_bindings') ? [runtime] : path.includes('agent_jobs') ? (job ? [job] : []) : [];
}
const caioBinding = { agent_id: 'AGT-05', scope_type: 'BUSINESS', business_id: 'BIZ-001', provider: 'HERMES', status: 'ACTIVE' };
const runningJob = { job_id: JOB, agent_id: 'AGT-05', business_id: 'BIZ-001', task_id: 'TSK-1', status: 'RUNNING' };
const actor = { type: 'hermes_profile', profileSlug: 'caio--biz001' };

test('autorizacao: so Caio, so no proprio job em execucao, empresa do job', async () => {
  const ok = await authorizeGatewayTool('registrar_lancamento', { ...base }, actor, reader({ runtime: caioBinding, job: runningJob }));
  assert.equal(ok.args.business_id, 'BIZ-001');
  assert.equal(ok.identity.agentId, 'AGT-05');
  for (const agent of ['AGT-01', 'AGT-04', 'AGT-06', 'AGT-18']) {
    const runtime = { ...caioBinding, agent_id: agent, scope_type: agent === 'AGT-01' ? 'GROUP' : 'BUSINESS' };
    await assert.rejects(authorizeGatewayTool('registrar_lancamento', base, actor, reader({ runtime, job: { ...runningJob, agent_id: agent } })), /exclusivo do Caio/);
  }
  await assert.rejects(authorizeGatewayTool('registrar_lancamento', base, actor, reader({ runtime: caioBinding, job: { ...runningJob, status: 'READY' } })), /em execucao/);
  await assert.rejects(authorizeGatewayTool('registrar_lancamento', base, actor, reader({ runtime: caioBinding, job: { ...runningJob, agent_id: 'AGT-06' } })), /em execucao/);
  await assert.rejects(authorizeGatewayTool('registrar_lancamento', base, actor, reader({ runtime: caioBinding, job: { ...runningJob, business_id: 'BIZ-002' } })), /outra empresa/);
  await assert.rejects(authorizeGatewayTool('registrar_lancamento', { ...base, business_id: 'BIZ-002' }, actor, reader({ runtime: caioBinding, job: runningJob })), /difere do job/);
});
