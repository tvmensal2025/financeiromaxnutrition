import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Transform } from 'node:stream';
import { setTimeout as delay } from 'node:timers/promises';
import { createCallWaitCue, warmCallWaitClip, cancelCallWaitCue } from '../src/integrations/call-wait-cue.mjs';

const base = { callId: 'cue-test', speechEpoch: 3, voice: 'pt-BR-Chirp3-HD-Achernar',
  baseUrl: 'http://transport', token: 'fake', delayMs: 5, cooldownMs: 0, getClip: () => Buffer.alloc(1920) };

test('cached Google clip is reused only for the same resolved voice', async () => {
  const voices = [];
  const openTTS = ({ voice }) => {
    voices.push(voice);
    return new Transform({ objectMode: true, transform(input, _, done) {
      assert.equal(input.input.text, 'Hum.');
      this.push({ audioContent: Buffer.alloc(1920) }); done();
    } });
  };
  const [a,b] = await Promise.all([warmCallWaitClip(base.voice,{openTTS}),warmCallWaitClip(base.voice,{openTTS})]);
  assert.equal(a,b); assert.equal(voices.length,1);
  await warmCallWaitClip('pt-BR-Chirp3-HD-Charon',{openTTS});
  assert.equal(voices.length,2);
});

test('cue waits for speech end and reply waits for cue playback, not its upload', async () => {
  let release, requests = 0;
  const done = new Promise(resolve => { release = resolve; });
  const cue = createCallWaitCue({ ...base, fetchImpl: async (_, opts) => {
    requests++; assert.equal(opts.headers['X-Speech-Epoch'],'3');
    return { ok: true, arrayBuffer: () => done };
  } });
  cue.heard('Preciso de ajuda');
  await delay(15); assert.equal(requests,0);
  cue.inputEnded(); await delay(15); assert.equal(requests,1);
  let ready = false;
  const reply = cue.beforeReply().then(() => { ready = true; });
  await delay(10); assert.equal(ready,false);
  release(); await reply; cue.finish();
  assert.equal(cue.metrics.wait_cue_played,true);
});

test('fast reply, silent input, cache miss and changed profile do not play cues', async () => {
  let requests = 0;
  for (const scenario of ['fast','silence','miss','profile']) {
    const cue = createCallWaitCue({ ...base,
      getClip: () => scenario === 'miss' ? null : Buffer.alloc(1920),
      isCurrent: () => scenario !== 'profile', fetchImpl: async () => { requests++; } });
    if (scenario !== 'silence') cue.heard('Olá');
    cue.inputEnded();
    if (scenario === 'fast') await cue.beforeReply();
    await delay(15); cue.finish();
  }
  assert.equal(requests,0);
});

test('barge-in cancels an in-flight cue and a new turn cancels a pending cue', async () => {
  let signal, requests = 0;
  const cue = createCallWaitCue({ ...base, fetchImpl: async (_, opts) => {
    requests++; signal = opts.signal;
    return await new Promise((_,reject) => signal.addEventListener('abort', () => reject(signal.reason), {once:true}));
  } });
  cue.heard('Olá'); cue.inputEnded(); await delay(15);
  cancelCallWaitCue(base.callId); await cue.beforeReply();
  assert.equal(signal.aborted,true);
  const pending = createCallWaitCue({ ...base, fetchImpl: async () => { requests++; } });
  pending.heard('Olá'); pending.inputEnded();
  const next = createCallWaitCue({ ...base, speechEpoch: 4 });
  await delay(15); next.finish();
  assert.equal(requests,1);
});


test('does not repeat a filler on every consecutive turn', async () => {
  let requests=0;
  for (let epoch=1;epoch<=2;epoch++) {
    const cue=createCallWaitCue({...base,callId:'cue-cooldown',speechEpoch:epoch,cooldownMs:10000,
      fetchImpl:async()=>{requests++;return Response.json({ok:true});}});
    cue.heard('Olá');cue.inputEnded();await delay(15);await cue.beforeReply();cue.finish();
  }
  assert.equal(requests,1);
});
