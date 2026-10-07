import { test } from 'node:test';
import assert from 'node:assert/strict';
import { workflowTools, WORKFLOW_TOOLS } from '../src/workflow.mjs';
import { BRIEF_SECTIONS } from '../src/brief-contract.mjs';
import { authorizeGatewayTool } from '../src/runtime-access.mjs';

const helena = { type: 'hermes_profile', profileSlug: 'helena--grupo', bindingVerified: true, agentId: 'AGT-01' };
const pedro = { type: 'hermes_profile', profileSlug: 'pedro--biz003', bindingVerified: true, agentId: 'AGT-18' };
const instruction = BRIEF_SECTIONS.map((title, i) =>
  `## ${title}\nSeção ${i + 1} com conteúdo substantivo e específico para a missão substituta corrigida, sem repetição.`).join('\n\n')
  + '\n\n' + 'Detalhe operacional verificável. '.repeat(10);
const base = { job_id: 'JOB-HR-' + 'a'.repeat(32), idempotency_key: 'replan-a', expected_task_version: 7,
  reason: 'Contradição entre definição de pronto e regra de material ao fundador; corrigida.' };
const replace = { ...base, mode: 'REPLACE', objective: 'Plano corrigido', instruction,
  definition_of_done: 'Plano com responsáveis, fontes descritas e rastreabilidade interna no resumo.' };

test('replan_job é ferramenta de workflow só da coordenação e usa RPC próprio', async () => {
  assert.ok(WORKFLOW_TOOLS.has('replan_job'));
  const calls = [];
  const tools = workflowTools(async (...args) => { calls.push(args); return { success: true, mode: 'REPLACE' }; });
  await tools.replan_job.handler(replace, { identity: helena });
  assert.deepEqual(calls[0][0], 'gateway_replan_job');
  assert.equal(calls[0][1].p_profile_slug, 'helena--grupo');
  await assert.rejects(tools.replan_job.handler(replace, { identity: pedro }), /Somente Helena ou Marina/);
});

test('REPLACE exige briefing completo e válido; ESCALATE exige pergunta ao Fundador', async () => {
  const tools = workflowTools(async () => ({ success: true }));
  await assert.rejects(tools.replan_job.handler({ ...replace, instruction: undefined }, { identity: helena }), /REPLACE exige/);
  await assert.rejects(tools.replan_job.handler({ ...replace, instruction: 'curto '.repeat(150) }, { identity: helena }), /Briefing profissional/);
  await assert.rejects(tools.replan_job.handler({ ...base, mode: 'ESCALATE' }, { identity: helena }), /founder_question/);
  await tools.replan_job.handler({ ...base, mode: 'ESCALATE', founder_question: 'Manter o escopo atual ou reduzir para três agentes?' }, { identity: helena });
  assert.equal(tools.replan_job.schema.safeParse({ ...base, mode: 'OUTRO' }).success, false);
  assert.equal(tools.replan_job.schema.safeParse({ ...replace, reason: 'curto' }).success, false);
});

test('autorização: especialista não replaneja', async () => {
  const read = runtime => async url => url.startsWith('/rest/v1/agent_runtime_bindings?') ? [runtime]
    : url.startsWith('/rest/v1/agent_business_scopes?') ? [] : [];
  const specialist = { agent_id: 'AGT-18', scope_type: 'BUSINESS', business_id: 'BIZ-003', provider: 'HERMES', status: 'ACTIVE' };
  await assert.rejects(authorizeGatewayTool('replan_job', replace, { type: 'hermes_profile', profileSlug: 'pedro--biz003' }, read(specialist)), /Somente Helena ou Marina/);
  const coord = { agent_id: 'AGT-01', scope_type: 'GROUP', business_id: null, provider: 'HERMES', status: 'ACTIVE' };
  await authorizeGatewayTool('replan_job', replace, { type: 'hermes_profile', profileSlug: 'helena--grupo' }, read(coord));
});
