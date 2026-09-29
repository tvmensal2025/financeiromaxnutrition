import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.HELENA_GATEWAY_DISABLE_LISTEN = '1';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.SUPABASE_URL = 'https://example.invalid';

const { handleRecordProgress, TOOLS_CONFIG } = await import('../src/server.mjs');

test('record_progress envia motivo, próximo passo e identidade autenticada ao RPC', async () => {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const path = String(url);
    if (path.includes('/agent_jobs?')) return new Response(JSON.stringify([{ agent_id: 'AGT-09', business_id: 'BIZ-001' }]), { status: 200, headers: { 'content-type': 'application/json' } });
    if (path.includes('/app_access?')) return new Response(JSON.stringify([{ role: 'operator' }]), { status: 200, headers: { 'content-type': 'application/json' } });
    if (path.includes('/user_business_access?')) return new Response(JSON.stringify([{ business_id: 'BIZ-001' }]), { status: 200, headers: { 'content-type': 'application/json' } });
    calls.push({ url: path, body: JSON.parse(options.body) });
    return new Response(JSON.stringify({ event_id: '4e1915f1-9ec1-4606-bb5e-5ad306287727' }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };

  const args = TOOLS_CONFIG.record_progress.schema.parse({
    job_id: 'JOB-1', agent_id: 'AGT-09', step_key: 'diagnostico_concluido',
    action: 'Análise concluída', reason: 'Validar a causa antes da correção',
    next_step: 'Aplicar ajuste', evidence_refs: ['AUD-001']
  });
  const result = await handleRecordProgress(args, { identity: { type: 'oauth2', userId: 'user-1', clientId: 'client-1', email: 'nao-registrar@example.invalid' } });

  assert.equal(result.recorded, true);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/rpc\/gateway_record_agent_progress$/);
  assert.deepEqual(calls[0].body, {
    job_id: 'JOB-1', agent_id: 'AGT-09', step_key: 'diagnostico_concluido',
    action: 'Análise concluída', reason: 'Validar a causa antes da correção',
    next_step: 'Aplicar ajuste', evidence_refs: ['AUD-001'],
    actor: { type: 'oauth2', user_id: 'user-1', client_id: 'client-1' }
  });
});

test('record_progress recusa usuário sem acesso à empresa antes de chamar o RPC', async () => {
  const calls = [];
  globalThis.fetch = async (url) => {
    const path = String(url);
    calls.push(path);
    const data = path.includes('/agent_jobs?') ? [{ agent_id: 'AGT-09', business_id: 'BIZ-002' }]
      : path.includes('/app_access?') ? [{ role: 'operator' }] : [];
    return new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const args = TOOLS_CONFIG.record_progress.schema.parse({
    job_id: 'JOB-2', agent_id: 'AGT-09', step_key: 'diagnostico',
    action: 'Análise concluída', reason: 'Verificar causa', next_step: 'Corrigir'
  });
  await assert.rejects(() => handleRecordProgress(args, { identity: { type: 'oauth2', userId: 'user-1' } }), /Acesso à empresa do job não autorizado/);
  assert.equal(calls.some(path => path.includes('/rpc/')), false);
});

test('record_progress não declara sucesso quando o banco não confirma event_id', async () => {
  globalThis.fetch = async () => new Response('null', { status: 200, headers: { 'content-type': 'application/json' } });
  const args = TOOLS_CONFIG.record_progress.schema.parse({
    job_id: 'JOB-3', agent_id: 'AGT-09', step_key: 'validacao',
    action: 'Entrega revisada', reason: 'Conferir critério de pronto', next_step: 'Concluir'
  });
  await assert.rejects(() => handleRecordProgress(args, { identity: { type: 'static_fallback', role: 'service-admin', userId: 'admin' } }), /não confirmou o registro/);
});

test('record_progress recusa marco sem motivo e não grava', () => {
  assert.throws(() => TOOLS_CONFIG.record_progress.schema.parse({
    job_id: 'JOB-1', agent_id: 'AGT-09', step_key: 'diagnostico_concluido',
    action: 'Análise concluída', reason: '   ', next_step: 'Aplicar ajuste'
  }));
});
