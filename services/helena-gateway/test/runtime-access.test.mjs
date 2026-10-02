import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { authorizeGatewayTool, matchHermesToken, resolveHermesToken } from '../src/runtime-access.mjs';

const token = 'hhs_' + 'a'.repeat(48);
const entry = { profile_slug: 'pedro--biz003', sha256: crypto.createHash('sha256').update(token).digest('hex') };
const identity = { type: 'hermes_profile', profileSlug: 'pedro--biz003' };
const binding = { agent_id: 'AGT-18', business_id: 'BIZ-003', scope_type: 'BUSINESS', provider: 'HERMES', status: 'ACTIVE' };
const job = { job_id: 'JOB-TEST', agent_id: 'AGT-18', business_id: 'BIZ-003', task_id: 'TSK-TEST' };
test('supervisao tecnica exige coordenacao ativa e nao concede execucao alheia', async () => {
  for (let number = 1; number <= 21; number++) {
    const agentId = `AGT-${String(number).padStart(2,'0')}`;
    const runtime = { ...binding, agent_id: agentId,
      scope_type: number === 1 ? 'GROUP' : 'BUSINESS' };
    const read = reader({runtime});
    for (const name of ['queue_attention', 'record_queue_attention']) {
      if ([1,4].includes(number))
        await authorizeGatewayTool(name, {job_id: job.job_id}, identity, read);
      else
        await assert.rejects(authorizeGatewayTool(name, {job_id: job.job_id}, identity, read), /Somente/);
    }
    await assert.rejects(authorizeGatewayTool('start_job', {job_id: job.job_id}, identity,
      reader({runtime,task:{...job,agent_id:'AGT-99'}})), /outro agente/);
  }
});
for (let number=1; number<=21; number++) {
  const agentId=`AGT-${String(number).padStart(2,'0')}`;
  test(`matriz ${agentId}: leitura, escopo, coordenacao e conclusao direta`, async () => {
    const personal=number===2, manager=[1,4].includes(number);
    const runtime={...binding,agent_id:agentId,scope_type:number===1?'GROUP':personal?'PERSONAL':'BUSINESS',
      business_id:number===1||personal?null:'BIZ-003'};
    const actor={type:'hermes_profile',profileSlug:`profile-${number}`};
    const own=reader({runtime,task:{...job,agent_id:agentId}});
    await authorizeGatewayTool('get_work_context',{},actor,own);
    if (personal) {
      await assert.rejects(authorizeGatewayTool('claim_job',{job_id:job.job_id},actor,own),/escopo empresarial/);
      return;
    }
    await authorizeGatewayTool('get_job',{job_id:job.job_id},actor,own);
    await assert.rejects(authorizeGatewayTool('complete_job',{job_id:job.job_id},actor,own),/submit_delivery/);
    if (manager) await authorizeGatewayTool('release_job',{job_id:job.job_id},actor,own);
    else await assert.rejects(authorizeGatewayTool('release_job',{job_id:job.job_id},actor,own),/Somente/);
    if(number!==1) await assert.rejects(authorizeGatewayTool('get_job',{job_id:job.job_id},actor,
      reader({runtime,task:{...job,agent_id:agentId,business_id:'BIZ-OTHER'}})),/outra empresa/);
    await assert.rejects(authorizeGatewayTool('start_job',{job_id:job.job_id},actor,
      reader({runtime,task:{...job,agent_id:'AGT-99'}})),/outro agente/);
  });
}
function reader({ runtime = binding, task = job, role = 'operator' } = {}) {
  return async url => {
    if (url.startsWith('/rest/v1/agent_runtime_bindings?')) return runtime ? [runtime] : [];
    if (url.startsWith('/rest/v1/agent_jobs?')) return task ? [task] : [];
    if (url.startsWith('/rest/v1/app_access?')) return [{ role }];
    throw new Error('Consulta inesperada: ' + url);
  };
}

test('token individual exige hash unico e formato forte', () => {
  assert.deepEqual(matchHermesToken(token, JSON.stringify([entry])), identity);
  assert.equal(matchHermesToken(token, '[]'), null);
  assert.equal(matchHermesToken(token, JSON.stringify([entry, entry])), null);
  assert.equal(matchHermesToken(token + 'b', JSON.stringify([entry])), null);
  assert.equal(matchHermesToken(token, '{'), null);
  assert.equal(matchHermesToken('short', JSON.stringify([entry])), null);
});

test('registro de credenciais consulta somente hash e exige unicidade; falha fecha acesso', async () => {
  const read = async url => {
    assert.ok(!url.includes(token));
    assert.ok(url.includes('revoked_at=is.null'));
    return [{ profile_slug: 'pedro--biz003' }];
  };
  assert.deepEqual(await resolveHermesToken(token, read), identity);
  assert.equal(await resolveHermesToken(token, async () => []), null);
  assert.equal(await resolveHermesToken(token, async () => [{profile_slug:'a'},{profile_slug:'b'}]), null);
  assert.equal(await resolveHermesToken(token, async () => { throw new Error('offline'); }), null);
});

test('identidade ausente ou OAuth comum nao pode se passar por bot', async () => {
  await assert.rejects(authorizeGatewayTool('claim_job', {}, null, reader()), /autenticada/);
  await assert.rejects(authorizeGatewayTool('claim_job', { agent_id: 'AGT-18' }, { type: 'oauth2', userId: 'u1' }, reader()), /exige fundador/);
});

test('fundador autenticado preserva operacoes administrativas', async () => {
  const args = { agent_id: 'AGT-18' };
  const result = await authorizeGatewayTool('get_job', args, { type: 'oauth2', userId: 'u1' }, reader({ role: 'founder' }));
  assert.equal(result.args, args);
});

test('perfil configurado mas inativo e recusado', async () => {
  await assert.rejects(authorizeGatewayTool('get_job', { job_id: 'JOB-TEST' }, identity, reader({ runtime: { ...binding, status: 'CONFIGURED' } })), /nao ativo/);
});

test('perfil pessoal nao executa fila empresarial', async () => {
  await assert.rejects(authorizeGatewayTool('queue_summary', {}, identity, reader({ runtime: { ...binding, scope_type: 'PERSONAL', business_id: null } })), /escopo empresarial/);
});

test('somente Helena ou Marina podem revisar briefings devolvidos', async () => {
  await assert.rejects(authorizeGatewayTool('revise_task_brief', { job_id: 'JOB-TEST' }, identity, reader()), /Somente Helena ou Marina/);
  const marina = { ...identity, profileSlug: 'marina--biz003' };
  const result = await authorizeGatewayTool('revise_task_brief', { job_id: 'JOB-TEST' }, marina, reader({
    runtime: { ...binding, agent_id: 'AGT-04', profile_slug: 'marina--biz003' }
  }));
  assert.equal(result.identity.agentId, 'AGT-04');
  assert.equal(result.identity.bindingVerified, true);
});

test('especialista assume apenas seu job na sua empresa', async () => {
  const result = await authorizeGatewayTool('claim_job', { job_id: job.job_id, agent_id: binding.agent_id }, identity, reader());
  assert.equal(result.args.agent_id, 'AGT-18');
  assert.equal(result.identity.bindingVerified, true);
  await assert.rejects(authorizeGatewayTool('claim_job', { job_id: job.job_id, agent_id: 'AGT-09' }, identity, reader()), /difere/);
  await assert.rejects(authorizeGatewayTool('claim_job', { job_id: job.job_id }, identity, reader({ task: { ...job, agent_id: 'AGT-09' } })), /outro agente/);
  await assert.rejects(authorizeGatewayTool('get_job', { job_id: job.job_id }, identity, reader({ task: { ...job, business_id: 'BIZ-001' } })), /outra empresa/);
  await assert.rejects(authorizeGatewayTool('get_job', { job_id: job.job_id }, identity, reader({ task: { ...job, task_id: null } })), /tarefa e empresa/);
});

test('consultas de especialista recebem filtro do servidor', async () => {
  for (const tool of ['list_ready_jobs', 'queue_summary']) {
    const result = await authorizeGatewayTool(tool, {}, identity, reader());
    assert.deepEqual(result.args, { business_id: 'BIZ-003', agent_id: 'AGT-18' });
    await assert.rejects(authorizeGatewayTool(tool, { business_id: 'BIZ-001' }, identity, reader()), /outra empresa/);
    await assert.rejects(authorizeGatewayTool(tool, { agent_id: 'AGT-09' }, identity, reader()), /outro agente/);
  }
});

test('Marina enxerga equipe da propria empresa sem assumir trabalho alheio', async () => {
  const read = reader({ runtime: { ...binding, agent_id: 'AGT-04' } });
  const result = await authorizeGatewayTool('list_ready_jobs', {}, identity, read);
  assert.deepEqual(result.args, { business_id: 'BIZ-003' });
  await authorizeGatewayTool('get_job', { job_id: job.job_id }, identity, read);
  await assert.rejects(authorizeGatewayTool('claim_job', { job_id: job.job_id, agent_id: 'AGT-18' }, identity, read), /outro agente/);
  const dispatch = await authorizeGatewayTool('record_dispatch', { job_id: job.job_id, dispatcher_agent_id: 'AGT-04' }, identity, read);
  assert.equal(dispatch.args.dispatcher_agent_id, 'AGT-04');
  await assert.rejects(authorizeGatewayTool('record_dispatch', { job_id: job.job_id, dispatcher_agent_id: 'AGT-01' }, identity, read), /Despachante/);
});

test('especialista nao despacha nem cria fila automatica', async () => {
  await assert.rejects(authorizeGatewayTool('record_dispatch', { job_id: job.job_id, dispatcher_agent_id: 'AGT-04' }, identity, reader()), /Somente Marina/);
  await assert.rejects(authorizeGatewayTool('enqueue_job', { agent_id: 'AGT-09', business_id: 'BIZ-003' }, identity, reader()), /nao liberada/);
});

test('Helena supervisiona empresas sem executar pelo agente especialista', async () => {
  const read = reader({ runtime: { ...binding, agent_id: 'AGT-01', scope_type: 'GROUP', business_id: null } });
  await authorizeGatewayTool('get_job', { job_id: job.job_id }, identity, read);
  const result = await authorizeGatewayTool('queue_summary', {}, identity, read);
  assert.deepEqual(result.args, {});
  const board = await authorizeGatewayTool('kanban_snapshot', { business_id: 'BIZ-003' }, identity, read);
  assert.deepEqual(board.args, { business_id: 'BIZ-003' });
  await assert.rejects(authorizeGatewayTool('complete_job', { job_id: job.job_id, agent_id: 'AGT-18' }, identity, read), /submit_delivery/);
});

test('nenhum especialista, inclusive Marina, pode ler o quadro consolidado', async () => {
  for (let number = 2; number <= 21; number++) {
    const runtime = { ...binding, agent_id: `AGT-${String(number).padStart(2, '0')}` };
    await assert.rejects(authorizeGatewayTool('kanban_snapshot', {}, identity, reader({ runtime })), /Somente Helena/);
  }
});

test('workflow exige escopo empresarial e coordenacao para liberar', async () => {
  await assert.rejects(authorizeGatewayTool('release_job', { job_id: job.job_id }, identity, reader()), /Somente Helena ou Marina/);
  await authorizeGatewayTool('submit_delivery', { job_id: job.job_id }, identity, reader());
  const coordinator = reader({ runtime: { ...binding, agent_id: 'AGT-04' } });
  await assert.rejects(authorizeGatewayTool('create_task_job', { business_id: 'BIZ-001' }, identity, coordinator), /fora do escopo/);
});

test('revisor designado pode consultar entrega sem assumir identidade do autor', async () => {
  const read = reader({ runtime: { ...binding, agent_id: 'AGT-06' }, task: { ...job, result_payload: { reviewer_agent_id: 'AGT-06' } } });
  await authorizeGatewayTool('get_job', { job_id: job.job_id }, identity, read);
  await assert.rejects(authorizeGatewayTool('claim_job', { job_id: job.job_id }, identity, read), /outro agente/);
});

test('artes so podem ser preparadas pelo proprio executor com job RUNNING', async () => {
  const mayaIdentity = { type: 'hermes_profile', profileSlug: 'maya--biz003' };
  const mayaBinding = { ...binding, agent_id: 'AGT-12' };
  const mayaJob = { ...job, agent_id: 'AGT-12' };
  const own = await authorizeGatewayTool('create_artifact_upload', { job_id: mayaJob.job_id, slot: 'post', version: 1 }, mayaIdentity,
    reader({ runtime: mayaBinding, task: { ...mayaJob, status: 'RUNNING' } }));
  assert.equal(own.args.agent_id, mayaBinding.agent_id);
  assert.equal(own.args.business_id, mayaBinding.business_id);
  await assert.rejects(authorizeGatewayTool('verify_artifact_upload', { job_id: mayaJob.job_id, slot: 'post', version: 1 }, mayaIdentity,
    reader({ runtime: mayaBinding, task: { ...mayaJob, status: 'DRAFT' } })), /execucao/);
  await assert.rejects(authorizeGatewayTool('create_artifact_upload', { job_id: mayaJob.job_id, slot: 'post', version: 1 }, mayaIdentity,
    reader({ runtime: mayaBinding, task: { ...mayaJob, status: 'RUNNING', agent_id: 'AGT-18' } })), /proprio agente/);
});

test('renderizacao vetorial e exclusiva da Maya, mesmo se outro perfil conhecer o campo SVG', async () => {
  await assert.rejects(authorizeGatewayTool('create_artifact_upload', {
    job_id: job.job_id, slot: 'story-1', version: 1, svg: '<svg/>'
  }, identity, reader({ task: { ...job, status: 'RUNNING' } })), /exclusivas da Maya/);
});
