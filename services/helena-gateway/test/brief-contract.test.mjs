import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BRIEF_SECTIONS, validateProfessionalBrief } from '../src/brief-contract.mjs';
import { workflowTools } from '../src/workflow.mjs';

const instruction = BRIEF_SECTIONS.map(section =>
  `## ${section}\nDefina fatos verificáveis, responsável, limite, resultado e evidência concretos desta etapa.`
).join('\n');
const detail = {
  job: { job_id: 'job-1', task_id: 'task-1', business_id: 'BIZ-003', agent_id: 'AGT-03',
    objective: 'Preparar estratégia do piloto', instruction },
  task: { task_id: 'task-1', business_id: 'BIZ-003', definicao_de_pronto: 'Entregar estratégia revisável.' },
  runtime_binding: { agent_id: 'AGT-03', business_id: 'BIZ-003' }
};

test('briefing profissional exige estrutura, conteúdo e vínculos', () => {
  assert.equal(validateProfessionalBrief(detail), true);
  assert.equal(validateProfessionalBrief({ ...detail, job: { ...detail.job, instruction: instruction.replaceAll('\n', '\r\n') } }), true);
  assert.throws(() => validateProfessionalBrief({ ...detail, job: { ...detail.job, instruction: 'Faça análise.' } }), /Briefing profissional/);
  assert.throws(() => validateProfessionalBrief({ ...detail, task: { ...detail.task, business_id: 'BIZ-002' } }), /empresa/);
  assert.throws(() => validateProfessionalBrief({ ...detail, job: { ...detail.job, instruction: instruction.replace('## Entregáveis', '## Texto') } }), /Entregáveis/);
});

test('briefing completo permite a liberação confirmada', async () => {
  const calls = [];
  const identity = { type: 'hermes_profile', bindingVerified: true, profileSlug: 'helena--grupo' };
  const tools = workflowTools(async (...args) => { calls.push(args); return { success: true, status: 'READY' }; }, async () => detail);
  const result = await tools.release_job.handler({ job_id: 'job-1', expected_task_version: 1, idempotency_key: 'k' }, { identity });
  assert.equal(result.status, 'READY');
  assert.equal(calls.length, 1);
});

test('liberação recusa briefing raso antes de gravar no Supabase', async () => {
  let writes = 0;
  const identity = { type: 'hermes_profile', bindingVerified: true, profileSlug: 'helena--grupo' };
  const tools = workflowTools(async () => { writes++; return { success: true }; }, async () =>
    ({ ...detail, job: { ...detail.job, instruction: 'Faça análise.' } }));
  await assert.rejects(tools.release_job.handler({ job_id: 'job-1', expected_task_version: 1, idempotency_key: 'k' }, { identity }), /Briefing profissional/);
  assert.equal(writes, 0);
});

test('liberacao bloqueia fonte ausente antes de gastar IA ou gravar', async () => {
  const id = 'MEM-HR-' + 'f'.repeat(32);
  const withSource = { ...detail, job: { ...detail.job, instruction: instruction + `\nFonte: ${id}` }, input_evidence_records: [], input_evidence_missing: [id] };
  let writes = 0;
  const identity = { type: 'hermes_profile', bindingVerified: true, profileSlug: 'marina--biz003' };
  const tools = workflowTools(async () => { writes++; }, async () => withSource);
  await assert.rejects(tools.release_job.handler({ job_id: 'job-1', expected_task_version: 1, idempotency_key: 'k' }, { identity }), /Fontes do briefing/);
  assert.equal(writes, 0);
  assert.equal(validateProfessionalBrief({ ...withSource, input_evidence_records: [{ id }], input_evidence_missing: [] }), true);
});
