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

function installSupabaseMock() {
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

test('record_dispatch com AGT-04 grava DISPATCHED com payload e mensagem corretos', async () => {
  const writes = installSupabaseMock();

  const result = await handleRecordDispatch({
    job_id: FIXTURE_JOB_ID,
    dispatcher_agent_id: 'AGT-04',
    target_agent_id: 'AGT-09'
  });

  assert.equal(result.success, true);
  assert.equal(result.dispatched, true);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].event_type, 'DISPATCHED');
  assert.equal(writes[0].payload.dispatcher_agent_id, 'AGT-04');
  assert.equal(writes[0].message, 'Despachado por AGT-04 para AGT-09');
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
