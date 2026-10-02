-- Same authorized post + story. Pre-generation parameter failure only.
-- Preserve attempt 1/2 and independent approval. Idempotent, exact snapshot guards.
begin;
do $$
declare j public.agent_jobs%rowtype; t public.tarefas%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('hermes:global-wip',0));
  select * into strict j from public.agent_jobs where job_id='JOB-HR-ee3060f449310194fda5b585c192332c' for update;
  if exists(select 1 from public.agent_job_events where job_id=j.job_id and event_type='OPERATOR_CONTROLLED_RETRY' and payload->>'recovery_key'='visual-version-preflight-20261002-v1') then return; end if;
  select * into strict t from public.tarefas where task_id=j.task_id for update;
  if j.status <> 'FAILED' or j.error_code <> 'VISUAL_GENERATION_PARAMETER_REJECTED'
     or j.attempt_count <> 1 or j.max_attempts <> 2
     or j.agent_id <> 'AGT-12' or j.business_id <> 'BIZ-003'
     or j.updated_at <> '2026-10-02T21:04:11.702523+00:00'::timestamptz
     or t.row_version <> 3782 or jsonb_array_length(coalesce(j.evidence_refs,'[]'::jsonb)) <> 0 then
    raise exception 'Recovery preconditions changed; no writes';
  end if;
  if exists(select 1 from public.agent_jobs where status in ('READY','CLAIMED','RUNNING')) then
    raise exception 'Another execution active; no writes';
  end if;
  insert into public.agent_job_events(job_id,agent_id,business_id,event_type,status,message,payload,correlation_id)
    values(j.job_id,'AGT-01',j.business_id,'OPERATOR_CONTROLLED_RETRY','DRAFT',
      'Retomada assistida da mesma tarefa autorizada: Maya usou task.row_version=3781 como versao de imagem. Recusa antes do provedor, zero recibos e arquivos verificados. Adaptador corrigido e 8 testes Linux aprovados. Preservar tentativa 1/2 e liberacao normal da Helena; Nina continua revisora independente. Sem publicacao.',
      jsonb_build_object('recovery_key','visual-version-preflight-20261002-v1','previous_status',j.status,
        'previous_error_code',j.error_code,'previous_error_message',j.error_message,
        'attempt_count_preserved',j.attempt_count,'max_attempts_preserved',j.max_attempts,
        'previous_updated_at',j.updated_at,'model_calls',0,'automatic_retry',false,
        'runtime_sha256','5ad56a45c5c28f6e315ef72b21b82e34fdf05939d5515e4bccfc2ca8675c2f2d'),j.correlation_id);
  update public.agent_jobs set status='DRAFT',approval_status='PENDING',error_code=null,error_message=null,
    claimed_at=null,started_at=null,completed_at=null,available_at=null,updated_at=clock_timestamp()
    where job_id=j.job_id;
  perform public.helena_write_record('tarefas',t.task_id,t.row_version,
    jsonb_build_object('status','BLOQUEADA','bloqueio','Retomada da mesma etapa visual apos corrigir parametro: primeira imagem de cada slot usa version=1, nunca row_version. Tentativa 1/2 preservada; aguardando liberacao normal da Helena.'));
end $$;
select job_id,status,approval_status,attempt_count,max_attempts from public.agent_jobs where job_id='JOB-HR-ee3060f449310194fda5b585c192332c';
commit;
