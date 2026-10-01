begin;
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


select public.gateway_workflow_checkpoint('helena--grupo','{"action":"list"}'::jsonb)->>'success' as journal_read_ready;
commit;