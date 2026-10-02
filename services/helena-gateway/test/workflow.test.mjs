import { test } from 'node:test';
import assert from 'node:assert/strict';
import { workflowTools } from '../src/workflow.mjs';
import { QUALITY_VERSION, buildReviewContract } from '../src/professional-output.mjs';
import { sampleDelivery, sampleQuality, creativeContext } from './quality-fixtures.mjs';

test('workflow nunca aceita identidade administrativa ou declarada pelo modelo', async () => {
  const tools = workflowTools(() => { throw new Error('Nao pode chamar RPC'); });
  for (const identity of [null, { type: 'static_fallback' }, { type: 'hermes_profile', profileSlug: 'helena--grupo' }]) {
    await assert.rejects(tools.get_work_context.handler({}, { identity }), /individual Hermes/);
  }
});
test('contexto usa RPC compacto e consultável sem misturar o payload legado', async () => {
  const calls = [];
  const tools = workflowTools(async (...args) => { calls.push(args); return { context_version: 'hermes-context-v2', truncated: false }; });
  const identity = { type: 'hermes_profile', profileSlug: 'marina--biz003', bindingVerified: true };
  const result = await tools.get_work_context.handler({}, { identity });
  assert.deepEqual(result, { context_version: 'hermes-context-v2', truncated: false, quality_version: QUALITY_VERSION, agent_quality_contract: null });
  assert.deepEqual(calls, [['gateway_context', { p_profile_slug: 'marina--biz003' }]]);
});
test('entrega exige referencia nao vazia e versao segura; rejeita campos extras', () => {
  const tools = workflowTools(() => {});
  assert.match(tools.submit_delivery.inputSchema.properties.delivery.properties.acceptance_checks.items.properties.evidence_ref.description,/memory_id devolvido por record_memory/);
  const delivery = { job_id: 'j', expected_task_version: 1, idempotency_key: 'k', summary: 'feito', evidence_refs: ['ref'], delivery:sampleDelivery('ref') };
  assert.ok(tools.submit_delivery.schema.safeParse(delivery).success);
  for (const change of [{ evidence_refs: [' '] }, { evidence_refs: [] }, { expected_task_version: 0 }, { expected_task_version: 1.1 }, { agent_id: 'AGT-01' }]) {
    assert.equal(tools.submit_delivery.schema.safeParse({ ...delivery, ...change }).success, false);
  }
});
test('somente resposta confirmada conta como gravação', async () => {
  const tools = workflowTools(async () => null);
  const identity = { type: 'hermes_profile', profileSlug: 'pedro--biz003', bindingVerified: true };
  await assert.rejects(tools.submit_delivery.handler({delivery:sampleDelivery('ref'),evidence_refs:['ref']}, { identity }), /nao confirmou/);
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

test('rascunho exige parecer coerente mas pode corrigir fontes pendentes sem libera-las', async () => {
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
  assert.equal(writes, 0);
  const revised = { ...input, instruction: professionalInstruction + `\nDependencia pendente de aceite: ${memoryId}. Nao iniciar producao antes da verificacao.` };
  await tools.revise_task_brief.handler(revised, { identity });
  assert.equal(writes, 1);
  detail = { ...detail, job: { ...detail.job, instruction: revised.instruction },
    task: { ...detail.task, definicao_de_pronto: revised.definition_of_done } };
  await assert.rejects(tools.release_job.handler({ job_id: input.job_id, expected_task_version: 2705, idempotency_key: 'release-blocked' }, { identity }), /Fontes do briefing indisponiveis/);
  assert.equal(writes, 1);
  await assert.rejects(tools.revise_task_brief.handler({ ...input, instruction: 'Faca copy.' }, { identity }), /Briefing profissional/);
  assert.equal(writes, 1);
});

test('segunda edicao exige recibo da mesma versao, sem transformar DRAFT inicial em revisado', async () => {
  const job = { job_id:'JOB-EDIT',task_id:'TSK-EDIT',business_id:'BIZ-003',agent_id:'AGT-04',
    objective:'Organizar campanha',instruction:professionalInstruction,status:'DRAFT',updated_at:'2026-09-30T20:00:00Z',
    result_payload:{review_pending:false,reviewed_by:'AGT-01',review_reason:'Corrigir fontes.'} };
  const task = { task_id:job.task_id,business_id:job.business_id,status:'NÃO INICIADA',row_version:10,definicao_de_pronto:'Plano com fontes e revisores definidos.' };
  const input = {job_id:job.job_id,idempotency_key:'second-edit',expected_task_version:10,expected_job_updated_at:job.updated_at,
    instruction:professionalInstruction,definition_of_done:task.definicao_de_pronto,revision_summary:'Atualizar as fontes aprovadas para a mesma campanha.'};
  const review = {event_type:'WORKFLOW_review_delivery',agent_id:'AGT-01',payload:{request:{payload:{decision:'REQUEST_CHANGES',reason:'Corrigir fontes.'}}}};
  const revision = {event_type:'WORKFLOW_revise_task_brief',job_id:job.job_id,business_id:job.business_id,payload:{
    response:{success:true,status:'DRAFT',task_id:task.task_id,task_version:10},
    request:{payload:{instruction:job.instruction,definition_of_done:task.definicao_de_pronto}}}};
  const detail={job,task,events:[review],runtime_binding:{agent_id:'AGT-04',business_id:'BIZ-003',scope_type:'BUSINESS'}};
  let writes=0;
  const tools=workflowTools(async()=>{writes++;return {success:true};},async()=>detail);
  const identity={type:'hermes_profile',bindingVerified:true,profileSlug:'helena--grupo',agentId:'AGT-01'};
  await assert.rejects(tools.revise_task_brief.handler(input,{identity}),/REQUEST_CHANGES verificavel/);
  detail.events.unshift(revision);
  await tools.revise_task_brief.handler(input,{identity});
  assert.equal(writes,1);
  for (const mutate of [
    r=>{r.payload.response.task_version=9;},r=>{r.business_id='BIZ-002';},
    r=>{r.payload.request.payload.instruction='Texto divergente';},r=>{r.payload.response.success=false;}
  ]) {
    const invalid=structuredClone(revision);mutate(invalid);detail.events=[invalid,review];
    await assert.rejects(tools.revise_task_brief.handler(input,{identity}),/REQUEST_CHANGES verificavel/);
  }
  assert.equal(writes,1);
});

test('aprovacao exige evidencia da propria tarefa recuperada do Supabase', async () => {
  const calls = [];
  const identity = { type: 'hermes_profile', profileSlug: 'clara--biz003', bindingVerified: true };
  const input = { job_id: 'JOB-1', expected_task_version: 2, idempotency_key: 'review-1', decision: 'APPROVE', reason: 'Conferi fontes e escopo.' };
  const delivery = sampleDelivery(); input.quality_review=sampleQuality(delivery);
  const job = { status: 'WAITING_HELENA', evidence_refs: ['MEM-HR-1'],result_payload:{delivery} };
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

test('entrega visual da Maya exige os formatos pedidos, pacote publicavel e revisao visual', async () => {
  const calls = [];
  const identity = { type: 'hermes_profile', profileSlug: 'nina--biz003', bindingVerified: true };
  const input = { job_id: 'JOB-MAYA', expected_task_version: 3, idempotency_key: 'review-maya', decision: 'APPROVE', reason: 'Conferi dimensoes e arquivos.' };
  const creative = creativeContext(); const delivery=sampleDelivery(); input.quality_review=sampleQuality(delivery);
  const job = { status: 'WAITING_HELENA', agent_id: 'AGT-12', business_id:'BIZ-003',instruction:creative.instruction,objective: 'Criar post e stories', evidence_refs: ['MEM-HR-1'],result_payload:{delivery} };
  const context = { job,company_identity:creative.company_identity,evidence_records: [{ id: 'MEM-HR-1', related_object_id: 'JOB-MAYA' }], evidence_missing: [], artifact_records: [{ slot: 'post' }] };
  const tools = workflowTools(async (...args) => { calls.push(args); return { success: true }; }, async () => context);
  await assert.rejects(tools.review_delivery.handler(input, { identity }), /formatos solicitados/);
  assert.equal(calls.length, 0);
  context.artifact_records.push({ slot: 'story-1' }, { slot: 'story-2' }, { slot: 'story-3' });
  context.artifact_records.forEach(a => { a.reference = `storage://helena-deliveries/BIZ-003/JOB-MAYA/${a.slot}-v1.png`;a.width=1080;a.height=a.slot==='post'?1350:1920; });
  await assert.rejects(tools.review_delivery.handler(input, { identity }), /pacote publicavel/);
  job.result_payload = { delivery,publication: {title:'Humano Digital',caption:'Conheça novas formas de trabalhar com tecnologia.',strategy:'Apresentar o projeto com clareza para despertar interesse qualificado.',instructions:'Publique apenas após conferir o canal e a autorização.',alt_text:'Pessoa trabalhando ao lado de uma representação da inteligência artificial.'} };
  await assert.rejects(tools.review_delivery.handler(input, { identity }), /revisao visual/);
  context.artifact_records.forEach(a => { a.reference = `storage://helena-deliveries/BIZ-003/JOB-MAYA/${a.slot}-v1.png`; });
    input.visual_review = { inspected_references: context.artifact_records.map(a => a.reference), findings: 'Conferi cada imagem final: título legível, pessoa e cenário coerentes, logo correto, cores da marca e chamada para ação com bom contraste.', text_readable: true, brand_matches: true, copy_matches: true, composition_approved: true };
    await assert.rejects(tools.review_delivery.handler(input, { identity }), /Abra cada imagem/);
    context.events = context.artifact_records.map((artifact, i) => {
      artifact.sha256 = `verified-image-${i}`;
      return { event_type: 'VISUAL_ASSET_OPENED', agent_id: identity.agentId, job_id: input.job_id,
        payload: { reference: artifact.reference, sha256: artifact.sha256 } };
    });
  await tools.review_delivery.handler(input, { identity });
  assert.equal(calls.length, 1);
});

function approvalFixture() {
  const delivery = sampleDelivery();
  delivery.acceptance_checks[0].criterion = 'Conferir todos os requisitos da copy e suas fontes. '.padEnd(300, 'x');
  delivery.acceptance_checks.push({ ...delivery.acceptance_checks[0], criterion: 'Conferir a proxima etapa e seus limites' });
  const refs = ['MEM-HR-1', 'MEM-HR-2'];
  const detail = { job: { job_id: 'JOB-CAMILA', status: 'WAITING_HELENA', agent_id: 'AGT-16', evidence_refs: refs, result_payload: { delivery } },
    task: { row_version: 87 }, evidence_records: refs.map(id => ({ id, related_object_id: 'JOB-CAMILA' })), evidence_missing: [] };
  const contract = buildReviewContract(detail);
  const input = { job_id: 'JOB-CAMILA', idempotency_key: 'review-with-ids', decision: 'APPROVE', reason: 'Conferi a copy e as fontes da versao vigente.',
    ...contract.approval_fields_seed,
    quality_review: { ...contract.approval_fields_seed.quality_review, findings: sampleQuality(delivery).findings, requirements_met: true } };
  const identity = { type: 'hermes_profile', profileSlug: 'augusto--biz003', agentId: 'AGT-03', bindingVerified: true };
  return { detail, delivery, input, identity };
}

test('aprovacao por IDs normaliza criteria e refs ANTES RPC sem alterar entrada ou identidade', async () => {
  const { detail, delivery, input, identity } = approvalFixture();
  input.quality_review.verified_check_ids.reverse();
  input.quality_review.inspected_evidence_refs.reverse();
  const original = structuredClone(input), calls = [];
  const tools = workflowTools(async (...args) => { calls.push(args); return { success: true }; }, async () => detail);
  assert.equal(tools.review_delivery.schema.safeParse(input).success, true);
  await tools.review_delivery.handler(input, { identity });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'gateway_workflow');
  const request = calls[0][1];
  assert.equal(request.p_profile_slug, 'augusto--biz003');
  assert.equal(request.p_action, 'review_delivery');
  assert.equal(request.p_payload.expected_task_version, 87);
  assert.equal(request.p_payload.decision, 'APPROVE');
  assert.deepEqual(request.p_payload.quality_review.verified_criteria, delivery.acceptance_checks.map(check => check.criterion));
  assert.equal(request.p_payload.quality_review.verified_criteria[0].length, 300);
  assert.deepEqual(request.p_payload.quality_review.inspected_evidence_refs, detail.job.evidence_refs);
  assert.equal(Object.hasOwn(request.p_payload.quality_review, 'verified_check_ids'), false);
  assert.equal(request.p_payload.quality_review.findings, input.quality_review.findings);
  assert.equal(request.p_payload.quality_review.requirements_met, true);
  assert.deepEqual(input, original);
});

test('IDs nao corrigem versao obsoleta e preservam rejeicao da RPC autoritativa', async () => {
  const { detail, input, identity } = approvalFixture();
  input.expected_task_version = 86;
  const calls = [];
  const tools = workflowTools(async (name, request) => {
    calls.push(request);
    if (request.p_payload.expected_task_version !== detail.task.row_version) throw new Error('40001: Versao desatualizada');
    return { success: true };
  }, async () => detail);
  await assert.rejects(tools.review_delivery.handler(input, { identity }), /40001.*Versao desatualizada/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].p_payload.expected_task_version, 86);
  assert.equal(input.expected_task_version, 86);
  assert.equal(Object.hasOwn(calls[0].p_payload.quality_review, 'verified_check_ids'), false);
});

test('review_delivery recusa ref, ID, criterio parafraseado e modo misto antes da RPC', async () => {
  const { detail, input, identity, delivery } = approvalFixture();
  let calls = 0;
  const tools = workflowTools(async () => { calls++; return { success: true }; }, async () => detail);
  for (const quality_review of [
    { ...input.quality_review, inspected_evidence_refs: ['REF-ERRADA'] },
    { ...input.quality_review, verified_check_ids: ['C-0000000000000000'] },
    { ...input.quality_review, verified_criteria: delivery.acceptance_checks.map(check => check.criterion) },
    { ...sampleQuality(delivery, detail.job.evidence_refs), verified_criteria: ['Conferir requisitos e fontes da copy'] }
  ]) await assert.rejects(tools.review_delivery.handler({ ...input, quality_review }, { identity }), /QUALITY_REVIEW_(MISMATCH|MODE)/);
  assert.equal(calls, 0);
  const tooLong = { ...sampleQuality(delivery, detail.job.evidence_refs), verified_criteria: [delivery.acceptance_checks[0].criterion + '.'] };
  const rejected = tools.review_delivery.schema.safeParse({ ...input, quality_review: tooLong });
  assert.equal(rejected.success, false);
  assert.match(rejected.error.message, /REVIEW_CONTRACT_MISMATCH/);
});

test('REQUEST_CHANGES dispensa contrato de aprovacao e continua usando versao e perfil originais', async () => {
  const { input, identity } = approvalFixture();
  const { quality_review, ...change } = input;
  change.decision = 'REQUEST_CHANGES';
  change.reason = 'A copy precisa distinguir fonte comprovada de promessa.';
  const calls = [];
  const tools = workflowTools(async (...args) => { calls.push(args); return { success: true, decision: 'REQUEST_CHANGES' }; },
    async () => { throw new Error('REQUEST_CHANGES nao exige leitura para APPROVE'); });
  assert.equal(tools.review_delivery.schema.safeParse(change).success, true);
  const result = await tools.review_delivery.handler(change, { identity });
  assert.equal(result.decision, 'REQUEST_CHANGES');
  assert.equal(calls[0][1].p_profile_slug, identity.profileSlug);
  assert.deepEqual(calls[0][1].p_payload, change);
  assert.equal(Object.hasOwn(calls[0][1].p_payload, 'quality_review'), false);
});

test('MCP anuncia dois modos exclusivos e limites reais de IDs, criterios, refs e findings', () => {
  const tools = workflowTools(() => {});
  const choices = tools.review_delivery.inputSchema.properties.quality_review.oneOf;
  assert.equal(choices.length, 2);
  const ids = choices.find(choice => choice.properties.verified_check_ids);
  const legacy = choices.find(choice => choice.properties.verified_criteria);
  for (const choice of choices) {
    assert.equal(choice.additionalProperties, false);
    assert.equal(choice.properties.inspected_evidence_refs.minItems, 1);
    assert.equal(choice.properties.inspected_evidence_refs.maxItems, 10);
    assert.equal(choice.properties.inspected_evidence_refs.items.maxLength, 500);
    assert.equal(choice.properties.findings.minLength, 80);
    assert.equal(choice.properties.findings.maxLength, 2000);
    assert.equal(choice.properties.requirements_met.const, true);
  }
  assert.ok(ids.required.includes('verified_check_ids'));
  assert.equal(Object.hasOwn(ids.properties, 'verified_criteria'), false);
  assert.equal(ids.properties.verified_check_ids.minItems, 1);
  assert.equal(ids.properties.verified_check_ids.maxItems, 8);
  assert.equal(ids.properties.verified_check_ids.items.minLength, 18);
  assert.equal(ids.properties.verified_check_ids.items.maxLength, 18);
  assert.equal(ids.properties.verified_check_ids.items.pattern, '^C-[a-f0-9]{16}$');
  assert.ok(legacy.required.includes('verified_criteria'));
  assert.equal(legacy.properties.verified_criteria.maxItems, 8);
  assert.equal(legacy.properties.verified_criteria.items.maxLength, 300);
  assert.equal(tools.submit_delivery.inputSchema.properties.delivery.properties.acceptance_checks.maxItems, 8);
  const fixture = approvalFixture();
  assert.equal(tools.review_delivery.schema.safeParse({ ...fixture.input, quality_review: {
    ...fixture.input.quality_review, verified_criteria: fixture.delivery.acceptance_checks.map(check => check.criterion)
  } }).success, false);
});
