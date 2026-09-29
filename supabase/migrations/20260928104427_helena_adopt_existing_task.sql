-- Attach one Hermes draft to an existing visible task. Never duplicate the task.
create function public.gateway_adopt_existing_task(
  p_profile_slug text,
  p_task_id text,
  p_target_agent_id text,
  p_expected_task_version bigint,
  p_instruction text default null
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  coordinator public.agent_runtime_bindings;
  executor public.agent_runtime_bindings;
  task_row public.tarefas;
  agent_name text;
  existing public.agent_jobs;
  new_job_id text;
begin
  if p_task_id is null or p_target_agent_id is null or p_expected_task_version is null
     or length(coalesce(p_instruction, '')) > 8000 then
    raise exception 'Tarefa, agente, versao e instrucao valida sao obrigatorios' using errcode='22023';
  end if;

  select * into coordinator from public.agent_runtime_bindings
    where profile_slug = p_profile_slug and provider = 'HERMES' and status = 'ACTIVE' for share;
  if not found or coordinator.agent_id not in ('AGT-01', 'AGT-04') then
    raise exception 'Somente Helena ou Marina podem preparar a fila' using errcode='42501';
  end if;

  select * into task_row from public.tarefas where task_id = p_task_id for update;
  if not found or task_row.business_id is null then
    raise exception 'Tarefa empresarial inexistente' using errcode='22023';
  end if;
  if coordinator.scope_type = 'BUSINESS' and coordinator.business_id is distinct from task_row.business_id then
    raise exception 'Empresa fora do escopo da coordenacao' using errcode='42501';
  end if;
  if task_row.row_version is distinct from p_expected_task_version then
    raise exception 'CONFLITO_DE_VERSAO: releia a tarefa antes de gravar' using errcode='40001';
  end if;
  if task_row.status <> 'NÃO INICIADA' then
    raise exception 'Somente tarefa ainda nao iniciada pode entrar na fila' using errcode='22023';
  end if;
  if nullif(btrim(task_row.tarefa), '') is null or nullif(btrim(task_row.definicao_de_pronto), '') is null then
    raise exception 'Tarefa exige objetivo e definicao de pronto' using errcode='22023';
  end if;

  select * into executor from public.agent_runtime_bindings
    where agent_id = p_target_agent_id and provider = 'HERMES' and status = 'ACTIVE'
      and scope_type = 'BUSINESS' and business_id = task_row.business_id for share;
  if not found then
    raise exception 'Executor nao ativo nesta empresa' using errcode='42501';
  end if;
  select agente into agent_name from public.agentes where agent_id = p_target_agent_id;
  if agent_name is distinct from task_row.responsavel then
    raise exception 'Responsavel da tarefa difere do perfil solicitado' using errcode='22023';
  end if;

  select * into existing from public.agent_jobs where task_id = p_task_id limit 1;
  if found then
    raise exception 'Tarefa ja possui job; consulte o registro existente' using errcode='23505';
  end if;

  new_job_id := 'JOB-HR-' || md5('existing-task:' || p_task_id);
  insert into public.agent_jobs(
    job_id, task_id, agent_id, business_id, objective, instruction,
    priority, status, approval_required, approval_status, max_attempts,
    idempotency_key, correlation_id
  ) values (
    new_job_id, p_task_id, p_target_agent_id, task_row.business_id,
    task_row.tarefa, coalesce(p_instruction, ''), 'MEDIA', 'DRAFT',
    true, 'PENDING', 2, 'hermes-adopt:' || p_task_id, new_job_id
  );
  insert into public.agent_job_events(
    job_id, agent_id, business_id, event_type, status, message, payload, correlation_id
  ) values (
    new_job_id, coordinator.agent_id, task_row.business_id,
    'WORKFLOW_adopt_existing_task', 'DRAFT',
    'Tarefa existente vinculada ao Hermes sem duplicar o cartao',
    jsonb_build_object('task_id', p_task_id, 'task_version', p_expected_task_version,
      'profile_slug', p_profile_slug, 'original_source_system', task_row.source_system,
      'original_related_object_id', task_row.related_object_id), new_job_id
  );
  return jsonb_build_object('success', true, 'job_id', new_job_id,
    'task_id', p_task_id, 'business_id', task_row.business_id,
    'status', 'DRAFT', 'started', false);
end;
$function$;

revoke all on function public.gateway_adopt_existing_task(text,text,text,bigint,text) from public, anon, authenticated;
grant execute on function public.gateway_adopt_existing_task(text,text,text,bigint,text) to service_role;
