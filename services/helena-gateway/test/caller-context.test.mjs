import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCallerPhone, loadCallerContext, buildCallInstruction, persistVoiceTurn, persistVoiceUtterance } from '../src/integrations/caller-context.mjs';
import { registerCallSession, getCallSession, updateProfile } from '../src/integrations/call-engine.mjs';
import { handleCallConnectedWebhook } from '../src/integrations/voice-agent.mjs';
import { cleanSpeechTranscript } from '../src/integrations/voice-delivery.mjs';
import { webOpening, conversationModeInstruction } from '../src/integrations/conversation-mode.mjs';

test('web opening respects explicit toggle and never repeats for empty turns', () => {
  assert.equal(webOpening({opening_enabled:false,opening_message:'fixed'},true,''),null);
  assert.equal(webOpening({opening_enabled:true,opening_message:'fixed'},true,''),null);
  assert.equal(webOpening({opening_enabled:true,opening_message:'fixed'},false,''),'');
  assert.equal(webOpening({},false,'Olá'),null);
  assert.notEqual(conversationModeInstruction('normal'),conversationModeInstruction('firm'));
  assert.notEqual(conversationModeInstruction('firm'),conversationModeInstruction('intense'));
});

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
  assert.ok(!instruction.includes('STALE'));
  assert.ok(instruction.includes('unidentified'));
});

test('unidentified WhatsApp callers use the saved prospect script and never a known-client script', async () => {
  const oldUrl=process.env.MAX_VOICE_CONTEXT_URL, oldToken=process.env.MAX_VOICE_CONTEXT_TOKEN, oldFetch=global.fetch;
  process.env.MAX_VOICE_CONTEXT_URL='https://example.test/context'; process.env.MAX_VOICE_CONTEXT_TOKEN='gateway-secret';
  global.fetch=async()=>({ok:true,json:async()=>({status:'unidentified'})});
  try {
    const instruction = await buildCallInstruction({remoteNumber:'5511888888888'}, {
      character_id:'sirlene',character_name:'Sirlene',mode:'normal',mode_name:'Normal',
      system_script:'SCRIPT PARA CLIENTE',prospect_script:'Apresente o aplicativo e responda às dúvidas.'
    });
    assert.match(instruction,/Apresente o aplicativo/);
    assert.doesNotMatch(instruction,/SCRIPT PARA CLIENTE/);
  } finally {
    global.fetch=oldFetch;
    if(oldUrl===undefined) delete process.env.MAX_VOICE_CONTEXT_URL; else process.env.MAX_VOICE_CONTEXT_URL=oldUrl;
    if(oldToken===undefined) delete process.env.MAX_VOICE_CONTEXT_TOKEN; else process.env.MAX_VOICE_CONTEXT_TOKEN=oldToken;
  }
});
test('temporary lookup failures do not classify known callers as prospects', async () => {
  const instruction = await buildCallInstruction({remoteNumber:'5511888888888'}, {
    character_id:'sirlene',character_name:'Sirlene',mode:'normal',mode_name:'Normal',
    system_script:'SCRIPT PARA CLIENTE',prospect_script:'ROTEIRO PARA VISITANTE'
  });
  assert.match(instruction,/temporariamente indisponível/);
  assert.match(instruction,/SCRIPT PARA CLIENTE/);
  assert.doesNotMatch(instruction,/ROTEIRO PARA VISITANTE/);
});
test('inbound greets naturally in Normal once even with fixed opening disabled', async () => {
  updateProfile('sirlene','normal',{opening_enabled:false});
  const spoken = [];
  const payload = {call_id:'caller-context-inbound',direction:'INBOUND',remote_number:'5511999991234'};
  const dependencies = { speak: async args => { spoken.push(args.text); return {ok:true}; } };
  await handleCallConnectedWebhook(payload, dependencies);
  await handleCallConnectedWebhook(payload, dependencies);
  assert.equal(spoken.length, 1);
  assert.match(spoken[0], /Sirlene/);
  assert.equal(getCallSession('caller-context-inbound').activeProfileKey,'sirlene_normal');
  assert.equal(getCallSession('caller-context-inbound').remoteNumber,'5511999991234');
});

test('outbound resets a previously selected Intense profile to Normal', async () => {
  registerCallSession({callId:'outbound-normal',profileKey:'vital_intense',direction:'OUTBOUND'});
  await handleCallConnectedWebhook({call_id:'outbound-normal',direction:'OUTBOUND'}, {speak:async () => ({ok:true})});
  assert.equal(getCallSession('outbound-normal').activeProfileKey,'vital_normal');
});

test('web context forwards authenticated session without trusting a supplied user id', async () => {
  const oldUrl=process.env.MAX_VOICE_CONTEXT_URL, oldToken=process.env.MAX_VOICE_CONTEXT_TOKEN;
  process.env.MAX_VOICE_CONTEXT_URL='https://example.test/context'; process.env.MAX_VOICE_CONTEXT_TOKEN='gateway-secret';
  try {
    const result=await loadCallerContext({accessToken:'session-token'},'vital',{fetchImpl:async (_url,opts)=>{
      const body=JSON.parse(opts.body); assert.equal(body.access_token,'session-token'); assert.equal(body.user_id,undefined);
      return {ok:true,json:async()=>({status:'matched',context:{profile:{firstName:'Rafael'}}})};
    }});
    assert.equal(result.context.profile.firstName,'Rafael');
  } finally {
    if(oldUrl===undefined) delete process.env.MAX_VOICE_CONTEXT_URL; else process.env.MAX_VOICE_CONTEXT_URL=oldUrl;
    if(oldToken===undefined) delete process.env.MAX_VOICE_CONTEXT_TOKEN; else process.env.MAX_VOICE_CONTEXT_TOKEN=oldToken;
  }
});

test('stores a heard utterance before its answer and requests fact extraction once', async () => {
  const oldUrl=process.env.MAX_VOICE_CONTEXT_URL, oldToken=process.env.MAX_VOICE_CONTEXT_TOKEN, oldFetch=global.fetch;
  process.env.MAX_VOICE_CONTEXT_URL='https://example.test/context'; process.env.MAX_VOICE_CONTEXT_TOKEN='gateway-secret';
  const requests=[];
  global.fetch=async (_url, options)=>{requests.push(JSON.parse(options.body));return {ok:true};};
  try {
    const call={callId:'web-test',accessToken:'session-token'};
    const profile={character_id:'vital'};
    const utteranceId=await persistVoiceUtterance(call,profile,'Comi arroz e depois passei mal');
    assert.match(utteranceId,/^[a-f0-9-]{36}$/);
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(requests[0].action,'append_turn');
    assert.equal(requests[0].assistant_text,'');
    assert.equal(requests[1].action,'extract_facts');
    assert.equal(requests[1].turn_id,utteranceId);
    await persistVoiceTurn(call,profile,'','Espero que melhore.');
    assert.equal(requests[2].user_text,'');
    assert.equal(requests[2].assistant_text,'Espero que melhore.');
  } finally {
    global.fetch=oldFetch;
    if(oldUrl===undefined) delete process.env.MAX_VOICE_CONTEXT_URL; else process.env.MAX_VOICE_CONTEXT_URL=oldUrl;
    if(oldToken===undefined) delete process.env.MAX_VOICE_CONTEXT_TOKEN; else process.env.MAX_VOICE_CONTEXT_TOKEN=oldToken;
  }
});


test('persistence retries the same id and preserves heard-before-answer ordering', async t => {
  const url=process.env.MAX_VOICE_CONTEXT_URL, token=process.env.MAX_VOICE_CONTEXT_TOKEN;
  process.env.MAX_VOICE_CONTEXT_URL='https://example.test/context'; process.env.MAX_VOICE_CONTEXT_TOKEN='fake';
  const bodies=[];
  t.mock.method(globalThis,'fetch',async (_,opts)=>{
    bodies.push(JSON.parse(opts.body));
    return {ok:bodies.length>1,status:bodies.length===1?503:200};
  });
  try {
    const call={callId:'retry-test',accessToken:'fake'};
    const a=persistVoiceTurn(call,{character_id:'vital'},'Olá','');
    const b=persistVoiceTurn(call,{character_id:'vital'},'','Oi');
    await Promise.all([a,b]);
    assert.equal(bodies.length,3);
    assert.equal(bodies[0].turn_id,bodies[1].turn_id);
    assert.equal(bodies[2].assistant_text,'Oi');
    assert.notEqual(bodies[2].turn_id,bodies[1].turn_id);
  } finally {
    if(url===undefined)delete process.env.MAX_VOICE_CONTEXT_URL;else process.env.MAX_VOICE_CONTEXT_URL=url;
    if(token===undefined)delete process.env.MAX_VOICE_CONTEXT_TOKEN;else process.env.MAX_VOICE_CONTEXT_TOKEN=token;
  }
});
