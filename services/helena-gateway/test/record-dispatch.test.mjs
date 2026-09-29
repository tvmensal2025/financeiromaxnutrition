import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.HELENA_GATEWAY_DISABLE_LISTEN = '1';
process.env.PORT = '3998';
process.env.PUBLIC_HOST = 'localhost';
process.env.MCP_BEARER_TOKEN = 'test-mcp-token-xyz';
process.env.GATEWAY_WEBHOOK_SECRET = 'test-webhook-secret-abc';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.SUPABASE_URL = 'https://example.invalid';

const { handleRecordDispatch, TOOLS_CONFIG } = await import('../src/server.mjs');

const FIXTURE_JOB_ID = 'JOB-FIXTURE-001';
const FIXTURE_JOB = {
  job_id: FIXTURE_JOB_ID,
  agent_id: 'AGT-09',
  task_id: 'TSK-FIXTURE-001',
  business_id: 'MAX_NUTRITION',
  status: 'READY',
  objective: 'Fixture de despacho',
  instruction: 'Usar apenas em testes isolados',
  priority: 'ALTA',
  created_at: '2026-09-25T00:00:00.000Z'
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

function installSupabaseMock({ binding = { agent_id: 'AGT-09', business_id: 'MAX_NUTRITION', scope_type: 'BUSINESS', provider: 'HERMES', profile_slug: 'theo--max', status: 'ACTIVE' } } = {}) {
  const writes = [];
  globalThis.fetch = async (url, options = {}) => {
    const u = String(url);
    const method = (options.method || 'GET').toUpperCase();

    if (u.includes('easypanel.host') || u.includes('supabase.co')) {
      throw new Error(`chamada de rede bloqueada nos testes: ${method} ${u}`);
    }

    if (u.includes('agent_jobs') && method === 'GET') {
      return jsonResponse([FIXTURE_JOB]);
    }

    if (u.includes('agent_runtime_bindings') && method === 'GET') {
      return jsonResponse(binding ? [binding] : []);
    }

    if (u.includes('/rest/v1/agentes') && method === 'GET') {
      return jsonResponse([]);
    }

    if (u.includes('agent_job_events') && method === 'GET') {
      return jsonResponse([]);
    }

    if (u.includes('agent_job_events') && method === 'POST') {
      const body = JSON.parse(options.body);
      writes.push(body);
      return jsonResponse([body], 201);
    }

    throw new Error(`fetch inesperado nos testes: ${method} ${u}`);
  };
  return writes;
}

test('record_dispatch sem API registra pedido sem alegar que o Hermes iniciou', async () => {
  const writes = installSupabaseMock();

  const result = await handleRecordDispatch({
    job_id: FIXTURE_JOB_ID,
    dispatcher_agent_id: 'AGT-04',
    target_agent_id: 'AGT-09'
  });

  assert.equal(result.success, true);
  assert.equal(result.dispatched, false);
  assert.equal(result.local_runner_required, true);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].event_type, 'DISPATCH_REQUESTED');
  assert.equal(writes[0].payload.dispatcher_agent_id, 'AGT-04');
  assert.equal(writes[0].payload.target_external_agent_id, 'theo--max');
  assert.match(writes[0].message, /API Hermes desativada/);
});

test('mensagem da fila exige entrega, revisão e handoff antes de declarar conclusão', async () => {
  installSupabaseMock();
  const ready = await TOOLS_CONFIG.list_ready_jobs.handler({});
  assert.equal(ready.returned_count, 1);
  const message = ready.jobs[0].dispatch_message;
  assert.match(message, /get_work_context e get_job/);
  assert.match(message, /submit_delivery/);
  assert.match(message, /review_delivery/);
  assert.match(message, /handoff_task/);
  assert.doesNotMatch(message, /\bcomplete_job - Concluir/);
});

test('runtime Grok desativado nao aparece na fila e nao aceita despacho', async () => {
  const writes = installSupabaseMock({ binding: null });

  const ready = await TOOLS_CONFIG.list_ready_jobs.handler({});
  assert.equal(ready.returned_count, 0);
  assert.equal(ready.total_ready, 0);

  await assert.rejects(
    () => handleRecordDispatch({
      job_id: FIXTURE_JOB_ID,
      dispatcher_agent_id: 'AGT-04',
      target_agent_id: 'AGT-09'
    }),
    /sem runtime ativo permitido/
  );
  assert.equal(writes.length, 0);
});

test('perfil Hermes ativo de outra empresa nao recebe job', async () => {
  const writes = installSupabaseMock({
    binding: { agent_id: 'AGT-09', business_id: 'BIZ-001', scope_type: 'BUSINESS', provider: 'HERMES', profile_slug: 'theo--biz001', status: 'ACTIVE' }
  });
  const ready = await TOOLS_CONFIG.list_ready_jobs.handler({});
  assert.equal(ready.returned_count, 0);
  await assert.rejects(() => handleRecordDispatch({
    job_id: FIXTURE_JOB_ID,
    dispatcher_agent_id: 'AGT-04',
    target_agent_id: 'AGT-09'
  }), /sem runtime ativo permitido/);
  assert.equal(writes.length, 0);
});

test('perfil externo divergente nao gera despacho', async () => {
  const writes = installSupabaseMock();
  await assert.rejects(() => handleRecordDispatch({
    job_id: FIXTURE_JOB_ID,
    dispatcher_agent_id: 'AGT-04',
    target_agent_id: 'AGT-09',
    target_external_agent_id: 'outro-perfil'
  }), /Perfil Hermes de destino/);
  assert.equal(writes.length, 0);
});

test('record_dispatch sem dispatcher_agent_id falha na função e nenhuma escrita é feita', async () => {
  const writes = installSupabaseMock();

  await assert.rejects(
    () => handleRecordDispatch({
      job_id: FIXTURE_JOB_ID,
      target_agent_id: 'AGT-09'
    }),
    (err) => {
      assert.equal(err.message, 'dispatcher_agent_id é obrigatório para record_dispatch');
      return true;
    }
  );

  assert.equal(writes.length, 0);
});

test('record_dispatch sem dispatcher_agent_id falha na validação do schema MCP e nenhuma escrita é feita', () => {
  const writes = installSupabaseMock();

  assert.throws(
    () => TOOLS_CONFIG.record_dispatch.schema.parse({
      job_id: FIXTURE_JOB_ID,
      target_agent_id: 'AGT-09'
    }),
    (err) => {
      assert.equal(err.name, 'ZodError');
      const paths = err.issues.map((issue) => issue.path.join('.'));
      assert.ok(paths.includes('dispatcher_agent_id'));
      return true;
    }
  );

  assert.equal(writes.length, 0);
});

test('record_dispatch com dispatcher_agent_id AGT-17 falha e nenhuma escrita é feita', async () => {
  const writes = installSupabaseMock();

  await assert.rejects(
    () => handleRecordDispatch({
      job_id: FIXTURE_JOB_ID,
      dispatcher_agent_id: 'AGT-17',
      target_agent_id: 'AGT-09'
    }),
    (err) => {
      assert.equal(err.message, 'record_dispatch permitido somente para Marina / AGT-04');
      return true;
    }
  );

  assert.equal(writes.length, 0);
});
