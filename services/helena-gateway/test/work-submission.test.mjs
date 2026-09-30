import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { submitWork } from '../src/work-submission.mjs';
import { workflowTools } from '../src/workflow.mjs';

const identity = { type: 'hermes_profile', bindingVerified: true, profileSlug: 'marina--biz003', agentId: 'AGT-04' };
const input = () => ({
  job_id: 'JOB-TEST', idempotency_key: 'entrega-1', expected_task_version: 3,
  summary: 'Plano da operacao entregue para revisao.', source: 'Briefing da tarefa e identidade aprovada da empresa.',
  delivery: { schema_version: 1, title: 'Plano de operacao',
    content: 'Receba os interessados pelo formulario aprovado. Confira as informacoes e encaminhe cada pedido para o responsavel definido no plano.',
    next_steps: 'Aguardar revisao independente do plano de operacao.',
    limitations: 'Nao houve publicacao nem contato com candidatos.',
    acceptance_checks: [{ criterion: 'Definir uma proxima etapa clara', finding: 'O plano indica recebimento pelo formulario, conferencia e encaminhamento ao responsavel.' }] }
});
function database({ failSubmissionOnce = false } = {}) {
  const receipts = new Map(); const calls = []; let submitted = false;
  const rpc = async (name, request) => {
    assert.equal(name, 'gateway_workflow'); calls.push(request);
    const { p_action: action, p_payload: payload, p_profile_slug: profile } = request;
    if (profile !== identity.profileSlug || payload.job_id !== 'JOB-TEST') throw new Error('Scope denied');
    const key = `${profile}:${payload.idempotency_key}`;
    const old = receipts.get(key);
    if (old) { assert.deepEqual(request, old.request, 'Idempotency conflict'); return old.result; }
    if (action === 'submit_delivery') {
      if (failSubmissionOnce) { failSubmissionOnce = false; throw new Error('Network interrupted'); }
      assert.equal(payload.expected_task_version, 3, 'Stale version');
      assert.equal(submitted, false, 'Already submitted'); submitted = true;
    }
    const result = action === 'record_memory'
      ? { success: true, memory_id: 'MEM-HR-' + createHash('md5').update(key).digest('hex') }
      : { success: true, status: 'WAITING_HELENA', completed: false };
    receipts.set(key, { request, result }); return result;
  };
  return { rpc, receipts, calls };
}
test('creates durable memory and binds findings without agent-supplied IDs', async () => {
  const db = database(); const result = await submitWork(db.rpc, input(), identity);
  assert.equal(result.status, 'WAITING_HELENA'); assert.equal(result.completed, false);
  assert.equal(db.calls[1].p_payload.delivery.acceptance_checks[0].evidence_ref, result.memory_id);
  assert.equal(db.calls[0].p_payload.summary, input().delivery.content);
  assert.deepEqual(db.calls.map(c => c.p_action), ['record_memory', 'submit_delivery']);
});
test('identical replay after completion uses the two durable receipts', async () => {
  const db = database(); const first = await submitWork(db.rpc, input(), identity);
  assert.deepEqual(await submitWork(db.rpc, input(), identity), first); assert.equal(db.receipts.size, 2);
});
test('interruption after memory recovers without duplicated memory or autoapproval', async () => {
  const db = database({ failSubmissionOnce: true });
  await assert.rejects(submitWork(db.rpc, input(), identity), /Network interrupted/);
  assert.equal(db.receipts.size, 1);
  assert.equal((await submitWork(db.rpc, input(), identity)).status, 'WAITING_HELENA');
  assert.equal(db.receipts.size, 2);
});
test('changed content or version with reused key is rejected before delivery', async () => {
  for (const change of [arg => arg.delivery.content += ' Conteudo alterado.', arg => arg.expected_task_version++]) {
    const db = database(); await submitWork(db.rpc, input(), identity);
    const changed = input(); change(changed);
    await assert.rejects(submitWork(db.rpc, changed, identity), /Idempotency conflict/);
    assert.equal(db.calls.filter(c => c.p_action === 'submit_delivery').length, 1);
  }
});
test('scope and stale version remain enforced by the database', async () => {
  const db = database();
  await assert.rejects(submitWork(db.rpc, { ...input(), job_id: 'OTHER' }, identity), /Scope denied/);
  await assert.rejects(submitWork(db.rpc, { ...input(), expected_task_version: 4 }, identity), /Stale version/);
});
test('invalid content, repeated criteria and artifact references fail before writes', async () => {
  const changes = [arg => arg.delivery.content = 'JOB-HR-123 ' + arg.delivery.content,
    arg => arg.delivery.acceptance_checks.push(arg.delivery.acceptance_checks[0]),
    arg => arg.artifact_refs = ['MEM-INVENTADA'],
    arg => arg.artifact_refs = ['storage://helena-deliveries/BIZ-003/JOB-TEST/post-v1.png']];
  for (const change of changes) {
    const db = database(); const changed = input(); change(changed);
    await assert.rejects(submitWork(db.rpc, changed, identity)); assert.equal(db.calls.length, 0);
  }
});
test('missing verified identity and unconfirmed memory never trigger submission', async () => {
  const db = database(); await assert.rejects(submitWork(db.rpc, input(), {}));
  assert.equal(db.calls.length, 0);
  await assert.rejects(submitWork(async () => ({ success: true, memory_id: 'wrong' }), input(), identity), /Memoria nao confirmada/);
});
test('new workflow exposes findings without requesting evidence identifiers', async () => {
  const tool = workflowTools(database().rpc).submit_work;
  assert.equal(tool.schema.safeParse(input()).success, true);
  const check = tool.inputSchema.properties.delivery.properties.acceptance_checks.items;
  assert.deepEqual(check.required, ['criterion', 'finding']);
  assert.equal(check.properties.evidence_ref, undefined);
});
