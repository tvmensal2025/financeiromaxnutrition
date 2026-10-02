-- Run after migration. Every simulated recovery is rolled back, including receipt changes.
begin;
do $test$
declare r public.agent_workflow_runs; j public.agent_jobs; t public.tarefas;
 args jsonb; response jsonb; original_job jsonb; n integer:=0;
begin
 select * into j from public.agent_jobs where job_id='JOB-HR-20b2a6f253ee5c5377e994e8da2b8595';
 select * into t from public.tarefas where task_id=j.task_id;
 select * into r from public.agent_workflow_runs where job_id=j.job_id and phase='REVIEW'
 and task_version=t.row_version and job_updated_at=j.updated_at;
 if r.run_id is null or r.status<>'NEEDS_ATTENTION' or r.recovery_count<>0 then
  raise exception 'Test requires original failed review snapshot'; end if;
 original_job:=to_jsonb(j);
 args:=jsonb_build_object('action','recover','job_id',j.job_id,'phase','REVIEW',
  'run_id',r.run_id,'run_token',r.run_token,'fingerprint',r.fingerprint,
  'expected_task_version',t.row_version,'expected_status',j.status,'expected_updated_at',j.updated_at,
  'diagnostic','REVIEW_CONTRACT_REJECTED','repair_version','review-contract-v2');
 begin
  update public.agent_workflow_runs set diagnostic='REVIEW_CONTRACT_REJECTED' where run_id=r.run_id;
  begin
   perform public.gateway_workflow_checkpoint('nina--biz003',args);
   raise exception 'Specialist unexpectedly recovered';
  exception when insufficient_privilege then n:=n+1; end;
  begin
   perform public.gateway_workflow_checkpoint('helena--grupo',args||jsonb_build_object('diagnostic','TIMEOUT'));
   raise exception 'Unknown failure unexpectedly recovered';
  exception when invalid_parameter_value then n:=n+1; end;
  response:=public.gateway_workflow_checkpoint('helena--grupo',args||jsonb_build_object('expected_task_version',t.row_version+1));
  if response->>'status'<>'STATE_CHANGED' then raise exception 'Stale version accepted'; end if; n:=n+1;
  begin
   perform public.gateway_workflow_checkpoint('helena--grupo',args||jsonb_build_object('run_token',gen_random_uuid()));
   raise exception 'Wrong token accepted';
  exception when insufficient_privilege then n:=n+1; end;
  response:=public.gateway_workflow_checkpoint('helena--grupo',args);
  if response->>'reserved'<>'true' or response->'run'->>'recovery_count'<>'1'
   or jsonb_array_length(response->'run'->'recovery_history')<>1
   or response->'run'->>'run_token'=r.run_token::text then raise exception 'Recovery/history failed: %',response->>'status'; end if;
  n:=n+1;
  if response->'run'->'recovery_history'->0->'original_receipt'->>'status'<>'NEEDS_ATTENTION' then
   raise exception 'Original failure lost'; end if; n:=n+1;
  response:=public.gateway_workflow_checkpoint('helena--grupo',args);
  if response->>'status'<>'RECOVERY_LIMIT' or response->>'reserved'<>'false' then raise exception 'Second recovery accepted'; end if; n:=n+1;
  select * into j from public.agent_jobs where job_id=j.job_id;
  if to_jsonb(j) is distinct from original_job then raise exception 'Job was modified'; end if; n:=n+1;
  raise exception using errcode='PZ001',message='rollback successful test changes';
 exception when sqlstate 'PZ001' then null; end;
 if n<>8 then raise exception 'Incomplete tests: %',n; end if;
 if (select to_jsonb(x) from public.agent_workflow_runs x where x.run_id=r.run_id) is distinct from to_jsonb(r) then
  raise exception 'Test changes escaped rollback'; end if;
 raise notice '8 recovery assertions passed; original receipt and job preserved';
end $test$;
rollback;
