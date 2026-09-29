import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable, Transform } from 'node:stream';
import { registerCallSession } from '../src/integrations/call-engine.mjs';
import { processUserSpeech } from '../src/integrations/voice-agent.mjs';
import { setGoogleTTSClientForTesting } from '../src/integrations/google-chirp3-hd.mjs';

test('a blocked history write does not block GPT, Google or playback', async t => {
  const env = Object.fromEntries(['MAX_VOICE_CONTEXT_URL','MAX_VOICE_CONTEXT_TOKEN','OPENAI_API_KEY','CALL_VOICE_STREAMING_ENABLED'].map(k=>[k,process.env[k]]));
  Object.assign(process.env,{MAX_VOICE_CONTEXT_URL:'http://context',MAX_VOICE_CONTEXT_TOKEN:'fake',OPENAI_API_KEY:'fake',CALL_VOICE_STREAMING_ENABLED:'true'});
  const call = registerCallSession({callId:'nonblocking-history',profileKey:'vital_normal'});
  call.accessToken = 'fake-session';
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
