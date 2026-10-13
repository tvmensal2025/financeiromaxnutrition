// Ligação RECEBIDA pelo WhatsApp. Padrão "all" (decisão do dono, 13/10/2026): a Sirlene atende todo número; o aluno
// conhecido conversa com a ficha dele e quem não é aluno ouve o roteiro de conversão do Admin.
// Opção "students": só aluno conhecido (ficha encontrada pelo telefone); número desconhecido, ambíguo ou ficha fora do
// ar não é atendido e não gasta STT, GPT nem voz. Opção "none": ninguém.
// Nenhum provedor real é chamado: ficha, operadora, OpenAI e voz são simulados.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const {
  DEFAULT_INBOUND_CALL_POLICY,
  awaitCallGate,
  callGateDecision,
  decideInboundCall,
  inboundCallPolicy,
  settleCallGate
} = await import('../src/integrations/inbound-call-gate.mjs');
const { registerCallSession, endCallSession, getCallSession } = await import('../src/integrations/call-engine.mjs');
const { handleCallConnectedWebhook, handleCallEndedWebhook, handleUserSilence, processUserSpeech } =
  await import('../src/integrations/voice-agent.mjs');

function withEnv(t, values) {
  const saved = Object.fromEntries(Object.keys(values).map(name => [name, process.env[name]]));
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
  t.after(() => {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  });
}

const contextFor = status => async () => ({ status });

// Decisão do dono (13/10/2026): ligação no WhatsApp não é bloqueada; a Sirlene atende e converte quem não é aluno.
test('política padrão atende todos (decisão do dono); students e none continuam como opção', () => {
  assert.equal(DEFAULT_INBOUND_CALL_POLICY, 'all');
  assert.equal(inboundCallPolicy({}), 'all');
  assert.equal(inboundCallPolicy({ VOICE_INBOUND_CALL_POLICY: 'qualquer' }), 'all');
  assert.equal(inboundCallPolicy({ VOICE_INBOUND_CALL_POLICY: '' }), 'all');
  assert.equal(inboundCallPolicy({ VOICE_INBOUND_CALL_POLICY: 'STUDENTS' }), 'students');
  assert.equal(inboundCallPolicy({ VOICE_INBOUND_CALL_POLICY: ' none ' }), 'none');
});

test('sem configurar nada, número desconhecido é atendido pela Sirlene e não é desligado', async (t) => {
  withEnv(t, { VOICE_INBOUND_CALL_POLICY: undefined, MAX_VOICE_CONTEXT_URL: undefined, MAX_VOICE_CONTEXT_TOKEN: undefined });
  const callId = `gate-default-${Date.now()}`;
  const spoken = [];
  try {
    const result = await handleCallConnectedWebhook({ call_id: callId, direction: 'INBOUND', remote_number: '5511900003333' }, {
      generateOpening: async profile => `Olá, aqui é a ${profile.character_name}.`,
      speak: async args => { spoken.push(args.text); return { ok: true }; },
      hangup: async () => assert.fail('não pode desligar')
    });
    assert.equal(result.ok, true);
    assert.equal(result.character, 'Sirlene');
    assert.equal(spoken.length, 1);
    assert.equal((await awaitCallGate(callId)).allowed, true);
  } finally {
    endCallSession({ callId, reason: 'TEST_CLEANUP' });
  }
});

test('quem não é aluno: a Sirlene responde com o roteiro de conversão salvo no Admin e, se o GPT falhar, com a fala segura', async (t) => {
  const ROTEIRO_DO_ADMIN = 'Apresente o eLiving com calma, explique como funciona e convide para baixar o app.';
  withEnv(t, { VOICE_INBOUND_CALL_POLICY: undefined, OPENAI_API_KEY: 'chave-openai-simulada', ELEVENLABS_API_KEY: undefined,
    MAX_VOICE_CONTEXT_URL: 'https://ficha.test/voice-caller-context', MAX_VOICE_CONTEXT_TOKEN: 'token-de-teste-com-tamanho-suficiente',
    MEOWCALLER_TOKEN: 'token-meowcaller-de-teste' });
  const { getProfile, updateProfile } = await import('../src/integrations/call-engine.mjs');
  const original = getProfile('sirlene', 'normal').prospect_script || '';
  updateProfile('sirlene', 'normal', { prospect_script: ROTEIRO_DO_ADMIN }, 'teste');
  t.after(() => updateProfile('sirlene', 'normal', { prospect_script: original }, 'teste'));
  const { Readable, Transform } = await import('node:stream');
  const { setGoogleTTSClientForTesting } = await import('../src/integrations/google-chirp3-hd.mjs');
  setGoogleTTSClientForTesting({ streamingSynthesize: () => new Transform({ objectMode: true, transform(msg, _e, cb) {
    if (msg.input?.text) this.push({ audioContent: Buffer.alloc(640, 1) });
    cb();
  } }) });
  t.after(() => setGoogleTTSClientForTesting(null));
  const sse = data => Buffer.from(`data: ${JSON.stringify(data)}\r\n\r\n`);
  const systemPrompts = [];
  let llmFails = false;
  t.mock.method(globalThis, 'fetch', async (url, opts = {}) => {
    const target = String(url);
    if (target === 'https://ficha.test/voice-caller-context') {
      const body = JSON.parse(opts.body);
      return body.action ? Response.json({ status: 'saved', matched: false }) : Response.json({ status: 'unidentified' });
    }
    if (target === 'https://api.openai.com/v1/chat/completions') {
      const request = JSON.parse(opts.body);
      // A classificação de fatos da fala (voice-facts.mjs) também usa a OpenAI, sem streaming: não é a resposta.
      if (!request.stream) return Response.json({ choices: [{ message: { content: '[]' }, finish_reason: 'stop' }] });
      systemPrompts.push(request.messages[0].content);
      if (llmFails) return new Response('indisponível', { status: 500 });
      return { ok: true, body: Readable.from([sse({ choices: [{ delta: { content: 'Que bom que ligou! ' } }] }),
        sse({ choices: [{ delta: {}, finish_reason: 'stop' }] })]) };
    }
    if (target.endsWith('/play/stream')) {
      try { for await (const chunk of opts.body) void chunk; } catch { /* cancelado */ }
      return Response.json({ ok: true });
    }
    if (target.endsWith('/play')) return Response.json({ ok: true });
    return new Response('não simulado', { status: 404 });
  });
  const callId = `gate-prospect-${Date.now()}`;
  const spoken = [];
  try {
    await handleCallConnectedWebhook({ call_id: callId, direction: 'INBOUND', remote_number: '5511900004444' }, {
      generateOpening: async () => 'Olá, aqui é a Sirlene.', speak: async () => ({ ok: true })
    });
    const answer = await processUserSpeech({ callId, userText: 'O que é o eLiving?', speechEpoch: 1 });
    assert.equal(answer.ok, true);
    assert.equal(systemPrompts.length, 1);
    assert.match(systemPrompts[0], /ROTEIRO SALVO PARA QUEM AINDA NÃO É CLIENTE/);
    assert.ok(systemPrompts[0].includes(ROTEIRO_DO_ADMIN), 'usa o roteiro de conversão do Admin');
    assert.doesNotMatch(systemPrompts[0], /REGISTROS DO MAX/, 'nunca a ficha de um aluno');

    llmFails = true;
    const failed = await processUserSpeech({ callId, userText: 'E quanto custa?', speechEpoch: 2 },
      { speak: async ({ text }) => { spoken.push(text); return { ok: true }; } });
    assert.equal(failed.fallback, true);
    assert.equal(spoken.length, 1);
    assert.match(spoken[0], /probleminha/);
    assert.doesNotMatch(spoken[0], /Pedro|Max Nutrition|creatina|whey|suplement|frete|Pix/i);
  } finally {
    endCallSession({ callId, reason: 'TEST_CLEANUP' });
  }
});

test('decisão por ficha: só aluno identificado é atendido; desconhecido, ambíguo e ficha fora do ar não', async () => {
  const call = { remoteNumber: '5511999990000' };
  assert.deepEqual(await decideInboundCall(call, { policy: 'students', loadContext: contextFor('matched') }),
    { allowed: true, reason: 'known_student' });
  assert.deepEqual(await decideInboundCall(call, { policy: 'students', loadContext: contextFor('unidentified') }),
    { allowed: false, reason: 'caller_unidentified' });
  assert.deepEqual(await decideInboundCall(call, { policy: 'students', loadContext: contextFor('ambiguous') }),
    { allowed: false, reason: 'caller_ambiguous' });
  assert.deepEqual(await decideInboundCall(call, { policy: 'students', loadContext: contextFor('unavailable') }),
    { allowed: false, reason: 'context_unavailable' });
  assert.deepEqual(await decideInboundCall(call, { policy: 'students', loadContext: async () => { throw new Error('rede'); } }),
    { allowed: false, reason: 'context_unavailable' });
});

test('interruptor: "all" atende todos e "none" recusa todos, sem consultar a ficha', async () => {
  const neverLoad = async () => assert.fail('não deve consultar a ficha');
  assert.deepEqual(await decideInboundCall({}, { policy: 'all', loadContext: neverLoad }), { allowed: true, reason: 'policy_all' });
  assert.deepEqual(await decideInboundCall({}, { policy: 'none', loadContext: neverLoad }), { allowed: false, reason: 'policy_none' });
});

test('a consulta usa a mesma busca de ficha por telefone do gateway (voice-caller-context) e falha fechada sem rede', async (t) => {
  withEnv(t, { MAX_VOICE_CONTEXT_URL: 'https://ficha.test/voice-caller-context', MAX_VOICE_CONTEXT_TOKEN: 'token-de-teste-com-tamanho-suficiente' });
  const seen = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    seen.push({ url: String(url), body: JSON.parse(options.body) });
    return Response.json({ status: 'unidentified' });
  });
  const decision = await decideInboundCall({ remoteNumber: '5511988887777' }, { policy: 'students' });
  assert.deepEqual(decision, { allowed: false, reason: 'caller_unidentified' });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].url, 'https://ficha.test/voice-caller-context');
  assert.equal(seen[0].body.phone, '5511988887777');

  t.mock.method(globalThis, 'fetch', async () => { throw new Error('ECONNRESET'); });
  assert.deepEqual(await decideInboundCall({ remoteNumber: '5511977776666' }, { policy: 'students' }),
    { allowed: false, reason: 'context_unavailable' });
});

test('opção students: número desconhecido não abre a conversa, não fala, desliga uma vez e registra o motivo', async (t) => {
  withEnv(t, { VOICE_INBOUND_CALL_POLICY: 'students' });
  const callId = `gate-unknown-${Date.now()}`;
  const hangups = [];
  const deps = {
    decideInbound: async () => ({ allowed: false, reason: 'caller_unidentified' }),
    generateOpening: async () => assert.fail('não pode gerar abertura'),
    speak: async () => assert.fail('não pode falar'),
    hangup: async id => { hangups.push(id); }
  };
  try {
    const result = await handleCallConnectedWebhook({ call_id: callId, direction: 'INBOUND', remote_number: '5511900001111' }, deps);
    assert.equal(result.refused, true);
    assert.equal(result.reason, 'caller_unidentified');
    const again = await handleCallConnectedWebhook({ call_id: callId, direction: 'INBOUND', remote_number: '5511900001111' }, deps);
    assert.equal(again.refused, true);
    assert.deepEqual(hangups, [callId], 'desliga uma vez só, mesmo com webhook repetido');
    assert.equal(getCallSession(callId).greetingPlayed, false);
    assert.deepEqual(callGateDecision(callId), { allowed: false, reason: 'caller_unidentified' });
  } finally {
    await handleCallEndedWebhook({ call_id: callId, reason: 'TEST_CLEANUP' });
  }
  assert.equal(callGateDecision(callId), null, 'a decisão é esquecida quando a ligação termina');
});

test('aluno conhecido: atende normalmente como Sirlene e não desliga', async () => {
  const callId = `gate-known-${Date.now()}`;
  const spoken = [];
  try {
    const result = await handleCallConnectedWebhook({ call_id: callId, direction: 'INBOUND', remote_number: '5511900002222' }, {
      decideInbound: async () => ({ allowed: true, reason: 'known_student' }),
      generateOpening: async profile => `Olá, aqui é a ${profile.character_name}.`,
      speak: async args => { spoken.push(args.text); return { ok: true }; },
      hangup: async () => assert.fail('não pode desligar aluno conhecido')
    });
    assert.equal(result.ok, true);
    assert.equal(result.character, 'Sirlene');
    assert.equal(spoken.length, 1);
    assert.deepEqual(await awaitCallGate(callId, { policy: 'students' }), { allowed: true, reason: 'known_student' });
  } finally {
    endCallSession({ callId, reason: 'TEST_CLEANUP' });
  }
});

test('ligação recusada: fala, silêncio e áudio em lote são ignorados sem STT, GPT nem voz', async (t) => {
  withEnv(t, { OPENAI_API_KEY: 'nao-pode-ser-usada' });
  t.mock.method(globalThis, 'fetch', async url => assert.fail(`nenhum provedor pode ser chamado: ${url}`));
  const callId = `gate-refused-${Date.now()}`;
  registerCallSession({ callId, direction: 'INBOUND', profileKey: 'sirlene_normal' });
  settleCallGate(callId, { allowed: false, reason: 'caller_unidentified' });
  const speak = async () => assert.fail('não pode falar');
  try {
    const live = await processUserSpeech({ callId, userText: 'Alô?', speechEpoch: 1 }, { speak });
    assert.equal(live.reason, 'call_not_allowed');
    const batch = await processUserSpeech({ callId, audioBase64: Buffer.alloc(4000, 1).toString('base64') }, { speak });
    assert.equal(batch.reason, 'call_not_allowed');
    const silence = await handleUserSilence({ callId });
    assert.equal(silence.reason, 'call_not_allowed');
  } finally {
    endCallSession({ callId, reason: 'TEST_CLEANUP' });
  }
});

test('fala que chega antes do webhook espera a decisão; sem decisão no prazo, não gasta nada', async () => {
  const early = `gate-early-${Date.now()}`;
  const pending = awaitCallGate(early, { policy: 'students', timeoutMs: 2000 });
  settleCallGate(early, { allowed: true, reason: 'known_student' });
  assert.deepEqual(await pending, { allowed: true, reason: 'known_student' });

  const silent = `gate-timeout-${Date.now()}`;
  assert.deepEqual(await awaitCallGate(silent, { policy: 'students', timeoutMs: 20 }), { allowed: false, reason: 'gate_timeout' });
});

test('ligação de saída (aberta pelo app) e política "all" não esperam a ficha', async () => {
  const callId = `gate-outbound-${Date.now()}`;
  registerCallSession({ callId, direction: 'OUTBOUND', profileKey: 'alex_normal' });
  try {
    assert.deepEqual(await awaitCallGate(callId, { policy: 'students', timeoutMs: 20 }), { allowed: true, reason: 'outbound' });
  } finally {
    endCallSession({ callId, reason: 'TEST_CLEANUP' });
  }
  assert.deepEqual(await awaitCallGate(`gate-all-${Date.now()}`, { policy: 'all', timeoutMs: 20 }), { allowed: true, reason: 'policy_all' });
});
