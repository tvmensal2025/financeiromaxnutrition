-- Conflito de versão deixa de usar SQLSTATE 40001 (serialization_failure).
-- O PostgREST repete transações que falham com 40001; como o conflito de
-- versão é determinístico, a repetição virava laço infinito (CPU 100%,
-- centenas de milhões de rollbacks). PT409 responde HTTP 409 sem repetir.

CREATE OR REPLACE FUNCTION public.gateway_adopt_existing_task(p_profile_slug text, p_task_id text, p_target_agent_id text, p_expected_task_version bigint, p_instruction text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
    raise exception 'CONFLITO_DE_VERSAO: releia a tarefa antes de gravar' using errcode='PT409';
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

CREATE OR REPLACE FUNCTION public.gateway_record_queue_attention(p_profile_slug text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare b public.agent_runtime_bindings; j public.agent_jobs; e public.agent_job_events;
 k text; req jsonb; res jsonb; reason text;
begin
 if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>4096 then
 raise exception 'Payload invalido' using errcode='22023'; end if;
 select * into b from public.agent_runtime_bindings where profile_slug=p_profile_slug for share;
 if not found or b.status<>'ACTIVE' or b.provider<>'HERMES' or b.agent_id not in ('AGT-01','AGT-04')
 or not (b.scope_type='BUSINESS' or (b.scope_type='GROUP' and b.agent_id='AGT-01')) then
 raise exception 'Coordenacao ativa obrigatoria' using errcode='42501'; end if;
 k:=nullif(btrim(p_payload->>'idempotency_key'),'');
 if k is null or length(k)>120 then raise exception 'Chave obrigatoria' using errcode='22023'; end if;
 req:=jsonb_build_object('profile',p_profile_slug,'payload',p_payload);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_profile_slug||':'||k,0));
 select * into j from public.agent_jobs where job_id=p_payload->>'job_id' for update;
 if not found or j.task_id is null or j.business_id is null then raise exception 'Job exige tarefa e empresa' using errcode='22023'; end if;
 if b.scope_type='BUSINESS' and b.business_id is distinct from j.business_id then
 raise exception 'Empresa fora do escopo' using errcode='42501'; end if;
 select * into e from public.agent_job_events where job_id=j.job_id and event_type='QUEUE_ATTENTION'
 and payload->>'workflow_key'=k limit 1;
 if e.event_id is not null then
 if e.payload->'request' is distinct from req then raise exception 'Chave reutilizada com conteudo diferente' using errcode='22023'; end if;
 return e.payload->'response'; end if;
 if p_payload->>'expected_status' is distinct from j.status
 or (p_payload->>'expected_updated_at')::timestamptz is distinct from j.updated_at then
 raise exception 'SNAPSHOT_CHANGED' using errcode='PT409'; end if;
 if exists(select 1 from public.agent_workflow_runs q join public.tarefas t on t.task_id=j.task_id
   where q.job_id=j.job_id and q.job_updated_at=j.updated_at and q.task_version=t.row_version
   and (q.status='NEEDS_ATTENTION' or (q.status='STARTED' and q.lease_until<clock_timestamp()))) then
 reason:='Revisao ou coordenacao interrompida: Helena e Theo conferem o recibo, a causa e os efeitos antes de retomar. Nao repetir IA nem alterar tentativas automaticamente.';
 elsif j.status='FAILED' then reason:='Falha tecnica: Theo diagnostica; Helena decide retomada apos prova. Resultado incerto nao autoriza repetir IA.';
 elsif j.status in ('CLAIMED','RUNNING') and j.updated_at<clock_timestamp()-interval '30 minutes' then
 reason:='Execucao antiga: Theo confirma processo e efeitos; Helena reconcilia antes de liberar WIP ou repetir.';
 elsif j.status='WAITING_HELENA' and coalesce(j.attempt_count,0)>=least(coalesce(j.max_attempts,2),2)
 and j.result_payload->>'review_pending' is distinct from 'true' then
 reason:='Limite de tentativas: Helena avalia causa; preservar tentativas e historico.';
 else raise exception 'Estado sem motivo para alerta tecnico' using errcode='22023'; end if;
 res:=jsonb_build_object('success',true,'job_id',j.job_id,'status',j.status,'recorded',true,'model_started',false,'jobs_changed',false);
 insert into public.agent_job_events(job_id,agent_id,business_id,event_type,status,message,payload,correlation_id)
 values(j.job_id,b.agent_id,j.business_id,'QUEUE_ATTENTION',j.status,reason,
 jsonb_build_object('workflow_key',k,'request',req,'response',res,'next_responsible','AGT-01','technical_responsible','AGT-09','automatic_retry',false),j.correlation_id);
 return res;
end; $function$;

CREATE OR REPLACE FUNCTION public.gateway_resolve_job_block(p_profile_slug text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
 b public.agent_runtime_bindings;
 j public.agent_jobs;
 t public.tarefas;
 e public.agent_job_events;
 k text; reason text; req jsonb; res jsonb; recovering boolean;
begin
 if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>16384 then raise exception 'Payload invalido' using errcode='22023'; end if;
 select * into b from public.agent_runtime_bindings where profile_slug=p_profile_slug for share;
 if not found or b.status<>'ACTIVE' or b.provider<>'HERMES' or b.agent_id not in ('AGT-01','AGT-04')
 or not (b.scope_type='BUSINESS' or (b.scope_type='GROUP' and b.agent_id='AGT-01')) then
 raise exception 'Somente Helena ou Marina ativa resolve bloqueios' using errcode='42501'; end if;
 k:=nullif(btrim(p_payload->>'idempotency_key'),''); reason:=nullif(btrim(p_payload->>'reason'),'');
 if k is null or length(k)>120 or reason is null or length(reason)>4000 then raise exception 'Chave e motivo obrigatorios' using errcode='22023'; end if;
 req:=jsonb_build_object('profile',p_profile_slug,'action','resolve_job_block','payload',p_payload);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_profile_slug||':'||k,0));
 select * into j from public.agent_jobs where job_id=p_payload->>'job_id' for update;
 if not found or j.business_id is null or j.task_id is null then raise exception 'Job exige tarefa e empresa' using errcode='22023'; end if;
 if b.scope_type='BUSINESS' and b.business_id is distinct from j.business_id then raise exception 'Empresa fora do escopo' using errcode='42501'; end if;
 select * into e from public.agent_job_events where job_id=j.job_id and payload->>'workflow_key'=k and event_type like 'WORKFLOW_%';
 if e.event_id is not null then
 if e.payload->'request' is distinct from req then raise exception 'Chave reutilizada com conteudo diferente' using errcode='22023'; end if;
 return e.payload->'response'; end if;
 select * into t from public.tarefas where task_id=j.task_id for update;
 if not found or t.business_id is distinct from j.business_id then raise exception 'Tarefa divergente' using errcode='22023'; end if;
 if (p_payload->>'expected_task_version')::bigint is distinct from t.row_version then raise exception 'CONFLITO_DE_VERSAO' using errcode='PT409'; end if;
 recovering := j.status='FAILED';
 if recovering then
  -- Only the content-only pilot is enabled. Other domains require a validated recipe.
  if j.agent_id <> 'AGT-17' or j.error_code is distinct from 'HERMES_PROCESS_FAILED'
   or j.error_message is distinct from 'Execucao pontual terminou sem entrega confirmada. Diagnostico local: TIMEOUT. Verificar eventos antes de qualquer repeticao.'
   or j.attempt_count is distinct from 1
   or coalesce(j.evidence_refs,'[]'::jsonb) <> '[]'::jsonb
   or coalesce(j.result_payload,'{}'::jsonb) ? 'delivery'
   or j.result_payload->>'review_pending'='true'
   or exists(select 1 from public.agent_job_events where job_id=j.job_id and event_type='WORKFLOW_resolve_job_block' and payload->>'previous_status'='FAILED') then
   raise exception 'Falha sem receita de recuperacao validada ou resultado a reconciliar' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('hermes:global-wip',0));
  if exists(select 1 from public.agent_jobs where status in ('READY','CLAIMED','RUNNING')) then
   raise exception 'WIP ocupado; aguardar sem repetir' using errcode='55000'; end if;
 else
  if j.status<>'WAITING_HELENA' or j.result_payload->>'review_pending'='true'
   or nullif(btrim(j.result_payload->>'decisao_necessaria'),'') is null then
   raise exception 'Exige bloqueio por decisao; entrega submetida exige review_delivery' using errcode='22023'; end if;
 end if;
 if coalesce(j.attempt_count,0)>=least(coalesce(j.max_attempts,2),2) then raise exception 'Limite de tentativas atingido; replanejar' using errcode='22023'; end if;
 update public.agent_jobs set status='DRAFT',approval_status='PENDING',updated_at=clock_timestamp(),
 result_payload=coalesce(result_payload,'{}'::jsonb)||jsonb_build_object('block_resolved_by',b.agent_id,'block_resolution',reason,'block_resolved_at',clock_timestamp(),'recovery_recipe',case when recovering then 'text-timeout-sol61-v1' else null end)
 where job_id=j.job_id;
 perform public.helena_write_record('tarefas',t.task_id,t.row_version,jsonb_build_object('status','NÃO INICIADA','bloqueio','Bloqueio resolvido; aguardando liberacao da coordenacao'));
 res:=jsonb_build_object('success',true,'job_id',j.job_id,'status','DRAFT','started',false,'completed',false,'attempt_count',j.attempt_count);
 insert into public.agent_job_events(job_id,agent_id,business_id,event_type,status,message,payload,correlation_id)
 values(j.job_id,b.agent_id,j.business_id,'WORKFLOW_resolve_job_block','DRAFT',reason,jsonb_build_object('workflow_key',k,'request',req,'response',res,'profile_slug',p_profile_slug,'previous_status',j.status,'previous_error_code',j.error_code,'previous_error_message',j.error_message,'technical_owner','AGT-09','recipe',case when recovering then 'text-timeout-sol61-v1' else null end),j.correlation_id);
 return res;
end;
$function$;

CREATE OR REPLACE FUNCTION public.gateway_revise_task_brief(p_profile_slug text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
    raise exception 'CONFLITO_DE_VERSAO: releia job e tarefa antes de revisar' using errcode='PT409';
  end if;
  if job_row.status <> 'DRAFT'
     or task_row.status not in ('BLOQUEADA', 'NÃO INICIADA')
     or (task_row.status = 'BLOQUEADA' and coalesce(task_row.bloqueio, '') not like 'Ajustes solicitados:%')
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
  if task_row.status = 'NÃO INICIADA' and (
    task_row.bloqueio is not null or pg_catalog.jsonb_array_length(history) = 0
    or not exists (
      select 1 from public.agent_job_events e
      where e.job_id = job_row.job_id and e.business_id = job_row.business_id
        and e.event_type = 'WORKFLOW_revise_task_brief'
        and e.payload->>'workflow_key' = history->-1->>'workflow_key'
        and e.payload->'response'->>'success' = 'true'
        and e.payload->'response'->>'status' = 'DRAFT'
        and e.payload->'response'->>'task_id' = task_row.task_id
        and e.payload->'response'->>'task_version' = task_row.row_version::text
        and e.payload->'request'->'payload'->>'instruction' = job_row.instruction
        and e.payload->'request'->'payload'->>'definition_of_done' = task_row.definicao_de_pronto
        and e.created_at >= review_event.created_at
    )
  ) then
    raise exception 'Rascunho revisado exige recibo da mesma versao; nao contornar REQUEST_CHANGES' using errcode = '22023';
  end if;
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

CREATE OR REPLACE FUNCTION public.gateway_workflow(p_profile_slug text, p_action text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  b public.agent_runtime_bindings;
  target public.agent_runtime_bindings;
  j public.agent_jobs;
  t public.tarefas;
  h public.handoffs;
  old_event public.agent_job_events;
  result jsonb;
  company text;
  key text;
  request jsonb;
  suffix text;
  new_job text;
  new_task text;
  new_handoff text;
  reviewer text;
  agent_name text;
  target_name text;
  root_id text;
begin
  if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>65536 then
    raise exception 'Payload invalido ou maior que 64KB' using errcode='22023';
  end if;
  select * into b from public.agent_runtime_bindings where profile_slug=p_profile_slug for share;
  if not found or b.provider<>'HERMES' or b.status<>'ACTIVE' then
    raise exception 'Perfil Hermes nao ativo' using errcode='42501';
  end if;
  select agente into agent_name from public.agentes where agent_id=b.agent_id;
  if p_action='context' then
    return jsonb_build_object('profile',to_jsonb(b),'role',(select to_jsonb(a) from public.agentes a where a.agent_id=b.agent_id),
      'checkpoint',(select jsonb_build_object('checkpoint_id',c.checkpoint_id,'resumo_executivo',c.resumo_executivo) from public.checkpoint_mestre_atual c limit 1),
      'tasks',coalesce((select jsonb_agg(x) from (select task_id,business_id,tarefa,responsavel,status,bloqueio,definicao_de_pronto,row_version from public.tarefas
        where (b.scope_type='GROUP' and b.agent_id='AGT-01' or b.scope_type='BUSINESS' and business_id=b.business_id)
          and (b.agent_id in ('AGT-01','AGT-04') or responsavel=agent_name)
        order by atualizado_em desc limit 30)x),'[]'::jsonb),
      'handoffs',coalesce((select jsonb_agg(x) from (select id,de,para,business_id_area,assunto,status,related_object_id,row_version from public.handoffs
        where (b.scope_type='GROUP' and b.agent_id='AGT-01' and scope_type<>'PERSONAL' or b.scope_type='BUSINESS' and business_id_area=b.business_id)
          and (b.agent_id in ('AGT-01','AGT-04') or para=agent_name or de=agent_name)
        order by criado_em desc limit 30)x),'[]'::jsonb),
      'pending_reviews',coalesce((select jsonb_agg(x) from (
        select job_id,task_id,agent_id,business_id,result_summary,evidence_refs,result_payload->>'reviewer_agent_id' as reviewer_agent_id
        from public.agent_jobs where status='WAITING_HELENA' and result_payload->>'review_pending'='true'
        and (b.scope_type='GROUP' and b.agent_id='AGT-01' or b.scope_type='BUSINESS' and business_id=b.business_id)
        and (b.agent_id='AGT-01' or result_payload->>'reviewer_agent_id'=b.agent_id)
        order by updated_at limit 30)x),'[]'::jsonb),
      'rules',jsonb_build_array('Ler a versao antes de alterar; conflito exige releitura e comparacao.',
        'Registrar acao, motivo, evidencia e proximo responsavel somente em marcos relevantes.',
        'Entrega aguarda revisao; handoff cria tarefa em DRAFT e nao inicia outro modelo.',
        'WIP global 1; ate 2 tentativas por job; sem loops, gastos ou mensagens externas automaticos.',
        'Dados pessoais de Laura ficam fora da fila empresarial.'));
  end if;
  if b.scope_type='PERSONAL' or (b.scope_type='GROUP' and b.agent_id<>'AGT-01') then
    raise exception 'Perfil fora do fluxo empresarial' using errcode='42501';
  end if;
  if p_action not in ('create_task','submit_delivery','review_delivery','handoff','release_job','record_memory') then
    raise exception 'Acao desconhecida' using errcode='22023';
  end if;
  key:=nullif(btrim(p_payload->>'idempotency_key'),'');
  if key is null or length(key)>120 then raise exception 'Chave estavel obrigatoria (ate 120 caracteres)' using errcode='22023'; end if;
  request:=jsonb_build_object('profile',p_profile_slug,'action',p_action,'payload',p_payload);
  -- Serializes identical requests, including first-time task creation.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_profile_slug||':'||key,0));
  if p_action='create_task' then
    if b.agent_id not in ('AGT-01','AGT-04') then raise exception 'Somente Helena ou Marina cria fila' using errcode='42501'; end if;
    company:=nullif(p_payload->>'business_id','');
    new_job:='JOB-HR-'||md5(p_profile_slug||':'||key);
    select * into old_event from public.agent_job_events where job_id=new_job and payload->>'workflow_key'=key and event_type like 'WORKFLOW_%';
  else
    select * into j from public.agent_jobs where job_id=p_payload->>'job_id' for update;
    if not found or j.business_id is null or j.task_id is null then raise exception 'Job exige tarefa e empresa' using errcode='22023'; end if;
    company:=j.business_id;
    select * into old_event from public.agent_job_events where job_id=j.job_id and payload->>'workflow_key'=key and event_type like 'WORKFLOW_%';
  end if;
  if company is null or (b.scope_type='BUSINESS' and company is distinct from b.business_id) then
    raise exception 'Empresa fora do escopo' using errcode='42501';
  end if;
  if old_event.event_id is not null then
    if old_event.payload->'request' is distinct from request then raise exception 'Chave reutilizada com conteudo diferente' using errcode='22023'; end if;
    return old_event.payload->'response';
  end if;
  if p_action<>'create_task' then
    select * into t from public.tarefas where task_id=j.task_id for update;
    if not found or t.business_id is distinct from company then raise exception 'Tarefa e empresa divergentes' using errcode='22023'; end if;
    if p_action in ('submit_delivery','record_memory') and j.agent_id<>b.agent_id then
      raise exception 'Job pertence a outro agente' using errcode='42501';
    end if;
    if p_action='handoff' and b.agent_id not in ('AGT-01','AGT-04') then
      raise exception 'Somente Helena ou Marina encaminha tarefas apos revisao' using errcode='42501';
    end if;
    if p_action<>'record_memory' and (p_payload->>'expected_task_version')::bigint is distinct from t.row_version then
      raise exception 'CONFLITO_DE_VERSAO: releia e compare antes de gravar' using errcode='PT409';
    end if;
  end if;
  if p_action in ('create_task','handoff') then
    if nullif(btrim(p_payload->>'objective'),'') is null or nullif(btrim(p_payload->>'definition_of_done'),'') is null then
      raise exception 'Objetivo e definicao de pronto obrigatorios' using errcode='22023';
    end if;
    select * into target from public.agent_runtime_bindings where agent_id=p_payload->>'target_agent_id'
      and (scope_type='BUSINESS' and business_id=company or scope_type='GROUP' and agent_id='AGT-01') and status in ('CONFIGURED','ACTIVE') for share;
    if not found then raise exception 'Destino sem vinculo Hermes nesta empresa' using errcode='42501'; end if;
    if p_action='handoff' then
      if j.status<>'COMPLETED' or not exists(select 1 from public.agent_job_events where job_id=j.job_id and event_type='WORKFLOW_review_delivery' and payload->'request'->'payload'->>'decision'='APPROVE') then
        raise exception 'Entrega precisa de revisao aprovada antes do handoff' using errcode='22023';
      end if;
      if target.agent_id=j.agent_id then raise exception 'Handoff para si mesmo nao permitido' using errcode='22023'; end if;
      if exists(select 1 from public.agent_job_events where job_id=j.job_id and event_type='WORKFLOW_handoff') then
        raise exception 'Esta entrega ja tem proximo responsavel; consulte o handoff existente' using errcode='22023';
      end if;
      root_id:=coalesce(j.correlation_id,j.job_id);
      if (select count(*) from public.agent_jobs where correlation_id=root_id)>=10 then
        raise exception 'Limite de 10 etapas atingido; Helena precisa replanejar' using errcode='22023';
      end if;
    end if;
    suffix:=md5(p_profile_slug||':'||key);
    new_job:='JOB-HR-'||suffix; new_task:='TSK-HR-'||suffix; new_handoff:='HND-HR-'||suffix;
    select agente into target_name from public.agentes where agent_id=target.agent_id;
    insert into public.tarefas(task_id,business_id,tarefa,tipo,responsavel,prioridade,status,definicao_de_pronto,source_system,related_object_type,related_object_id,idempotency_key)
      values(new_task,company,p_payload->>'objective','OPERACIONAL',target_name,'MEDIA','NÃO INICIADA',p_payload->>'definition_of_done','HERMES','agent_jobs',new_job,'hermes:'||suffix);
    insert into public.agent_jobs(job_id,task_id,agent_id,business_id,objective,instruction,priority,status,approval_required,approval_status,max_attempts,idempotency_key,correlation_id)
      values(new_job,new_task,target.agent_id,company,p_payload->>'objective',concat_ws(E'\n',p_payload->>'instruction',case when p_action='handoff' then 'Fonte: '||j.job_id||E'\nEntrega revisada: '||left(coalesce(j.result_summary,''),1600)||E'\nEvidencias: '||j.evidence_refs::text end),'MEDIA','DRAFT',true,'PENDING',2,'hermes:'||suffix,coalesce(root_id,new_job));
    insert into public.handoffs(id,data_hora,de,para,business_id_area,assunto,contexto_essencial,pergunta_tarefa_transferida,pendencias,prioridade,status,related_object_id,scope_type)
      values(new_handoff,clock_timestamp()::text,agent_name,target_name,company,p_payload->>'objective',coalesce(j.result_summary,p_payload->>'instruction'),p_payload->>'definition_of_done','Aguardando liberacao da coordenacao','MEDIA','ABERTO',new_job,'BUSINESS');
    result:=jsonb_build_object('success',true,'job_id',new_job,'task_id',new_task,'handoff_id',new_handoff,'status','DRAFT','started',false);
  elsif p_action='submit_delivery' then
 if jsonb_typeof(p_payload->'delivery') is distinct from 'object' or p_payload->'delivery'->>'schema_version' is distinct from '1' or length(btrim(coalesce(p_payload->'delivery'->>'content',''))) < 40 or jsonb_typeof(p_payload->'delivery'->'acceptance_checks') is distinct from 'array' then raise exception 'Entrega exige material profissional e criterios verificaveis' using errcode='22023'; end if; 
    if j.status<>'RUNNING' then raise exception 'Somente job em execucao pode entregar' using errcode='22023'; end if;
    if nullif(btrim(p_payload->>'summary'),'') is null or jsonb_typeof(p_payload->'evidence_refs') is distinct from 'array' then raise exception 'Resumo e evidencias obrigatorios' using errcode='22023'; end if;
    if jsonb_array_length(p_payload->'evidence_refs')<1 or jsonb_array_length(p_payload->'evidence_refs')>10 or exists(select 1 from jsonb_array_elements(p_payload->'evidence_refs') e where jsonb_typeof(e)<>'string' or length(btrim(e#>>'{}'))=0) then
      raise exception 'Exige 1 a 10 referencias nao vazias' using errcode='22023';
    end if;
    if j.agent_id='AGT-01' then reviewer:='FOUNDER';
    else reviewer:=case j.agent_id when 'AGT-09' then 'AGT-13' when 'AGT-11' then 'AGT-03' when 'AGT-12' then 'AGT-10' when 'AGT-14' then 'AGT-04' when 'AGT-16' then 'AGT-03' when 'AGT-17' then 'AGT-16' when 'AGT-18' then 'AGT-06' when 'AGT-20' then 'AGT-19' when 'AGT-21' then 'AGT-14' else 'AGT-01' end; end if;
    update public.agent_jobs set status='WAITING_HELENA',result_summary=p_payload->>'summary',evidence_refs=p_payload->'evidence_refs',updated_at=clock_timestamp(),result_payload=coalesce(result_payload,'{}'::jsonb)||jsonb_build_object('reviewer_agent_id',reviewer,'review_pending',true)||jsonb_build_object('delivery',p_payload->'delivery','quality_review',null,'quality_version','helena-delivery-quality-v1')||jsonb_build_object('publication',p_payload->'publication','visual_review',null) where job_id=j.job_id;
    perform public.helena_write_record('tarefas',t.task_id,t.row_version,jsonb_build_object('status','BLOQUEADA','bloqueio','Aguardando revisao de '||reviewer,'evidencia',p_payload->>'summary'||E'\n'||(p_payload->'evidence_refs')::text));
    select agente into target_name from public.agentes where agent_id=reviewer;
    insert into public.handoffs(id,data_hora,de,para,business_id_area,assunto,contexto_essencial,pergunta_tarefa_transferida,pendencias,prioridade,status,related_object_id,scope_type)
      values('HND-REVIEW-'||md5(p_profile_slug||':'||key),clock_timestamp()::text,agent_name,coalesce(target_name,'Fundador'),company,
      'Revisar: '||j.objective,p_payload->>'summary','Conferir evidencias e definicao de pronto. Aprovar ou pedir ajustes.','Aguardando revisao','MEDIA','ABERTO',j.job_id,'BUSINESS');
    result:=jsonb_build_object('success',true,'job_id',j.job_id,'status','WAITING_HELENA','reviewer_agent_id',reviewer,'completed',false);
  elsif p_action='review_delivery' then
 if p_payload->>'decision'='APPROVE' and (jsonb_typeof(j.result_payload->'delivery') is distinct from 'object' or jsonb_typeof(p_payload->'quality_review') is distinct from 'object' or p_payload->'quality_review'->>'requirements_met' is distinct from 'true') then raise exception 'Aprovacao exige entrega profissional e revisao de qualidade' using errcode='22023'; end if; 
    if j.agent_id=b.agent_id or (b.agent_id<>'AGT-01' and b.agent_id is distinct from j.result_payload->>'reviewer_agent_id') then raise exception 'Revisor nao autorizado ou autoaprovacao' using errcode='42501'; end if;
    if j.status<>'WAITING_HELENA' or j.result_payload->>'review_pending' is distinct from 'true' then raise exception 'Entrega nao esta aguardando revisao' using errcode='22023'; end if;
    if p_payload->>'decision' not in ('APPROVE','REQUEST_CHANGES') or p_payload->>'decision' is null or nullif(btrim(p_payload->>'reason'),'') is null then raise exception 'Decisao e motivo obrigatorios' using errcode='22023'; end if;
    update public.agent_jobs set status=case when p_payload->>'decision'='APPROVE' then 'COMPLETED' else 'DRAFT' end,
      completed_at=case when p_payload->>'decision'='APPROVE' then clock_timestamp() else null end,
      approval_status=case when p_payload->>'decision'='APPROVE' then 'APPROVED' else 'PENDING' end,
      result_payload=result_payload||jsonb_build_object('review_pending',false,'reviewed_by',b.agent_id,'review_reason',p_payload->>'reason')||jsonb_build_object('quality_review',p_payload->'quality_review')||jsonb_build_object('visual_review',p_payload->'visual_review'),updated_at=clock_timestamp() where job_id=j.job_id;
    perform public.helena_write_record('tarefas',t.task_id,t.row_version,jsonb_build_object('status',case when p_payload->>'decision'='APPROVE' then 'CONCLUÍDA' else 'BLOQUEADA' end,'bloqueio',case when p_payload->>'decision'='APPROVE' then null else 'Ajustes solicitados: '||(p_payload->>'reason') end));
    for h in select * from public.handoffs where related_object_id=j.job_id and status='ABERTO' for update loop
      perform public.helena_write_record('handoffs',h.id,h.row_version,jsonb_build_object('status',case when p_payload->>'decision'='APPROVE' then 'CONCLUÍDO' else 'ABERTO' end,'retorno_conclusao',p_payload->>'reason','pendencias',case when p_payload->>'decision'='APPROVE' then null else p_payload->>'reason' end));
    end loop;
    result:=jsonb_build_object('success',true,'job_id',j.job_id,'decision',p_payload->>'decision','completed',p_payload->>'decision'='APPROVE');
  elsif p_action='release_job' then
    if b.agent_id not in ('AGT-01','AGT-04') then raise exception 'Somente coordenacao libera' using errcode='42501'; end if;
    if j.status<>'DRAFT' or coalesce(j.attempt_count,0)>=least(coalesce(j.max_attempts,2),2) then raise exception 'Job fora do estado ou limite de tentativas' using errcode='22023'; end if;
    perform 1 from public.agent_runtime_bindings where agent_id=j.agent_id and status='ACTIVE' and provider='HERMES' and (business_id=company or scope_type='GROUP' and agent_id='AGT-01') for share;
    if not found then raise exception 'Executor ainda nao esta ativo' using errcode='42501'; end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('hermes:global-wip',0));
    if exists(select 1 from public.agent_jobs where status in ('READY','CLAIMED','RUNNING')) then raise exception 'WIP 1: outra execucao ja esta liberada' using errcode='22023'; end if;
    update public.agent_jobs set status='READY',approval_status='APPROVED',available_at=clock_timestamp(),updated_at=clock_timestamp() where job_id=j.job_id;
    perform public.helena_write_record('tarefas',t.task_id,t.row_version,jsonb_build_object('status','NÃO INICIADA','bloqueio',null));
    result:=jsonb_build_object('success',true,'job_id',j.job_id,'status','READY','started',false);
  elsif p_action='record_memory' then
    if j.status not in ('RUNNING','WAITING_HELENA') or nullif(btrim(p_payload->>'summary'),'') is null or nullif(btrim(p_payload->>'source'),'') is null then raise exception 'Memoria exige job ativo, registro e fonte' using errcode='22023'; end if;
    suffix:=md5(p_profile_slug||':'||key);
    insert into public.memoria_mestre(id,data_hora,tipo,business_id_area,agente_origem,assunto,registro,evidencia_origem,status,confianca,related_object_type,related_object_id,proxima_acao,responsavel,scope_type)
      values('MEM-HR-'||suffix,clock_timestamp()::text,'REGISTRO OPERACIONAL',company,agent_name,j.objective,p_payload->>'summary',p_payload->>'source','ATIVO','RELATO DO AGENTE','agent_jobs',j.job_id,p_payload->>'next_step',agent_name,'BUSINESS');
    result:=jsonb_build_object('success',true,'memory_id','MEM-HR-'||suffix,'job_id',j.job_id);
  end if;
  insert into public.agent_job_events(job_id,agent_id,business_id,event_type,status,message,payload,correlation_id)
    values(coalesce(j.job_id,new_job),b.agent_id,company,'WORKFLOW_'||p_action,(select status from public.agent_jobs where job_id=coalesce(j.job_id,new_job)),
      'Hermes: '||p_action,jsonb_build_object('workflow_key',key,'request',request,'response',result,'profile_slug',p_profile_slug),coalesce(j.correlation_id,new_job));
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.helena_guard_checkpoint()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare expected text;
begin
 expected:=nullif(current_setting('helena.checkpoint_predecessor',true),'');
 if expected is null then raise exception 'Use helena_publish_checkpoint com o predecessor lido' using errcode='P0001'; end if;
 if TG_OP='DELETE' then raise exception 'Versões do checkpoint não podem ser excluídas' using errcode='42501'; end if;
 if TG_OP='UPDATE' then
   if OLD.checkpoint_id<>expected or OLD.status<>'ATIVO' or NEW.status<>'SUPERADO'
     or (to_jsonb(NEW)-'status'-'atualizado_em') is distinct from (to_jsonb(OLD)-'status'-'atualizado_em') then
     raise exception 'Checkpoint histórico imutável' using errcode='42501';
   end if;
 elsif NEW.status<>'ATIVO' or NEW.checkpoint_anterior_id is distinct from expected
   or not exists(select 1 from public.checkpoint_mestre c where c.checkpoint_id=expected and c.status='SUPERADO' and c.versao+1=NEW.versao) then
   raise exception 'Predecessor do checkpoint inconsistente' using errcode='PT409';
 end if;
 return NEW;
end;
$function$;

CREATE OR REPLACE FUNCTION public.helena_publish_checkpoint(p_expected_checkpoint_id text, p_titulo text, p_resumo_executivo text, p_conteudo_markdown text, p_snapshot jsonb, p_mudancas_desde_anterior jsonb DEFAULT '[]'::jsonb, p_fontes jsonb DEFAULT '[]'::jsonb, p_criado_por text DEFAULT 'AGT-01 Helena'::text, p_motivo text DEFAULT NULL::text)
 RETURNS checkpoint_mestre
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare current_id text; result public.checkpoint_mestre; previous_guard text;
begin
 lock table public.checkpoint_mestre in share row exclusive mode;
 select checkpoint_id into current_id from public.checkpoint_mestre where status='ATIVO';
 if p_expected_checkpoint_id is null or current_id is distinct from p_expected_checkpoint_id then
   raise exception 'Outro chat publicou um checkpoint. Releia e reconcilie antes de publicar.' using errcode='PT409';
 end if;
 previous_guard:=current_setting('helena.checkpoint_predecessor',true);
 perform set_config('helena.checkpoint_predecessor',current_id,true);
 select * into result from public.registrar_checkpoint_mestre(
   p_titulo,p_resumo_executivo,p_conteudo_markdown,p_snapshot,p_mudancas_desde_anterior,p_fontes,p_criado_por,p_motivo);
 perform set_config('helena.checkpoint_predecessor',coalesce(previous_guard,''),true);
 return result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.helena_sync_calendar(p_source text, p_id text, p_expected_version bigint)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare source_row jsonb; plans jsonb; plan jsonb; desired jsonb; existing_row jsonb; day_value text; source_pk text;
begin
 if p_source not in ('tarefas','crm') or p_source is null or p_expected_version is null then
   raise exception 'Fonte e versão obrigatórias para sincronizar a agenda' using errcode='22023';
 end if;
 source_pk:=case when p_source='tarefas' then 'task_id' else 'opportunity_id' end;
 execute format('select to_jsonb(t) from public.%I t where %I=$1 for update',p_source,source_pk)
   into source_row using p_id;
 if source_row is null then raise exception 'Fonte indisponível para este acesso' using errcode='42501'; end if;
 if (source_row->>'row_version')::bigint<>p_expected_version then
   raise exception 'A fonte da agenda mudou. Releia antes de sincronizar.' using errcode='PT409';
 end if;
 if p_source='tarefas' then
   day_value:=coalesce(public.helena_calendar_day(source_row->>'prazo'),public.helena_calendar_day(source_row->>'occurrence_date'),public.helena_calendar_day(source_row->>'created_at'));
   plans:=jsonb_build_array(jsonb_build_object('id','EVT-TSK-'||p_id,'day',day_value,'hour','09','end','10','title',source_row->>'tarefa',
      'description',concat_ws(' · ',nullif(source_row->>'status',''),nullif(source_row->>'prioridade',''),nullif(source_row->>'bloqueio',''))));
 else
   plans:=jsonb_build_array(
     jsonb_build_object('id','EVT-CRM-'||p_id||'-PROX','day',public.helena_calendar_day(source_row->>'data_proxima_acao'),'hour','09','end','10',
       'title','Follow-up: '||coalesce(source_row->>'empresa_lead',''),'description',coalesce(source_row->>'proxima_acao','Próxima ação do pipeline')),
     jsonb_build_object('id','EVT-CRM-'||p_id||'-FECH','day',public.helena_calendar_day(source_row->>'fechamento_previsto'),'hour','14','end','15',
       'title','Previsão fechamento: '||coalesce(source_row->>'empresa_lead',''),'description',coalesce(source_row->>'proxima_acao','Data prevista de fechamento')));
 end if;
 for plan in select value from jsonb_array_elements(plans) loop
   select to_jsonb(c) into existing_row from public.calendario c where event_id=plan->>'id' for update;
   if existing_row is not null and (
     existing_row->>'related_object_type' is distinct from p_source or
     existing_row->>'related_object_id' is distinct from p_id
   ) then raise exception 'Identificador da agenda pertence a outra origem' using errcode='23505'; end if;
   if plan->>'day' is null then
     if existing_row is not null then
       perform public.helena_write_record('calendario',plan->>'id',(existing_row->>'row_version')::bigint,'{}',true);
     end if;
     continue;
   end if;
   desired:=jsonb_build_object('event_id',plan->>'id','business_id',source_row->>'business_id',
     'tipo',case when p_source='tarefas' then 'TAREFA' else 'CRM' end,
     'titulo',plan->>'title','descricao',plan->>'description',
     'inicio',(plan->>'day')||'T'||(plan->>'hour')||':00:00',
     'fim',(plan->>'day')||'T'||(plan->>'end')||':00:00',
     'status',case when p_source='tarefas' then coalesce(source_row->>'status','ABERTO') else 'ABERTO' end,
     'related_object_type',p_source,'related_object_id',p_id,'source_system','HELENA');
   if existing_row is null then
     insert into public.calendario(event_id,business_id,tipo,titulo,descricao,inicio,fim,status,related_object_type,related_object_id,source_system)
       select x.event_id,x.business_id,x.tipo,x.titulo,x.descricao,x.inicio,x.fim,x.status,x.related_object_type,x.related_object_id,x.source_system
       from jsonb_populate_record(null::public.calendario,desired) x;
   elsif not(existing_row @> desired) then
     perform public.helena_write_record('calendario',plan->>'id',(existing_row->>'row_version')::bigint,desired,false);
   end if;
 end loop;
end;
$function$;

CREATE OR REPLACE FUNCTION public.helena_write_record(p_table text, p_id text, p_expected_version bigint, p_changes jsonb DEFAULT '{}'::jsonb, p_delete boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  pk text; pk_type text; before_row jsonb; after_row jsonb; changes jsonb;
  assignments text; previous_guard text; field text;
begin
  if p_table is null or not(p_table=any(public.helena_concurrency_tables())) then
    raise exception 'Tabela fora do contrato de escrita protegida' using errcode='22023';
  end if;
  if p_id is null or p_expected_version is null or p_expected_version<1 or p_delete is null
    or jsonb_typeof(p_changes) is distinct from 'object' then
    raise exception 'Identificador, versão lida e alterações válidas são obrigatórios' using errcode='22023';
  end if;
  select a.attname,pg_catalog.format_type(a.atttypid,a.atttypmod) into strict pk,pk_type
    from pg_catalog.pg_constraint c join pg_catalog.pg_class t on t.oid=c.conrelid
    join pg_catalog.pg_namespace ns on ns.oid=t.relnamespace
    join pg_catalog.pg_attribute a on a.attrelid=t.oid and a.attnum=c.conkey[1]
    where ns.nspname='public' and t.relname=p_table and c.contype='p' and cardinality(c.conkey)=1;
  execute format('select to_jsonb(t) from public.%I t where %I=$1::%s for update',p_table,pk,pk_type)
    into before_row using p_id;
  if before_row is null then
    raise exception 'Registro indisponível para este acesso' using errcode='42501';
  end if;
  if (before_row->>'row_version')::bigint<>p_expected_version then
    raise exception 'Outra conversa ou pessoa alterou este registro. Seu rascunho foi preservado; releia e compare antes de salvar.'
      using errcode='PT409',hint='CONFLITO_DE_VERSAO: releia o registro e compare; não repetir automaticamente.';
  end if;
  if p_delete and p_table=any(array['memoria_mestre','decisoes','auditoria_sistema','helena_guia','protocolo_agentes']) then
    raise exception 'Preserve o histórico: encerre ou substitua o registro, sem excluir' using errcode='42501';
  end if;
  changes:=p_changes;
  if changes ? pk then
    if changes->>pk is distinct from p_id then
      raise exception 'A chave do registro não pode ser alterada' using errcode='22023';
    end if;
    changes:=changes-pk;
  end if;
  for field in select jsonb_object_keys(changes) loop
    if field=any(array['row_version','criado_em','created_at','atualizado_em','updated_at']) or not exists(
      select 1 from pg_catalog.pg_attribute a join pg_catalog.pg_class t on t.oid=a.attrelid
        join pg_catalog.pg_namespace n on n.oid=t.relnamespace
      where n.nspname='public' and t.relname=p_table and a.attname=field and a.attnum>0
        and not a.attisdropped and a.attgenerated='' and a.attidentity=''
    ) then raise exception 'Campo não editável: %',field using errcode='22023'; end if;
  end loop;
  if not p_delete and changes='{}'::jsonb then return before_row; end if;
  previous_guard:=current_setting('helena.write_guard',true);
  perform set_config('helena.write_guard',jsonb_build_object(
    'table',p_table,'id',p_id,'version',p_expected_version::text,
    'operation',case when p_delete then 'DELETE' else 'UPDATE' end
  )::text,true);
  if p_delete then
    execute format('delete from public.%I where %I=$1::%s returning to_jsonb(%I.*)',p_table,pk,pk_type,p_table)
      into after_row using p_id;
  else
    select string_agg(format('%I=(jsonb_populate_record(null::public.%I,$1)).%I',k,p_table,k),', ' order by k)
      into assignments from jsonb_object_keys(changes) k;
    execute format('update public.%I set %s where %I=$2::%s returning to_jsonb(%I.*)',p_table,assignments,pk,pk_type,p_table)
      into after_row using changes,p_id;
  end if;
  perform set_config('helena.write_guard',coalesce(previous_guard,''),true);
  if after_row is null then raise exception 'Alteração não autorizada para este acesso' using errcode='42501'; end if;
  return after_row;
end;
$function$;
