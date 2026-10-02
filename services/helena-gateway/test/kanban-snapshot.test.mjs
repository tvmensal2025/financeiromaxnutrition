import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kanbanSnapshot } from '../src/kanban-snapshot.mjs';

const jobs = [
  { job_id: 'JOB-HR-' + 'a'.repeat(32), task_id: 'TSK-1', agent_id: 'AGT-12', business_id: 'BIZ-003',
    objective: 'Preparar arte', status: 'RUNNING', approval_status: 'APPROVED',
    instruction: 'private', result_payload: { secret: 'private' } },
  { job_id: 'JOB-HR-' + 'b'.repeat(32), task_id: 'TSK-2', agent_id: 'AGT-18', business_id: 'BIZ-003',
    objective: 'Validar', status: 'DRAFT', approval_status: 'PENDING' },
  { job_id: 'JOB-HR-' + 'c'.repeat(32), task_id: 'TSK-3', agent_id: 'AGT-09', business_id: null,
    objective: 'Pessoal', status: 'DRAFT' }
];
const bindings = [
  { agent_id: 'AGT-12', scope_type: 'BUSINESS', business_id: 'BIZ-003', profile_slug: 'maya--biz003' },
  { agent_id: 'AGT-18', scope_type: 'BUSINESS', business_id: 'BIZ-002', profile_slug: 'pedro--biz002' },
];

test('espelho é limitado, preserva empresa/perfil e não expõe instruções ou resultados', async () => {
  const paths = [];
  const read = async path => {
    paths.push(path);
    return path.includes('/agent_jobs?') ? jobs : bindings;
  };
  const result = await kanbanSnapshot(read, { business_id: 'BIZ-003', limit: 100 });
  assert.match(paths[0], /business_id=eq.BIZ-003/);
  assert.equal(result.execution_owner, 'helena-gateway');
  assert.equal(result.jobs.length, 2);
  assert.equal(result.jobs[0].profile_slug, 'maya--biz003');
  assert.equal(result.jobs[1].profile_slug, null);
  assert.equal(result.jobs[1].binding_status, 'UNAVAILABLE');
  assert.ok(!JSON.stringify(result).includes('private'));
});

test('valida filtros e falha fechado com resposta incompleta', async () => {
  for (const args of [{ business_id: '../outro' }, { offset: -1 }, { limit: 101 }]) {
    await assert.rejects(kanbanSnapshot(async () => [], args));
  }
  await assert.rejects(kanbanSnapshot(async () => null), /indisponivel/);
});
