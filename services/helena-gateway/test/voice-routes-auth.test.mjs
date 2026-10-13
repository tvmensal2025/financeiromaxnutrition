// VOZ-33: o gateway só liga e só gera voz para quem está autenticado, e o número
// discado vem do perfil da conta, nunca do corpo do pedido.
// Nenhum provedor real é chamado: Google, operadora, ElevenLabs e OpenAI são simulados.
import assert from 'node:assert/strict';
import { test, before, after, beforeEach } from 'node:test';
import express from 'express';

process.env.MEOWCALLER_BASE_URL = 'http://meowcaller.test';
process.env.MEOWCALLER_TOKEN = 'test-meow-token';
process.env.VOICE_GATEWAY_INTERNAL_KEY = 'test-voice-gateway-key';

const MAX_URL = 'https://max.test';
const MAX_ANON = 'anon-key-de-teste';
const SERVICE_TOKEN = 'service-token-de-teste';
const OAUTH_TOKEN = 'oauth-token-de-teste';

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const maxJwt = (sub) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, iss: `${MAX_URL}/auth/v1` })}.assinatura`;
const USER_A = { id: 'user-a', token: maxJwt('user-a'), phone: '+55 (11) 98888-7777' };
const USER_B = { id: 'user-b', token: maxJwt('user-b'), phone: '' };
const EXPIRED_TOKEN = maxJwt('user-expirado');

const originalFetch = globalThis.fetch;
const providerCalls = []; // tudo que sairia da máquina: operadora, ElevenLabs, OpenAI, Google (via fetch)
const googleCalls = [];   // cliente Google simulado
let meowCalls = [];

globalThis.fetch = async (url, options = {}) => {
  const target = String(url);
  if (target.startsWith('http://127.0.0.1:') || target.startsWith('http://localhost:')) {
    return originalFetch(url, options);
  }
  providerCalls.push({ url: target, method: options.method || 'GET', body: options.body || null });
  if (target.startsWith('http://meowcaller.test/health')) {
    return { ok: true, json: async () => ({ status: 'healthy', whatsapp_status: 'CONNECTED', active_calls: 0 }) };
  }
  if (/^http:\/\/meowcaller\.test\/v1\/calls\/[^/]+\/play$/.test(target)) {
    return { ok: true, json: async () => ({ ok: true }) };
  }
  if (target === 'http://meowcaller.test/v1/calls' && options.method === 'POST') {
    meowCalls.push(JSON.parse(options.body));
    return { ok: true, json: async () => ({ call_id: 'CALL-TESTE-1', status: 'DIALING' }) };
  }
  return { ok: false, status: 404, json: async () => ({}), text: async () => 'nao-simulado' };
};

const { createIntegrationsRouter } = await import('../src/routes/integrations.mjs');
const { setGoogleTTSClientForTesting } = await import('../src/integrations/google-chirp3-hd.mjs');

setGoogleTTSClientForTesting({
  synthesizeSpeech: async (request) => {
    googleCalls.push(request);
    return [{ audioContent: Buffer.from('audio-simulado') }];
  }
});

// Simula o que o middleware real faz (validado separadamente mais abaixo), para isolar as rotas.
function fakeVoiceSession(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header) return res.status(401).json({ error: 'authorization_required' });
  const token = header.replace(/^Bearer /, '');
  const user = [USER_A, USER_B].find((candidate) => candidate.token === token);
  if (user) {
    req.voiceSession = { kind: 'user', userId: user.id, profilePhone: async () => user.phone };
    return next();
  }
  if (token === SERVICE_TOKEN) {
    req.identity = { userId: 'admin', role: 'service-admin', type: 'static_fallback' };
    req.voiceSession = { kind: 'service' };
    return next();
  }
  if (token === OAUTH_TOKEN) {
    req.identity = { userId: 'oauth-user', type: 'oauth2' };
    req.voiceSession = { kind: 'other' };
    return next();
  }
  return res.status(401).json({ error: 'invalid_token' });
}

let server;
let baseUrl;

before(async () => {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(createIntegrationsRouter({
    supabaseFetch: async () => [],
    authenticateUser: fakeVoiceSession,
    authenticateVoiceSession: fakeVoiceSession
  }));
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', () => resolve()); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  globalThis.fetch = originalFetch;
  setGoogleTTSClientForTesting(null);
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  providerCalls.length = 0;
  googleCalls.length = 0;
  meowCalls = [];
});

const post = (path, { token, body } = {}) => fetch(`${baseUrl}${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body ?? {})
});

const noProviderTouched = () => {
  assert.deepEqual(providerCalls, [], 'nenhum provedor externo pode ser chamado');
  assert.equal(googleCalls.length, 0, 'o Google não pode ser chamado');
  assert.equal(meowCalls.length, 0, 'a operadora não pode ser chamada');
};

const VOICE_ROUTES = [
  ['/api/integrations/call-engine/preview', { text: 'Olá, teste', voice: 'pt-BR-Chirp3-HD-Aoede' }],
  ['/api/integrations/google-chirp3-hd/preview', { text: 'Olá, teste', voice: 'pt-BR-Chirp3-HD-Aoede' }],
  ['/api/integrations/voice-agent/test-dialogue', { prompt: 'Oi' }],
  ['/api/integrations/call-engine/call-phone', { phone: '11999990000', character_id: 'rafael' }]
];

// ---------------------------------------------------------------- (a) sem credencial
for (const [path, body] of VOICE_ROUTES) {
  test(`(a) sem credencial: ${path} responde 401 e não chama provedor`, async () => {
    const res = await post(path, { body });
    assert.equal(res.status, 401);
    noProviderTouched();
  });

  test(`(a) credencial inválida: ${path} responde 401 e não chama provedor`, async () => {
    const res = await post(path, { token: 'qualquer-coisa', body });
    assert.equal(res.status, 401);
    noProviderTouched();
  });
}

// ---------------------------------------------------------------- (b) número do perfil
test('(b) conta válida com número diferente do perfil: 403 e a operadora não é chamada', async () => {
  const res = await post('/api/integrations/call-engine/call-phone', {
    token: USER_A.token, body: { phone: '11 90000-0000', character_id: 'rafael' }
  });
  assert.equal(res.status, 403);
  noProviderTouched();
});

test('(b) conta válida com o próprio número (formato diferente): disca o número do perfil', async () => {
  const res = await post('/api/integrations/call-engine/call-phone', {
    token: USER_A.token, body: { phone: '11988887777', character_id: 'rafael' }
  });
  assert.equal(res.status, 200);
  assert.equal(meowCalls.length, 1);
  assert.equal(meowCalls[0].phone, '5511988887777');
});

test('(b) conta válida sem número no corpo: o servidor usa o do perfil', async () => {
  const res = await post('/api/integrations/call-engine/call-phone', {
    token: USER_A.token, body: { character_id: 'rafael' }
  });
  assert.equal(res.status, 200);
  assert.equal(meowCalls[0].phone, '5511988887777');
});

test('(b) conta sem telefone no perfil: recusa e não liga', async () => {
  const res = await post('/api/integrations/call-engine/call-phone', {
    token: USER_B.token, body: { phone: '11999990000', character_id: 'rafael' }
  });
  assert.equal(res.status, 400);
  noProviderTouched();
});

test('(b) credencial que não é conta nem serviço (ex.: OAuth da Helena): 403 e não liga', async () => {
  const res = await post('/api/integrations/call-engine/call-phone', {
    token: OAUTH_TOKEN, body: { phone: '11999990000', character_id: 'rafael' }
  });
  assert.equal(res.status, 403);
  noProviderTouched();
});

// ---------------------------------------------------------------- (c) credencial de serviço
test('(c) credencial de serviço continua escolhendo o destino e liga', async () => {
  const res = await post('/api/integrations/call-engine/call-phone', {
    token: SERVICE_TOKEN, body: { phone: '11977776666', character_id: 'rafael' }
  });
  assert.equal(res.status, 200);
  assert.equal(meowCalls.length, 1);
  assert.equal(meowCalls[0].phone, '5511977776666');
});

test('(c) credencial de serviço sem número: 400 e não liga', async () => {
  const res = await post('/api/integrations/call-engine/call-phone', {
    token: SERVICE_TOKEN, body: { character_id: 'rafael' }
  });
  assert.equal(res.status, 400);
  noProviderTouched();
});

// ---------------------------------------------------------------- (d) modo pedido pelo app
// Falha se: call-phone voltar a ignorar o modo e abrir sempre em Normal.
for (const [mode, expectedKey, expectedName] of [
  ['intense', 'alex_intense', 'Intenso'],
  ['firm', 'alex_firm', 'Firme'],
  ['firme', 'alex_firm', 'Firme'],
  ['normal', 'alex_normal', 'Normal'],
  [undefined, 'alex_normal', 'Normal'],
  ['qualquer-coisa', 'alex_normal', 'Normal']
]) {
  test(`(d) call-phone respeita o modo pedido (${mode ?? 'sem modo'} → ${expectedKey})`, async () => {
    const { getCallSession, endCallSession } = await import('../src/integrations/call-engine.mjs');
    const res = await post('/api/integrations/call-engine/call-phone', {
      token: SERVICE_TOKEN, body: { phone: '11977776666', character_id: 'alex', ...(mode === undefined ? {} : { mode }) }
    });
    try {
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.mode, expectedName);
      assert.doesNotMatch(data.message, /Google/, 'a resposta não promete um provedor de voz fixo');
      assert.equal(getCallSession('CALL-TESTE-1').activeProfileKey, expectedKey);
      assert.equal(getCallSession('CALL-TESTE-1').activeCharacterId, 'alex');
    } finally {
      endCallSession({ callId: 'CALL-TESTE-1', reason: 'TEST_CLEANUP' });
    }
  });
}

// ---------------------------------------------------------------- (e) ligação recebida recusada
// Falha se: a fala de um número recusado voltar a ser transcrita (STT) ou respondida.
test('(e) fala de ligação recebida recusada: 200 ignorado, sem transcrever e sem fallback em lote', async () => {
  const { settleCallGate } = await import('../src/integrations/inbound-call-gate.mjs');
  const { registerCallSession, endCallSession } = await import('../src/integrations/call-engine.mjs');
  const callId = `ROTA-RECUSADA-${Date.now()}`;
  registerCallSession({ callId, direction: 'INBOUND', profileKey: 'sirlene_normal' });
  settleCallGate(callId, { allowed: false, reason: 'caller_unidentified' });
  try {
    const res = await fetch(`${baseUrl}/api/integrations/voice-agent/user-speech-stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'audio/pcm', 'X-API-Key': 'test-voice-gateway-key', 'X-Call-ID': callId, 'X-Speech-Epoch': '1' },
      body: Buffer.alloc(3200, 1)
    });
    assert.equal(res.status, 200, 'resposta 200 evita o reenvio do mesmo áudio em lote pelo meowcaller');
    const data = await res.json();
    assert.equal(data.result.ignored, true);
    assert.equal(data.result.reason, 'call_not_allowed');
    noProviderTouched();
  } finally {
    endCallSession({ callId, reason: 'TEST_CLEANUP' });
  }
});

// ---------------------------------------------------------------- (f) resposta ao meowcaller sem fala
// Falha se: a resposta dos webhooks internos voltar a levar a fala (o meowcaller grava o corpo no log dele).
test('(f) atendimento: a resposta ao meowcaller não leva a fala da abertura', async () => {
  const { registerCallSession, endCallSession } = await import('../src/integrations/call-engine.mjs');
  const callId = `ROTA-WEBHOOK-${Date.now()}`;
  registerCallSession({ callId, direction: 'OUTBOUND', profileKey: 'sirlene_normal' });
  try {
    const res = await fetch(`${baseUrl}/api/integrations/voice-agent/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': 'test-voice-gateway-key' },
      body: JSON.stringify({ call_id: callId, direction: 'OUTBOUND' })
    });
    assert.equal(res.status, 200);
    const raw = await res.text();
    const data = JSON.parse(raw);
    assert.equal(data.result.handled, true, 'a abertura foi falada');
    assert.equal(googleCalls.length, 1);
    assert.doesNotMatch(raw, /"(greeting|text|user_text|reply_text)"/);
    assert.doesNotMatch(raw, /Olá, aqui é/);
  } finally {
    endCallSession({ callId, reason: 'TEST_CLEANUP' });
  }
});

for (const path of ['/api/integrations/call-engine/preview', '/api/integrations/google-chirp3-hd/preview']) {
  test(`(c) conta válida e serviço continuam gerando voz em ${path}`, async () => {
    for (const token of [USER_A.token, SERVICE_TOKEN]) {
      googleCalls.length = 0;
      const res = await post(path, { token, body: { text: 'Olá, teste', voice: 'pt-BR-Chirp3-HD-Aoede' } });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.ok, true);
      assert.equal(googleCalls.length, 1);
    }
  });
}

// ---------------------------------------------------------------- middleware real
test('middleware: sem cabeçalho de autorização responde 401 sem consultar ninguém', async () => {
  const { createVoiceSessionAuth } = await import('../src/voice-session-auth.mjs');
  const calls = [];
  const middleware = createVoiceSessionAuth({
    url: MAX_URL, key: MAX_ANON, fallback: () => assert.fail('não deve usar o fallback'),
    fetchImpl: async (...args) => { calls.push(args); return { ok: false }; }
  });
  const res = fakeRes();
  await middleware({ headers: {}, path: '/x' }, res, () => assert.fail('não pode seguir'));
  assert.equal(res.statusCode, 401);
  assert.equal(calls.length, 0);
});

test('middleware: sessão Max válida (não precisa ser administrador) vira conta com telefone do perfil', async () => {
  const { createVoiceSessionAuth } = await import('../src/voice-session-auth.mjs');
  const seen = [];
  const middleware = createVoiceSessionAuth({
    url: MAX_URL, key: MAX_ANON, fallback: () => assert.fail('não deve usar o fallback'),
    fetchImpl: async (target, options) => {
      seen.push({ target: String(target), authorization: options.headers.Authorization, apikey: options.headers.apikey });
      if (String(target).endsWith('/auth/v1/user')) return { ok: true, json: async () => ({ id: 'user-a', email: 'a@teste.dev' }) };
      if (String(target).includes('/rest/v1/profiles')) return { ok: true, json: async () => ([{ phone: '(11) 98888-7777' }]) };
      return { ok: false, status: 404 };
    }
  });
  const req = { headers: { authorization: `Bearer ${USER_A.token}` }, path: '/api/integrations/call-engine/call-phone' };
  let proceeded = false;
  await middleware(req, fakeRes(), () => { proceeded = true; });
  assert.equal(proceeded, true);
  assert.equal(req.voiceSession.kind, 'user');
  assert.equal(req.voiceSession.userId, 'user-a');
  assert.equal(await req.voiceSession.profilePhone(), '11988887777');
  const profileCall = seen.find((call) => call.target.includes('/rest/v1/profiles'));
  assert.match(profileCall.target, /user_id=eq\.user-a/);
  assert.equal(profileCall.authorization, `Bearer ${USER_A.token}`, 'o perfil é lido com a sessão da própria pessoa');
  assert.equal(profileCall.apikey, MAX_ANON);
});

test('middleware: sessão Max recusada pelo Max responde 401', async () => {
  const { createVoiceSessionAuth } = await import('../src/voice-session-auth.mjs');
  const middleware = createVoiceSessionAuth({
    url: MAX_URL, key: MAX_ANON, fallback: () => assert.fail('não deve usar o fallback'),
    fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({}) })
  });
  const res = fakeRes();
  await middleware({ headers: { authorization: `Bearer ${EXPIRED_TOKEN}` }, path: '/x' }, res, () => assert.fail('não pode seguir'));
  assert.equal(res.statusCode, 401);
});

test('middleware: Max fora do ar responde 503 (nunca deixa passar)', async () => {
  const { createVoiceSessionAuth } = await import('../src/voice-session-auth.mjs');
  const middleware = createVoiceSessionAuth({
    url: MAX_URL, key: MAX_ANON, fallback: () => assert.fail('não deve usar o fallback'),
    fetchImpl: async () => { throw new Error('rede'); }
  });
  const res = fakeRes();
  await middleware({ headers: { authorization: `Bearer ${USER_A.token}` }, path: '/x' }, res, () => assert.fail('não pode seguir'));
  assert.equal(res.statusCode, 503);
});

test('middleware: credencial de outro emissor segue para o fallback; só o token estático vira serviço', async () => {
  const { createVoiceSessionAuth } = await import('../src/voice-session-auth.mjs');
  const fallback = (req, res, next) => {
    const token = req.headers.authorization.replace(/^Bearer /, '');
    if (token === SERVICE_TOKEN) { req.identity = { type: 'static_fallback' }; return next(); }
    if (token === OAUTH_TOKEN) { req.identity = { type: 'oauth2' }; return next(); }
    return res.status(401).json({ error: 'invalid_token' });
  };
  const middleware = createVoiceSessionAuth({
    url: MAX_URL, key: MAX_ANON, fallback, fetchImpl: async () => assert.fail('não consulta o Max')
  });
  const service = { headers: { authorization: `Bearer ${SERVICE_TOKEN}` }, path: '/x' };
  await middleware(service, fakeRes(), () => {});
  assert.equal(service.voiceSession.kind, 'service');
  const oauth = { headers: { authorization: `Bearer ${OAUTH_TOKEN}` }, path: '/x' };
  await middleware(oauth, fakeRes(), () => {});
  assert.equal(oauth.voiceSession.kind, 'other');
  const res = fakeRes();
  await middleware({ headers: { authorization: 'Bearer desconhecido' }, path: '/x' }, res, () => assert.fail('não pode seguir'));
  assert.equal(res.statusCode, 401);
});

function fakeRes() {
  return {
    statusCode: 200, body: null, headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
}

// ---------------------------------------------------------------- roteador sem o middleware de sessão
test('sem authenticateVoiceSession o roteador continua fechado (fail-closed) e não disca por credencial comum', async () => {
  const app = express();
  app.use(express.json());
  app.use(createIntegrationsRouter({
    supabaseFetch: async () => [],
    authenticateUser: (req, res, next) => {
      if (req.headers.authorization === 'Bearer comum') { req.identity = { type: 'test' }; return next(); }
      return res.status(401).json({ error: 'invalid_token' });
    }
  }));
  const local = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  try {
    const url = `http://127.0.0.1:${local.address().port}`;
    const call = (path, token) => fetch(`${url}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ phone: '11999990000', text: 'Olá' })
    });
    assert.equal((await call('/api/integrations/call-engine/call-phone')).status, 401);
    assert.equal((await call('/api/integrations/call-engine/preview')).status, 401);
    assert.equal((await call('/api/integrations/call-engine/call-phone', 'comum')).status, 403);
    noProviderTouched();
  } finally {
    await new Promise((resolve) => local.close(resolve));
  }
});

// ======================================================================
// REFORÇOS (revisão independente)
// ======================================================================
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const MAX_PROFILES = { 'user-a': USER_A.phone, 'user-b': '', 'user-c': '(21) 97777-6666' };
const maxToken = (id) => maxJwt(id);
const OTHER_ISS_TOKEN = `${b64({ alg: 'HS256' })}.${b64({ sub: 'x', iss: 'https://outro-emissor.test/auth/v1' })}.sig`;
const maxCalls = [];

// Max simulado: /auth/v1/user aceita só os tokens conhecidos; /rest/v1/profiles devolve o telefone do perfil.
async function fakeMaxFetch(target, options) {
  const t = String(target);
  maxCalls.push(t);
  const token = String(options.headers.Authorization || '').replace(/^Bearer /, '');
  const id = Object.keys(MAX_PROFILES).find((candidate) => maxToken(candidate) === token);
  if (t.endsWith('/auth/v1/user')) return id ? { ok: true, json: async () => ({ id }) } : { ok: false, status: 401, json: async () => ({}) };
  if (t.includes('/rest/v1/profiles')) {
    const wanted = decodeURIComponent(t.match(/user_id=eq\.([^&]+)/)[1]);
    return { ok: true, json: async () => ([{ phone: MAX_PROFILES[wanted] }]) };
  }
  throw new Error(`Max simulado: chamada inesperada ${t}`);
}

async function withApp(routerOptions, fn) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(createIntegrationsRouter({ supabaseFetch: async () => [], ...routerOptions }));
  const local = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  try {
    const url = `http://127.0.0.1:${local.address().port}`;
    const send = (path, { token, body } = {}) => fetch(`${url}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body ?? {})
    });
    await fn(send);
  } finally {
    await new Promise((resolve) => local.close(resolve));
  }
}

// Fallback simulado do authenticateMcp: só conhece o token de serviço e o OAuth da Helena.
function fakeMcpFallback(req, res, next) {
  const token = String(req.headers.authorization || '').replace(/^Bearer /, '');
  if (token === SERVICE_TOKEN) { req.identity = { userId: 'admin', type: 'static_fallback' }; return next(); }
  if (token === OAUTH_TOKEN) { req.identity = { userId: 'oauth-user', type: 'oauth2' }; return next(); }
  return res.status(401).json({ error: 'invalid_token' });
}

async function withRealMiddleware(extra, fn) {
  const { createVoiceSessionAuth } = await import('../src/voice-session-auth.mjs');
  const authenticateVoiceSession = createVoiceSessionAuth({
    url: MAX_URL, key: MAX_ANON, fallback: fakeMcpFallback, fetchImpl: fakeMaxFetch
  });
  await withApp({ authenticateUser: fakeMcpFallback, authenticateVoiceSession, ...extra }, fn);
}

const PROTECTED = [
  ['/api/integrations/call-engine/call-phone', { phone: '11988887777', character_id: 'rafael' }],
  ['/api/integrations/call-engine/preview', { text: 'Olá', voice: 'pt-BR-Chirp3-HD-Aoede' }],
  ['/api/integrations/google-chirp3-hd/preview', { text: 'Olá', voice: 'pt-BR-Chirp3-HD-Aoede' }],
  ['/api/integrations/voice-agent/test-dialogue', { prompt: 'Oi' }]
];

// Falha se: a rota voltar a usar optionalAuth/sem middleware, ou o router deixar de ligar o middleware de sessão.
test('REAL: sem cabeçalho de autorização → 401 em todas as rotas protegidas, sem provedor', async () => {
  await withRealMiddleware({}, async (send) => {
    for (const [path, body] of PROTECTED) {
      assert.equal((await send(path, { body })).status, 401, path);
    }
    noProviderTouched();
  });
});

// Falha se: o middleware aceitar o JWT do Max sem conferir em /auth/v1/user.
test('REAL: JWT com iss do Max recusado por /auth/v1/user → 401', async () => {
  await withRealMiddleware({}, async (send) => {
    for (const [path, body] of PROTECTED) {
      assert.equal((await send(path, { token: EXPIRED_TOKEN, body })).status, 401, path);
    }
    noProviderTouched();
  });
});

// Falha se: o middleware passar a aceitar token de outro emissor sem o fallback.
test('REAL: JWT com outro iss recusado pelo fallback → 401', async () => {
  await withRealMiddleware({}, async (send) => {
    for (const [path, body] of PROTECTED) {
      assert.equal((await send(path, { token: OTHER_ISS_TOKEN, body })).status, 401, path);
    }
    noProviderTouched();
  });
});

// Falha se: call-phone voltar a discar o número do corpo, ou o servidor não comparar com o perfil.
test('REAL: sessão válida com número diferente do perfil → 403 e a operadora não é chamada', async () => {
  await withRealMiddleware({}, async (send) => {
    const res = await send('/api/integrations/call-engine/call-phone', {
      token: maxToken('user-a'), body: { phone: '11900001111', character_id: 'rafael' }
    });
    assert.equal(res.status, 403);
    noProviderTouched();
  });
});

// Falha se: o destino voltar a depender do corpo, ou o perfil não for lido do Max.
test('REAL: sessão válida sem phone no corpo → disca o número do perfil', async () => {
  await withRealMiddleware({}, async (send) => {
    const res = await send('/api/integrations/call-engine/call-phone', {
      token: maxToken('user-a'), body: { character_id: 'rafael' }
    });
    assert.equal(res.status, 200);
    assert.equal(meowCalls.length, 1);
    assert.equal(meowCalls[0].phone, '5511988887777');
  });
});

// ---------------------------------------------------------------- meowcaller/call exige fundador
const FOUNDER_TOKEN = 'founder-token';
const PLAIN_TOKEN = 'plain-token';
function founderAuth(req, res, next) {
  const token = String(req.headers.authorization || '').replace(/^Bearer /, '');
  if (token === FOUNDER_TOKEN) { req.identity = { userId: 'founder-1', type: 'oauth2' }; return next(); }
  if (token === PLAIN_TOKEN) { req.identity = { userId: 'plain-1', type: 'oauth2' }; return next(); }
  if (token === SERVICE_TOKEN) { req.identity = { userId: 'admin', role: 'service-admin', type: 'static_fallback' }; return next(); }
  return res.status(401).json({ error: 'invalid_token' });
}
const founderSupabase = async (path) =>
  path.startsWith('/rest/v1/app_access?') && path.includes('user_id=eq.founder-1') ? [{ role: 'founder' }] : [];

// Falha se: a rota meowcaller/call voltar a ter só authenticateUser (sem requireFounder).
test('meowcaller/call: sem credencial 401; credencial válida que não é fundador 403 sem chamar operadora; fundador liga', async () => {
  await withApp({ authenticateUser: founderAuth, supabaseFetch: founderSupabase }, async (send) => {
    const body = { phone: '11955554444', business_id: 'BIZ-001' };
    assert.equal((await send('/api/integrations/meowcaller/call', { body })).status, 401);
    assert.equal((await send('/api/integrations/meowcaller/call', { token: PLAIN_TOKEN, body })).status, 403);
    noProviderTouched();
    const ok = await send('/api/integrations/meowcaller/call', { token: FOUNDER_TOKEN, body });
    assert.equal(ok.status, 200);
    assert.equal(meowCalls.length, 1);
    assert.equal(meowCalls[0].phone, '5511955554444');
  });
});

// ---------------------------------------------------------------- limite por hora
const hourly = async (clock, fn, env = '2') => {
  const previous = process.env.VOICE_CALLS_PER_HOUR;
  if (env === undefined) delete process.env.VOICE_CALLS_PER_HOUR; else process.env.VOICE_CALLS_PER_HOUR = env;
  try { await withRealMiddleware({ now: () => clock.t }, fn); }
  finally { if (previous === undefined) delete process.env.VOICE_CALLS_PER_HOUR; else process.env.VOICE_CALLS_PER_HOUR = previous; }
};
const callAs = (send, id, body = { character_id: 'rafael' }) =>
  send('/api/integrations/call-engine/call-phone', { token: maxToken(id), body });

// Falha se: o limite por conta for removido ou passar a contar além de N.
test('limite: a (N+1)ª ligação da mesma conta na mesma hora → 429 sem chamar a operadora; outra conta não é afetada', async () => {
  const clock = { t: 1_000_000 };
  await hourly(clock, async (send) => {
    assert.equal((await callAs(send, 'user-a')).status, 200);
    assert.equal((await callAs(send, 'user-a')).status, 200);
    meowCalls = [];
    const blocked = await callAs(send, 'user-a');
    assert.equal(blocked.status, 429);
    assert.match((await blocked.json()).error, /limite|muitas|tente/i);
    assert.equal(meowCalls.length, 0);
    assert.equal((await callAs(send, 'user-c')).status, 200, 'outra conta não é afetada');
  });
});

// Falha se: a janela deixar de expirar (ex.: contador sem relógio).
test('limite: depois de uma hora a conta volta a ligar', async () => {
  const clock = { t: 5_000_000 };
  await hourly(clock, async (send) => {
    await callAs(send, 'user-a'); await callAs(send, 'user-a');
    assert.equal((await callAs(send, 'user-a')).status, 429);
    clock.t += 59 * 60 * 1000;
    assert.equal((await callAs(send, 'user-a')).status, 429);
    clock.t += 2 * 60 * 1000;
    assert.equal((await callAs(send, 'user-a')).status, 200);
  });
});

// Falha se: a credencial de serviço passar a entrar no limite.
test('limite: credencial de serviço não entra no limite', async () => {
  const clock = { t: 1 };
  await hourly(clock, async (send) => {
    for (let i = 0; i < 5; i += 1) {
      const res = await send('/api/integrations/call-engine/call-phone', { token: SERVICE_TOKEN, body: { phone: '11977776666' } });
      assert.equal(res.status, 200);
    }
  });
});

// Falha se: o padrão deixar de ser 6 ou valor inválido deixar de cair no padrão.
test('limite: VOICE_CALLS_PER_HOUR inválido cai no padrão 6', async () => {
  for (const invalid of ['abc', '0', '-3', '2.5', '']) {
    const clock = { t: 1 };
    await hourly(clock, async (send) => {
      for (let i = 0; i < 6; i += 1) assert.equal((await callAs(send, 'user-a')).status, 200, `${invalid} #${i}`);
      assert.equal((await callAs(send, 'user-a')).status, 429, invalid);
    }, invalid);
  }
});

// Falha se: uma ligação recusada (403/400) passar a gastar a cota da conta.
test('limite: pedido recusado (número diferente do perfil) não consome a cota', async () => {
  const clock = { t: 1 };
  await hourly(clock, async (send) => {
    for (let i = 0; i < 5; i += 1) assert.equal((await callAs(send, 'user-a', { phone: '11900001111' })).status, 403);
    assert.equal((await callAs(send, 'user-a')).status, 200);
  });
});

// ---------------------------------------------------------------- testes de fonte
const SRC = (name) => readFileSync(fileURLToPath(new URL(`../src/${name}`, import.meta.url)), 'utf8');

// Falha se: server.mjs deixar de passar authenticateVoiceSession: createVoiceSessionAuth(...) ao roteador.
test('fonte: server.mjs liga createVoiceSessionAuth ao roteador de integrações', () => {
  const server = SRC('server.mjs');
  const start = server.indexOf('createIntegrationsRouter({');
  assert.ok(start >= 0, 'createIntegrationsRouter não encontrado');
  const callBlock = server.slice(start, server.indexOf('}));', start) + 4);
  assert.match(callBlock, /authenticateVoiceSession:\s*createVoiceSessionAuth\(/);
  assert.match(server, /import\s*\{\s*createVoiceSessionAuth\s*\}\s*from\s*'\.\/voice-session-auth\.mjs'/);
});

// Falha se: alguma rota POST que liga ou gera voz voltar a usar optionalAuth.
test('fonte: nenhuma rota POST que liga ou gera voz usa optionalAuth', () => {
  const source = SRC('routes/integrations.mjs');
  const parts = source.split(/\n(?=\s*router\.(?:get|post|put|patch|delete|all|use)\()/);
  const voiceWork = /originateCall|routeCallAudio|speakInCall|previewGoogleCallVoice|generateVoiceSample|generateKokoro(?:Sample|Speech)|synthesize\w*\(/;
  const checked = [];
  for (const part of parts) {
    const head = part.match(/^\s*router\.(\w+)\(([\s\S]*?)(?:async\s*\(|handleUpdateProfile\);|\(req,\s*res)/);
    if (!head || head[1] !== 'post' || !voiceWork.test(part)) continue;
    checked.push(head[2].trim().split(',')[0]);
    assert.doesNotMatch(head[2], /optionalAuth/, `rota ${head[2].trim().split(',')[0]} voltou a usar optionalAuth`);
  }
  assert.ok(checked.length >= 8, `esperava varrer as rotas de voz, achei ${checked.length}`);
});

// Falha se: a credencial de serviço (token estático) deixar de poder ligar por meowcaller/call.
test('meowcaller/call: a credencial de serviço continua ligando, sem depender de perfil de fundador', async () => {
  await withApp({ authenticateUser: founderAuth, supabaseFetch: founderSupabase }, async (send) => {
    const ok = await send('/api/integrations/meowcaller/call', { token: SERVICE_TOKEN, body: { phone: '11955554444', business_id: 'BIZ-001' } });
    assert.equal(ok.status, 200);
    assert.equal(meowCalls.length, 1);
  });
});
