import { it } from 'node:test';
import assert from 'node:assert/strict';
import { reconcilePhoneCalls } from '../src/integrations/call-reconciliation.mjs';
it('cleans stale calls but keeps connected and just-started calls', async () => {
 const ended = [];
 const listLocal = () => [
  {call_id:'stale-confirmed',started_at:new Date(0).toISOString()},
  {call_id:'live',started_at:new Date(0).toISOString()},
  {call_id:'new',started_at:new Date(99000).toISOString()}];
 const options = { listLocal, listRemote: async () => [{call_id:'live',status:'CONNECTED'}], endCall: async c => ended.push(c.call_id) };

 await reconcilePhoneCalls({ ...options, now: 100000 });
 assert.deepEqual(ended, [], 'one missing snapshot must not close the session');

 await reconcilePhoneCalls({ ...options, now: 115000 });
 assert.deepEqual(ended,['stale-confirmed']);
});
it('forgets a missing snapshot when the remote call reappears', async () => {
 const ended = [];
 const listLocal = () => [{call_id:'reappearing-call',started_at:new Date(0).toISOString()}];
 const endCall = async call => ended.push(call.call_id);

 await reconcilePhoneCalls({ now: 200000, listLocal, listRemote: async () => [], endCall });
 await reconcilePhoneCalls({ now: 210000, listLocal, listRemote: async () => [{call_id:'reappearing-call',status:'CONNECTED'}], endCall });
 await reconcilePhoneCalls({ now: 225000, listLocal, listRemote: async () => [], endCall });
 assert.deepEqual(ended, [], 'a reappearing call must reset the prior miss count');
 await reconcilePhoneCalls({ now: 230000, listLocal, listRemote: async () => [], endCall });
 assert.deepEqual(ended, [], 'two misses less than 15 seconds apart must not close the session');

 await reconcilePhoneCalls({ now: 240000, listLocal, listRemote: async () => [], endCall });
 assert.deepEqual(ended, ['reappearing-call']);
});
it('does not close sessions when transport lookup fails', async () => {
 const ended = [];
 await assert.rejects(reconcilePhoneCalls({now:100000,listLocal:()=>[{call_id:'live',started_at:new Date(0).toISOString()}],listRemote:async()=>{throw new Error('offline')},endCall:async c=>ended.push(c)}));
 assert.deepEqual(ended,[]);
});
it('does not apply an old remote snapshot to a replacement session', async () => {
 const ended = [];
 let local = {call_id:'reused-during-lookup',call_instance_id:'old-instance',started_at:new Date(0).toISOString()};
 const options = {listLocal:()=>[local],endCall:async call=>ended.push(call.call_id)};
 await reconcilePhoneCalls({...options,now:100000,listRemote:async()=>[]});
 await reconcilePhoneCalls({...options,now:115000,listRemote:async()=>{
  local = {...local,call_instance_id:'replacement-instance',started_at:new Date(114000).toISOString()};
  return [];
 }});
 assert.deepEqual(ended,[]);
});
it('requires two missing snapshots for each instance when the transport ID is reused', async () => {
 const ended = [];
 let local = {call_id:'reused-between-lookups',call_instance_id:'original',started_at:new Date(0).toISOString()};
 const options = {listLocal:()=>[local],listRemote:async()=>[],endCall:async call=>ended.push(call.call_id)};
 await reconcilePhoneCalls({...options,now:100000});
 local = {...local,call_instance_id:'replacement',started_at:new Date(110000).toISOString()};
 await reconcilePhoneCalls({...options,now:150000});
 assert.deepEqual(ended,[],'the prior instance must not count as the first missing snapshot');
 await reconcilePhoneCalls({...options,now:165000});
 assert.deepEqual(ended,['reused-between-lookups']);
});
it('keeps a session active when the transport reports its alternate call ID', async () => {
 const ended = [];
 const options = {
  listLocal:()=>[{call_id:'primary-call',call_instance_id:'alias-session',call_aliases:['PRIMARY-CALL','TRANSPORT-CALL'],started_at:new Date(0).toISOString()}],
  listRemote:async()=>[{call_id:'transport-call',status:'CONNECTED'}],
  endCall:async call=>ended.push(call.call_id)
 };
 await reconcilePhoneCalls({...options,now:100000});
 await reconcilePhoneCalls({...options,now:115000});
 assert.deepEqual(ended,[]);
});
it('ignores a delayed missing snapshot after a newer snapshot found the call active', async () => {
 const ended = [];
 const options = {
  listLocal:()=>[{call_id:'out-of-order-call',call_instance_id:'ordered-session',started_at:new Date(0).toISOString()}],
  endCall:async call=>ended.push(call.call_id)
 };
 await reconcilePhoneCalls({...options,now:100000,listRemote:async()=>[]});
 let releaseOldSnapshot;
 const delayed = reconcilePhoneCalls({...options,now:115000,listRemote:()=>new Promise(resolve=>{releaseOldSnapshot=resolve;})});
 await reconcilePhoneCalls({...options,now:116000,listRemote:async()=>[{call_id:'out-of-order-call',status:'CONNECTED'}]});
 releaseOldSnapshot([]);
 await delayed;
 await reconcilePhoneCalls({...options,now:132000,listRemote:async()=>[]});
 assert.deepEqual(ended,[],'a delayed snapshot must not restore the absence reset by the newer snapshot');
 await reconcilePhoneCalls({...options,now:147000,listRemote:async()=>[]});
 assert.deepEqual(ended,['out-of-order-call']);
});
