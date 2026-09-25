import assert from 'node:assert';

const PORT = 3999;
process.env.PORT = String(PORT);
process.env.MCP_BEARER_TOKEN = 'test-mcp-token-xyz';
process.env.GATEWAY_WEBHOOK_SECRET = 'test-webhook-secret-abc';
process.env.SUPABASE_SERVICE_ROLE_KEY = ''; // intencionalmente vazio para testar healthcheck offline

const { server } = await import('../src/server.mjs');

// Aguarda 200ms para o servidor subir
await new Promise(r => setTimeout(r, 200));

try {
  console.log('--- TESTE 1: GET /health sem Supabase configurado ---');
  const resHealth = await fetch(`http://127.0.0.1:${PORT}/health`);
  assert.strictEqual(resHealth.status, 503, 'Health deve retornar 503 quando Supabase offline');
  const bodyHealth = await resHealth.json();
  assert.strictEqual(bodyHealth.ok, false);
  assert.strictEqual(bodyHealth.supabase, false);
  console.log('OK: /health retornou 503 seguro conforme especificado.');

  console.log('--- TESTE 2: POST /webhooks/supabase/agent-job sem secret ---');
  const resWebhookUnauth = await fetch(`http://127.0.0.1:${PORT}/webhooks/supabase/agent-job`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ job_id: 'JOB-TEST' })
  });
  assert.strictEqual(resWebhookUnauth.status, 401, 'Webhook deve rejeitar sem secret');
  console.log('OK: Webhook rejeitou sem secret (401).');

  console.log('--- TESTE 3: POST /mcp sem Bearer Token ---');
  const resMcpUnauth = await fetch(`http://127.0.0.1:${PORT}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' })
  });
  assert.strictEqual(resMcpUnauth.status, 401, 'MCP deve exigir token');
  console.log('OK: MCP rejeitou chamada não autenticada (401).');

  console.log('--- TESTE 4: POST /mcp initialize com Bearer Token ---');
  const resMcpInit = await fetch(`http://127.0.0.1:${PORT}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-mcp-token-xyz'
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' })
  });
  assert.strictEqual(resMcpInit.status, 200);
  const bodyInit = await resMcpInit.json();
  assert.strictEqual(bodyInit.result.serverInfo.name, 'helena-gateway');
  console.log('OK: MCP handshake initialize concluído.');

  console.log('--- TESTE 5: POST /mcp tools/list ---');
  const resMcpTools = await fetch(`http://127.0.0.1:${PORT}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-mcp-token-xyz'
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' })
  });
  assert.strictEqual(resMcpTools.status, 200);
  const bodyTools = await resMcpTools.json();
  const toolNames = bodyTools.result.tools.map(t => t.name);
  console.log('Ferramentas encontradas:', toolNames);
  
  const expectedTools = [
    'list_ready_jobs',
    'record_dispatch',
    'get_job',
    'claim_job',
    'start_job',
    'complete_job',
    'fail_job',
    'waiting_helena',
    'enqueue_job',
    'queue_summary'
  ];

  for (const exp of expectedTools) {
    assert.ok(toolNames.includes(exp), `Ferramenta obrigatória ausente: ${exp}`);
  }
  assert.strictEqual(toolNames.length, 10, 'Devem existir exatamente as 10 ferramentas');
  console.log('OK: Todas as 10 ferramentas MCP estão presentes.');

  console.log('--- TESTE 6: complete_job sem evidence_refs (Validação V9) ---');
  const resCompleteFail = await fetch(`http://127.0.0.1:${PORT}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-mcp-token-xyz'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'complete_job',
        arguments: {
          job_id: 'JOB-999',
          agent_id: 'AGT-02',
          result_summary: 'Fiz o trabalho sem colocar evidência',
          evidence_refs: [] // violação V9
        }
      }
    })
  });
  const bodyCompleteFail = await resCompleteFail.json();
  assert.strictEqual(bodyCompleteFail.result.isError, true, 'Deve rejeitar conclusão sem evidência');
  console.log('OK: complete_job bloqueou sem evidências conforme Protocolo V9.');

  console.log('TODOS OS TESTES PASSARAM COM SUCESSO!');
} finally {
  server.close();
  process.exit(0);
}
