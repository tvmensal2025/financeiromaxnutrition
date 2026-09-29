import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.HELENA_GATEWAY_DISABLE_LISTEN = '1';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.SUPABASE_URL = 'https://example.invalid';

const { handleWaitingHelena, TOOLS_CONFIG } = await import('../src/server.mjs');

const request = {
  job_id: 'JOB-REVIEW-1',
  agent_id: 'AGT-09',
  contexto: 'Entrega técnica pronta para validação',
  impacto: 'Bloqueia a próxima etapa',
  decisao_necessaria: 'Aprovar o critério de aceite',
  recomendacao: 'Revisar evidência AUD-001'
};

function json(data) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
}

test('waiting_helena usa os parâmetros reais do RPC e confirma a transição', async () => {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const path = String(url);
    if (path.includes('/agent_jobs?')) return json([{ agent_id: 'AGT-09', business_id: 'BIZ-002', status: 'RUNNING' }]);
    if (path.includes('/app_access?')) return json([{ role: 'operator' }]);
    if (path.includes('/user_business_access?')) return json([{ business_id: 'BIZ-002' }]);
    calls.push({ path, body: JSON.parse(options.body) });
    return json({ job_id: 'JOB-REVIEW-1', status: 'WAITING_HELENA' });
  };

  const args = TOOLS_CONFIG.waiting_helena.schema.parse(request);
  const result = await handleWaitingHelena(args, {
    identity: { type: 'oauth2', userId: 'user-1', clientId: 'client-1' }
  });

  assert.equal(result.waiting_helena, true);
  assert.equal(calls.length, 1);
  assert.match(calls[0].path, /\/rpc\/gateway_waiting_helena$/);
  assert.deepEqual(Object.keys(calls[0].body).sort(), [
    'p_agent_id', 'p_job_id', 'p_message', 'p_payload'
  ]);
  assert.equal(calls[0].body.p_payload.contexto, request.contexto);
  assert.equal(calls[0].body.p_payload.solicitante.user_id, 'user-1');
});

test('waiting_helena recusa usuário sem acesso à empresa antes de chamar o RPC', async () => {
  const paths = [];
  globalThis.fetch = async (url) => {
    const path = String(url);
    paths.push(path);
    if (path.includes('/agent_jobs?')) return json([{ agent_id: 'AGT-09', business_id: 'BIZ-002', status: 'RUNNING' }]);
    if (path.includes('/app_access?')) return json([{ role: 'operator' }]);
    return json([]);
  };

  await assert.rejects(
    () => handleWaitingHelena(request, { identity: { type: 'oauth2', userId: 'user-2' } }),
    /Acesso à empresa do job não autorizado/
  );
  assert.equal(paths.some((path) => path.includes('/rpc/')), false);
});

test('waiting_helena não declara sucesso se o banco não mudar o status', async () => {
  globalThis.fetch = async (url) => {
    if (String(url).includes('/agent_jobs?')) {
      return json([{ agent_id: 'AGT-09', business_id: 'BIZ-002', status: 'RUNNING' }]);
    }
    return json(null);
  };

  await assert.rejects(
    () => handleWaitingHelena(request, {
      identity: { type: 'static_fallback', role: 'service-admin' }
    }),
    /não confirmou a revisão pendente/
  );
});
