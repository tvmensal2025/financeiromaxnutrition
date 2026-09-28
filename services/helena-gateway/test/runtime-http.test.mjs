import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// Credenciais ficticias; nenhum acesso ao Supabase ou Hermes real neste arquivo.
const token = 'hhs_' + 'fixture'.repeat(8);
const claraToken = 'hhs_' + 'reviewer'.repeat(7);
process.env.HELENA_GATEWAY_DISABLE_LISTEN = '1';
process.env.SUPABASE_URL = 'https://example.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture-only';
process.env.MCP_BEARER_TOKEN = 'fixture-admin';
process.env.HERMES_PROFILE_TOKEN_HASHES = JSON.stringify([
  { profile_slug: 'pedro--biz003', sha256: crypto.createHash('sha256').update(token).digest('hex') },
  { profile_slug: 'clara--biz003', sha256: crypto.createHash('sha256').update(claraToken).digest('hex') }
]);
const originalFetch = globalThis.fetch;
const { app } = await import('../src/server.mjs');
let listener, base;
before(async () => {
  await new Promise(resolve => { listener = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${listener.address().port}`;
});
after(async () => {
  globalThis.fetch = originalFetch;
  await new Promise(resolve => listener.close(resolve));
});

const binding = { agent_id: 'AGT-18', business_id: 'BIZ-003', scope_type: 'BUSINESS', provider: 'HERMES', profile_slug: 'pedro--biz003', status: 'ACTIVE' };
const job = { job_id: 'JOB-FIXTURE', task_id: 'TSK-FIXTURE', agent_id: 'AGT-18', business_id: 'BIZ-003', status: 'RUNNING' };
function mock({ runtime = binding, currentJob = job, rpcResult = null, memories = [], sourceJob = null, handoffLinks = [] } = {}) {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const value = new URL(String(url));
    assert.equal(value.origin, 'https://example.invalid', 'Nenhuma rede externa permitida');
    calls.push({ url: value, method: options.method || 'GET', body: options.body });
    let result;
    if (value.pathname.includes('/rpc/')) result = rpcResult;
    else if (value.pathname.endsWith('/agent_runtime_bindings')) result = [runtime];
    else if (value.pathname.endsWith('/agent_jobs')) result = [sourceJob && value.searchParams.get('job_id') === `eq.${sourceJob.job_id}` ? sourceJob : currentJob];
    else if (value.pathname.endsWith('/agent_job_events')) result = value.searchParams.get('event_type') === 'eq.WORKFLOW_handoff' ? handoffLinks : [];
    else if (value.pathname.endsWith('/memoria_mestre')) result = memories;
    else if (value.pathname.endsWith('/tarefas')) result = [{ task_id: job.task_id, business_id: job.business_id, row_version: 123 }];
    else throw new Error('Requisicao nao prevista: ' + value.pathname);
    return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json' } });
  };
  return calls;
}
async function invoke(transport, name, args, bearer = token) {
  let path = '/mcp';
  let body = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } };
  if (transport === 'direct') body = { jsonrpc: '2.0', id: 1, method: name, params: args };
  if (transport === 'rest') { path = '/api/tools/' + name; body = args; }
  const response = await originalFetch(base + path, {
    method: 'POST', headers: { authorization: 'Bearer ' + bearer, 'content-type': 'application/json' }, body: JSON.stringify(body)
  });
  return response.json();
}
function resultOf(response, transport) {
  return transport === 'mcp' ? JSON.parse(response.result.content[0].text) : response.result;
}

for (const transport of ['mcp', 'direct', 'rest']) {
  test(`${transport}: job de outra empresa nao chega a RPC`, async () => {
    const calls = mock({ currentJob: { ...job, business_id: 'BIZ-001' } });
    const response = await invoke(transport, 'start_job', { job_id: job.job_id, agent_id: job.agent_id });
    assert.match(JSON.stringify(response), /outra empresa/);
    assert.equal(calls.filter(call => call.method !== 'GET').length, 0);
  });
  test(`${transport}: escopo vem da credencial e perfil pausado bloqueia`, async () => {
    const calls = mock();
    await invoke(transport, 'queue_summary', { identity: { type: 'static_fallback', role: 'service-admin' } });
    const query = calls.find(call => call.url.pathname.endsWith('/agent_jobs')).url.searchParams;
    assert.equal(query.get('agent_id'), 'eq.AGT-18');
    assert.equal(query.get('business_id'), 'eq.BIZ-003');
    mock({ runtime: { ...binding, status: 'PAUSED' } });
    const paused = await invoke(transport, 'queue_summary', {});
    assert.match(JSON.stringify(paused), /nao ativo/);
  });
}

test('falha nao declara sucesso se RPC nao mudou registro', async () => {
  for (const tool of ['fail_job']) {
    const args = tool === 'complete_job'
      ? { job_id: job.job_id, agent_id: job.agent_id, result_summary: 'Fixture', evidence_refs: ['fixture:evidence'] }
      : { job_id: job.job_id, agent_id: job.agent_id, error_code: 'FIXTURE', error_message: 'Teste' };
    mock();
    const refused = resultOf(await invoke('mcp', tool, args), 'mcp');
    assert.equal(refused.success, false);
    assert.equal(refused[tool === 'complete_job' ? 'completed' : 'failed'], false);
    mock({ rpcResult: { ...job, status: tool === 'complete_job' ? 'COMPLETED' : 'FAILED' } });
    const accepted = resultOf(await invoke('mcp', tool, args), 'mcp');
    assert.equal(accepted.success, true);
  }
});

test('detalhe do job identifica runtime Hermes atual sem consultar conexao Grok', async () => {
  const calls = mock();
  const result = resultOf(await invoke('mcp', 'get_job', { job_id: job.job_id }), 'mcp');
  assert.equal(result.runtime_binding.profile_slug, 'pedro--biz003');
  assert.equal(result.connection.provider, 'HERMES');
  assert.equal(result.task.row_version, 123);
  assert.equal(calls.some(call => call.url.pathname.endsWith('/agent_connections')), false);
});

test('revisora le somente memoria submetida deste job e empresa', async () => {
  const evidenceId = 'MEM-HR-' + 'a'.repeat(32);
  const missingId = 'MEM-HR-' + 'b'.repeat(32);
  const reviewJob = { ...job, status: 'WAITING_HELENA', evidence_refs: [evidenceId, missingId], result_payload: { reviewer_agent_id: 'AGT-06' } };
  const calls = mock({
    runtime: { ...binding, agent_id: 'AGT-06', profile_slug: 'clara--biz003' },
    currentJob: reviewJob,
    memories: [
      { id: evidenceId, assunto: 'Checklist', registro: 'Conteudo verificavel', business_id_area: 'BIZ-003', related_object_id: job.job_id },
      { id: missingId, assunto: 'Outro cliente', registro: 'Nao expor', business_id_area: 'BIZ-001', related_object_id: job.job_id }
    ]
  });
  const response = await invoke('mcp', 'get_job', { job_id: job.job_id }, claraToken);
  assert.notEqual(response.result.isError, true);
  const result = resultOf(response, 'mcp');
  assert.deepEqual(result.evidence_records.map(record => record.id), [evidenceId]);
  assert.deepEqual(result.evidence_missing, [missingId]);
  const query = calls.find(call => call.url.pathname.endsWith('/memoria_mestre')).url.searchParams;
  assert.equal(query.get('related_object_id'), `eq.${job.job_id}`);
  assert.equal(query.get('business_id_area'), 'eq.BIZ-003');
  assert.equal(query.get('id'), `in.(${evidenceId},${missingId})`);
});

test('handoff comprovado entrega a evidencia do pai aprovado antes da execucao', async () => {
  const evidenceId = 'MEM-HR-' + 'c'.repeat(32);
  const sourceJob = { ...job, job_id: 'JOB-PARENT', correlation_id: 'JOB-PARENT', status: 'COMPLETED', approval_status: 'APPROVED', evidence_refs: [evidenceId], result_payload: { reviewed_by: 'AGT-06' } };
  const child = { ...job, correlation_id: sourceJob.job_id, evidence_refs: [] };
  const memories = [{ id: evidenceId, registro: 'Entrega integral aprovada', business_id_area: job.business_id, related_object_id: sourceJob.job_id }];
  const handoffLinks = [{ job_id: sourceJob.job_id, business_id: job.business_id, payload: { response: { job_id: job.job_id } } }];
  mock({ currentJob: child, sourceJob, handoffLinks, memories });
  const result = resultOf(await invoke('mcp', 'get_job', { job_id: job.job_id }), 'mcp');
  assert.equal(result.source_evidence_records[0].registro, 'Entrega integral aprovada');
  assert.equal(result.source_job.job_id, sourceJob.job_id);
  for (const changed of [{ handoffLinks: [] }, { sourceJob: { ...sourceJob, business_id: 'BIZ-001' } }, { sourceJob: { ...sourceJob, status: 'DRAFT' } }]) {
    mock({ currentJob: { ...child, evidence_refs: [evidenceId] }, sourceJob, handoffLinks, memories, ...changed });
    const refused = resultOf(await invoke('mcp', 'get_job', { job_id: job.job_id }), 'mcp');
    assert.deepEqual(refused.source_evidence_records, []);
    assert.deepEqual(refused.evidence_missing, [evidenceId]);
  }
});

test('descoberta MCP publica parametros necessarios para cliente Hermes', async () => {
  const response = await originalFetch(base + '/mcp', {
    method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' })
  });
  const { result } = await response.json();
  for (const tool of result.tools) if (tool.name !== 'get_work_context') assert.ok(Object.keys(tool.inputSchema.properties).length > 0, tool.name);
  const claim = result.tools.find(tool => tool.name === 'claim_job');
  assert.deepEqual(claim.inputSchema.required, ['job_id', 'agent_id']);
  const complete = result.tools.find(tool => tool.name === 'complete_job');
  assert.equal(complete.inputSchema.properties.evidence_refs.minItems, 1);
});

test('Hermes nao consegue concluir sem revisao', async () => {
  const calls = mock();
  const result = await invoke('mcp', 'complete_job', { job_id: job.job_id, agent_id: job.agent_id, result_summary: 'Fixture', evidence_refs: ['fixture:evidence'] });
  assert.equal(result.result.isError, true);
  assert.match(result.result.content[0].text, /submit_delivery/);
  assert.equal(calls.some(c => c.url.pathname.includes('/rpc/')), false);
});

test('workflow HTTP passa identidade do token e chave de idempotencia ao Supabase', async () => {
  const calls = mock({ rpcResult: { success: true, status: 'WAITING_HELENA', completed: false } });
  const payload = { job_id: job.job_id, expected_task_version: 123, idempotency_key: 'delivery-1', summary: 'Entrega', evidence_refs: ['fixture:evidence'] };
  const response = resultOf(await invoke('mcp', 'submit_delivery', payload), 'mcp');
  assert.equal(response.completed, false);
  const call = calls.find(c => c.url.pathname.endsWith('/gateway_workflow'));
  assert.deepEqual(JSON.parse(call.body), { p_profile_slug: 'pedro--biz003', p_action: 'submit_delivery', p_payload: payload });
  const forged = await invoke('mcp', 'submit_delivery', { ...payload, profile_slug: 'helena--grupo' });
  assert.equal(forged.result.isError, true);
});
