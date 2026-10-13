// Logs do gateway sem telefone completo e sem fala (nem conteúdo de saúde): só ids, tamanhos e tempos.
// E as respostas aos webhooks do meowcaller não levam texto (o meowcaller grava o corpo da resposta no log dele).
// Nenhum provedor real é chamado: voz, meowcaller e GPT são simulados.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const PHONE = '5511987654321';
const FALA_DO_ALUNO = 'Minha glicemia deu trezentos e tomei insulina';
const FALA_DO_PERSONAGEM = 'Que bom que você mediu a glicemia hoje.';

const { maskPhone, withoutSpeechContent } = await import('../src/log-privacy.mjs');

function captureLogs(t) {
  const lines = [];
  for (const level of ['log', 'warn', 'error', 'info']) {
    t.mock.method(console, level, (...args) => { lines.push(args.map(String).join(' ')); });
  }
  return lines;
}

test('telefone mascarado mostra só os 4 últimos dígitos', () => {
  assert.equal(maskPhone(PHONE), '••••4321');
  assert.equal(maskPhone('+55 (11) 98765-4321'), '••••4321');
  assert.equal(maskPhone('5511987654321@s.whatsapp.net'), '••••4321');
  assert.equal(maskPhone('123'), '••••');
  assert.equal(maskPhone(''), 'Não identificado');
  assert.equal(maskPhone(null), 'Não identificado');
});

test('resposta ao meowcaller sem fala: tira textos em qualquer nível e mantém ids, tempos e motivos', () => {
  const result = withoutSpeechContent({
    ok: true, call_id: 'C1', reason: 'x', user_text: FALA_DO_ALUNO, reply_text: FALA_DO_PERSONAGEM,
    greeting: 'Olá', text: 'Olá', metrics: { stt_ms: 10, usage: { prompt_tokens: 5 } },
    play_result: { ok: true, text: FALA_DO_PERSONAGEM }
  });
  assert.deepEqual(result, { ok: true, call_id: 'C1', reason: 'x', metrics: { stt_ms: 10, usage: { prompt_tokens: 5 } },
    play_result: { ok: true } });
});

test('ligação completa: nenhum log traz o telefone inteiro nem a fala do aluno ou do personagem', async (t) => {
  const saved = Object.fromEntries(['MEOWCALLER_TOKEN', 'OPENAI_API_KEY', 'ELEVENLABS_API_KEY', 'MAX_VOICE_CONTEXT_URL',
    'MAX_VOICE_CONTEXT_TOKEN'].map(name => [name, process.env[name]]));
  for (const name of Object.keys(saved)) delete process.env[name];
  process.env.MEOWCALLER_TOKEN = 'token-meowcaller-de-teste';
  t.after(() => { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });
  const { setGoogleTTSClientForTesting } = await import('../src/integrations/google-chirp3-hd.mjs');
  setGoogleTTSClientForTesting({ synthesizeSpeech: async () => [{ audioContent: Buffer.from('audio-simulado') }] });
  t.after(() => setGoogleTTSClientForTesting(null));
  t.mock.method(globalThis, 'fetch', async () => Response.json({ ok: true }));
  const { registerCallSession, endCallSession } = await import('../src/integrations/call-engine.mjs');
  const { handleCallConnectedWebhook, processUserSpeech, speakInCall } = await import('../src/integrations/voice-agent.mjs');
  const { settleCallGate } = await import('../src/integrations/inbound-call-gate.mjs');
  const lines = captureLogs(t);
  const callId = `log-privacy-${Date.now()}`;
  try {
    registerCallSession({ callId, remoteNumber: PHONE, direction: 'INBOUND', profileKey: 'sirlene_normal' });
    await handleCallConnectedWebhook({ call_id: callId, direction: 'INBOUND', remote_number: PHONE }, {
      decideInbound: async () => ({ allowed: true, reason: 'known_student' }),
      generateOpening: async () => FALA_DO_PERSONAGEM
    });
    settleCallGate(callId, { allowed: true, reason: 'known_student' });
    await processUserSpeech({ callId, userText: FALA_DO_ALUNO });
    await speakInCall({ callId, text: FALA_DO_PERSONAGEM });
    const refusedId = `log-privacy-recusada-${Date.now()}`;
    await handleCallConnectedWebhook({ call_id: refusedId, direction: 'INBOUND', remote_number: PHONE }, {
      decideInbound: async () => ({ allowed: false, reason: 'caller_unidentified' }), hangup: async () => {}
    });
    endCallSession({ callId: refusedId, reason: 'TEST_CLEANUP' });
  } finally {
    endCallSession({ callId, reason: 'TEST_CLEANUP' });
  }
  const all = lines.join('\n');
  assert.ok(lines.length > 3, 'a ligação gerou logs');
  assert.doesNotMatch(all, /87654321|987654321|5511987654321/, 'telefone inteiro no log');
  assert.doesNotMatch(all, /glicemia|insulina|trezentos/i, 'fala do aluno ou do personagem no log');
  assert.match(all, /••••4321/, 'o telefone aparece só mascarado');
});
