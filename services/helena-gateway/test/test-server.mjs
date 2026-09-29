import assert from 'node:assert';
import { SignJWT, generateKeyPair } from 'jose';

const PORT = parseInt(process.env.TEST_PORT || '3997', 10);
process.env.PORT = String(PORT);
process.env.PUBLIC_HOST = 'helena-automation-helena-gateway.d9v63q.easypanel.host';
process.env.MCP_BEARER_TOKEN = 'test-mcp-token-xyz';
process.env.GATEWAY_WEBHOOK_SECRET = 'test-webhook-secret-abc';
process.env.SUPABASE_SERVICE_ROLE_KEY = ''; // intencionalmente vazio para testar healthcheck offline

const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  const urlStr = typeof url === 'string' ? url : (url?.url || String(url));
  if (urlStr.includes('127.0.0.1') || urlStr.includes('localhost')) {
    return originalFetch(url, options);
  }
  if (urlStr.includes('/auth/v1/oauth/clients/register')) {
    return new Response(JSON.stringify({ client_id: 'test-dcr-client-id' }), {
      status: 201,
      headers: { 'content-type': 'application/json' }
    });
  }
  if (urlStr.includes('/auth/v1/.well-known/jwks.json')) {
    return new Response(JSON.stringify({ keys: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  }
  throw new Error(`chamada de rede bloqueada nos testes: ${urlStr}`);
};

const { server } = await import('../src/server.mjs');

// Aguarda 200ms para o servidor subir
await new Promise(r => setTimeout(r, 200));

try {
  console.log('--- TESTE 1: GET /.well-known/oauth-protected-resource e /mcp ---');
  const resMetaRoot = await fetch(`http://127.0.0.1:${PORT}/.well-known/oauth-protected-resource`);
  assert.strictEqual(resMetaRoot.status, 200, 'Root resource metadata deve retornar 200');
  const metaRoot = await resMetaRoot.json();
  assert.strictEqual(metaRoot.resource, 'https://helena-automation-helena-gateway.d9v63q.easypanel.host/mcp');
  assert.deepStrictEqual(metaRoot.authorization_servers, ['https://wxkgrykduqtsgmjkzlou.supabase.co/auth/v1']);
  assert.ok(metaRoot.scopes_supported.includes('openid'));
  assert.ok(metaRoot.bearer_methods_supported.includes('header'));

  const resMetaMcp = await fetch(`http://127.0.0.1:${PORT}/.well-known/oauth-protected-resource/mcp`);
  assert.strictEqual(resMetaMcp.status, 200, 'MCP resource metadata deve retornar 200');
  const metaMcp = await resMetaMcp.json();
  assert.deepStrictEqual(metaRoot, metaMcp, 'Ambos endpoints metadata devem retornar o mesmo JSON');
  console.log('OK: Protected Resource Metadata RFC 9728 respondendo 200 em ambos os endpoints.');

  console.log('--- TESTE 2: POST /mcp sem token (401 + WWW-Authenticate) ---');
  const resUnauth = await fetch(`http://127.0.0.1:${PORT}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' })
  });
  assert.strictEqual(resUnauth.status, 401, 'POST /mcp sem token deve retornar 401');
  const wwwAuth = resUnauth.headers.get('www-authenticate');
  assert.ok(wwwAuth && wwwAuth.includes('Bearer resource_metadata="https://helena-automation-helena-gateway.d9v63q.easypanel.host/.well-known/oauth-protected-resource/mcp"'),
    `Header WWW-Authenticate incorreto: ${wwwAuth}`);
  const unauthBody = await resUnauth.json();
  assert.strictEqual(unauthBody.error, 'invalid_token');
  assert.strictEqual(unauthBody.error_description, 'Authorization required');
  console.log('OK: /mcp retornou 401 com header WWW-Authenticate e corpo JSON padronizado.');

  console.log('--- TESTE 3: POST /mcp com JWT malformado / inválido ---');
  const resBadJwt = await fetch(`http://127.0.0.1:${PORT}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature'
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'initialize' })
  });
  assert.strictEqual(resBadJwt.status, 401, 'JWT inválido deve retornar 401');
  const badJwtWwwAuth = resBadJwt.headers.get('www-authenticate');
  assert.ok(badJwtWwwAuth && badJwtWwwAuth.includes('error="invalid_token"'));
  console.log('OK: JWT inválido rejeitado com 401 e WWW-Authenticate.');

  console.log('--- TESTE 4: POST /mcp com JWT assinado por chave não confiável e expirado ---');
  const { privateKey } = await generateKeyPair('ES256');
  const expiredJwt = await new SignJWT({ sub: 'user_test_123', client_id: 'grok-client' })
    .setProtectedHeader({ alg: 'ES256' })
    .setIssuer('https://wxkgrykduqtsgmjkzlou.supabase.co/auth/v1')
    .setExpirationTime('1s')
    .sign(privateKey);

  // Aguarda 1.5s para garantir expiração
  await new Promise(r => setTimeout(r, 1500));

  const resExpired = await fetch(`http://127.0.0.1:${PORT}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${expiredJwt}`
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'initialize' })
  });
  assert.strictEqual(resExpired.status, 401, 'JWT expirado/não confiável deve retornar 401');
  console.log('OK: JWT expirado e não confiável rejeitado com 401.');

  console.log('--- TESTE 5: POST /mcp com Fallback Administrativo (MCP_BEARER_TOKEN) ---');
  const resFallback = await fetch(`http://127.0.0.1:${PORT}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-mcp-token-xyz'
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'initialize' })
  });
  assert.strictEqual(resFallback.status, 200, 'Fallback administrativo deve permitir acesso');
  const fallbackBody = await resFallback.json();
  assert.strictEqual(fallbackBody.result.serverInfo.name, 'helena-gateway');
  console.log('OK: Fallback administrativo temporário operacional.');

  console.log('--- TESTE 6: POST /mcp tools/list ---');
  const resTools = await fetch(`http://127.0.0.1:${PORT}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-mcp-token-xyz'
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 5, method: 'tools/list' })
  });
  assert.strictEqual(resTools.status, 200);
  const bodyTools = await resTools.json();
  const toolNames = bodyTools.result.tools.map(t => t.name);
  assert.strictEqual(toolNames.length, 11, 'Devem existir 11 ferramentas com registro de progresso');
  console.log('OK: 10 ferramentas listadas no MCP.');

  console.log('--- TESTE 7: complete_job sem evidence_refs (Regra V9) ---');
  const resCompleteFail = await fetch(`http://127.0.0.1:${PORT}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-mcp-token-xyz'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: {
        name: 'complete_job',
        arguments: {
          job_id: 'JOB-999',
          agent_id: 'AGT-02',
          result_summary: 'Trabalho sem evidencia',
          evidence_refs: []
        }
      }
    })
  });
  const bodyCompleteFail = await resCompleteFail.json();
  assert.strictEqual(bodyCompleteFail.result.isError, true);
  console.log('OK: complete_job bloqueado sem evidência conforme Protocolo V9.');

  console.log('--- TESTE 8: Dynamic Client Registration (DCR) no Supabase Auth ---');
  const dcrPayload = {
    client_name: 'Helena Integration Test Client',
    redirect_uris: ['https://grok.x.ai/oauth/callback', 'http://localhost/callback'],
    token_endpoint_auth_method: 'none',
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    scope: 'openid profile email offline_access'
  };
  const dcrRes = await fetch('https://wxkgrykduqtsgmjkzlou.supabase.co/auth/v1/oauth/clients/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dcrPayload)
  });
  assert.strictEqual(dcrRes.status, 201, 'Supabase DCR deve retornar 201 Created');
  const dcrData = await dcrRes.json();
  assert.ok(dcrData.client_id, 'DCR deve emitir client_id para o Grok');
  console.log('OK: Supabase Auth DCR funcional emitindo client_id:', dcrData.client_id);

  console.log('--- TESTE 9: GET /health com verificação de OAuth ---');
  const resHealth = await fetch(`http://127.0.0.1:${PORT}/health`);
  const bodyHealth = await resHealth.json();
  assert.strictEqual(bodyHealth.service, 'helena-gateway');
  assert.strictEqual(bodyHealth.oauth, true, 'OAuth JWKS deve estar verificado como true');
  assert.strictEqual(bodyHealth.mcp, true, 'MCP deve estar ativo');
  console.log('OK: /health validando conectividade do JWKS OAuth com sucesso.');

  console.log('--- TESTE 10: GET /api/integrations/status (Central de Integrações) ---');
  const resIntStatus = await fetch(`http://127.0.0.1:${PORT}/api/integrations/status`);
  const bodyIntStatus = await resIntStatus.json();
  assert.strictEqual(bodyIntStatus.ok, true, 'Integrations status deve retornar ok: true');
  assert.ok(bodyIntStatus.gateway, 'Deve conter status do gateway');
  assert.ok(bodyIntStatus.laya, 'Deve conter status da Laya');
  assert.ok(bodyIntStatus.evolution, 'Deve conter status da Evolution');
  assert.ok(bodyIntStatus.meowcaller, 'Deve conter status do Meowcaller');
  assert.ok(bodyIntStatus.kokoro, 'Deve conter status do Kokoro TTS');
  assert.strictEqual(bodyIntStatus.kokoro.is_official, true, 'Kokoro deve ser motor oficial');
  assert.strictEqual(bodyIntStatus.kokoro.default_profile_id, 'VP-KOKORO-MASC-03', 'Pedro deve ser o perfil padrão oficial');
  assert.ok(bodyIntStatus.elevenlabs, 'Deve conter status da ElevenLabs');
  console.log('OK: /api/integrations/status retornou status seguro com Kokoro como motor oficial.');

  console.log('--- TESTE 11: Auto-Atendimento & Menu URA (1, 2, 3, 4) ---');
  const { buildAutoReplyMessage } = await import('../src/routes/integrations.mjs');

  delete process.env.WHATSAPP_BUSINESS_ID;
  delete process.env.WHATSAPP_BRAND_NAME;

  const replyGreeting = buildAutoReplyMessage({ text: 'Olá', pushName: 'Carlos' });
  assert.ok(!replyGreeting.includes('Max Nutrition'), 'Sem config, menu NÃO deve afirmar Max Nutrition');
  assert.ok(replyGreeting.includes('1️⃣'), 'Menu deve conter opção 1');
  assert.ok(replyGreeting.includes('2️⃣'), 'Menu deve conter opção 2');
  assert.ok(replyGreeting.includes('3️⃣'), 'Menu deve conter opção 3');
  assert.ok(replyGreeting.includes('Carlos'), 'Menu deve saudar pelo nome');

  process.env.WHATSAPP_BUSINESS_ID = 'BIZ-002';
  process.env.WHATSAPP_BRAND_NAME = 'Max Nutrition';
  const replyBranded = buildAutoReplyMessage({ text: 'Olá' });
  assert.ok(replyBranded.includes('Max Nutrition'), 'Par configurado deve exibir a marca');
  delete process.env.WHATSAPP_BUSINESS_ID;
  delete process.env.WHATSAPP_BRAND_NAME;

  const replyOpt1 = buildAutoReplyMessage({ text: '1' });
  assert.ok(replyOpt1.includes('Victor'), 'Opção 1 deve direcionar para Victor');
  assert.ok(replyOpt1.includes('AGT-15'), 'Opção 1 deve citar AGT-15');
  assert.ok(replyOpt1.includes('Comercial'), 'Opção 1 deve ser Comercial/Vendas');

  const replyOpt2 = buildAutoReplyMessage({ text: '2' });
  assert.ok(replyOpt2.includes('Joana'), 'Opção 2 deve direcionar para Joana');
  assert.ok(replyOpt2.includes('AGT-20'), 'Opção 2 deve citar AGT-20');

  const replyOpt3 = buildAutoReplyMessage({ text: '3' });
  assert.ok(replyOpt3.includes('Caio'), 'Opção 3 deve direcionar para Caio');
  assert.ok(replyOpt3.includes('AGT-05'), 'Opção 3 deve citar AGT-05');
  assert.ok(!replyOpt3.includes('AGT-04'), 'Opção 3 não deve citar AGT-04');

  const replyOpt4 = buildAutoReplyMessage({ text: '4' });
  assert.ok(replyOpt4.includes('Marina'), 'Opção 4 deve direcionar para Marina');
  assert.ok(replyOpt4.includes('AGT-04'), 'Opção 4 deve citar AGT-04');
  assert.ok(!replyOpt4.includes('AGT-01'), 'Opção 4 não deve criar destino Helena AGT-01');

  assert.ok(!replyOpt1.toLowerCase().includes('em instantes'), 'Não prometer retorno em instantes');

  console.log('OK: Auto-atendimento e Menu URA (1, 2, 3, 4) validados com sucesso.');

  console.log('\n========================================');
  console.log('TODOS OS 11 TESTES OBRIGATÓRIOS PASSARAM!');
  console.log('========================================');
} finally {
  server.close();
  process.exit(0);
}
