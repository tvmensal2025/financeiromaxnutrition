import { test } from 'node:test';
import assert from 'node:assert/strict';
import { workflowTools } from '../src/workflow.mjs';

test('workflow nunca aceita identidade administrativa ou declarada pelo modelo', async () => {
  const tools = workflowTools(() => { throw new Error('Nao pode chamar RPC'); });
  for (const identity of [null, { type: 'static_fallback' }, { type: 'hermes_profile', profileSlug: 'helena--grupo' }]) {
    await assert.rejects(tools.get_work_context.handler({}, { identity }), /individual Hermes/);
  }
});
test('entrega exige referencia nao vazia e versao segura; rejeita campos extras', () => {
  const tools = workflowTools(() => {});
  const delivery = { job_id: 'j', expected_task_version: 1, idempotency_key: 'k', summary: 'feito', evidence_refs: ['ref'] };
  assert.ok(tools.submit_delivery.schema.safeParse(delivery).success);
  for (const change of [{ evidence_refs: [' '] }, { evidence_refs: [] }, { expected_task_version: 0 }, { expected_task_version: 1.1 }, { agent_id: 'AGT-01' }]) {
    assert.equal(tools.submit_delivery.schema.safeParse({ ...delivery, ...change }).success, false);
  }
});
test('somente resposta confirmada conta como gravação', async () => {
  const tools = workflowTools(async () => null);
  const identity = { type: 'hermes_profile', profileSlug: 'pedro--biz003', bindingVerified: true };
  await assert.rejects(tools.submit_delivery.handler({}, { identity }), /nao confirmou/);
});
test('vinculo de tarefa existente exige identidade do perfil e versao e usa RPC dedicada', async () => {
  const calls = [];
  const tools = workflowTools(async (...args) => { calls.push(args); return { success: true, status: 'DRAFT' }; });
  const input = { task_id: 'TSK-HD-20260927-03', target_agent_id: 'AGT-03', expected_task_version: 2389 };
  assert.ok(tools.adopt_existing_task.schema.safeParse(input).success);
  assert.equal(tools.adopt_existing_task.schema.safeParse({ ...input, expected_task_version: 0 }).success, false);
  assert.equal(tools.adopt_existing_task.schema.safeParse({ ...input, business_id: 'BIZ-004' }).success, false);
  await assert.rejects(tools.adopt_existing_task.handler(input, { identity: { type: 'static_fallback' } }), /individual Hermes/);
  await tools.adopt_existing_task.handler(input, { identity: { type: 'hermes_profile', profileSlug: 'helena--grupo', bindingVerified: true } });
  assert.deepEqual(calls, [['gateway_adopt_existing_task', {
    p_profile_slug: 'helena--grupo', p_task_id: input.task_id, p_target_agent_id: input.target_agent_id,
    p_expected_task_version: 2389, p_instruction: null
  }]]);
});

test('aprovacao exige evidencia da propria tarefa recuperada do Supabase', async () => {
  const calls = [];
  const identity = { type: 'hermes_profile', profileSlug: 'clara--biz003', bindingVerified: true };
  const input = { job_id: 'JOB-1', expected_task_version: 2, idempotency_key: 'review-1', decision: 'APPROVE', reason: 'Conferi fontes e escopo.' };
  const job = { status: 'WAITING_HELENA', evidence_refs: ['MEM-HR-1'] };
  let context = { job, evidence_records: [], evidence_missing: ['MEM-HR-1'] };
  const tools = workflowTools(async (...args) => { calls.push(args); return { success: true }; }, async () => context);
  await assert.rejects(tools.review_delivery.handler(input, { identity }), /evidencia da propria tarefa/);
  assert.equal(calls.length, 0);
  context = { job, evidence_records: [{ id: 'MEM-HR-1', related_object_id: 'OUTRO-JOB' }], evidence_missing: [] };
  await assert.rejects(tools.review_delivery.handler(input, { identity }), /evidencia da propria tarefa/);
  assert.equal(calls.length, 0);
  context = { job, evidence_records: [{ id: 'MEM-HR-1', related_object_id: 'JOB-1' }], evidence_missing: [] };
  await tools.review_delivery.handler(input, { identity });
  assert.equal(calls.length, 1);
  context = { job: { ...job, status: 'RUNNING' }, evidence_records: [{ id: 'MEM-HR-1', related_object_id: 'JOB-1' }], evidence_missing: [] };
  await assert.rejects(tools.review_delivery.handler(input, { identity }), /entrega em revisao/);
  const requestChanges = { ...input, decision: 'REQUEST_CHANGES', reason: 'Faltou fonte.' };
  await tools.review_delivery.handler(requestChanges, { identity });
  assert.equal(calls.length, 2);
});
