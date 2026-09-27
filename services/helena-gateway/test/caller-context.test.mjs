import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCallerPhone, loadCallerContext, buildCallInstruction } from '../src/integrations/caller-context.mjs';
import { registerCallSession, getCallSession, updateProfile } from '../src/integrations/call-engine.mjs';
import { handleCallConnectedWebhook } from '../src/integrations/voice-agent.mjs';
import { cleanSpeechTranscript } from '../src/integrations/voice-delivery.mjs';

test('sound-only annotations do not become conversational turns', () => {
  assert.equal(cleanSpeechTranscript('[som de fungada] [silêncio]'), '');
  assert.equal(cleanSpeechTranscript('[risos] Olá, tudo bem?'), 'Olá, tudo bem?');
});

test('LID cannot be used as phone; WhatsApp phone device is stripped', () => {
  assert.equal(normalizeCallerPhone('999999999999@lid'), '');
  assert.equal(normalizeCallerPhone('5511999991234:3@s.whatsapp.net'), '5511999991234');
  assert.equal(normalizeCallerPhone('+55 (11) 99999-1234'), '5511999991234');
});
test('caller context is cached only within the call, phone and character', async () => {
  process.env.MAX_VOICE_CONTEXT_URL = 'https://example.test/context';
  process.env.MAX_VOICE_CONTEXT_TOKEN = 'test';
  let requests = 0;
  const fetchImpl = async (_url, options) => { requests++; return { ok: true, json: async () => ({status:'matched',context:{character:JSON.parse(options.body).character}}) }; };
  const call = { remoteNumber:'5511999991234' };
  const [a,b] = await Promise.all([loadCallerContext(call,'sirlene',{fetchImpl}),loadCallerContext(call,'sirlene',{fetchImpl})]);
  assert.deepEqual(a,b); assert.equal(requests,1);
  await loadCallerContext(call,'vital',{fetchImpl}); assert.equal(requests,2);
  await loadCallerContext({remoteNumber:call.remoteNumber},'sirlene',{fetchImpl}); assert.equal(requests,3);
  delete process.env.MAX_VOICE_CONTEXT_URL; delete process.env.MAX_VOICE_CONTEXT_TOKEN;
});
test('saved personality wins over stale session; missing data is explicit', async () => {
  const instruction = await buildCallInstruction({activeSystemScript:'STALE'}, {character_id:'vital',character_name:'Vital',mode_name:'Firme',system_script:'SAVED VITAL'});
  assert.ok(instruction.includes('SAVED VITAL')); assert.ok(!instruction.includes('STALE'));
  assert.ok(instruction.includes('unidentified'));
});
test('inbound starts with Sirlene and disabled opening stays silent', async () => {
  updateProfile('sirlene','normal',{opening_enabled:false});
  await handleCallConnectedWebhook({call_id:'caller-context-inbound',direction:'INBOUND',remote_number:'5511999991234'});
  assert.equal(getCallSession('caller-context-inbound').activeProfileKey,'sirlene_normal');
  assert.equal(getCallSession('caller-context-inbound').remoteNumber,'5511999991234');
});
