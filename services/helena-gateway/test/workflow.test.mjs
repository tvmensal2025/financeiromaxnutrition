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
