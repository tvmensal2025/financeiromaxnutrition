-- Execute inside the deployment transaction. All scenario changes roll back.
do $test$
declare j public.agent_jobs; t public.tarefas; r public.agent_workflow_runs;
 before_run jsonb; before_job jsonb; events_before bigint; payload jsonb; first_result jsonb; candidate jsonb; denied boolean;
begin
 if public.gateway_list_recovery_candidates('helena--grupo',25,null,null)->>'success' is distinct from 'true' then
  raise exception 'Reader failed'; end if;
 denied:=false;
 begin perform public.gateway_list_recovery_candidates('maya--biz003',25,null,null);
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Specialist read accepted'; end if;
 select * into j from public.agent_jobs where job_id='JOB-HR-20b2a6f253ee5c5377e994e8da2b8595';
 select * into t from public.tarefas where task_id=j.task_id;
 select * into r from public.agent_workflow_runs where job_id=j.job_id and phase='HANDOFF' order by started_at desc limit 1;
 if r.run_id is null or j.status<>'COMPLETED' then raise exception 'Completed handoff fixture unavailable'; end if;
 before_run:=to_jsonb(r); before_job:=to_jsonb(j);
 select count(*) into events_before from public.agent_job_events where job_id=j.job_id;
 begin
  update public.agent_workflow_runs set status='NEEDS_ATTENTION',task_version=t.row_version,
   job_updated_at=j.updated_at,diagnostic='UNCONFIRMED_EFFECT' where run_id=r.run_id;
  select value into candidate from jsonb_array_elements(public.gateway_list_recovery_candidates('helena--grupo',25,null,j.created_at)->'candidates')
   where value->>'job_id'=j.job_id;
  if candidate->>'attention_kind' is distinct from 'WORKFLOW_STALLED' then raise exception 'Stalled handoff missing'; end if;
  payload:=jsonb_build_object('job_id',j.job_id,'expected_status',j.status,'expected_updated_at',j.updated_at,
   'idempotency_key','rollback-watchdog-test-20261002');
  denied:=false;
  begin perform public.gateway_record_queue_attention('maya--biz003',payload);
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Specialist write accepted'; end if;
  denied:=false;
  begin perform public.gateway_record_queue_attention('helena--grupo',payload||jsonb_build_object('expected_status','FAILED'));
  exception when serialization_failure then denied:=true; end;
  if not denied then raise exception 'Stale snapshot accepted'; end if;
  first_result:=public.gateway_record_queue_attention('helena--grupo',payload);
  if first_result->>'jobs_changed' is distinct from 'false' then raise exception 'Unexpected mutation'; end if;
  if public.gateway_record_queue_attention('helena--grupo',payload) is distinct from first_result then raise exception 'Replay differs'; end if;
  if (select count(*) from public.agent_job_events where job_id=j.job_id)<>events_before+1 then raise exception 'Duplicate attention'; end if;
  update public.agent_workflow_runs set task_version=t.row_version-1 where run_id=r.run_id;
  if exists(select 1 from jsonb_array_elements(public.gateway_list_recovery_candidates('helena--grupo',25,null,j.created_at)->'candidates')
    where value->>'job_id'=j.job_id) then raise exception 'Historical receipt leaked into current attention'; end if;
  if (select to_jsonb(x) from public.agent_jobs x where job_id=j.job_id) is distinct from before_job then raise exception 'Job changed'; end if;
  raise exception using errcode='Z0001', message='ROLLBACK_SCENARIO';
 exception when sqlstate 'Z0001' then null; end;
 if (select to_jsonb(x) from public.agent_workflow_runs x where run_id=r.run_id) is distinct from before_run
  or (select count(*) from public.agent_job_events where job_id=j.job_id)<>events_before then raise exception 'Scenario escaped rollback'; end if;
end $test$;
