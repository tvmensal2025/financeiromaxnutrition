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

const professionalInstruction = [
  ['Contexto e fontes', 'Trabalhe no Humano Digital, empresa BIZ-003. Use apenas o pedido aprovado, o job atual e o parecer registrado pelo revisor; nao invente comissoes, renda ou resultados.'],
  ['Objetivo e impacto', 'Revisar a copy de captacao para apresentar trabalho remoto com clareza, gerar interesse qualificado e orientar a pessoa ao proximo passo verificavel.'],
  ['Escopo e limites', 'Entregue somente a copy solicitada para esta tarefa. Nao publique, nao envie mensagens a clientes, nao prometa renda garantida e nao altere tarefas de outras empresas.'],
  ['Plano de trabalho', 'Leia o feedback de REQUEST_CHANGES, identifique cada ponto concreto, ajuste a mensagem, confira consistencia e registre a versao final com justificativa curta para cada correcao.'],
  ['Entregáveis', 'Devolva texto principal, variacoes curtas para chamada, legenda quando prevista no pedido, observacoes de uso e um mapa que associe cada requisito a um trecho da copy.'],
  ['Critérios de pronto', 'A copy deve responder ao parecer, ter linguagem natural em portugues do Brasil, explicar a atividade sem ambiguidade, evitar alegacoes sem fonte e atender todos os itens de pronto da tarefa.'],
  ['Evidências e registro', 'Registre a copy revisada no resultado deste job e cite as fontes aprovadas existentes. Nao trate o proprio texto produzido como comprovante de pagamento ou de comissao recebida.'],
  ['Revisão e encaminhamento', 'Envie para Augusto AGT-03 revisar a mesma entrega. Se um requisito continuar sem fonte ou contexto, descreva a pendencia e pare sem inventar informacao.']
].map(([title, body]) => `## ${title}\n${body}`).join('\n\n');

test('briefing revisado exige feedback verificavel, identidade de coordenacao e versoes atuais', async () => {
  const calls = [];
  const identity = { type: 'hermes_profile', profileSlug: 'helena--grupo', agentId: 'AGT-01', bindingVerified: true };
  const input = {
    job_id: 'JOB-CAMILA', idempotency_key: 'revise-camila-v2', expected_task_version: 2705,
    expected_job_updated_at: '2026-09-29T12:00:00.000Z', instruction: professionalInstruction,
    definition_of_done: 'A copy responde aos pontos do parecer, atende o brief completo, evita promessas sem comprovacao e retorna para revisao independente do Augusto.',
    revision_summary: 'Incorporei os pontos do parecer de Augusto e explicitei limites, evidencias, formato e criterio de revisao.'
  };
  const detail = {
    job: { job_id: input.job_id, task_id: 'TSK-CAMILA', business_id: 'BIZ-003', agent_id: 'AGT-16', objective: 'Revisar copy de captacao', status: 'DRAFT',
      updated_at: input.expected_job_updated_at, approval_status: 'PENDING', result_payload: {
        review_pending: false, reviewed_by: 'AGT-03', review_reason: 'A copy nao separa fonte confirmada de promessa de renda.'
      } },
    task: { task_id: 'TSK-CAMILA', business_id: 'BIZ-003', tarefa: 'Revisar copy de captacao', status: 'BLOQUEADA', row_version: 2705,
      definicao_de_pronto: 'Definicao antiga', bloqueio: 'Ajustes solicitados: copy precisa de revisao.' },
    runtime_binding: { agent_id: 'AGT-16', business_id: 'BIZ-003', scope_type: 'BUSINESS' },
    input_evidence_records: [], input_evidence_missing: [],
    events: [{ event_type: 'WORKFLOW_review_delivery', agent_id: 'AGT-03', payload: { request: { payload: {
      decision: 'REQUEST_CHANGES', reason: 'A copy nao separa fonte confirmada de promessa de renda.'
    } } } }]
  };
  const tools = workflowTools(async (...args) => { calls.push(args); return { success: true, status: 'DRAFT', started: false }; }, async () => detail);
  assert.ok(tools.revise_task_brief.schema.safeParse(input).success);
  assert.equal(tools.revise_task_brief.schema.safeParse({ ...input, expected_task_version: 0 }).success, false);
  assert.equal(tools.revise_task_brief.schema.safeParse({ ...input, unexpected: true }).success, false);
  await assert.rejects(tools.revise_task_brief.handler(input, { identity: { ...identity, agentId: 'AGT-16' } }), /Somente Helena ou Marina/);
  assert.equal(calls.length, 0);
  await assert.rejects(tools.revise_task_brief.handler({ ...input, expected_task_version: 2704 }, { identity }), /Versao desatualizada/);
  assert.equal(calls.length, 0);
  await tools.revise_task_brief.handler(input, { identity });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'gateway_revise_task_brief');
  assert.equal(calls[0][1].p_profile_slug, 'helena--grupo');
  assert.equal(calls[0][1].p_payload.job_id, input.job_id);
});

test('briefing revisado recusa parecer ausente, incoerente ou fonte citada nao aprovada', async () => {
  const input = {
    job_id: 'JOB-CAMILA', idempotency_key: 'revise-camila-v3', expected_task_version: 2705,
    expected_job_updated_at: '2026-09-29T12:00:00.000Z', instruction: professionalInstruction,
    definition_of_done: 'A copy responde aos pontos do parecer, atende o brief completo, evita promessas sem comprovacao e retorna para revisao independente do Augusto.',
    revision_summary: 'Incorporei os pontos do parecer de Augusto e explicitei limites, evidencias, formato e criterio de revisao.'
  };
  const identity = { type: 'hermes_profile', profileSlug: 'helena--grupo', agentId: 'AGT-01', bindingVerified: true };
  const validJob = { job_id: input.job_id, task_id: 'TSK-CAMILA', business_id: 'BIZ-003', agent_id: 'AGT-16', objective: 'Revisar copy de captacao', status: 'DRAFT',
    updated_at: input.expected_job_updated_at, result_payload: { review_pending: false, reviewed_by: 'AGT-03', review_reason: 'Fonte e alegacao precisam ficar distintas.' } };
  const validTask = { task_id: 'TSK-CAMILA', business_id: 'BIZ-003', tarefa: 'Revisar copy de captacao', status: 'BLOQUEADA', row_version: 2705,
    definicao_de_pronto: 'Definicao antiga', bloqueio: 'Ajustes solicitados: revisar copy.' };
  const review = { event_type: 'WORKFLOW_review_delivery', agent_id: 'AGT-03', payload: { request: { payload: { decision: 'REQUEST_CHANGES', reason: 'Fonte e alegacao precisam ficar distintas.' } } } };
  let detail = { job: validJob, task: validTask, runtime_binding: { agent_id: 'AGT-16', business_id: 'BIZ-003', scope_type: 'BUSINESS' },
    events: [], input_evidence_records: [], input_evidence_missing: [] };
  let writes = 0;
  const tools = workflowTools(async () => { writes++; return { success: true }; }, async () => detail);
  await assert.rejects(tools.revise_task_brief.handler(input, { identity }), /REQUEST_CHANGES verificavel/);
  detail = { ...detail, events: [{ ...review, payload: { request: { payload: { decision: 'APPROVE', reason: 'Aprovado.' } } } }] };
  await assert.rejects(tools.revise_task_brief.handler(input, { identity }), /REQUEST_CHANGES verificavel/);
  const memoryId = 'MEM-HR-' + 'a'.repeat(32);
  detail = { ...detail, events: [review], job: { ...validJob, instruction: `Fonte ${memoryId}` }, input_evidence_missing: [memoryId] };
  await assert.rejects(tools.revise_task_brief.handler(input, { identity }), /Fontes do briefing indisponiveis/);
  assert.equal(writes, 0);
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

test('entrega visual da Maya nao recebe aprovacao sem as quatro artes verificadas', async () => {
  const calls = [];
  const identity = { type: 'hermes_profile', profileSlug: 'nina--biz003', bindingVerified: true };
  const input = { job_id: 'JOB-MAYA', expected_task_version: 3, idempotency_key: 'review-maya', decision: 'APPROVE', reason: 'Conferi dimensoes e arquivos.' };
  const job = { status: 'WAITING_HELENA', agent_id: 'AGT-12', objective: 'Criar post e stories', evidence_refs: ['MEM-HR-1'] };
  const context = { job, evidence_records: [{ id: 'MEM-HR-1', related_object_id: 'JOB-MAYA' }], evidence_missing: [], artifact_records: [{ slot: 'post' }] };
  const tools = workflowTools(async (...args) => { calls.push(args); return { success: true }; }, async () => context);
  await assert.rejects(tools.review_delivery.handler(input, { identity }), /post e tres stories/);
  assert.equal(calls.length, 0);
  context.artifact_records.push({ slot: 'story-1' }, { slot: 'story-2' }, { slot: 'story-3' });
  await tools.review_delivery.handler(input, { identity });
  assert.equal(calls.length, 1);
});
