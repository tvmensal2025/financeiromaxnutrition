import test from 'node:test';
import assert from 'node:assert/strict';
import { workflowJournalTools } from '../src/workflow-journal.mjs';
import { authorizeGatewayTool } from '../src/runtime-access.mjs';

test('continuity bookkeeping remains coordinator-only and personal scope is excluded', async () => {
  const identity = { type: 'hermes_profile', profileSlug: 'maya--biz003' };
  const read = async () => [{ provider: 'HERMES', status: 'ACTIVE', agent_id: 'AGT-12', scope_type: 'BUSINESS', business_id: 'BIZ-003' }];
  for (const name of ['workflow_candidates', 'workflow_checkpoint']) {
    await assert.rejects(authorizeGatewayTool(name, {}, identity, read), /Helena ou Marina/);
    await assert.rejects(authorizeGatewayTool(name, {}, identity, async () => [{ provider: 'HERMES', status: 'ACTIVE', agent_id: 'AGT-02', scope_type: 'PERSONAL' }]), /escopo empresarial/);
  }
});

test('discovery preserves the authoritative profile, cutoff and bounded pagination', async () => {
  let request;
  const tools = workflowJournalTools(async (name, args) => { request = { name, args }; return { success: true, candidates: [], next_cursor: null }; });
  const args = tools.workflow_candidates.schema.parse({ created_after: '2026-10-01T00:00:00Z' });
  await tools.workflow_candidates.handler(args, { identity: { profileSlug: 'helena--grupo' } });
  assert.equal(request.name, 'gateway_workflow_candidates');
  assert.equal(request.args.p_profile_slug, 'helena--grupo');
  assert.equal(request.args.p_limit, 25);
  assert.equal(request.args.p_created_after, args.created_after);
  assert.throws(() => tools.workflow_candidates.schema.parse({ ...args, limit: 100 }));
  assert.throws(() => tools.workflow_candidates.schema.parse({ ...args, profile_slug: 'other' }));
});

test('reserve requires a complete snapshot and cannot modify a job or retry budget', () => {
  const tools = workflowJournalTools(() => {});
  assert.throws(() => tools.workflow_checkpoint.schema.parse({ action: 'reserve' }));
  const args = { action: 'reserve', job_id: 'JOB-HR-' + 'a'.repeat(32), phase: 'COORDINATE', fingerprint: 'b'.repeat(64), expected_status: 'DRAFT', expected_task_version: 3, expected_updated_at: '2026-10-01T00:00:00Z' };
  assert.deepEqual(tools.workflow_checkpoint.schema.parse(args), args);
  assert.throws(() => tools.workflow_checkpoint.schema.parse({ ...args, max_attempts: 10 }));
  assert.throws(() => tools.workflow_checkpoint.schema.parse({ ...args, approval_status: 'APPROVED' }));
});

test('journal failure is closed and an unconfirmed reservation is never invented', async () => {
  const tools = workflowJournalTools(async () => ({ success: false }));
  await assert.rejects(tools.workflow_checkpoint.handler({ action: 'list' }, { identity: { profileSlug: 'helena--grupo' } }), /nao confirmado/);
  await assert.rejects(tools.workflow_checkpoint.handler({ action: 'list' }, {}), /coordenacao/);
});

test('recovery requires bounded review repair with original receipt and exact snapshot', () => {
  const schema = workflowJournalTools(() => {}).workflow_checkpoint.schema;
  const args = { action: 'recover', job_id: 'JOB-HR-'+'a'.repeat(32), phase: 'REVIEW',
    fingerprint: 'b'.repeat(64), expected_task_version: 3, expected_status: 'WAITING_HELENA',
    expected_updated_at: '2026-10-01T00:00:00Z', run_id: '11111111-1111-4111-8111-111111111111',
    run_token: '22222222-2222-4222-8222-222222222222', diagnostic: 'REVIEW_CONTRACT_REJECTED', repair_version: 'review-contract-v2' };
  assert.deepEqual(schema.parse(args), args);
  for (const field of ['run_id','run_token','repair_version','diagnostic','expected_task_version']) {
    const missing = { ...args }; delete missing[field]; assert.throws(() => schema.parse(missing));
  }
  for (const patch of [{ phase:'HANDOFF' }, { diagnostic:'TIMEOUT' }, { expected_status:'COMPLETED' }, { max_attempts:10 }]) {
    assert.throws(() => schema.parse({ ...args,...patch }));
  }
});
