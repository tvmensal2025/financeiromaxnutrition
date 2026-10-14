-- Falha de infraestrutura (TIMEOUT, TRANSPORT_INTERRUPTED, RATE_LIMIT) não consome
-- tentativa: o job volta a DRAFT com a tentativa devolvida e a Helena replaneja pelo
-- fluxo normal. Limite de 2 devoluções por job para não virar laço; depois disso a
-- falha segue o caminho de sempre (FAILED). Falhas do agente continuam contando.
-- Autorizado pelo Fundador em 2026-10-07.

CREATE OR REPLACE FUNCTION public.gateway_fail_agent_job(p_job_id text, p_agent_id text, p_error_code text, p_error_message text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS agent_jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_job public.agent_jobs;
  v_infra boolean;
  v_requeues integer;
begin
  if p_error_message is null or btrim(p_error_message) = '' then
    raise exception 'error_message_required';
  end if;

  v_infra := p_error_code = 'HERMES_PROCESS_FAILED'
    and p_error_message ~ 'Diagnostico local: (TIMEOUT|TRANSPORT_INTERRUPTED|RATE_LIMIT)';

  if v_infra then
    select count(*) into v_requeues from public.agent_job_events
      where job_id = p_job_id and event_type = 'INFRA_REQUEUED';
    if v_requeues < 2 then
      update public.agent_jobs
      set status = 'DRAFT',
          approval_status = 'PENDING',
          attempt_count = greatest(coalesce(attempt_count, 1) - 1, 0),
          claimed_at = null,
          started_at = null,
          available_at = null,
          error_code = 'INFRA_RETRY',
          error_message = p_error_message,
          updated_at = now()
      where job_id = p_job_id
        and agent_id = p_agent_id
        and status in ('CLAIMED','RUNNING')
      returning * into v_job;

      if not found then
        return null;
      end if;

      insert into public.agent_job_events (
        job_id, agent_id, business_id, event_type, status, message, payload, correlation_id
      )
      values (
        v_job.job_id, v_job.agent_id, v_job.business_id,
        'INFRA_REQUEUED', v_job.status,
        'Falha de infraestrutura nao consome tentativa; Helena replaneja e relanca. ' || p_error_message,
        coalesce(p_payload,'{}'::jsonb) || jsonb_build_object('infra_requeue', v_requeues + 1, 'original_error_code', p_error_code),
        v_job.correlation_id
      );

      return v_job;
    end if;
  end if;

  update public.agent_jobs
  set status = 'FAILED',
      error_code = p_error_code,
      error_message = p_error_message,
      completed_at = now(),
      updated_at = now()
  where job_id = p_job_id
    and agent_id = p_agent_id
    and status in ('CLAIMED','RUNNING')
  returning * into v_job;

  if not found then
    return null;
  end if;

  insert into public.agent_job_events (
    job_id, agent_id, business_id, event_type, status, message, payload, correlation_id
  )
  values (
    v_job.job_id, v_job.agent_id, v_job.business_id,
    'FAILED', v_job.status, p_error_message, coalesce(p_payload,'{}'::jsonb), v_job.correlation_id
  );

  return v_job;
end;
$function$;
