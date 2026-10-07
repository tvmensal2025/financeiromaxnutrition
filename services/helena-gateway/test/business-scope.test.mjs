import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bindingForBusiness, servedBusinesses, servedByAgent } from '../src/business-scope.mjs';
import { authorizeGatewayTool } from '../src/runtime-access.mjs';
import { kanbanSnapshot } from '../src/kanban-snapshot.mjs';

const ravi = { agent_id: 'AGT-11', scope_type: 'BUSINESS', business_id: 'BIZ-003', provider: 'HERMES', status: 'ACTIVE', profile_slug: 'ravi--biz003' };
const scopes = [{ agent_id: 'AGT-11', business_id: 'BIZ-001' }, { agent_id: 'AGT-11', business_id: 'BIZ-004' }];

test('empresas atendidas: vinculo original + escopos confirmados; leitura falha nao amplia', async () => {
  const served = await servedBusinesses(async path => {
    assert.match(path, /authorization_status=eq.AUTHORIZED&runtime_status=eq.CONFIRMED/);
    return scopes;
  }, ravi);
  assert.deepEqual([...served].sort(), ['BIZ-001', 'BIZ-003', 'BIZ-004']);
  const failed = await servedBusinesses(async () => { throw new Error('offline'); }, ravi);
  assert.deepEqual([...failed], ['BIZ-003']);
  assert.equal((await servedBusinesses(async () => scopes, { agent_id: 'AGT-02', scope_type: 'PERSONAL' })).size, 0);
});

test('vinculo apresentado na empresa do job, com empresa de origem preservada', () => {
  const served = new Set(['BIZ-003', 'BIZ-001']);
  assert.deepEqual(bindingForBusiness(ravi, 'BIZ-001', served), { ...ravi, business_id: 'BIZ-001', home_business_id: 'BIZ-003' });
  assert.equal(bindingForBusiness(ravi, 'BIZ-003', served), ravi);
  assert.equal(bindingForBusiness(ravi, 'BIZ-002', served), null);
  const helena = { agent_id: 'AGT-01', scope_type: 'GROUP', business_id: null };
  assert.equal(bindingForBusiness(helena, 'BIZ-002', new Set()), helena);
});

function reader({ job, scopeRows = scopes }) {
  return async url => {
    if (url.startsWith('/rest/v1/agent_runtime_bindings?')) return [ravi];
    if (url.startsWith('/rest/v1/agent_business_scopes?')) return scopeRows;
    if (url.startsWith('/rest/v1/agent_jobs?')) return job ? [job] : [];
    throw new Error('Consulta inesperada: ' + url);
  };
}
const actor = { type: 'hermes_profile', profileSlug: 'ravi--biz003' };
const jobIn = business => ({ job_id: 'JOB-X', agent_id: 'AGT-11', business_id: business, task_id: 'TSK-X', status: 'READY' });

test('autorizacao: agente executa job de empresa atendida e continua barrado nas demais', async () => {
  await authorizeGatewayTool('claim_job', { job_id: 'JOB-X' }, actor, reader({ job: jobIn('BIZ-001') }));
  await assert.rejects(authorizeGatewayTool('claim_job', { job_id: 'JOB-X' }, actor, reader({ job: jobIn('BIZ-002') })), /outra empresa/);
  await assert.rejects(authorizeGatewayTool('claim_job', { job_id: 'JOB-X' }, actor, reader({ job: jobIn('BIZ-001'), scopeRows: [] })), /outra empresa/);
});

test('fila sem filtro lista todas as empresas atendidas; filtro fora do escopo e recusado', async () => {
  const all = await authorizeGatewayTool('list_ready_jobs', {}, actor, reader({}));
  assert.deepEqual(all.args.business_ids, ['BIZ-001', 'BIZ-003', 'BIZ-004']);
  assert.equal(all.args.agent_id, 'AGT-11');
  const one = await authorizeGatewayTool('list_ready_jobs', { business_id: 'BIZ-004' }, actor, reader({}));
  assert.equal(one.args.business_id, 'BIZ-004');
  await assert.rejects(authorizeGatewayTool('list_ready_jobs', { business_id: 'BIZ-002' }, actor, reader({})), /outra empresa/);
});

test('quadro mostra o perfil unico do agente em todas as empresas atendidas', async () => {
  const jobs = ['BIZ-001', 'BIZ-002', 'BIZ-003'].map((business, i) => ({ job_id: 'JOB-HR-' + String(i).repeat(32), task_id: 'T' + i, agent_id: 'AGT-11', business_id: business, objective: 'x', status: 'DRAFT' }));
  const result = await kanbanSnapshot(async path => path.includes('/agent_jobs?') ? jobs
    : path.includes('agent_business_scopes') ? scopes : [ravi], {});
  assert.deepEqual(result.jobs.map(j => j.profile_slug), ['ravi--biz003', null, 'ravi--biz003']);
  const map = await servedByAgent(async () => scopes, [ravi]);
  assert.deepEqual([...map.get('AGT-11')].sort(), ['BIZ-001', 'BIZ-003', 'BIZ-004']);
});
