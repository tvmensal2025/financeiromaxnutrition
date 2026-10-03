import { it } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { streamBrowserTurn } from '../src/integrations/browser-call-stream.mjs';
class Response extends EventEmitter {
 destroyed=false; events=[]; headers={}; blocked=false;
 setHeader(name,value){this.headers[name]=value;} flushHeaders(){}
 write(line){this.events.push(JSON.parse(line));return !this.blocked;}
 end(){this.ended=true;}
}
const generate=async options=>{await options.consumeAudio((async function*(){yield Buffer.alloc(24000);})(),options.signal);return{text:'Resposta completa.',metrics:{}};};
it('streams bounded PCM records and requires a saved answer before done',async()=>{
 const res=new Response();let saved=false;
 await streamBrowserTurn(res,{},async text=>{assert.equal(text,'Resposta completa.');saved=true;return true;},generate);
 assert.equal(saved,true);assert.equal(res.events.at(-1).type,'done');
 for(const event of res.events.filter(e=>e.type==='audio')){assert.equal(event.sampleRate,16000);assert.ok(Buffer.from(event.pcm,'base64').length<=8192);}
 assert.equal(res.listenerCount('close'),0);assert.equal(res.ended,true);
});
it('failed persistence never reports a completed answer',async()=>{
 const res=new Response();await streamBrowserTurn(res,{},async()=>false,generate);
 assert.equal(res.events.at(-1).type,'error');assert.ok(!res.events.some(e=>e.type==='done'));
});
it('a blocked browser write is cancelled by the turn deadline',async()=>{
 const res=new Response();res.blocked=true;let saved=false;
 await streamBrowserTurn(res,{},async()=>{saved=true;return true;},generate,20);
 assert.equal(saved,false);assert.equal(res.ended,true);assert.equal(res.listenerCount('drain'),0);
});
it('disconnect during a stalled save does not keep the route open',async()=>{
 const res=new Response();let saveStarted;
 const started=new Promise(resolve=>{saveStarted=resolve;});
 const result=streamBrowserTurn(res,{},()=>{saveStarted();return new Promise(()=>{});},generate);
 await started;res.destroyed=true;res.emit('close');await result;
 assert.ok(!res.events.some(e=>e.type==='done'));assert.equal(res.listenerCount('close'),0);
});
