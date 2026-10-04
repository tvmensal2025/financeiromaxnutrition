-- Local integration test after the journal, reader fix and recovery migrations.
-- Harness must SET helena.sql_test_mode='local'; fixtures are always rolled back.
begin;
do $$ begin
 if current_setting('helena.sql_test_mode',true) is distinct from 'local' then
  raise exception 'Local SQL test harness required'; end if;
end $$;
create temporary table review_recovery_checks(label text) on commit drop;
create function pg_temp.check_review_recovery(ok boolean,label text) returns void
language plpgsql as $$ begin
 if ok is distinct from true then raise exception 'FAIL: %',label; end if;
 insert into review_recovery_checks values(label);
end $$;
create function pg_temp.reject_review_recovery(profile text,p jsonb,expected_code text,label text)
returns void language plpgsql as $$ begin
 begin
  perform public.gateway_workflow_checkpoint(profile,p);
 exception when others then
  if sqlstate is distinct from expected_code then raise; end if;
  insert into review_recovery_checks values(label); return;
 end;
 raise exception 'FAIL: accepted %',label;
end $$;

do $$
declare
 j public.agent_jobs; t public.tarefas; old_receipt public.agent_workflow_runs;
 new_receipt public.agent_workflow_runs; p jsonb; q jsonb; response jsonb;
 job_before jsonb; task_before jsonb; events_before jsonb; row_before jsonb;
 field text; value text; busy_status text; reviewer text; test_payload jsonb;
 other_job text:='JOB-HR-'||replace(gen_random_uuid()::text,'-','');
 test_job text:='JOB-HR-'||replace(gen_random_uuid()::text,'-','');
 test_task text:='TSK-QA-REVIEW-'||gen_random_uuid()::text;
begin
 perform pg_temp.check_review_recovery(not exists(select 1 from public.agent_jobs
  where status in ('READY','CLAIMED','RUNNING')) and not exists(select 1
  from public.agent_workflow_runs where status='STARTED' and lease_until>clock_timestamp()),
  'isolated local harness is idle');
 insert into public.tarefas(task_id,business_id,tarefa,status)
 values(test_task,'BIZ-003','Local REVIEW recovery test','NÃO INICIADA') returning * into t;
 insert into public.agent_jobs(job_id,task_id,agent_id,business_id,objective,status,result_payload,
  attempt_count,max_attempts,approval_required,approval_status)
 values(test_job,test_task,'AGT-12','BIZ-003','Local REVIEW recovery test','WAITING_HELENA',
  '{"review_pending":true,"reviewer_agent_id":"AGT-13"}',2,2,true,'PENDING') returning * into j;
 p:=jsonb_build_object('action','reserve','job_id',j.job_id,'phase','REVIEW','fingerprint',repeat('b',64),
  'expected_status',j.status,'expected_task_version',t.row_version,'expected_updated_at',j.updated_at);
 response:=public.gateway_workflow_checkpoint('helena--grupo',p);
 perform pg_temp.check_review_recovery(response->>'reserved'='true','existing reserve still works');
 perform public.gateway_workflow_checkpoint('helena--grupo',jsonb_build_object('action','finish',
  'run_id',response->'run'->>'run_id','run_token',response->'run'->>'run_token',
  'status','NEEDS_ATTENTION','diagnostic','REVIEW_CONTRACT_REJECTED'));
 select * into old_receipt from public.agent_workflow_runs where job_id=test_job;
 perform pg_temp.check_review_recovery(old_receipt.diagnostic='REVIEW_CONTRACT_REJECTED',
  'existing finish stores the review rejection diagnostic');
 perform pg_temp.check_review_recovery(public.gateway_workflow_checkpoint('helena--grupo',p)
  ->>'status'='UNCHANGED_NO_RETRY','ordinary reserve cannot retry failed snapshot');
 p:=p||jsonb_build_object('action','recover','run_id',old_receipt.run_id,'run_token',old_receipt.run_token,
  'repair_version','review-contract-v2','diagnostic','REVIEW_CONTRACT_REJECTED');
 row_before:=to_jsonb(old_receipt);
 foreach field in array array['run_id','run_token','job_id','phase','fingerprint','expected_status',
  'expected_task_version','expected_updated_at','repair_version','diagnostic'] loop
  perform pg_temp.reject_review_recovery('helena--grupo',p-field,'22023','missing '||field);
 end loop;
 perform pg_temp.reject_review_recovery('helena--grupo',p||jsonb_build_object('run_token',gen_random_uuid()),
  '42501','wrong original token');
 perform pg_temp.reject_review_recovery('helena--grupo',p||jsonb_build_object('run_id',gen_random_uuid()),
  '42501','unknown original run');
 perform pg_temp.reject_review_recovery('maya--biz003',p,'42501','specialist excluded');
 perform pg_temp.reject_review_recovery('marina--biz001',p,'42501','cross-business coordinator excluded');
 foreach value in array array['RATE_LIMIT','REVIEW_REJECTED','CONTEXT_CONTRACT_REJECTED',''] loop
  perform pg_temp.reject_review_recovery('helena--grupo',p||jsonb_build_object('diagnostic',value),
   '22023','unknown diagnostic '||value);
 end loop;
 perform pg_temp.reject_review_recovery('helena--grupo',p||'{"repair_version":"review-contract-v3"}',
  '22023','unknown repair version');
 perform pg_temp.reject_review_recovery('helena--grupo',p||'{"phase":"HANDOFF"}',
  '22023','non-REVIEW phase');
 perform pg_temp.reject_review_recovery('helena--grupo',p||'{"expected_status":"COMPLETED"}',
  '22023','non-WAITING_HELENA snapshot');
 foreach field in array array['expected_task_version','expected_updated_at','fingerprint'] loop
  q:=case field when 'expected_task_version' then jsonb_build_object(field,t.row_version+1)
   when 'expected_updated_at' then jsonb_build_object(field,j.updated_at+interval '1 second')
   else jsonb_build_object(field,repeat('c',64)) end;
  response:=public.gateway_workflow_checkpoint('helena--grupo',p||q);
  perform pg_temp.check_review_recovery(response->>'status'='STATE_CHANGED'
   and response->>'reserved'='false','stale caller '||field);
 end loop;
 -- Keep the caller current while making the recorded original snapshot stale.
 foreach field in array array['task_version','job_status','job_updated_at'] loop
  begin
   update public.agent_workflow_runs set
    task_version=case when field='task_version' then task_version+1 else task_version end,
    job_status=case when field='job_status' then 'COMPLETED' else job_status end,
    job_updated_at=case when field='job_updated_at' then job_updated_at+interval '1 second' else job_updated_at end
    where run_id=old_receipt.run_id;
   response:=public.gateway_workflow_checkpoint('helena--grupo',p);
   perform pg_temp.check_review_recovery(response->>'status'='STATE_CHANGED', 'stale original '||field);
   raise no_data_found; -- Roll back this deliberate fixture mutation.
  exception when no_data_found then null; end;
  insert into review_recovery_checks values('stale original '||field);
 end loop;
 foreach value in array array['CONFIRMED','STARTED','RECONCILED'] loop
  begin
   update public.agent_workflow_runs set status=value where run_id=old_receipt.run_id;
   perform pg_temp.reject_review_recovery('helena--grupo',p,'22023','original status '||value);
   raise no_data_found;
  exception when no_data_found then null; end;
  insert into review_recovery_checks values('original status '||value);
 end loop;
 begin
  update public.agent_workflow_runs set diagnostic='UNKNOWN' where run_id=old_receipt.run_id;
  perform pg_temp.reject_review_recovery('helena--grupo',p,'22023','original diagnostic must match');
  raise no_data_found;
 exception when no_data_found then null; end;
 insert into review_recovery_checks values('original diagnostic must match');
 foreach reviewer in array array['AGT-12','FOUNDER','',' '] loop
  begin
   update public.agent_jobs set result_payload=jsonb_build_object('review_pending',true,
    'reviewer_agent_id',reviewer) where job_id=test_job returning * into j;
   update public.agent_workflow_runs set job_updated_at=j.updated_at where run_id=old_receipt.run_id;
   test_payload:=p||jsonb_build_object('expected_updated_at',j.updated_at);
   perform pg_temp.reject_review_recovery('helena--grupo',test_payload,'22023','invalid reviewer '||reviewer);
   raise no_data_found;
  exception when no_data_found then null; end;
  insert into review_recovery_checks values('invalid reviewer '||reviewer);
 end loop;
 begin
  update public.agent_jobs set result_payload='{"review_pending":false,"reviewer_agent_id":"AGT-13"}'
   where job_id=test_job returning * into j;
  update public.agent_workflow_runs set job_updated_at=j.updated_at where run_id=old_receipt.run_id;
  perform pg_temp.reject_review_recovery('helena--grupo',p||jsonb_build_object('expected_updated_at',j.updated_at),
   '22023','review must still be pending');
  raise no_data_found;
 exception when no_data_found then null; end;
 insert into review_recovery_checks values('review must still be pending');
 foreach value in array array['PAUSED','CONFIGURED'] loop
  begin
   update public.agent_runtime_bindings set status=value where profile_slug='helena--grupo';
   perform pg_temp.reject_review_recovery('helena--grupo',p,'42501','inactive coordinator '||value);
   raise no_data_found;
  exception when no_data_found then null; end;
  insert into review_recovery_checks values('inactive coordinator '||value);
 end loop;
 -- Journal busy check and producer overlap use the same existing WIP contract.
 begin
  insert into public.agent_jobs(job_id,task_id,agent_id,business_id,objective,status)
   values(other_job,test_task,'AGT-12','BIZ-003','Local busy fixture','READY');
  response:=public.gateway_workflow_checkpoint('helena--grupo',p);
  perform pg_temp.check_review_recovery(response->>'status'='EXECUTOR_BUSY','READY blocks recovery');
  raise no_data_found;
 exception when no_data_found then null; end;
 insert into review_recovery_checks values('READY blocks recovery');
 begin
  insert into public.agent_workflow_runs(job_id,business_id,phase,fingerprint,task_version,
   job_status,job_updated_at,profile_slug) values(test_job,'BIZ-003','HANDOFF',repeat('d',64),
   old_receipt.task_version,old_receipt.job_status,old_receipt.job_updated_at,'helena--grupo');
  response:=public.gateway_workflow_checkpoint('helena--grupo',p);
  perform pg_temp.check_review_recovery(response->>'status'='EXECUTOR_BUSY','active lease blocks recovery');
  raise no_data_found;
 exception when no_data_found then null; end;
 insert into review_recovery_checks values('active lease blocks recovery');
 select to_jsonb(x) into job_before from public.agent_jobs x where job_id=test_job;
 select to_jsonb(x) into task_before from public.tarefas x where task_id=test_task;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into events_before from public.agent_job_events x;
 select * into old_receipt from public.agent_workflow_runs where run_id=old_receipt.run_id;
 perform pg_temp.check_review_recovery(to_jsonb(old_receipt)=row_before,'all rejected recoveries preserve receipt');
 response:=public.gateway_workflow_checkpoint('marina--biz003',p);
 perform pg_temp.check_review_recovery(response->>'reserved'='true','ACTIVE Marina can recover in business scope');
 select * into new_receipt from public.agent_workflow_runs where run_id=old_receipt.run_id;
 perform pg_temp.check_review_recovery(new_receipt.run_id=old_receipt.run_id
  and new_receipt.fingerprint=old_receipt.fingerprint and new_receipt.recovery_count=1
  and new_receipt.status='STARTED' and new_receipt.run_token<>old_receipt.run_token
  and new_receipt.started_at>old_receipt.started_at
  and new_receipt.lease_until=new_receipt.started_at+interval '10 minutes'
  and new_receipt.finished_at is null and new_receipt.diagnostic is null,'same receipt renewed once');
 perform pg_temp.check_review_recovery(jsonb_array_length(new_receipt.recovery_history)=1
  and new_receipt.recovery_history->0->'original_receipt'=to_jsonb(old_receipt)
  and new_receipt.recovery_history->0->>'repair_version'='review-contract-v2'
  and new_receipt.recovery_history->0->>'recovered_by_profile'='marina--biz003','full original failure and caller audited');
 perform pg_temp.check_review_recovery((select to_jsonb(x) from public.agent_jobs x where job_id=test_job)=job_before
  and (select to_jsonb(x) from public.tarefas x where task_id=test_task)=task_before
  and (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.agent_job_events x)=events_before,
  'job/task/attempts/approvals/events unchanged');
 perform pg_temp.check_review_recovery(exists(select 1 from jsonb_array_elements(
  public.gateway_workflow_checkpoint('helena--grupo','{"action":"list"}')->'runs') x
  where x->>'run_id'=new_receipt.run_id::text and x->>'recovery_count'='1'
  and x->'recovery_history'=new_receipt.recovery_history),'reader fix exposes recovery fields');
 perform pg_temp.reject_review_recovery('helena--grupo',jsonb_build_object('action','finish',
  'run_id',old_receipt.run_id,'run_token',old_receipt.run_token,'status','NEEDS_ATTENTION'),
  '42501','old token cannot finish renewed reservation');
 perform pg_temp.reject_review_recovery('helena--grupo',jsonb_build_object('action','finish',
  'run_id',new_receipt.run_id,'run_token',new_receipt.run_token,'status','CONFIRMED'),
  '22023','renewed reservation still requires confirmed effect');
 response:=public.gateway_workflow_checkpoint('helena--grupo',p);
 perform pg_temp.check_review_recovery(response->>'status'='RECOVERY_LIMIT' and response->>'reserved'='false',
  'original-token replay cannot reserve again');
 perform public.gateway_workflow_checkpoint('helena--grupo',jsonb_build_object('action','finish',
  'run_id',new_receipt.run_id,'run_token',new_receipt.run_token,'status','NEEDS_ATTENTION',
  'diagnostic','REVIEW_CONTRACT_REJECTED'));
 response:=public.gateway_workflow_checkpoint('helena--grupo',p||jsonb_build_object('run_token',new_receipt.run_token));
 perform pg_temp.check_review_recovery(response->>'status'='RECOVERY_LIMIT','second rejection cannot recover twice');
 perform pg_temp.check_review_recovery((select recovery_history from public.agent_workflow_runs
  where run_id=new_receipt.run_id)=new_receipt.recovery_history,'double retry preserves history');
 perform pg_temp.check_review_recovery(not has_table_privilege('authenticated','public.agent_workflow_runs','SELECT')
  and not has_function_privilege('authenticated','public.gateway_workflow_checkpoint(text,jsonb)','EXECUTE'),
  'private journal and coordinator permissions preserved');
end $$;
select count(*) as passed_checks,'PASS: local REVIEW recovery; all fixtures rolled back' as validation
from review_recovery_checks;
rollback;
