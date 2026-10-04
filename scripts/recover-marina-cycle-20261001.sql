-- Founder requested one real end-to-end cycle. Preserve the remaining attempt,
-- the failed execution, and normal coordinator approval. No exhausted job reset.
begin;
do $$
declare j public.agent_jobs%rowtype; t public.tarefas%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('hermes:global-wip',0));
  select * into strict j from public.agent_jobs where job_id='JOB-HR-794692b1e94a8ee7aa1b0f1268b1ed2b' for update;
  if exists(select 1 from public.agent_job_events where job_id=j.job_id and event_type='OPERATOR_CONTROLLED_RETRY' and payload->>'recovery_key'='marina-full-cycle-20261001-v1') then return; end if;
  select * into strict t from public.tarefas where task_id=j.task_id for update;
  if j.status <> 'FAILED' or j.error_code <> 'HERMES_PROCESS_FAILED'
     or j.attempt_count <> 1 or j.max_attempts <> 2
     or j.agent_id <> 'AGT-04' or j.business_id <> 'BIZ-003'
     or j.updated_at <> '2026-10-01T02:51:50.353884+00:00'::timestamptz
     or t.row_version <> 3614 or jsonb_array_length(coalesce(j.evidence_refs,'[]'::jsonb)) <> 0 then
    raise exception 'Recovery preconditions changed; no writes';
  end if;
  if exists(select 1 from public.agent_jobs where status in ('READY','CLAIMED','RUNNING')) then
    raise exception 'Another execution active; no writes';
  end if;
  insert into public.agent_job_events(job_id,agent_id,business_id,event_type,status,message,payload,correlation_id)
    values(j.job_id,'AGT-01',j.business_id,'OPERATOR_CONTROLLED_RETRY','DRAFT',
      'Founder requested a real full cycle. One controlled retry of the same task after installing the bounded runtime and validating its parser, profile resolution and tools. Original startup cause remains unconfirmed; capture diagnostic on failure. Normal coordinator approval still required.',
      jsonb_build_object('recovery_key','marina-full-cycle-20261001-v1','previous_status',j.status,
        'previous_error_code',j.error_code,'previous_error_message',j.error_message,
        'attempt_count_preserved',j.attempt_count,'max_attempts_preserved',j.max_attempts,
        'previous_updated_at',j.updated_at,'model_calls',0,'automatic_retry',false),j.correlation_id);
  update public.agent_jobs set status='DRAFT',approval_status='PENDING',error_code=null,error_message=null,
    claimed_at=null,started_at=null,completed_at=null,available_at=null,updated_at=clock_timestamp()
    where job_id=j.job_id;
  perform public.helena_write_record('tarefas',t.task_id,t.row_version,
    jsonb_build_object('status','BLOQUEADA','bloqueio','Retomada controlada solicitada pelo fundador; aguardando liberacao normal da Helena. Tentativa 1 de 2 preservada; diagnostico de inicializacao ainda nao confirmado.'));
end $$;
select job_id,status,attempt_count,max_attempts from public.agent_jobs where job_id='JOB-HR-794692b1e94a8ee7aa1b0f1268b1ed2b';
commit;
