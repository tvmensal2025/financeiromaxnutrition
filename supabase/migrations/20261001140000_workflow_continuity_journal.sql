-- Persist runtime receipts; derive next actions from canonical jobs/events.
-- No existing job, approval, retry budget or profile is changed.
begin;
create table if not exists public.agent_workflow_runs (
 run_id uuid primary key default gen_random_uuid(),
 job_id text not null references public.agent_jobs(job_id),
 business_id text not null, phase text not null check(phase in ('REVIEW','HANDOFF','COORDINATE','RESOLVE')),
 fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'),
 task_version bigint not null, job_status text not null, job_updated_at timestamptz not null,
 profile_slug text not null, run_token uuid not null default gen_random_uuid(),
 status text not null default 'STARTED' check(status in ('STARTED','CONFIRMED','RECONCILED','NEEDS_ATTENTION')),
 started_at timestamptz not null default clock_timestamp(), lease_until timestamptz not null default clock_timestamp()+interval '10 minutes',
 finished_at timestamptz, diagnostic text,
 unique(job_id,phase,fingerprint), unique(job_id,phase,task_version,job_updated_at)
);
alter table public.agent_workflow_runs enable row level security;
revoke all on public.agent_workflow_runs from public,anon,authenticated;
grant select,insert,update on public.agent_workflow_runs to service_role;
create index if not exists agent_workflow_runs_pending on public.agent_workflow_runs(status,lease_until);

create or replace function public.gateway_workflow_phase(j public.agent_jobs)
returns text language sql stable security invoker set search_path='' as $$
 select case
 when j.status='DRAFT' then 'COORDINATE'
 when j.status='WAITING_HELENA' and j.result_payload->>'review_pending'='true'
  and j.result_payload->>'reviewer_agent_id' is not null
  and j.result_payload->>'reviewer_agent_id' not in ('FOUNDER',j.agent_id) then 'REVIEW'
 when j.status='WAITING_HELENA' and coalesce(j.result_payload->>'review_pending','false')<>'true'
  and j.agent_id<>'AGT-01' then 'RESOLVE'
 when j.status='COMPLETED' and j.result_payload->>'review_pending'='false'
  and nullif(j.result_payload->>'reviewed_by','') is not null
  and coalesce(j.result_payload->'delivery'->>'stage','')<>'FINAL'
  and exists(select 1 from public.agent_job_events e where e.job_id=j.job_id
   and e.event_type='WORKFLOW_review_delivery' and e.agent_id=j.result_payload->>'reviewed_by'
   and e.payload->'request'->'payload'->>'decision'='APPROVE')
  and not exists(select 1 from public.agent_job_events e where e.job_id=j.job_id and e.event_type='WORKFLOW_handoff') then 'HANDOFF'
 else null end
$$;
revoke all on function public.gateway_workflow_phase(public.agent_jobs) from public,anon,authenticated;
grant execute on function public.gateway_workflow_phase(public.agent_jobs) to service_role;

create or replace function public.gateway_workflow_candidates(
 p_profile_slug text,p_created_after timestamptz,p_adopt_job_ids text[] default '{}',p_after_job_id text default null,p_limit integer default 25
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare b public.agent_runtime_bindings; items jsonb;
begin
 select * into b from public.agent_runtime_bindings where profile_slug=p_profile_slug for share;
 if not found or b.status<>'ACTIVE' or b.provider<>'HERMES' or b.agent_id not in ('AGT-01','AGT-04')
 or not (b.scope_type='BUSINESS' or (b.scope_type='GROUP' and b.agent_id='AGT-01')) then
  raise exception 'Coordenacao ativa obrigatoria' using errcode='42501'; end if;
 if p_created_after is null or p_limit is null or p_limit not between 1 and 25 or cardinality(p_adopt_job_ids)>100 then
  raise exception 'Filtro de continuidade obrigatorio' using errcode='22023'; end if;
 select coalesce(jsonb_agg(x order by x.job_id),'[]'::jsonb) into items from (
  select j.job_id,j.business_id,j.status,public.gateway_workflow_phase(j) as phase
  from public.agent_jobs j join public.tarefas t on t.task_id=j.task_id and t.business_id=j.business_id
  where j.job_id ~ '^JOB-HR-[a-f0-9]{32}$'
  and ((b.scope_type='GROUP' and b.agent_id='AGT-01') or j.business_id=b.business_id)
  and (j.created_at>=p_created_after or j.job_id=any(p_adopt_job_ids))
  and (p_after_job_id is null or j.job_id>p_after_job_id)
  and public.gateway_workflow_phase(j) is not null
  and (public.gateway_workflow_phase(j) not in ('COORDINATE','RESOLVE') or coalesce(j.attempt_count,0)<least(coalesce(j.max_attempts,2),2))
  and not exists(select 1 from public.agent_workflow_runs r where r.job_id=j.job_id
    and r.phase=public.gateway_workflow_phase(j) and r.task_version=t.row_version and r.job_updated_at=j.updated_at)
  order by j.job_id limit p_limit+1
 ) x;
 return jsonb_build_object('success',true,'candidates',(select coalesce(jsonb_agg(v order by ord),'[]'::jsonb)
  from jsonb_array_elements(items) with ordinality a(v,ord) where ord<=p_limit),
  'next_cursor',case when jsonb_array_length(items)>p_limit then items->(p_limit-1)->>'job_id' else null end);
end; $$;
revoke all on function public.gateway_workflow_candidates(text,timestamptz,text[],text,integer) from public,anon,authenticated;
grant execute on function public.gateway_workflow_candidates(text,timestamptz,text[],text,integer) to service_role;

create or replace function public.gateway_workflow_checkpoint(p_profile_slug text,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare b public.agent_runtime_bindings; j public.agent_jobs; t public.tarefas; r public.agent_workflow_runs;
 action text:=p_payload->>'action'; v_phase text:=p_payload->>'phase'; changed boolean;
begin
 if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>4096 then
  raise exception 'Registro invalido' using errcode='22023'; end if;
 select * into b from public.agent_runtime_bindings where profile_slug=p_profile_slug for share;
 if not found or b.status<>'ACTIVE' or b.provider<>'HERMES' or b.agent_id not in ('AGT-01','AGT-04')
 or not (b.scope_type='BUSINESS' or (b.scope_type='GROUP' and b.agent_id='AGT-01')) then
  raise exception 'Coordenacao ativa obrigatoria' using errcode='42501'; end if;
 if action='list' then
  return jsonb_build_object('success',true,'runs',coalesce((select jsonb_agg(to_jsonb(x)) from (
   select r.* from public.agent_workflow_runs r where r.status in ('STARTED','NEEDS_ATTENTION')
   and ((b.scope_type='GROUP' and b.agent_id='AGT-01') or r.business_id=b.business_id)
   and (p_payload->>'after_run_id' is null or r.run_id>(p_payload->>'after_run_id')::uuid)
   order by r.run_id limit 100) x),'[]'::jsonb));
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

-- Share the same WIP lock with producer claims on other processes/hosts.
create or replace function public.guard_workflow_execution_overlap()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status in ('CLAIMED','RUNNING') and new.status is distinct from old.status then
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('hermes:global-wip',0)) then
   raise exception 'WIP 1: transicao concorrente; reconciliar estado' using errcode='55000';
  end if;
  if exists(select 1 from public.agent_workflow_runs where status='STARTED' and lease_until>clock_timestamp()) then
   raise exception 'WIP 1: coordenacao ou revisao em andamento' using errcode='55000';
  end if;
 end if;
 return new;
end; $$;
revoke all on function public.guard_workflow_execution_overlap() from public,anon,authenticated;
drop trigger if exists agent_workflow_execution_overlap on public.agent_jobs;
create trigger agent_workflow_execution_overlap before update of status on public.agent_jobs
 for each row execute function public.guard_workflow_execution_overlap();
commit;
