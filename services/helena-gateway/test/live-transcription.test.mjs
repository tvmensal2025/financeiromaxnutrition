import { it } from 'node:test';
import assert from 'node:assert/strict';
import { pcm16To24k, transcribeLivePCM } from '../src/integrations/live-transcription.mjs';

it('resamples complete PCM16 frames from 16 to 24 kHz', () => {
  const source = Buffer.alloc(1920);
  for (let i = 0; i < 960; i++) source.writeInt16LE(i, i * 2);
  const result = pcm16To24k(source);
  assert.equal(result.length, 2880);
  assert.equal(result.readInt16LE(0), 0);
  assert.equal(result.readInt16LE(2), 1);
});

it('sends audio before commit and consumes the final live transcript', async () => {
  let audioBeforeCommit = 0, ended = false;
  class FakeSocket extends EventTarget {
    constructor(url, options) {
      super();
      assert.match(url, /intent=transcription/);
      assert.equal(options.headers.Authorization, 'Bearer test');
      queueMicrotask(() => this.dispatchEvent(new Event('open')));
    }
    send(raw) {
      const event = JSON.parse(raw);
      if (event.type === 'session.update') {
        assert.equal(event.session.audio.input.transcription.model, 'gpt-live-transcribe');
        queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ type: 'session.updated' }) })));
      }
      if (event.type === 'input_audio_buffer.append') audioBeforeCommit++;
      if (event.type === 'input_audio_buffer.commit') {
        assert.ok(audioBeforeCommit >= 2);
        assert.equal(ended, true);
        queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({
          type: 'conversation.item.input_audio_transcription.completed', transcript: 'Olá, preciso de ajuda.'
        }) })));
      }
    }
    close() {}
  }
  async function* audio() {
    yield Buffer.alloc(1921);
    yield Buffer.alloc(1919);
  }
  const result = await transcribeLivePCM(audio(), { apiKey: 'test', WebSocketImpl: FakeSocket, onInputEnd: () => { ended = true; } });
  assert.equal(result.text, 'Olá, preciso de ajuda.');
  assert.equal(result.metrics.audio_bytes, 3840);
  assert.ok(result.metrics.input_ended_at > 0);
  assert.ok(result.metrics.stt_after_commit_ms <= result.metrics.stt_final_ms);
});

class ReadySocket extends EventTarget {
 constructor() { super(); queueMicrotask(() => this.dispatchEvent(new Event('open'))); }
 send(raw) {
  const event=JSON.parse(raw);
  if(event.type==='session.update') queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({type:'session.updated'})})));
 }
 close() { this.closed=true; }
}
it('deadline rejects even while the PCM iterator is stalled', async()=>{
 let socket, returned=false;
 class Socket extends ReadySocket { constructor(...args){super(...args);socket=this;} }
 const stalled={ [Symbol.asyncIterator](){return this;},next(){return new Promise(()=>{});},return(){returned=true;return Promise.resolve({done:true});} };
 await assert.rejects(transcribeLivePCM(stalled,{apiKey:'fake',WebSocketImpl:Socket,timeoutMs:25}),/Timeout/);
 assert.equal(socket.closed,true);assert.equal(returned,true);
});
it('abort rejects a stalled microphone and closes transcription immediately', async()=>{
 const abort=new AbortController();let socket;
 class Socket extends ReadySocket {constructor(...args){super(...args);socket=this;}}
 const stalled={async *[Symbol.asyncIterator](){await new Promise(()=>{});}};
 const result=transcribeLivePCM(stalled,{apiKey:'fake',WebSocketImpl:Socket,signal:abort.signal});
 const assertion=assert.rejects(result,/interrupted/);
 setTimeout(()=>abort.abort(new Error('interrupted')),10);await assertion;assert.equal(socket.closed,true);
});
it('provider transcription failure is surfaced instead of waiting for the deadline',async()=>{
 class Socket extends ReadySocket {
  send(raw){super.send(raw);if(JSON.parse(raw).type==='input_audio_buffer.commit') queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({type:'conversation.item.input_audio_transcription.failed'})})));}
 }
 await assert.rejects(transcribeLivePCM((async function*(){yield Buffer.alloc(3840);})(),{apiKey:'fake',WebSocketImpl:Socket}),/Falha na transcrição/);
});
it('an already cancelled turn never opens a provider socket',async()=>{
 let opened=false;const abort=new AbortController();abort.abort(new Error('cancelled'));
 class Socket extends ReadySocket{constructor(){super();opened=true;}}
 await assert.rejects(transcribeLivePCM([],{apiKey:'fake',WebSocketImpl:Socket,signal:abort.signal}),/cancelled/);assert.equal(opened,false);
});
it('real ws handshake carries server Authorization headers',async()=>{
 const {WebSocketServer,default:Socket}=await import('ws');
 const server=new WebSocketServer({port:0,host:'127.0.0.1'});
 await new Promise(resolve=>server.once('listening',resolve));
 const address=server.address();let authorization;
 server.on('connection',(socket,request)=>{
  authorization=request.headers.authorization;
  socket.on('message',raw=>{
   const event=JSON.parse(raw);
   if(event.type==='session.update')socket.send(JSON.stringify({type:'session.updated'}));
   if(event.type==='input_audio_buffer.commit')socket.send(JSON.stringify({type:'conversation.item.input_audio_transcription.completed',transcript:'sim'}));
  });
 });
 class LocalSocket extends Socket{constructor(_url,options){super(`ws://127.0.0.1:${address.port}`,options);}}
 try {
  const result=await transcribeLivePCM((async function*(){yield Buffer.alloc(3840);})(),{apiKey:'local-test-only',WebSocketImpl:LocalSocket});
  assert.equal(authorization,'Bearer local-test-only');assert.equal(result.text,'sim');
 } finally {for(const client of server.clients)client.terminate();await new Promise(resolve=>server.close(resolve));}
});

it('limits connection setup separately from the complete speech turn', async () => {
  let closed = false;
  class SilentSocket extends EventTarget {
    send() {}
    close() { closed = true; }
  }
  await assert.rejects(transcribeLivePCM((async function* () { yield Buffer.alloc(3840); })(), {
    apiKey: 'fake', WebSocketImpl: SilentSocket, readyTimeoutMs: 20, timeoutMs: 250,
  }), error => error.code === 'stt_connect_timeout');
  assert.equal(closed, true);
});

it('limits the final transcript wait after commit instead of spending the full turn budget', async () => {
  await assert.rejects(transcribeLivePCM((async function* () { yield Buffer.alloc(3840); })(), {
    apiKey: 'fake', WebSocketImpl: ReadySocket, finalTimeoutMs: 20, timeoutMs: 250,
  }), error => error.code === 'stt_final_timeout' && error.transcriptionMetrics?.audio_bytes === 3840);
});

it('does not spend the final transcript budget while the customer is still speaking', async () => {
  class CompletedSocket extends ReadySocket {
    send(raw) {
      super.send(raw);
      if (JSON.parse(raw).type === 'input_audio_buffer.commit') queueMicrotask(() => this.dispatchEvent(
        new MessageEvent('message', { data: JSON.stringify({
          type: 'conversation.item.input_audio_transcription.completed', transcript: 'sim',
        }) }),
      ));
    }
  }
  const result = await transcribeLivePCM((async function* () {
    yield Buffer.alloc(1920);
    await new Promise(resolve => setTimeout(resolve, 40));
    yield Buffer.alloc(1920);
  })(), { apiKey: 'fake', WebSocketImpl: CompletedSocket, finalTimeoutMs: 15 });
  assert.equal(result.text, 'sim');
  assert.ok(result.metrics.stt_session_ready_ms >= 0);
  assert.ok(result.metrics.stt_input_stream_ms >= 30);
});
