-- Jobs de runtimes desativados nao podem ser assumidos nem iniciados.
-- Preserva a semantica de retorno nulo das RPCs existentes.
create or replace function public.gateway_claim_agent_job(p_job_id text, p_agent_id text)
returns public.agent_jobs
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_job public.agent_jobs;
begin
  perform 1
  from public.agent_connections c
  where c.agent_id = p_agent_id
    and c.connection_status = 'CONNECTED'
    and c.provider <> 'GROK'
  for share;

  if not found then
    return null;
  end if;

  update public.agent_jobs
  set status = 'CLAIMED',
      claimed_at = coalesce(claimed_at, now()),
      attempt_count = coalesce(attempt_count, 0) + 1,
      updated_at = now()
  where job_id = p_job_id
    and agent_id = p_agent_id
    and status = 'READY'
    and coalesce(available_at, now()) <= now()
  returning * into v_job;

  if not found then
    return null;
  end if;

  insert into public.agent_job_events (
    job_id, agent_id, business_id, event_type, status, message, payload, correlation_id
  ) values (
    v_job.job_id, v_job.agent_id, v_job.business_id,
    'CLAIMED', v_job.status, 'Job assumido pelo agente.',
    jsonb_build_object('attempt_count', v_job.attempt_count),
    v_job.correlation_id
  );

  return v_job;
end;
$function$;

create or replace function public.gateway_start_agent_job(p_job_id text, p_agent_id text)
returns public.agent_jobs
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_job public.agent_jobs;
begin
  perform 1
  from public.agent_connections c
  where c.agent_id = p_agent_id
    and c.connection_status = 'CONNECTED'
    and c.provider <> 'GROK'
  for share;

  if not found then
    return null;
  end if;

  update public.agent_jobs
  set status = 'RUNNING',
      started_at = coalesce(started_at, now()),
      updated_at = now()
  where job_id = p_job_id
    and agent_id = p_agent_id
    and status = 'CLAIMED'
  returning * into v_job;

  if not found then
    return null;
  end if;

  insert into public.agent_job_events (
    job_id, agent_id, business_id, event_type, status, message, correlation_id
  ) values (
    v_job.job_id, v_job.agent_id, v_job.business_id,
    'STARTED', v_job.status, 'Execucao iniciada pelo agente.', v_job.correlation_id
  );

  return v_job;
end;
$function$;
