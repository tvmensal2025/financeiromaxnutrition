-- Transactional integration test against the actual schema. Never commits.
begin;
set local statement_timeout='15s';
do $$
declare
  r jsonb; replay jsonb; child jsonb; other jsonb; payload jsonb;
  j text; t text; v bigint; n integer; claimed public.agent_jobs;
begin
  if has_function_privilege('anon','public.gateway_workflow(text,text,jsonb)','EXECUTE') or has_function_privilege('authenticated','public.gateway_workflow(text,text,jsonb)','EXECUTE') then raise exception 'RPC exposed'; end if;
  begin
    perform public.gateway_workflow('pedro--biz003','context');
    raise exception 'inactive profile accepted';
  exception when insufficient_privilege then null; end;
  update public.agent_runtime_bindings set status='ACTIVE',activation_reference='ROLLBACK TEST ONLY',activated_at=clock_timestamp()
    where profile_slug in ('helena--grupo','marina--biz003','pedro--biz003','clara--biz003','victor--biz003','camila--biz003');
  r:=public.gateway_workflow('marina--biz003','context');
  if r->'checkpoint'->>'checkpoint_id' is null then raise exception 'checkpoint missing'; end if;
  payload:=jsonb_build_object('target_agent_id','AGT-18','business_id','BIZ-003','objective','ROLLBACK integration fixture','definition_of_done','Evidence and review','idempotency_key','rollback-create');
  r:=public.gateway_workflow('marina--biz003','create_task',payload);
  replay:=public.gateway_workflow('marina--biz003','create_task',payload);
  if r<>replay then raise exception 'non-idempotent create'; end if;
  begin
    perform public.gateway_workflow('marina--biz003','create_task',payload||'{"objective":"Different"}');
    raise exception 'mismatched replay accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.gateway_workflow('marina--biz003','create_task',payload||'{"business_id":"BIZ-001","idempotency_key":"rollback-cross"}');
    raise exception 'cross-business write accepted';
  exception when insufficient_privilege then null; end;
  j:=r->>'job_id'; t:=r->>'task_id';
  select row_version into v from public.tarefas where task_id=t;
  perform public.gateway_workflow('marina--biz003','release_job',jsonb_build_object('job_id',j,'expected_task_version',v,'idempotency_key','rollback-release'));
  -- All calls share a transaction here; legacy claim compares transaction now().
  update public.agent_jobs set available_at=now() where job_id=j;
  claimed:=public.gateway_claim_agent_job(j,'AGT-18');
  if claimed.status is distinct from 'CLAIMED' then raise exception 'claim failed'; end if;
  claimed:=public.gateway_claim_agent_job(j,'AGT-18');
  if claimed.job_id is not null then raise exception 'double claim'; end if;
  perform public.gateway_start_agent_job(j,'AGT-18');
  if (select status from public.tarefas where task_id=t) is distinct from 'EM EXECUÇÃO' then raise exception 'task did not start'; end if;
  perform public.gateway_record_agent_progress(j,'AGT-18','fixture','Prepared evidence','Verify pipeline','Submit for review','["fixture:evidence"]','{"profile_slug":"pedro--biz003"}');
  payload:=jsonb_build_object('job_id',j,'idempotency_key','rollback-memory','summary','Fixture only','source','fixture:evidence','next_step','Review');
  r:=public.gateway_workflow('pedro--biz003','record_memory',payload);
  replay:=public.gateway_workflow('pedro--biz003','record_memory',payload);
  if r<>replay then raise exception 'memory duplicated'; end if;
  payload:=jsonb_build_object('job_id',j,'expected_task_version',v,'idempotency_key','rollback-delivery','summary','Fixture delivered','evidence_refs',jsonb_build_array('fixture:evidence'));
  begin
    perform public.gateway_workflow('pedro--biz003','submit_delivery',payload);
    raise exception 'stale version accepted';
  exception when serialization_failure then null; end;
  select row_version into v from public.tarefas where task_id=t;
  payload:=payload||jsonb_build_object('expected_task_version',v);
  r:=public.gateway_workflow('pedro--biz003','submit_delivery',payload);
  if r->>'reviewer_agent_id'<>'AGT-06' or r->>'completed'<>'false' then raise exception 'wrong review routing'; end if;
  replay:=public.gateway_workflow('pedro--biz003','submit_delivery',payload);
  if r<>replay then raise exception 'delivery replay failed'; end if;
  select row_version into v from public.tarefas where task_id=t;
  payload:=jsonb_build_object('job_id',j,'expected_task_version',v,'idempotency_key','rollback-review','decision','APPROVE','reason','Fixture references checked');
  begin
    perform public.gateway_workflow('pedro--biz003','review_delivery',payload);
    raise exception 'self-review accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.gateway_workflow('camila--biz003','review_delivery',payload);
    raise exception 'wrong reviewer accepted';
  exception when insufficient_privilege then null; end;
  r:=public.gateway_workflow('clara--biz003','review_delivery',payload);
  if r->>'completed'<>'true' or (select status from public.tarefas where task_id=t)<>'CONCLUÍDA' then raise exception 'review did not synchronize task'; end if;
  if exists(select 1 from public.handoffs where related_object_id=j and status<>'CONCLUÍDO') then raise exception 'handoff not closed'; end if;
  select row_version into v from public.tarefas where task_id=t;
  payload:=jsonb_build_object('job_id',j,'expected_task_version',v,'idempotency_key','rollback-handoff','target_agent_id','AGT-15','objective','Fixture next stage','definition_of_done','Reviewed next delivery');
  child:=public.gateway_workflow('pedro--biz003','handoff',payload);
  if child->>'status'<>'DRAFT' then raise exception 'handoff starts work automatically'; end if;
  replay:=public.gateway_workflow('pedro--biz003','handoff',payload);
  if child<>replay then raise exception 'handoff duplicated'; end if;
  begin
    perform public.gateway_workflow('pedro--biz003','handoff',payload||'{"idempotency_key":"rollback-handoff-other"}');
    raise exception 'multiple downstream tasks accepted';
  exception when invalid_parameter_value then null; end;
  other:=public.gateway_workflow('marina--biz003','create_task','{"target_agent_id":"AGT-16","business_id":"BIZ-003","objective":"WIP fixture","definition_of_done":"Test","idempotency_key":"rollback-wip"}');
  select row_version into v from public.tarefas where task_id=other->>'task_id';
  perform public.gateway_workflow('marina--biz003','release_job',jsonb_build_object('job_id',other->>'job_id','expected_task_version',v,'idempotency_key','rollback-wip-release'));
  select row_version into v from public.tarefas where task_id=child->>'task_id';
  begin
    perform public.gateway_workflow('marina--biz003','release_job',jsonb_build_object('job_id',child->>'job_id','expected_task_version',v,'idempotency_key','rollback-child-release'));
    raise exception 'WIP exceeded';
  exception when invalid_parameter_value then null; end;
  update public.agent_jobs set attempt_count=2,available_at=now() where job_id=other->>'job_id';
  begin
    perform public.gateway_claim_agent_job(other->>'job_id','AGT-16');
    raise exception 'attempt cap ignored';
  exception when invalid_parameter_value then null; end;
end;
$$;
select 'PASS: create, replay, conflict, company, claim, progress, memory, review, handoff, WIP, attempts, ACL' as verification;
rollback;
