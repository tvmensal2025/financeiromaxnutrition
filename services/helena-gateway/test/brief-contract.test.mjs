import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BRIEF_LIMITS, BRIEF_SECTIONS, validateProfessionalBrief, validateOutgoingBrief } from '../src/brief-contract.mjs';
import { workflowTools } from '../src/workflow.mjs';
import { creativeContext } from './quality-fixtures.mjs';

const bodies = [
  'Empresa BIZ-003 Humano Digital. Consultar o contexto da empresa no Gateway. Condições comerciais não comprovadas continuam pendentes e não podem virar promessa.',
  'Augusto AGT-03 define um público e uma proposta para um piloto educativo sobre trabalho em casa, permitindo que Camila prepare conteúdo coerente com o posicionamento.',
  'Preparação interna sem contato externo, publicação, despesas ou promessa de renda. Limitar a análise ao escopo da BIZ-003 e escalar dados ausentes para Helena.',
  '1. Consultar a tarefa e suas fontes. 2. Distinguir trabalho por tarefas e indicação. 3. Comparar públicos com premissas explícitas. 4. Recomendar um único recorte.',
  'Entregar uma recomendação com público escolhido, problema, mensagem central, três argumentos verificáveis e lista de condições comerciais pendentes.',
  'O recorte tem justificativa e fonte; não contém valores ou ganhos inventados; os itens pedidos estão completos e existe referência recuperável da memória.',
  'Registrar marcos com ação, motivo, fonte e próximo passo no Supabase. Salvar a recomendação em record_memory e usar a referência confirmada em submit_delivery.',
  'Helena revisa a coerência da estratégia e registra aprovação ou ajustes. Após aprovação, Marina organiza a etapa de Camila, sem o executor iniciar outro agente.'
];
const instruction = BRIEF_SECTIONS.map((section,index) => `## ${section}\n${bodies[index]}`).join('\n');
const detail = {
  job: { job_id: 'job-1', task_id: 'task-1', business_id: 'BIZ-003', agent_id: 'AGT-03',
    objective: 'Preparar estratégia do piloto', instruction },
  task: { task_id: 'task-1', business_id: 'BIZ-003', definicao_de_pronto: 'Entregar estratégia revisável.' },
  runtime_binding: { agent_id: 'AGT-03', business_id: 'BIZ-003' }
};

test('safe brief limits agree with MCP, count UTF-16 and preserve historical briefs', () => {
  for (const size of [7001, 7041, 8000, 8873]) {
    const value = instruction + '\n' + 'x'.repeat(size - instruction.length - 1);
    assert.throws(() => validateOutgoingBrief({instruction:value}), /BRIEF_SAFE_LIMIT/);
    if (size <= 8000) assert.equal(validateProfessionalBrief({...detail,job:{...detail.job,instruction:value}}), true);
  }
  assert.equal(validateOutgoingBrief({instruction:'x'.repeat(7000), objective:'o'.repeat(350), definition_of_done:'d'.repeat(3000)}),true);
  assert.throws(() => validateOutgoingBrief({instruction:'x'.repeat(6999)+'🤖'}), /7001/);
});

test('all new brief write paths reject excess before read, RPC, model or mutation', async () => {
  let calls = 0;
  const forbidden = async () => { calls++; throw new Error('Must not run'); };
  const tools = workflowTools(forbidden,forbidden,forbidden);
  for (const profileSlug of ['helena--grupo','marina--biz003','caio--biz003','clara--biz003','laura--personal']) {
    const identity={type:'hermes_profile',bindingVerified:true,profileSlug};
    for (const name of ['create_task_job','handoff_task','revise_task_brief','adopt_existing_task']) {
      await assert.rejects(tools[name].handler({instruction:'x'.repeat(7001)}, {identity}), /BRIEF_SAFE_LIMIT/);
    }
  }
  assert.equal(calls,0);
});

test('MCP schemas publish the actual string budgets, including optional fields', () => {
  const tools=workflowTools(()=>{});
  for (const name of ['create_task_job','handoff_task','revise_task_brief','adopt_existing_task']) {
    assert.equal(tools[name].inputSchema.properties.instruction.maxLength,BRIEF_LIMITS.instruction.max);
  }
  for (const name of ['create_task_job','handoff_task']) {
    for (const field of ['instruction','objective','definition_of_done']) {
      assert.equal(tools[name].inputSchema.properties[field].maxLength, BRIEF_LIMITS[field].max);
    }
  }
  assert.equal(tools.revise_task_brief.inputSchema.properties.instruction.minLength,700);
  assert.equal(tools.record_memory.inputSchema.properties.summary.maxLength,8000);
  assert.equal(tools.handoff_task.inputSchema.properties.idempotency_key.maxLength,120);
});

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

test('titulos duplicados, texto repetido e campos pendentes nao passam por briefing completo', () => {
  for (const bad of [
    instruction + '\n## Entregáveis\nUma segunda seção não pode substituir a primeira silenciosamente.',
    BRIEF_SECTIONS.map(section => `## ${section}\n${bodies[0]}`).join('\n'),
    instruction.replace(bodies[3], bodies[3] + ' [preencher responsável]')
  ]) assert.throws(() => validateProfessionalBrief({ ...detail, job: { ...detail.job, instruction: bad } }), /Briefing profissional/);
});

test('criacao e handoff recusam comando raso antes da RPC e aceitam estrutura completa', async () => {
  let writes = 0;
  const tools = workflowTools(async () => { writes++; return { success: true }; });
  const identity = { type: 'hermes_profile', bindingVerified: true, profileSlug: 'marina--biz003' };
  for (const name of ['create_task_job', 'handoff_task']) {
    await assert.rejects(tools[name].handler({ instruction: 'Faça um stories.' }, { identity }), /Briefing profissional/);
    assert.equal(writes, name === 'create_task_job' ? 0 : 1);
    await tools[name].handler({ instruction }, { identity });
  }
  assert.equal(writes, 2);
});

test('foto licenciada sem fonte permanece bloqueada antes de release e avaliar IA',async()=>{
  const creative = creativeContext(['post']);
  const design = {...detail,company_identity:creative.company_identity,job:{...detail.job,agent_id:'AGT-12',objective:'Criar post profissional',instruction:instruction+'\n'+creative.instruction.replace('ORIGINAL_ILLUSTRATION','LICENSED_PHOTO')},runtime_binding:{...detail.runtime_binding,agent_id:'AGT-12'}};
  let calls=0;
  const tools=workflowTools(async()=>{calls++;return {success:true};},async()=>design,async()=>{calls++;});
  await assert.rejects(tools.release_job.handler({job_id:'job-1',expected_task_version:1,idempotency_key:'k'},{identity:{type:'hermes_profile',bindingVerified:true,profileSlug:'helena--grupo'}}),/Banco de fotos/);
  assert.equal(calls,0);
});
