-- Revise the existing Hermes brief after an explicit REQUEST_CHANGES review.
-- This does not create a task, approve a delivery, release a job, or start a model.
create or replace function public.gateway_revise_task_brief(
  p_profile_slug text,
  p_payload jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  coordinator public.agent_runtime_bindings;
  job_row public.agent_jobs;
  task_row public.tarefas;
  review_event public.agent_job_events;
  prior_event public.agent_job_events;
  updated_task jsonb;
  workflow_key text;
  instruction_text text;
  definition_text text;
  revision_summary_text text;
  expected_job_timestamp timestamptz;
  request_payload jsonb;
  response_payload jsonb;
  history jsonb;
  revised_at timestamptz := pg_catalog.clock_timestamp();
begin
  if jsonb_typeof(p_payload) is distinct from 'object'
     or pg_catalog.octet_length(p_payload::text) > 32768 then
    raise exception 'Payload de revisao invalido' using errcode = '22023';
  end if;

  select * into coordinator
    from public.agent_runtime_bindings
   where profile_slug = p_profile_slug
     and provider = 'HERMES'
     and status = 'ACTIVE'
   for share;
  if not found or coordinator.agent_id not in ('AGT-01', 'AGT-04')
     or not (coordinator.scope_type = 'BUSINESS'
       or (coordinator.scope_type = 'GROUP' and coordinator.agent_id = 'AGT-01')) then
    raise exception 'Somente Helena ou Marina ativa pode revisar briefings' using errcode = '42501';
  end if;

  workflow_key := nullif(pg_catalog.btrim(p_payload->>'idempotency_key'), '');
  instruction_text := nullif(pg_catalog.btrim(p_payload->>'instruction'), '');
  definition_text := nullif(pg_catalog.btrim(p_payload->>'definition_of_done'), '');
  revision_summary_text := nullif(pg_catalog.btrim(p_payload->>'revision_summary'), '');
  if workflow_key is null or pg_catalog.char_length(workflow_key) > 120
     or nullif(p_payload->>'job_id', '') is null
     or nullif(p_payload->>'expected_task_version', '') is null
     or nullif(p_payload->>'expected_job_updated_at', '') is null
     or instruction_text is null or pg_catalog.char_length(instruction_text) not between 700 and 8000
     or definition_text is null or pg_catalog.char_length(definition_text) not between 80 and 4000
     or revision_summary_text is null or pg_catalog.char_length(revision_summary_text) not between 20 and 1200 then
    raise exception 'Job, versoes e briefing profissional completo sao obrigatorios' using errcode = '22023';
  end if;
  begin
    expected_job_timestamp := (p_payload->>'expected_job_updated_at')::timestamptz;
  exception when others then
    raise exception 'expected_job_updated_at deve ser timestamp ISO valido' using errcode = '22023';
  end;
  perform public.helena_validate_professional_brief(instruction_text);

  request_payload := jsonb_build_object(
    'profile', p_profile_slug,
    'action', 'revise_task_brief',
    'payload', p_payload
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_profile_slug || ':' || workflow_key, 0)
  );

  select * into job_row
    from public.agent_jobs
   where job_id = p_payload->>'job_id'
   for update;
  if not found or job_row.business_id is null or job_row.task_id is null then
    raise exception 'Job existente deve estar ligado a tarefa e empresa' using errcode = '22023';
  end if;
  if coordinator.scope_type = 'BUSINESS'
     and coordinator.business_id is distinct from job_row.business_id then
    raise exception 'Empresa fora do escopo da coordenacao' using errcode = '42501';
  end if;

  select * into prior_event
    from public.agent_job_events
   where job_id = job_row.job_id
     and payload->>'workflow_key' = workflow_key
     and event_type = 'WORKFLOW_revise_task_brief'
   limit 1;
  if prior_event.event_id is not null then
    if prior_event.payload->'request' is distinct from request_payload then
      raise exception 'Chave de idempotencia reutilizada com outro briefing' using errcode = '22023';
    end if;
    return prior_event.payload->'response';
  end if;

  select * into task_row
    from public.tarefas
   where task_id = job_row.task_id
   for update;
  if not found or task_row.business_id is distinct from job_row.business_id then
    raise exception 'Tarefa do job diverge da empresa' using errcode = '22023';
  end if;
  if task_row.row_version is distinct from (p_payload->>'expected_task_version')::bigint
     or job_row.updated_at is distinct from expected_job_timestamp then
    raise exception 'CONFLITO_DE_VERSAO: releia job e tarefa antes de revisar' using errcode = '40001';
  end if;
  if job_row.status <> 'DRAFT'
     or task_row.status <> 'BLOQUEADA'
     or coalesce(task_row.bloqueio, '') not like 'Ajustes solicitados:%'
     or job_row.approval_status <> 'PENDING'
     or job_row.result_payload->>'review_pending' is distinct from 'false'
     or nullif(pg_catalog.btrim(job_row.result_payload->>'reviewed_by'), '') is null
     or nullif(pg_catalog.btrim(job_row.result_payload->>'review_reason'), '') is null
     or job_row.result_payload->>'reviewed_by' = job_row.agent_id then
    raise exception 'Revisao exige job DRAFT e tarefa bloqueada por REQUEST_CHANGES, sem auto-revisao' using errcode = '22023';
  end if;
  if coalesce(job_row.attempt_count, 0) >= least(coalesce(job_row.max_attempts, 2), 2) then
    raise exception 'Limite de tentativas atingido; briefing nao sera alterado sem caminho de liberacao' using errcode = '22023';
  end if;

  select * into review_event
    from public.agent_job_events
   where job_id = job_row.job_id
     and event_type = 'WORKFLOW_review_delivery'
   order by created_at desc
   limit 1;
  if review_event.event_id is null
     or review_event.payload->'request'->'payload'->>'decision' <> 'REQUEST_CHANGES'
     or review_event.payload->'request'->'payload'->>'reason' is distinct from job_row.result_payload->>'review_reason'
     or review_event.agent_id is distinct from job_row.result_payload->>'reviewed_by' then
    raise exception 'Parecer REQUEST_CHANGES mais recente nao confere com o historico do job' using errcode = '22023';
  end if;

  history := case
    when pg_catalog.jsonb_typeof(job_row.result_payload->'brief_revision_history') = 'array'
      then job_row.result_payload->'brief_revision_history'
    else '[]'::jsonb
  end;
  if pg_catalog.jsonb_array_length(history) >= 5 then
    raise exception 'Limite de cinco revisoes atingido; replanejar em vez de repetir ciclos' using errcode = '22023';
  end if;
  history := history || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
    'workflow_key', workflow_key,
    'revised_by', coordinator.agent_id,
    'revised_at', revised_at,
    'reviewed_by', job_row.result_payload->>'reviewed_by',
    'review_reason', job_row.result_payload->>'review_reason',
    'revision_summary', revision_summary_text,
    'previous_instruction', job_row.instruction,
    'previous_definition_of_done', task_row.definicao_de_pronto,
    'instruction', instruction_text,
    'definition_of_done', definition_text
  ));

  update public.agent_jobs
     set instruction = instruction_text,
         result_payload = coalesce(result_payload, '{}'::jsonb)
           || pg_catalog.jsonb_build_object('brief_revision_history', history),
         updated_at = revised_at
   where job_id = job_row.job_id;

  updated_task := public.helena_write_record(
    'tarefas', task_row.task_id, task_row.row_version,
    pg_catalog.jsonb_build_object(
      'definicao_de_pronto', definition_text,
      'status', 'NÃO INICIADA',
      'bloqueio', null
    )
  );

  response_payload := pg_catalog.jsonb_build_object(
    'success', true,
    'job_id', job_row.job_id,
    'task_id', task_row.task_id,
    'business_id', job_row.business_id,
    'status', 'DRAFT',
    'task_version', updated_task->'row_version',
    'attempt_count', coalesce(job_row.attempt_count, 0),
    'reviewed_by', job_row.result_payload->>'reviewed_by',
    'started', false,
    'released', false
  );
  insert into public.agent_job_events(
    job_id, agent_id, business_id, event_type, status, message, payload, correlation_id
  ) values (
    job_row.job_id, coordinator.agent_id, job_row.business_id,
    'WORKFLOW_revise_task_brief', 'DRAFT', revision_summary_text,
    pg_catalog.jsonb_build_object(
      'workflow_key', workflow_key,
      'request', request_payload,
      'response', response_payload,
      'profile_slug', p_profile_slug
    ), job_row.correlation_id
  );
  return response_payload;
end;
$function$;

revoke all on function public.gateway_revise_task_brief(text, jsonb) from public, anon, authenticated;
grant execute on function public.gateway_revise_task_brief(text, jsonb) to service_role;

comment on function public.gateway_revise_task_brief(text, jsonb)
is 'Revises the same DRAFT job after a verified REQUEST_CHANGES review using job updated_at and task row_version; preserves prior briefs and review history and never releases or starts a model.';
