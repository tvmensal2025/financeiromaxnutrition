import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable, Transform } from 'node:stream';
import { registerCallSession } from '../src/integrations/call-engine.mjs';
import { processUserSpeech } from '../src/integrations/voice-agent.mjs';
import { setGoogleTTSClientForTesting } from '../src/integrations/google-chirp3-hd.mjs';
import { settleCallGate } from '../src/integrations/inbound-call-gate.mjs';
import { createVoiceAgentStore } from '../src/integrations/voice-agent-store.mjs';

test('a blocked history write does not block GPT, Google or playback', async t => {
  const env = Object.fromEntries(['MAX_VOICE_CONTEXT_URL','MAX_VOICE_CONTEXT_TOKEN','OPENAI_API_KEY','CALL_VOICE_STREAMING_ENABLED'].map(k=>[k,process.env[k]]));
  Object.assign(process.env,{MAX_VOICE_CONTEXT_URL:'http://context',MAX_VOICE_CONTEXT_TOKEN:'fake',OPENAI_API_KEY:'fake',CALL_VOICE_STREAMING_ENABLED:'true'});
  const call = registerCallSession({callId:'nonblocking-history',profileKey:'vital_normal'});
  call.accessToken = 'fake-session';
  settleCallGate(call.callId, { allowed: true, reason: 'known_student' }); // ligação já atendida para aluno conhecido
  let release, saved = false, llm = false;
  const blocked = new Promise(resolve => { release = resolve; });
  const operations=[];
  t.mock.method(globalThis,'fetch',async(url,opts)=>{
    if(String(url)==='http://context') {
      const body=JSON.parse(opts.body);
      if(body.action==='append_turn') {
        operations.push(body.user_text ? 'heard' : 'answer');
        if(body.user_text) { await blocked; saved=true; }
        return Response.json({ok:true});
      }
      return Response.json({status:'matched',context:{},fetched_at:'test'});
    }
    if(String(url).includes('api.openai.com')) {
      llm=true; assert.equal(saved,false);
      return {ok:true,body:Readable.from([
        'data: {"choices":[{"delta":{"content":"Olá, como posso ajudar?"}}]}\n\n',
        'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n'
      ].map(x=>Buffer.from(x)))};
    }
    assert.match(String(url),/\/play\/stream$/);
    for await(const chunk of opts.body) assert.ok(chunk.length);
    assert.equal(saved,false);
    return Response.json({ok:true,metrics:{first_frame_ms:10}});
  });
  setGoogleTTSClientForTesting({streamingSynthesize:()=>new Transform({objectMode:true,transform(message,_,done){
    if(message.input)this.push({audioContent:Buffer.alloc(3840)}); done();
  }})});
  let timeout;
  try {
    const result=await Promise.race([
      processUserSpeech({callId:call.callId,speechEpoch:1,userText:'Olá',sttMetrics:{stt_after_commit_ms:20}}),
      new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('history blocked the reply')),1500);})
    ]);
    assert.equal(result.ok,true); assert.equal(llm,true); assert.equal(saved,false);
    release(); await new Promise(resolve=>setTimeout(resolve,20));
    assert.deepEqual(operations,['heard','answer']);
  } finally {
    release(); clearTimeout(timeout); await new Promise(resolve=>setImmediate(resolve));
    setGoogleTTSClientForTesting(null);
    for(const [k,v] of Object.entries(env)) { if(v===undefined)delete process.env[k];else process.env[k]=v; }
  }
});

test('loads independent legacy voice settings concurrently without changing their mapping', async () => {
  let release;
  const barrier = new Promise(resolve => { release = resolve; });
  const requested = [];
  const store = createVoiceAgentStore(async url => {
    if (url.startsWith('/rest/v1/voice_profiles')) return [];
    requested.push(url);
    await barrier;
    return [{ valor: new URL(`http://local${url}`).searchParams.get('chave').slice(3) }];
  });
  const loading = store.load();
  try {
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(requested.length, 4, 'all independent reads must start before one finishes');
  } finally { release(); }
  assert.deepEqual(await loading, {
    knowledge_base: 'VOICE_AGENT_KNOWLEDGE_BASE', persona: 'VOICE_AGENT_PERSONA',
    ai_provider: 'VOICE_AGENT_AI_PROVIDER', ai_model: 'VOICE_AGENT_AI_MODEL',
  });
});

test('keeps the canonical voice profile authoritative and surfaces legacy read errors', async () => {
  let reads = 0;
  const store = createVoiceAgentStore(async () => {
    reads++;
    return [{ profile_id: 'VP-VOICE-AGENT-BIZ-002', business_id: 'BIZ-002', settings: { voice_agent: { is_active: false } } }];
  });
  assert.deepEqual(await store.load(), { is_active: false });
  assert.equal(reads, 1);
  const failing = createVoiceAgentStore(async url => {
    if (url.startsWith('/rest/v1/voice_profiles')) return [];
    if (url.includes('VOICE_AGENT_PERSONA')) throw new Error('read failed');
    return [];
  });
  await assert.rejects(failing.load(), /read failed/);
});
