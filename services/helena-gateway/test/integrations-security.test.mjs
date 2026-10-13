import assert from 'node:assert';
import express from 'express';

process.env.PUBLIC_HOST = 'gateway.test';
process.env.EVOLUTION_BASE_URL = 'http://evolution.test';
process.env.EVOLUTION_API_KEY = 'test-evo-key';
process.env.EVOLUTION_INSTANCE = 'test-instance';
process.env.EVOLUTION_WEBHOOK_SECRET = 'test-evo-webhook-secret';
process.env.MEOWCALLER_BASE_URL = 'http://meowcaller.test';
process.env.MEOWCALLER_TOKEN = 'test-meow-token';
process.env.VOICE_GATEWAY_INTERNAL_KEY = 'test-voice-gateway-key';
process.env.LAYA_BASE_URL = 'http://laya.test';

const originalFetch = globalThis.fetch;
const fetchCalls = [];
const sentMessages = [];
const webhookSetPayloads = [];
let meowStatus = 'DISCONNECTED';
let failCallSession = false;

globalThis.fetch = async (url, options = {}) => {
  const target = String(url);
  if (target.startsWith('http://127.0.0.1:') || target.startsWith('http://localhost:')) {
    return originalFetch(url, options);
  }

  fetchCalls.push({ url: target, method: options.method || 'GET', body: options.body || null });

  if (target.includes('/v1/classify')) {
    return {
      ok: true,
      json: async () => ({
        area: 'ATENDIMENTO',
        intent: 'saudacao',
        suggested_agent_id: 'AGT-20',
        suggested_agent_name: 'Joana',
        urgency: 1,
        business_id: 'BIZ-001'
      })
    };
  }

  if (target.includes('/message/sendText')) {
    sentMessages.push(JSON.parse(options.body || '{}'));
    return {
      ok: true,
      json: async () => ({ key: { id: 'OUT-MOCK-1' } })
    };
  }

  if (target.includes('/webhook/set/')) {
    webhookSetPayloads.push(JSON.parse(options.body || '{}'));
    return { ok: true, json: async () => ({ ok: true }) };
  }

  if (target.includes('/instance/connect/')) {
    return {
      ok: true,
      json: async () => ({ base64: 'qr-mock', pairingCode: null, status: 'CONNECTING' })
    };
  }

  if (target.includes('/v1/session/start')) {
    return { ok: true, json: async () => ({ status: 'CONNECTING', qrcode: 'qr-meow-mock' }) };
  }

  if (target.includes('/v1/session/pair-phone')) {
    return {
      ok: true,
      json: async () => ({ pairing_code: '12345678', phone: '5511999999999' })
    };
  }

  if (target.includes('/v1/calls') && (options.method || 'GET') === 'POST') {
    return { ok: true, json: async () => ({ call_id: 'CALL-TEST-1', status: 'DIALING' }) };
  }

  if (target.includes('/health') || target.includes('/v1/session')) {
    return {
      ok: true,
      json: async () => ({
        status: 'healthy',
        whatsapp_status: meowStatus,
        connected_jid: '',
        active_calls: 0
      })
    };
  }

  return {
    ok: false,
    status: 404,
    json: async () => ({}),
    text: async () => 'not-mocked'
  };
};

const {
  createIntegrationsRouter,
  safeCompareSecrets,
  authenticateVoiceGateway
} = await import('../src/routes/integrations.mjs');
const { configureVoiceAgentStore } = await import('../src/integrations/voice-agent.mjs');
const { createVoiceAgentStore } = await import('../src/integrations/voice-agent-store.mjs');
const {
  setEvolutionWebhook,
  buildEvolutionWebhookUrl,
  buildEvolutionWebhookHeaders
} = await import('../src/integrations/evolution.mjs');
const {
  resetWhatsappAutoReplyDebounce,
  NEUTRAL_BUSINESS_ID
} = await import('../src/whatsapp-ura.mjs');

const AUTH_TOKEN = 'test-user-token';
const WEBHOOK_SECRET = 'test-evo-webhook-secret';
const FOUNDER_ID = '00000000-0000-4000-8000-000000000001';
let identityUserId = 'test-user';
let appAccessRows = [];
let voiceProfiles = [];

function authenticateUser(req, res, next) {
  const header = req.headers.authorization || '';
  if (header === `Bearer ${AUTH_TOKEN}`) {
    req.identity = { userId: identityUserId, type: 'test' };
    return next();
  }
  return res.status(401).json({
    error: 'invalid_token',
    error_description: 'Authorization required'
  });
}

const supabaseCalls = [];
async function supabaseFetch(path, options = {}) {
  supabaseCalls.push({
    path,
    method: options.method || 'GET',
    body: options.body ? JSON.parse(options.body) : null
  });
  if (path.startsWith('/rest/v1/app_access?')) return appAccessRows;
  if (path === '/rest/v1/call_sessions' && options.method === 'POST') {
    if (failCallSession) throw new Error('Registro indisponível');
    return [JSON.parse(options.body)];
  }
  if (path.startsWith('/rest/v1/voice_profiles?') && options.method === 'POST') {
    voiceProfiles = JSON.parse(options.body);
    return voiceProfiles;
  }
  if (path.startsWith('/rest/v1/voice_profiles?')) return voiceProfiles;
  if (path.includes('DEEPSEEK_API_KEY')) return [{ chave: 'DEEPSEEK_API_KEY', valor: 'secret-must-stay-server-side' }];
  return [];
}

function inboundMessagePayload(text = 'oi', { id = 'MSG-TEST-1', remoteJid = '5511999999999@s.whatsapp.net' } = {}) {
  return {
    event: 'messages.upsert',
    instance: 'test-instance',
    data: {
      key: {
        remoteJid,
        fromMe: false,
        id
      },
      pushName: 'Teste',
      message: { conversation: text }
    }
  };
}

function startApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  configureVoiceAgentStore(createVoiceAgentStore(supabaseFetch));
  app.use(createIntegrationsRouter({ supabaseFetch, authenticateUser }));
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

function resetSideEffects() {
  supabaseCalls.length = 0;
  sentMessages.length = 0;
  webhookSetPayloads.length = 0;
  fetchCalls.length = 0;
  identityUserId = 'test-user';
  appAccessRows = [];
  voiceProfiles = [];
  meowStatus = 'DISCONNECTED';
  failCallSession = false;
  resetWhatsappAutoReplyDebounce();
  delete process.env.WHATSAPP_BUSINESS_ID;
  delete process.env.WHATSAPP_BRAND_NAME;
  delete process.env.WHATSAPP_AUTOREPLY_DEBOUNCE_MS;
}

let passed = 0;
async function test(name, fn) {
  resetSideEffects();
  process.env.EVOLUTION_WEBHOOK_SECRET = WEBHOOK_SECRET;
  await fn();
  passed += 1;
  console.log(`OK: ${name}`);
}

const { server, baseUrl } = await startApp();

try {
  console.log('--- Segurança Evolution webhook e rotas de conexão ---');

  await test('configuração de voz exige fundador autenticado', async () => {
    const path = `${baseUrl}/api/integrations/voice-agent/settings`;
    assert.equal((await fetch(path)).status, 401);
    assert.equal((await fetch(path, { headers: { Authorization: `Bearer ${AUTH_TOKEN}` } })).status, 403);
    identityUserId = FOUNDER_ID;
    appAccessRows = [{ role: 'member', active: true }];
    assert.equal((await fetch(path, { headers: { Authorization: `Bearer ${AUTH_TOKEN}` } })).status, 403);
    assert.equal(supabaseCalls.some(call => call.path.includes('voice_profiles')), false);
  });

  await test('fundador lê e grava perfil de voz sem persistir credenciais', async () => {
    identityUserId = FOUNDER_ID;
    appAccessRows = [{ role: 'founder', active: true }];
    const path = `${baseUrl}/api/integrations/voice-agent/settings`;
    const headers = { Authorization: `Bearer ${AUTH_TOKEN}`, 'Content-Type': 'application/json' };
    const rejected = await fetch(path, { method: 'POST', headers, body: JSON.stringify({ persona: 'Pedro vigente', ai_api_key: 'não-gravar' }) });
    assert.equal(rejected.status, 400);
    assert.equal(JSON.stringify(voiceProfiles).includes('não-gravar'), false);
    const write = await fetch(path, { method: 'POST', headers, body: JSON.stringify({ persona: 'Pedro vigente' }) });
    assert.equal(write.status, 200, await write.clone().text());
    assert.equal(voiceProfiles[0].business_id, 'BIZ-002');
    assert.equal(voiceProfiles[0].settings.voice_agent.persona, 'Pedro vigente');
    assert.equal(JSON.stringify(voiceProfiles).includes('não-gravar'), false);
    const read = await fetch(path, { headers });
    assert.equal(read.status, 200);
    const body = await read.json();
    assert.equal(body.config.ai_api_key, '');
    assert.equal(JSON.stringify(body).includes('secret-must-stay-server-side'), false);
    assert.equal(body.config.persona, 'Pedro vigente');
    assert.equal(JSON.stringify(body).includes('não-gravar'), false);
  });

  await test('histórico de chamadas só é legível pelo fundador', async () => {
    const path = `${baseUrl}/api/integrations/voice-agent/call-history/chamada-teste`;
    assert.equal((await fetch(path)).status, 401);
    identityUserId = FOUNDER_ID;
    appAccessRows = [{ role: 'member', active: true }];
    assert.equal((await fetch(path, { headers: { Authorization: `Bearer ${AUTH_TOKEN}` } })).status, 403);
    appAccessRows = [{ role: 'founder', active: true }];
    const permitted = await fetch(path, { headers: { Authorization: `Bearer ${AUTH_TOKEN}` } });
    assert.equal(permitted.status, 200);
    assert.deepEqual((await permitted.json()).history, []);
  });

  await test('callbacks de voz rejeitam ausência e chave incorreta sem consumir serviço', async () => {
    // user-silence e ended também: o meowcaller já envia X-API-Key nessas duas chamadas (engine.go).
    for (const suffix of ['webhook', 'user-speech', 'user-silence', 'ended']) {
      const path = `${baseUrl}/api/integrations/voice-agent/${suffix}`;
      const body = JSON.stringify({ call_id: 'chamada-teste', audio_base64: 'dGVzdGU=' });
      const absent = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      assert.equal(absent.status, 401);
      const wrong = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': 'incorreta' }, body });
      assert.equal(wrong.status, 401);
    }
    assert.equal(fetchCalls.length, 0);
    assert.equal(supabaseCalls.length, 0);
  });

  await test('silêncio e fim de ligação com a chave interna continuam funcionando', async () => {
    const headers = { 'Content-Type': 'application/json', 'X-API-Key': 'test-voice-gateway-key' };
    const ended = await fetch(`${baseUrl}/api/integrations/voice-agent/ended`, {
      method: 'POST', headers, body: JSON.stringify({ call_id: 'chamada-fim-autenticada', reason: 'remote_hangup' })
    });
    assert.equal(ended.status, 200);
    const silence = await fetch(`${baseUrl}/api/integrations/voice-agent/user-silence`, {
      method: 'POST', headers, body: JSON.stringify({ call_id: 'chamada-silencio-autenticada' })
    });
    assert.equal(silence.status, 200);
    assert.equal((await silence.json()).result.ignored, true);
    assert.equal(fetchCalls.length, 0);
  });

  await test('callback de voz aceita somente a chave interna configurada', () => {
    let advanced = false;
    const response = { status: () => { throw new Error('deveria aceitar'); } };
    authenticateVoiceGateway({ headers: { 'x-api-key': 'test-voice-gateway-key' } }, response, () => { advanced = true; });
    assert.equal(advanced, true);
  });

  await test('callback de voz falha fechado sem variável configurada', () => {
    const current = process.env.VOICE_GATEWAY_INTERNAL_KEY;
    delete process.env.VOICE_GATEWAY_INTERNAL_KEY;
    try {
      let status;
      authenticateVoiceGateway({ headers: { 'x-api-key': 'qualquer' } }, {
        status(code) { status = code; return { json() {} }; }
      }, () => { throw new Error('não pode avançar'); });
      assert.equal(status, 401);
    } finally {
      if (current === undefined) delete process.env.VOICE_GATEWAY_INTERNAL_KEY;
      else process.env.VOICE_GATEWAY_INTERNAL_KEY = current;
    }
  });

  await test('chamada iniciada mostra falha de registro sem inventar sincronização', async () => {
    meowStatus = 'CONNECTED';
    failCallSession = true;
    // VOZ-33: meowcaller/call escolhe o destino pelo corpo, então só o fundador liga.
    identityUserId = FOUNDER_ID;
    appAccessRows = [{ role: 'founder', active: true }];
    const response = await fetch(`${baseUrl}/api/integrations/meowcaller/call`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${AUTH_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '11999999999', business_id: 'BIZ-002' })
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.call_id, 'CALL-TEST-1');
    assert.equal(body.tracking_status, 'FALHA');
    assert.match(body.warning, /Supabase/);
    assert.ok(supabaseCalls.some(call => call.path === '/rest/v1/call_sessions'));
  });

  await test('safeCompareSecrets rejeita tamanhos diferentes e aceita iguais', () => {
    assert.strictEqual(safeCompareSecrets('abc', 'abc'), true);
    assert.strictEqual(safeCompareSecrets('abc', 'abd'), false);
    assert.strictEqual(safeCompareSecrets('abc', 'abcd'), false);
    assert.strictEqual(safeCompareSecrets('', 'abc'), false);
    assert.strictEqual(safeCompareSecrets('abc', ''), false);
  });

  await test('webhook sem segredo rejeita 401 e não grava', async () => {
    const res = await fetch(`${baseUrl}/webhooks/evolution`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inboundMessagePayload())
    });
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.ok, false);
    assert.strictEqual(supabaseCalls.length, 0);
    assert.strictEqual(sentMessages.length, 0);
  });

  await test('webhook com segredo errado no header rejeita 401', async () => {
    const res = await fetch(`${baseUrl}/webhooks/evolution`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-evolution-webhook-secret': 'segredo-errado'
      },
      body: JSON.stringify(inboundMessagePayload())
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(supabaseCalls.length, 0);
    assert.strictEqual(sentMessages.length, 0);
  });

  await test('webhook com query secret errado rejeita 401', async () => {
    const res = await fetch(`${baseUrl}/webhooks/evolution?secret=segredo-errado`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inboundMessagePayload())
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(supabaseCalls.length, 0);
    assert.strictEqual(sentMessages.length, 0);
  });

  await test('webhook com header correto aceita e segue o fluxo (mocks)', async () => {
    const res = await fetch(`${baseUrl}/webhooks/evolution`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-evolution-webhook-secret': WEBHOOK_SECRET
      },
      body: JSON.stringify(inboundMessagePayload('oi'))
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.ok, true);
    assert.strictEqual(body.processed, true);
    assert.ok(supabaseCalls.some((call) => call.path.includes('/comunicacoes')));
    assert.ok(supabaseCalls.some((call) => call.path.includes('/agent_jobs')));
    assert.ok(sentMessages.length >= 1, 'auto-resposta deve ser enviada via mock da Evolution');
  });

  await test('webhook com query secret correto aceita', async () => {
    const res = await fetch(`${baseUrl}/webhooks/evolution?secret=${encodeURIComponent(WEBHOOK_SECRET)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inboundMessagePayload('menu'))
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.ok, true);
    assert.ok(supabaseCalls.length > 0);
  });

  await test('sem EVOLUTION_WEBHOOK_SECRET definido: fail-closed 401 mesmo com valor enviado', async () => {
    delete process.env.EVOLUTION_WEBHOOK_SECRET;
    const res = await fetch(`${baseUrl}/webhooks/evolution`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-evolution-webhook-secret': WEBHOOK_SECRET
      },
      body: JSON.stringify(inboundMessagePayload())
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(supabaseCalls.length, 0);
    assert.strictEqual(sentMessages.length, 0);
  });

  await test('setEvolutionWebhook inclui secret na URL e no header, sem devolver o valor', async () => {
    const result = await setEvolutionWebhook();
    assert.strictEqual(result.success, true);
    assert.ok(result.url.includes('/webhooks/evolution'));
    assert.ok(result.url.includes('secret=***'), 'URL devolvida deve estar redigida');
    assert.ok(!result.url.includes(WEBHOOK_SECRET), 'resposta não pode conter o segredo');
    assert.strictEqual(webhookSetPayloads.length, 1);
    const payload = webhookSetPayloads[0].webhook;
    assert.ok(payload.url.includes(`secret=${encodeURIComponent(WEBHOOK_SECRET)}`) || payload.url.includes(`secret=${WEBHOOK_SECRET}`));
    assert.strictEqual(payload.headers['x-evolution-webhook-secret'], WEBHOOK_SECRET);
  });

  await test('setEvolutionWebhook recusa registrar sem EVOLUTION_WEBHOOK_SECRET', async () => {
    delete process.env.EVOLUTION_WEBHOOK_SECRET;
    await assert.rejects(
      () => setEvolutionWebhook(),
      /EVOLUTION_WEBHOOK_SECRET não definido/
    );
    assert.strictEqual(webhookSetPayloads.length, 0);
  });

  await test('buildEvolutionWebhookUrl e headers respeitam a variável de ambiente', () => {
    const url = buildEvolutionWebhookUrl();
    assert.ok(url.startsWith('https://gateway.test/webhooks/evolution'));
    assert.ok(url.includes('secret='));
    const headers = buildEvolutionWebhookHeaders();
    assert.strictEqual(headers['x-evolution-webhook-secret'], WEBHOOK_SECRET);
  });

  await test('POST evolution/connect sem auth rejeita 401', async () => {
    const res = await fetch(`${baseUrl}/api/integrations/evolution/connect`, { method: 'POST' });
    assert.strictEqual(res.status, 401);
  });

  await test('POST evolution/connect com auth aceita', async () => {
    const res = await fetch(`${baseUrl}/api/integrations/evolution/connect`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` }
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.ok, true);
    assert.ok(body.result);
  });

  await test('POST meowcaller/connect sem auth rejeita 401', async () => {
    const res = await fetch(`${baseUrl}/api/integrations/meowcaller/connect`, { method: 'POST' });
    assert.strictEqual(res.status, 401);
  });

  await test('POST meowcaller/connect com auth aceita', async () => {
    const res = await fetch(`${baseUrl}/api/integrations/meowcaller/connect`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` }
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.ok, true);
  });

  await test('POST meowcaller/pair-phone sem auth rejeita 401', async () => {
    const res = await fetch(`${baseUrl}/api/integrations/meowcaller/pair-phone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '11999999999' })
    });
    assert.strictEqual(res.status, 401);
  });

  await test('POST meowcaller/pair-phone com auth aceita', async () => {
    const res = await fetch(`${baseUrl}/api/integrations/meowcaller/pair-phone`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AUTH_TOKEN}`
      },
      body: JSON.stringify({ phone: '11999999999' })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.ok, true);
  });

  await test('GET status de leitura continua acessível sem auth', async () => {
    const evo = await fetch(`${baseUrl}/api/integrations/evolution/status`);
    assert.strictEqual(evo.status, 200);
    const meow = await fetch(`${baseUrl}/api/integrations/meowcaller/status`);
    assert.strictEqual(meow.status, 200);
  });

  await test('(a)(b) opção 1: job e texto usam Victor/AGT-15 mesmo se Laya sugerir AGT-20; business_id neutro', async () => {
    const res = await fetch(`${baseUrl}/webhooks/evolution`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-evolution-webhook-secret': WEBHOOK_SECRET
      },
      body: JSON.stringify(inboundMessagePayload('1', { id: 'MSG-OPT-1' }))
    });
    assert.strictEqual(res.status, 200);
    const jobCall = supabaseCalls.find((call) => call.path.includes('/agent_jobs'));
    assert.ok(jobCall, 'deve criar agent_job');
    assert.strictEqual(jobCall.body.agent_id, 'AGT-15');
    assert.strictEqual(jobCall.body.business_id, NEUTRAL_BUSINESS_ID);
    const inbound = supabaseCalls.find((call) => call.path.includes('/comunicacoes') && call.body?.direction === 'ENTRADA');
    assert.strictEqual(inbound.body.business_id, NEUTRAL_BUSINESS_ID);
    assert.strictEqual(inbound.body.responsavel, 'Victor');
    assert.ok(sentMessages.length >= 1);
    const reply = sentMessages[0].text || sentMessages[0].textMessage?.text || '';
    assert.ok(reply.includes('Victor'));
    assert.ok(reply.includes('AGT-15'));
    assert.ok(!reply.includes('Max Nutrition'));
    assert.ok(!/em instantes/i.test(reply));
  });

  await test('(a) par configurado: marca no texto e business_id nos registros coincidem', async () => {
    process.env.WHATSAPP_BUSINESS_ID = 'BIZ-002';
    process.env.WHATSAPP_BRAND_NAME = 'Max Nutrition';
    const res = await fetch(`${baseUrl}/webhooks/evolution`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-evolution-webhook-secret': WEBHOOK_SECRET
      },
      body: JSON.stringify(inboundMessagePayload('oi', { id: 'MSG-BRAND-1' }))
    });
    assert.strictEqual(res.status, 200);
    const jobCall = supabaseCalls.find((call) => call.path.includes('/agent_jobs'));
    assert.strictEqual(jobCall.body.business_id, 'BIZ-002');
    const comms = supabaseCalls.filter((call) => call.path.includes('/comunicacoes'));
    assert.ok(comms.every((call) => call.body.business_id === 'BIZ-002'));
    const reply = sentMessages[0].text || '';
    assert.ok(reply.includes('Max Nutrition'));
  });

  await test('(b) opção 3 cria job para Caio/AGT-05 e o texto cita o mesmo agente', async () => {
    const res = await fetch(`${baseUrl}/webhooks/evolution`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-evolution-webhook-secret': WEBHOOK_SECRET
      },
      body: JSON.stringify(inboundMessagePayload('3', { id: 'MSG-OPT-3' }))
    });
    assert.strictEqual(res.status, 200);
    const jobCall = supabaseCalls.find((call) => call.path.includes('/agent_jobs'));
    assert.strictEqual(jobCall.body.agent_id, 'AGT-05');
    const reply = sentMessages[0].text || '';
    assert.ok(reply.includes('Caio'));
    assert.ok(reply.includes('AGT-05'));
    assert.ok(!reply.includes('AGT-04'));
  });

  await test('(b) opção 4 cria job para Marina/AGT-04 (não Helena)', async () => {
    const res = await fetch(`${baseUrl}/webhooks/evolution`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-evolution-webhook-secret': WEBHOOK_SECRET
      },
      body: JSON.stringify(inboundMessagePayload('4', { id: 'MSG-OPT-4' }))
    });
    assert.strictEqual(res.status, 200);
    const jobCall = supabaseCalls.find((call) => call.path.includes('/agent_jobs'));
    assert.strictEqual(jobCall.body.agent_id, 'AGT-04');
    const reply = sentMessages[0].text || '';
    assert.ok(reply.includes('Marina'));
    assert.ok(!reply.includes('AGT-01'));
  });

  await test('(c) três mensagens iguais em janela curta: uma só auto-resposta', async () => {
    process.env.WHATSAPP_AUTOREPLY_DEBOUNCE_MS = '60000';
    for (let i = 1; i <= 3; i += 1) {
      const res = await fetch(`${baseUrl}/webhooks/evolution`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-evolution-webhook-secret': WEBHOOK_SECRET
        },
        body: JSON.stringify(inboundMessagePayload('oi', { id: `MSG-DEBOUNCE-${i}` }))
      });
      assert.strictEqual(res.status, 200);
    }
    assert.strictEqual(sentMessages.length, 1, 'debounce deve enviar uma única auto-resposta');
    const jobs = supabaseCalls.filter((call) => call.path.includes('/agent_jobs'));
    assert.strictEqual(jobs.length, 3, 'mensagens inbound ainda geram jobs');
  });

  console.log('\n========================================');
  console.log(`TESTES DE SEGURANÇA: ${passed} executados, ${passed} passados, 0 falhos`);
  console.log('========================================');
} finally {
  configureVoiceAgentStore(null);
  globalThis.fetch = originalFetch;
  await new Promise((resolve) => server.close(resolve));
}
