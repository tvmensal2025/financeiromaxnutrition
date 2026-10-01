-- Run after the migration in the SAME transaction, then ROLLBACK.
do $$
declare j public.agent_jobs; t public.tarefas; p jsonb; r jsonb; failed boolean;
begin
 begin
  perform public.gateway_workflow_candidates('maya--biz003',now(),'{}',null,25);
  raise exception 'Specialist incorrectly accepted';
 exception when insufficient_privilege then null; end;
 if has_table_privilege('authenticated','public.agent_workflow_runs','INSERT') then
  raise exception 'Journal incorrectly exposed'; end if;
 select * into j from public.agent_jobs where job_id='JOB-HR-fd62fc9a1659086444127a218432d958';
 select * into t from public.tarefas where task_id=j.task_id;
 if public.gateway_workflow_phase(j) is distinct from 'COORDINATE' then
  raise exception 'Current pilot is not DRAFT'; end if;
 if not exists(select 1 from jsonb_array_elements(public.gateway_workflow_candidates(
  'helena--grupo','2026-09-30T18:43:02.292265+00:00','{}',null,25)->'candidates') v
  where v->>'job_id'=j.job_id) then raise exception 'DRAFT not discovered'; end if;
 p:=jsonb_build_object('action','reserve','job_id',j.job_id,'phase','COORDINATE','fingerprint',repeat('a',64),
  'expected_task_version',t.row_version,'expected_status',j.status,'expected_updated_at',j.updated_at);
 r:=public.gateway_workflow_checkpoint('helena--grupo',p||jsonb_build_object('expected_task_version',-1));
 if r->>'status'<>'STATE_CHANGED' then raise exception 'Stale state accepted'; end if;
 r:=public.gateway_workflow_checkpoint('helena--grupo',p);
 if r->>'reserved' is distinct from 'true' then raise exception 'Reserve failed: %',r->>'status'; end if;
 if public.gateway_workflow_checkpoint('helena--grupo',p)->>'status'<>'UNCHANGED_NO_RETRY' then
  raise exception 'Duplicate accepted'; end if;
 failed:=false;
 begin
  perform public.gateway_workflow_checkpoint('helena--grupo',jsonb_build_object('action','finish',
   'run_id',r->'run'->>'run_id','run_token',r->'run'->>'run_token','status','CONFIRMED'));
 exception when invalid_parameter_value then failed:=true; end;
 if not failed then raise exception 'False success accepted'; end if;
 failed:=false;
 begin
  update public.agent_jobs set status='READY' where job_id=j.job_id;
  update public.agent_jobs set status='CLAIMED' where job_id=j.job_id;
 exception when object_not_in_prerequisite_state then failed:=true; end;
 if not failed then raise exception 'Concurrent producer accepted'; end if;
 perform public.gateway_workflow_checkpoint('helena--grupo',jsonb_build_object('action','finish',
  'run_id',r->'run'->>'run_id','run_token',r->'run'->>'run_token','status','NEEDS_ATTENTION'));
 if public.gateway_workflow_checkpoint('helena--grupo',p)->>'status'<>'UNCHANGED_NO_RETRY' then
  raise exception 'Uncertain paid call incorrectly retried'; end if;
end $$;
select 'PASS: authorization, DRAFT discovery, snapshot, duplicate, uncertain outcome, false success, WIP; all rolled back' as validation;
