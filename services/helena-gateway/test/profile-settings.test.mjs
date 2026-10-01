import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProfileStore } from '../src/integrations/profile-store.mjs';
import { createVoiceAdminAuth } from '../src/voice-admin-auth.mjs';
import { DEFAULT_PROFILES_12, getProfile, registerCallSession, getCallSession } from '../src/integrations/call-engine.mjs';
import { handleCallConnectedWebhook, handleUserSilence, getCallHistory } from '../src/integrations/voice-agent.mjs';

test('all profiles greet in Normal and wait for customer before silence nudge', async () => {
  assert.equal(Object.keys(DEFAULT_PROFILES_12).length,12);
  for (const p of Object.values(DEFAULT_PROFILES_12)) {
    assert.equal(p.opening_enabled,false);
    const callId=`silent-${p.profile_key}`;
    registerCallSession({callId,profileKey:p.profile_key,direction:'OUTBOUND'});
    const spoken=[];
    const result=await handleCallConnectedWebhook({call_id:callId},{speak:async args => {spoken.push(args.text);return {ok:true};}});
    assert.equal(result.ok,true);
    assert.equal(spoken.length,1);
    assert.equal(getCallHistory(callId).length,1);
    assert.equal(getCallSession(callId).activeProfileKey,`${p.character_id}_normal`);
    assert.equal((await handleUserSilence({callId})).reason,'waiting_for_customer');
  }
});

test('voice, full script and toggle persist across store reload; reset persists; failed writes do not change runtime',async()=>{
  const rows=new Map([['CALL_PROFILE_VITAL_NORMAL',{chave:'CALL_PROFILE_VITAL_NORMAL',registro_id:1,row_version:1,valor:JSON.stringify(DEFAULT_PROFILES_12.vital_normal)}]]); let version=1; let fail=false;
  const db=async(path,opts)=>{
    if(!opts) return [...rows.values()];
    if(fail) throw new Error('database offline');
    const body=JSON.parse(opts.body); let row;
    if(path.includes('/rpc/')) {
      const old=[...rows.values()].find(r=>String(r.registro_id)===body.p_id);
      assert.equal(old.row_version,body.p_expected_version);
      row={...old,...body.p_changes,row_version:++version};
    } else row={...body,registro_id:rows.size+1,row_version:++version};
    rows.set(row.chave,row); return path.includes('/rpc/')?row:[row];
  };
  const store=createProfileStore(db); const script='Personalidade completa. '.repeat(1800);
  const p=await store.save('vital','normal',{voice_id:'pt-BR-Chirp3-HD-Charon',system_script:script,opening_enabled:true,row_version:1},'test');
  const reload=createProfileStore(db); await reload.load();
  assert.equal(getProfile('vital','normal').system_script,script.trim());
  assert.equal(getProfile('vital','normal').opening_enabled,true);
  await assert.rejects(reload.save('vital','normal',{system_script:'stale',row_version:0},'test'),{status:409});
  fail=true;
  await assert.rejects(reload.save('vital','normal',{system_script:'lost',row_version:p.row_version},'test'));
  assert.equal(getProfile('vital','normal').system_script,script.trim());
  fail=false;
  const reset=await reload.save('vital','normal',{row_version:p.row_version},'test',true);
  assert.equal(reset.opening_enabled,false);
  await createProfileStore(db).load();
  assert.equal(getProfile('vital','normal').system_script,DEFAULT_PROFILES_12.vital_normal.system_script);
});

test('prospect script persists only in the saved Sirlene Normal profile', async()=>{
  const current=getProfile('sirlene','normal');
  const {updateProfile}=await import('../src/integrations/call-engine.mjs');
  updateProfile('sirlene','normal',{prospect_script:'Explique a plataforma e indique somente links oficiais.'},'test');
  assert.match(getProfile('sirlene','normal').prospect_script,/links oficiais/);
  updateProfile('sirlene','normal',{prospect_script:current.prospect_script || ''},'test');
});

for(const [label,valid,admin,status] of [['admin',true,true,200],['expired',false,true,401],['member',true,false,403]]) {
 test(`Max authentication: ${label}`,async()=>{
  const url='https://max.example';const token='x.'+Buffer.from(JSON.stringify({iss:url+'/auth/v1'})).toString('base64url')+'.x';
  const middleware=createVoiceAdminAuth({url,key:'public-test-key',fallback:()=>assert.fail('unexpected fallback'),fetchImpl:async path=>path.endsWith('/user')?{ok:valid,json:async()=>({id:'user-1'})}:{ok:true,json:async()=>admin}});
  let result=0; const res={status(n){result=n;return this;},json(){return this;}};
  await middleware({headers:{authorization:'Bearer '+token},path:'/api/integrations/call-engine/profiles/vital/normal'},res,()=>{result=200});
  assert.equal(result,status);
 });
}
