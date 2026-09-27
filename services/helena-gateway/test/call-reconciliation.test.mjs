import { it } from 'node:test';
import assert from 'node:assert/strict';
import { reconcilePhoneCalls } from '../src/integrations/call-reconciliation.mjs';
it('cleans stale calls but keeps connected and just-started calls', async () => {
 const ended = [];
 await reconcilePhoneCalls({ now: 100000, listLocal: () => [
 {call_id:'stale',started_at:new Date(0).toISOString()},
 {call_id:'live',started_at:new Date(0).toISOString()},
 {call_id:'new',started_at:new Date(99000).toISOString()}],
 listRemote: async () => [{call_id:'live',status:'CONNECTED'}], endCall: async c => ended.push(c.call_id) });
 assert.deepEqual(ended,['stale']);
});
it('does not close sessions when transport lookup fails', async () => {
 const ended = [];
 await assert.rejects(reconcilePhoneCalls({now:100000,listLocal:()=>[{call_id:'live',started_at:new Date(0).toISOString()}],listRemote:async()=>{throw new Error('offline')},endCall:async c=>ended.push(c)}));
 assert.deepEqual(ended,[]);
});
