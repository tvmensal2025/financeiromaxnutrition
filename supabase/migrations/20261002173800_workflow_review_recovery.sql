-- One audited REVIEW contract repair per original journal snapshot.
-- Only the journal receipt changes; task/job state and execution permissions do not.
begin;
alter table public.agent_workflow_runs
 add column recovery_count integer not null default 0
  check (recovery_count in (0,1)),
 add column recovery_history jsonb not null default '[]'::jsonb
  check (jsonb_typeof(recovery_history)='array'),
 add constraint agent_workflow_runs_recovery_history_count
  check (jsonb_array_length(recovery_history)=recovery_count);

-- Copy the reader-fixed function explicitly, preserving all existing actions.
create or replace function public.gateway_workflow_checkpoint(p_profile_slug text,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare b public.agent_runtime_bindings; j public.agent_jobs; t public.tarefas; r public.agent_workflow_runs;
 action text:=p_payload->>'action'; v_phase text:=p_payload->>'phase'; changed boolean;
 recovered_at timestamptz;
begin
 if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>4096 then
  raise exception 'Registro invalido' using errcode='22023'; end if;
 select * into b from public.agent_runtime_bindings where profile_slug=p_profile_slug for share;
 if not found or b.status<>'ACTIVE' or b.provider<>'HERMES' or b.agent_id not in ('AGT-01','AGT-04')
 or not (b.scope_type='BUSINESS' or (b.scope_type='GROUP' and b.agent_id='AGT-01')) then
  raise exception 'Coordenacao ativa obrigatoria' using errcode='42501'; end if;
 if action='list' then
  return jsonb_build_object('success',true,'runs',coalesce((select jsonb_agg(to_jsonb(x)) from (
   select q.* from public.agent_workflow_runs q where q.status in ('STARTED','NEEDS_ATTENTION')
   and ((b.scope_type='GROUP' and b.agent_id='AGT-01') or q.business_id=b.business_id)
   and (p_payload->>'after_run_id' is null or q.run_id>(p_payload->>'after_run_id')::uuid)
   order by q.run_id limit 100) x),'[]'::jsonb));
 end if;
 if action='reserve' then
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('hermes:global-wip',0)) then
   raise exception 'WIP 1: transicao concorrente; reconciliar estado' using errcode='55000';
  end if;
  select * into j from public.agent_jobs where job_id=p_payload->>'job_id' for update;
  if not found or j.task_id is null or j.business_id is null then raise exception 'Job empresarial obrigatorio'; end if;
  if b.scope_type='BUSINESS' and j.business_id is distinct from b.business_id then raise exception 'Empresa fora do escopo' using errcode='42501'; end if;
  select * into t from public.tarefas where task_id=j.task_id and business_id=j.business_id for share;
  if not found or t.row_version is distinct from (p_payload->>'expected_task_version')::bigint
   or j.status is distinct from p_payload->>'expected_status'
   or j.updated_at is distinct from (p_payload->>'expected_updated_at')::timestamptz then
   return jsonb_build_object('success',true,'status','STATE_CHANGED','reserved',false); end if;
  if v_phase is distinct from public.gateway_workflow_phase(j) then raise exception 'Etapa divergente' using errcode='22023'; end if;
  if v_phase in ('COORDINATE','RESOLVE') and coalesce(j.attempt_count,0)>=least(coalesce(j.max_attempts,2),2) then
   return jsonb_build_object('success',true,'status','ATTEMPT_LIMIT','reserved',false); end if;
  select * into r from public.agent_workflow_runs where job_id=j.job_id and phase=v_phase
   and (fingerprint=p_payload->>'fingerprint' or (task_version=t.row_version and job_updated_at=j.updated_at)) limit 1;
  if found then return jsonb_build_object('success',true,'status','UNCHANGED_NO_RETRY','reserved',false); end if;
  if exists(select 1 from public.agent_jobs where status in ('READY','CLAIMED','RUNNING'))
   or exists(select 1 from public.agent_workflow_runs where status='STARTED' and lease_until>clock_timestamp()) then
   return jsonb_build_object('success',true,'status','EXECUTOR_BUSY','reserved',false); end if;
  insert into public.agent_workflow_runs(job_id,business_id,phase,fingerprint,task_version,job_status,job_updated_at,profile_slug)
   values(j.job_id,j.business_id,v_phase,p_payload->>'fingerprint',t.row_version,j.status,j.updated_at,p_profile_slug) returning * into r;
  return jsonb_build_object('success',true,'status','RESERVED','reserved',true,'run',to_jsonb(r));
 elsif action='recover' then
  if p_payload->>'repair_version' is distinct from 'review-contract-v2'
   or p_payload->>'diagnostic' is distinct from 'REVIEW_CONTRACT_REJECTED'
   or v_phase is distinct from 'REVIEW'
   or p_payload->>'expected_status' is distinct from 'WAITING_HELENA'
   or nullif(p_payload->>'run_id','') is null or nullif(p_payload->>'run_token','') is null
   or nullif(p_payload->>'job_id','') is null
   or coalesce(p_payload->>'fingerprint','') !~ '^[a-f0-9]{64}$'
   or p_payload->>'expected_task_version' is null or p_payload->>'expected_updated_at' is null then
   raise exception 'Contrato de recuperacao REVIEW invalido' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('hermes:global-wip',0)) then
   raise exception 'WIP 1: transicao concorrente; reconciliar estado' using errcode='55000'; end if;
  select * into r from public.agent_workflow_runs where run_id=(p_payload->>'run_id')::uuid for update;
  if not found then raise exception 'Reserva nao confirmada' using errcode='42501'; end if;
  if b.scope_type='BUSINESS' and r.business_id is distinct from b.business_id then
   raise exception 'Empresa fora do escopo' using errcode='42501'; end if;
  if r.run_token is distinct from (p_payload->>'run_token')::uuid
   and (r.recovery_count=0 or
    (r.recovery_history->0->'original_receipt'->>'run_token')::uuid
     is distinct from (p_payload->>'run_token')::uuid) then
   raise exception 'Reserva nao confirmada' using errcode='42501'; end if;
  -- An authenticated replay of the original token reports the exhausted budget.
  if r.recovery_count>=1 then
   return jsonb_build_object('success',true,'status','RECOVERY_LIMIT','reserved',false); end if;
  if r.phase is distinct from 'REVIEW' or r.status is distinct from 'NEEDS_ATTENTION'
   or r.diagnostic is distinct from p_payload->>'diagnostic' then
   raise exception 'Falha de contrato REVIEW obrigatoria' using errcode='22023'; end if;
  if r.job_id is distinct from p_payload->>'job_id' then
   raise exception 'Job da reserva divergente' using errcode='22023'; end if;
  select * into j from public.agent_jobs where job_id=r.job_id for update;
  if not found or j.task_id is null or j.business_id is null then
   raise exception 'Job empresarial obrigatorio' using errcode='22023'; end if;
  if j.business_id is distinct from r.business_id
   or (b.scope_type='BUSINESS' and j.business_id is distinct from b.business_id) then
   raise exception 'Empresa fora do escopo' using errcode='42501'; end if;
  select * into t from public.tarefas where task_id=j.task_id and business_id=j.business_id for share;
  if not found or t.row_version is distinct from (p_payload->>'expected_task_version')::bigint
   or j.status is distinct from p_payload->>'expected_status'
   or j.updated_at is distinct from (p_payload->>'expected_updated_at')::timestamptz
   or r.task_version is distinct from t.row_version or r.job_status is distinct from j.status
   or r.job_updated_at is distinct from j.updated_at
   or r.fingerprint is distinct from p_payload->>'fingerprint' then
   return jsonb_build_object('success',true,'status','STATE_CHANGED','reserved',false); end if;
  if j.status is distinct from 'WAITING_HELENA'
   or j.result_payload->>'review_pending' is distinct from 'true'
   or nullif(btrim(j.result_payload->>'reviewer_agent_id'),'') is null
   or j.result_payload->>'reviewer_agent_id' in ('FOUNDER',j.agent_id)
   or public.gateway_workflow_phase(j) is distinct from 'REVIEW' then
   raise exception 'Revisao independente pendente obrigatoria' using errcode='22023'; end if;
  if exists(select 1 from public.agent_jobs where status in ('READY','CLAIMED','RUNNING'))
   or exists(select 1 from public.agent_workflow_runs where status='STARTED' and lease_until>clock_timestamp()) then
   return jsonb_build_object('success',true,'status','EXECUTOR_BUSY','reserved',false); end if;
  recovered_at:=clock_timestamp();
  update public.agent_workflow_runs set
   recovery_count=1,
   recovery_history=recovery_history||jsonb_build_array(jsonb_build_object(
    'original_receipt',to_jsonb(r),'recovered_at',recovered_at,
    'recovered_by_profile',p_profile_slug,'recovered_by_agent',b.agent_id,
    'repair_version',p_payload->>'repair_version','diagnostic',p_payload->>'diagnostic')),
   run_token=gen_random_uuid(),profile_slug=p_profile_slug,status='STARTED',
   started_at=recovered_at,lease_until=recovered_at+interval '10 minutes',
   finished_at=null,diagnostic=null
   where run_id=r.run_id returning * into r;
  return jsonb_build_object('success',true,'status','RESERVED','reserved',true,'run',to_jsonb(r));
 elsif action='finish' then
  select * into r from public.agent_workflow_runs where run_id=(p_payload->>'run_id')::uuid for update;
  if not found or r.run_token is distinct from (p_payload->>'run_token')::uuid then raise exception 'Reserva nao confirmada' using errcode='42501'; end if;
  if b.scope_type='BUSINESS' and r.business_id is distinct from b.business_id then raise exception 'Empresa fora do escopo' using errcode='42501'; end if;
  if p_payload->>'status' not in ('CONFIRMED','RECONCILED','NEEDS_ATTENTION') then raise exception 'Conclusao invalida'; end if;
  if r.status in ('CONFIRMED','RECONCILED') then return jsonb_build_object('success',true,'status',r.status); end if;
  select * into j from public.agent_jobs where job_id=r.job_id;
  select * into t from public.tarefas where task_id=j.task_id;
  changed:=j.status is distinct from r.job_status or j.updated_at is distinct from r.job_updated_at or t.row_version is distinct from r.task_version;
  if p_payload->>'status' in ('CONFIRMED','RECONCILED') and not changed
   and not (r.phase='HANDOFF' and exists(select 1 from public.agent_job_events e where e.job_id=j.job_id and e.event_type='WORKFLOW_handoff')) then
   raise exception 'Conclusao exige efeito confirmado no banco' using errcode='22023'; end if;
  update public.agent_workflow_runs set status=p_payload->>'status',finished_at=clock_timestamp(),
   diagnostic=left(p_payload->>'diagnostic',100) where run_id=r.run_id;
  return jsonb_build_object('success',true,'status',p_payload->>'status');
 end if;
 raise exception 'Acao desconhecida' using errcode='22023';
end; $$;
revoke all on function public.gateway_workflow_checkpoint(text,jsonb) from public,anon,authenticated;
grant execute on function public.gateway_workflow_checkpoint(text,jsonb) to service_role;
commit;
