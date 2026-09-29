import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTypeSafe, TYPESAFE_MODEL, validateTypeSafeResponse } from '../src/integrations/typesafe.mjs';
import { workflowTools } from '../src/workflow.mjs';
import { BRIEF_SECTIONS } from '../src/brief-contract.mjs';

const response = () => ({ model: TYPESAFE_MODEL, usage: { input_tokens: 2000, output_tokens: 10 }, answers: {
  role_fit: { type:'choice', choice:'MATCH', confidence:0.99, probabilities:{ MATCH:0.99, MISMATCH:0.005, UNCLEAR:0.005 } },
  brief_congruence: { type:'choice', choice:'COHERENT', confidence:0.99, probabilities:{ COHERENT:0.99, CONFLICT:0.005, UNCLEAR:0.005 } },
  needs_clarification: { type:'noul', noul:0.01 },
  complexity: { type:'choice', choice:'MODERATE', confidence:0.95, probabilities:{ SIMPLE:0.02, MODERATE:0.95, COMPLEX:0.02, UNCLEAR:0.01 } }
}});
const identity = { type:'hermes_profile', profileSlug:'marina--biz003', bindingVerified:true, agentId:'AGT-04', businessId:'BIZ-003' };
const args = { job_id:'job-1', expected_task_version:1, idempotency_key:'release-1' };
const detail = () => ({
  job: { job_id:'job-1', task_id:'task-1', business_id:'BIZ-003', agent_id:'AGT-16', status:'DRAFT',
    objective:'Preparar copy educativa interna', instruction:BRIEF_SECTIONS.map((s,i) => `## ${s}\nEtapa ${i}: preparar uma proposta educativa interna, com fonte e escopo documentados, sem publicar ou prometer renda.`).join('\n') },
  task: { task_id:'task-1', business_id:'BIZ-003', row_version:1, definicao_de_pronto:'Copy interna com fonte e encaminhamento para revisao.' },
  runtime_binding: { agent_id:'AGT-16', business_id:'BIZ-003' },
  evidence_records:[{ segredo:'NAO_ENVIAR' }], input_evidence_records:[], input_evidence_missing:[]
});

function harness(options = {}) {
  const events = options.events || new Map();
  let current = detail();
  const requests = [];
  const read = async (path, init) => {
    if (options.auditDown) throw new Error('secret-provider-error');
    if (path.includes('/agentes?')) return [{ agente:'Camila', cargo_funcao:'Marketing e Growth', missao:'Preparar campanhas educativas.' }];
    if (init?.method === 'POST') {
      const event = JSON.parse(init.body);
      if (events.has(event.event_id)) return [];
      events.set(event.event_id,event); return [event];
    }
    const id = /event_id=eq\.([^&]+)/.exec(path)?.[1];
    return events.has(id) ? [events.get(id)] : [];
  };
  const env = { TYPESAFE_MODE:'shadow', TYPESAFE_API_KEY:'test-only-secret', TYPESAFE_BUSINESS_IDS:'BIZ-003', TYPESAFE_DAILY_LIMIT:'10', ...options.env };
  const service = createTypeSafe({ read, readJob:async () => current, env,
    now:() => Date.parse('2026-09-29T12:00:00Z'), fetchImpl:async (url, init) => {
      requests.push({url,init});
      if (options.mutate) current = { ...current, task:{...current.task,row_version:2} };
      if (options.error) throw options.error;
      return new Response(JSON.stringify(options.data || response()), {status:options.http || 200});
    }});
  return { service, events, requests, get current(){return current;}, set current(v){current=v;} };
}

test('TypeSafe off or missing key never calls provider or writes audit', async () => {
  for (const env of [{TYPESAFE_MODE:'off'},{TYPESAFE_API_KEY:''},{TYPESAFE_BUSINESS_IDS:''},{TYPESAFE_DAILY_LIMIT:'NaN'},{TYPESAFE_MODE:'enforce'}]) {
    const h=harness({env}); await h.service.evaluate(h.current,args,identity);
    assert.equal(h.requests.length,0); assert.equal(h.events.size,0); assert.equal(h.service.publicStatus().configured,false);
    assert.ok(!JSON.stringify(h.service.publicStatus()).includes('test-only-secret'));
  }
});
test('TypeSafe batches four questions and sends only whitelisted task context', async () => {
  const h=harness(); const out=await h.service.evaluate(h.current,args,identity);
  assert.equal(out.status,'EVALUATED'); assert.equal(out.recommendation,'NO_ISSUE_DETECTED');
  assert.equal(h.requests.length,1); assert.equal(h.events.size,3);
  const payload=JSON.parse(h.requests[0].init.body);
  assert.equal(Object.keys(payload.questions).length,4); assert.equal(payload.model,TYPESAFE_MODEL);
  assert.equal(out.model_route.model,'gpt-6-sol');
  assert.ok(!h.requests[0].init.body.includes('NAO_ENVIAR')); assert.ok(!JSON.stringify([...h.events.values()]).includes('test-only-secret'));
  assert.ok(!JSON.stringify([...h.events.values()]).includes('Preparar copy'));
  assert.ok(out.estimated_cost_usd > 0);
});
test('repeated release and process restart reuse persisted result without provider call', async () => {
  const h=harness(); const a=await h.service.evaluate(h.current,args,identity);
  const restarted=harness({events:h.events}); const b=await restarted.service.evaluate(restarted.current,{...args,idempotency_key:'different-key'},identity);
  assert.deepEqual(b,a); assert.equal(restarted.requests.length,0);
});
test('concurrent instances reserve one call for the same immutable briefing', async () => {
  const a=harness(); const b=harness({events:a.events});
  await Promise.all([a.service.evaluate(a.current,args,identity),b.service.evaluate(b.current,args,identity)]);
  assert.equal(a.requests.length+b.requests.length,1);
});
test('shared daily slots cap calls across processes and different jobs', async () => {
  const a=harness({env:{TYPESAFE_DAILY_LIMIT:'1'}}); await a.service.evaluate(a.current,args,identity);
  const b=harness({events:a.events,env:{TYPESAFE_DAILY_LIMIT:'1'}});
  b.current={...b.current,job:{...b.current.job,job_id:'job-2'}};
  const result=await b.service.evaluate(b.current,{...args,job_id:'job-2'},identity);
  assert.equal(result.status,'DAILY_LIMIT'); assert.equal(b.requests.length,0);
});
test('scope and version violations cannot disclose a task or spend tokens', async () => {
  for (const caller of [{...identity,agentId:'AGT-16'}, {...identity,businessId:'BIZ-002'}, {...identity,bindingVerified:false}]) {
    const h=harness(); await assert.rejects(h.service.evaluate(h.current,args,caller),/escopo/); assert.equal(h.requests.length,0);
  }
  const h=harness(); await assert.rejects(h.service.evaluate(h.current,{...args,expected_task_version:2},identity),/versao/); assert.equal(h.requests.length,0);
});
test('changed task during provider call rejects release', async () => {
  const h=harness({mutate:true}); await assert.rejects(h.service.evaluate(h.current,args,identity),/alterada/); assert.equal(h.requests.length,1);
});
test('provider failure is recorded once, redacted, and never automatically retried', async () => {
  for (const options of [{http:401},{http:429},{http:529},{error:new Error('test-only-secret')},{error:new DOMException('failed','TimeoutError')}]) {
    const h=harness(options); const result=await h.service.evaluate(h.current,args,identity);
    assert.notEqual(result.status,'EVALUATED'); assert.ok(!JSON.stringify(result).includes('test-only-secret'));
    await h.service.evaluate(h.current,args,identity); assert.equal(h.requests.length,1);
  }
});
test('missing audit, excessive input and credential-like content cannot call provider', async () => {
  const down=harness({auditDown:true}); assert.equal((await down.service.evaluate(down.current,args,identity)).status,'AUDIT_UNAVAILABLE');
  assert.equal(down.requests.length,0);
  for (const [text,status] of [['x'.repeat(18000),'INPUT_TOO_LARGE'],['Bearer sensitive-value','SENSITIVE_INPUT']]) {
    const h=harness(); h.current.job.instruction=text;
    assert.equal((await h.service.evaluate(h.current,args,identity)).status,status); assert.equal(h.requests.length,0);
  }
});
test('invalid probability, missing answers, usage and model changes are rejected', () => {
  for (const change of [r=>r.answers.role_fit.confidence=2,r=>r.answers.role_fit.probabilities.MATCH=0,
    r=>delete r.answers.needs_clarification,r=>r.model='jev-latest',r=>r.usage.input_tokens=-1,
    r=>r.answers.brief_congruence.choice='UNKNOWN',r=>r.answers.needs_clarification.noul='0.1']) {
    const r=response(); change(r); assert.throws(()=>validateTypeSafeResponse(r));
  }
});
test('uncertainty recommends manager review without granting approval', () => {
  const r=response(); r.answers.needs_clarification.noul=0.7;
  const out=validateTypeSafeResponse(r); assert.equal(out.recommendation,'REVIEW_WITH_MANAGER'); assert.equal(out.approved,undefined);
  assert.equal(out.model_route.model,null);
});
test('Jev complexity maps to the approved model only with sufficient confidence', () => {
  for (const [tier, model] of [['SIMPLE','gpt-6-luna'],['MODERATE','gpt-6-sol'],['COMPLEX','gpt-6-astra']]) {
    const r=response(); r.answers.complexity.choice=tier;
    r.answers.complexity.probabilities={ SIMPLE:0.01, MODERATE:0.01, COMPLEX:0.01, UNCLEAR:0.01 };
    r.answers.complexity.probabilities[tier]=0.97; r.answers.complexity.confidence=0.97;
    assert.equal(validateTypeSafeResponse(r).model_route.model,model);
  }
  const r=response(); r.answers.complexity.confidence=0.79;
  r.answers.complexity.probabilities={ SIMPLE:0.07, MODERATE:0.79, COMPLEX:0.07, UNCLEAR:0.07 };
  assert.equal(validateTypeSafeResponse(r).model_route.model,null);
});
test('workflow validates briefing before Jev, keeps shadow advisory and returns audit summary', async () => {
  const h=harness(); let calls=0;
  const tools=workflowTools(async()=>{calls++;return {success:true,status:'READY'};},async()=>h.current,h.service.evaluate);
  h.current.job.instruction='raso';
  await assert.rejects(tools.release_job.handler(args,{identity}),/Briefing profissional/);
  assert.equal(h.requests.length,0); assert.equal(calls,0);
  h.current=detail(); const result=await tools.release_job.handler(args,{identity});
  assert.equal(result.status,'READY'); assert.equal(result.typesafe.status,'EVALUATED'); assert.equal(calls,1);
});
test('a stale task prevents workflow RPC even after a valid Jev answer', async () => {
  const h=harness({mutate:true}); let calls=0;
  const tools=workflowTools(async()=>{calls++; return {success:true};},async()=>h.current,h.service.evaluate);
  await assert.rejects(tools.release_job.handler(args,{identity}),/alterada/); assert.equal(calls,0);
});
