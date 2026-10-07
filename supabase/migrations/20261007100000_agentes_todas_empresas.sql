-- Agentes atendendo todas as empresas (autorizado pelo Fundador em 2026-10-07: "pode fazer todas as empresas").
-- Reaproveita agent_business_scopes (nao cria tabela). Cada perfil Hermes continua unico por agente;
-- a empresa de cada entrega e sempre a da tarefa/job. Isolamento preservado: so empresas com escopo
-- AUTHORIZED + CONFIRMED (ou o vinculo original) passam. Somente as comparacoes de empresa mudaram.
begin;

create or replace function public.helena_agent_serves(p_agent_id text, p_business_id text)
 returns boolean
 language sql
 stable
 security definer
 set search_path to ''
as $$
  select p_business_id is not null and (
    exists (select 1 from public.agent_runtime_bindings b
            where b.agent_id = p_agent_id and b.provider = 'HERMES' and b.status in ('ACTIVE','CONFIGURED')
              and (b.business_id = p_business_id or (b.scope_type = 'GROUP' and b.agent_id = 'AGT-01')))
    or exists (select 1 from public.agent_business_scopes s
               join public.agent_runtime_bindings b on b.agent_id = s.agent_id and b.provider = 'HERMES' and b.scope_type = 'BUSINESS'
               where s.agent_id = p_agent_id and s.business_id = p_business_id
                 and s.authorization_status = 'AUTHORIZED' and s.runtime_status = 'CONFIRMED')
  );
$$;
revoke all on function public.helena_agent_serves(text, text) from public, anon, authenticated;
grant execute on function public.helena_agent_serves(text, text) to service_role;

-- agent_job_hermes_execution_guard
CREATE OR REPLACE FUNCTION public.agent_job_hermes_execution_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if new.status not in ('CLAIMED', 'RUNNING') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    raise exception 'execution_requires_ready_job';
  end if;
  if (new.status = 'CLAIMED' and old.status <> 'READY')
     or (new.status = 'RUNNING' and old.status <> 'CLAIMED') then
    raise exception 'invalid_execution_transition:%->%', old.status, new.status;
  end if;
  if new.task_id is null or new.business_id is null then
    raise exception 'execution_requires_task_and_business';
  end if;

  perform 1
  from public.agent_runtime_bindings b
  join public.tarefas t on t.task_id = new.task_id
  where b.agent_id = new.agent_id
    and b.status = 'ACTIVE'
    and b.provider = 'HERMES'
    and (
      (b.scope_type = 'BUSINESS' and public.helena_agent_serves(b.agent_id, new.business_id))
      or (new.agent_id = 'AGT-01' and b.scope_type = 'GROUP')
    )
    and t.business_id = new.business_id
  for share of b;
  if not found then
    raise exception 'hermes_runtime_not_active_or_task_business_mismatch';
  end if;

  return new;
end;
$function$;

-- gateway_claim_agent_job
CREATE OR REPLACE FUNCTION public.gateway_claim_agent_job(p_job_id text, p_agent_id text)
 RETURNS agent_jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_job public.agent_jobs;
begin
  perform 1
  from public.agent_jobs j
  join public.tarefas t on t.task_id = j.task_id and t.business_id = j.business_id
  join public.agent_runtime_bindings b on b.agent_id = j.agent_id
  where j.job_id = p_job_id
    and j.agent_id = p_agent_id
    and j.status = 'READY'
    and j.task_id is not null
    and j.business_id is not null
    and coalesce(j.available_at, now()) <= now()
    and (coalesce(j.approval_required,false) = false or j.approval_status = 'APPROVED')
    and b.status = 'ACTIVE'
    and b.provider = 'HERMES'
    and (
      (b.scope_type = 'BUSINESS' and public.helena_agent_serves(b.agent_id, j.business_id))
      or (p_agent_id = 'AGT-01' and b.scope_type = 'GROUP')
    )
  for share of b;

  if not found then return null; end if;

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

  if not found then return null; end if;

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

-- gateway_start_agent_job
CREATE OR REPLACE FUNCTION public.gateway_start_agent_job(p_job_id text, p_agent_id text)
 RETURNS agent_jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_job public.agent_jobs;
begin
  perform 1
  from public.agent_jobs j
  join public.tarefas t on t.task_id = j.task_id and t.business_id = j.business_id
  join public.agent_runtime_bindings b on b.agent_id = j.agent_id
  where j.job_id = p_job_id
    and j.agent_id = p_agent_id
    and j.status = 'CLAIMED'
    and j.task_id is not null
    and j.business_id is not null
    and b.status = 'ACTIVE'
    and b.provider = 'HERMES'
    and (
      (b.scope_type = 'BUSINESS' and public.helena_agent_serves(b.agent_id, j.business_id))
      or (p_agent_id = 'AGT-01' and b.scope_type = 'GROUP')
    )
  for share of b;

  if not found then return null; end if;

  update public.agent_jobs
  set status = 'RUNNING',
      started_at = coalesce(started_at, now()),
      updated_at = now()
  where job_id = p_job_id
    and agent_id = p_agent_id
    and status = 'CLAIMED'
  returning * into v_job;

  if not found then return null; end if;

  insert into public.agent_job_events (
    job_id, agent_id, business_id, event_type, status, message, correlation_id
  ) values (
    v_job.job_id, v_job.agent_id, v_job.business_id,
    'STARTED', v_job.status, 'Execucao iniciada pelo agente.', v_job.correlation_id
  );

  return v_job;
end;
$function$;

-- gateway_adopt_existing_task
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
  if coordinator.scope_type = 'BUSINESS' and not public.helena_agent_serves(coordinator.agent_id, task_row.business_id) then
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
      and scope_type = 'BUSINESS' and public.helena_agent_serves(agent_id, task_row.business_id) for share;
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

-- gateway_context
CREATE OR REPLACE FUNCTION public.gateway_context(p_profile_slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$

declare

  b public.agent_runtime_bindings;

  agent_name text;

  result jsonb;

begin

  select * into b from public.agent_runtime_bindings where profile_slug = p_profile_slug for share;

  if not found or b.provider <> 'HERMES' or b.status <> 'ACTIVE' then

    raise exception 'Perfil Hermes nao ativo' using errcode = '42501';

  end if;

  select a.agente into agent_name from public.agentes a where a.agent_id = b.agent_id;

  select jsonb_build_object(

    'context_version', 'hermes-context-v2',

    'truncated', false,

    'profile', jsonb_build_object('profile_slug', b.profile_slug, 'agent_id', b.agent_id, 'business_id', b.business_id, 'scope_type', b.scope_type, 'provider', b.provider, 'status', b.status),

    'role', (select jsonb_build_object('agent_id', a.agent_id, 'name', left(coalesce(a.agente, ''), 100), 'function', left(coalesce(a.cargo_funcao, ''), 180), 'status', a.status) from public.agentes a where a.agent_id = b.agent_id),

    'checkpoint', (select jsonb_build_object('checkpoint_id', c.checkpoint_id, 'summary', left(coalesce(c.resumo_executivo, ''), 2200)) from public.checkpoint_mestre_atual c order by c.checkpoint_id desc limit 1),

    'fleet', jsonb_build_object(

      'total', (select count(*) from public.agentes),

      'agents', coalesce((select jsonb_agg(x order by x.agent_id) from (

        select a.agent_id, left(coalesce(a.agente, ''), 80) as name, left(coalesce(a.cargo_funcao, ''), 140) as function, a.status,

          case when exists (select 1 from public.agent_runtime_bindings rb where rb.agent_id = a.agent_id and rb.provider = 'HERMES' and rb.status = 'ACTIVE' and ((b.scope_type = 'GROUP' and b.agent_id = 'AGT-01') or rb.scope_type = 'GROUP' or rb.business_id = b.business_id)) then 'ACTIVE'

               when exists (select 1 from public.agent_runtime_bindings rb where rb.agent_id = a.agent_id and rb.provider = 'HERMES' and rb.status = 'CONFIGURED' and ((b.scope_type = 'GROUP' and b.agent_id = 'AGT-01') or rb.scope_type = 'GROUP' or rb.business_id = b.business_id)) then 'CONFIGURED'

               else 'MISSING' end as runtime_status

        from public.agentes a

      ) x), '[]'::jsonb)

    ),

    'queue_summary', jsonb_build_object(

      'business_id', b.business_id,

      'open_tasks', (select count(*) from public.tarefas t where (b.scope_type = 'GROUP' and b.agent_id = 'AGT-01') or (b.scope_type = 'BUSINESS' and public.helena_agent_serves(b.agent_id, t.business_id))),

      'ready_jobs', (select count(*) from public.agent_jobs j where j.status = 'READY' and ((b.scope_type = 'GROUP' and b.agent_id = 'AGT-01') or (b.scope_type = 'BUSINESS' and public.helena_agent_serves(b.agent_id, j.business_id)))),

      'pending_reviews', (select count(*) from public.agent_jobs j where j.status = 'WAITING_HELENA' and ((b.agent_id = 'AGT-01') or j.result_payload->>'reviewer_agent_id' = b.agent_id) and ((b.scope_type = 'GROUP' and b.agent_id = 'AGT-01') or (b.scope_type = 'BUSINESS' and public.helena_agent_serves(b.agent_id, j.business_id))))

    ),

    'tasks', coalesce((select jsonb_agg(x) from (

      select t.task_id, t.business_id, left(coalesce(t.tarefa, ''), 180) as title, left(coalesce(t.responsavel, ''), 100) as responsible, t.status, left(coalesce(t.bloqueio, ''), 180) as blocking, t.row_version

      from public.tarefas t

      where ((b.scope_type = 'GROUP' and b.agent_id = 'AGT-01') or (b.scope_type = 'BUSINESS' and public.helena_agent_serves(b.agent_id, t.business_id))) and (b.agent_id in ('AGT-01', 'AGT-04') or t.responsavel = agent_name)

      order by t.atualizado_em desc limit 12

    ) x), '[]'::jsonb),

    'pending_reviews_detail', coalesce((select jsonb_agg(x) from (

      select j.job_id, j.business_id, j.agent_id, left(coalesce(j.objective, ''), 180) as objective, j.status, left(coalesce(j.result_summary, ''), 240) as result_summary, j.updated_at

      from public.agent_jobs j

      where j.status = 'WAITING_HELENA' and ((b.agent_id = 'AGT-01') or j.result_payload->>'reviewer_agent_id' = b.agent_id) and ((b.scope_type = 'GROUP' and b.agent_id = 'AGT-01') or (b.scope_type = 'BUSINESS' and public.helena_agent_serves(b.agent_id, j.business_id)))

      order by j.updated_at desc limit 8

    ) x), '[]'::jsonb),

    'handoffs', coalesce((select jsonb_agg(x) from (

      select h.id, h.de, h.para, h.business_id_area, left(coalesce(h.assunto, ''), 160) as subject, h.status, h.related_object_id, h.row_version

      from public.handoffs h

      where ((b.scope_type = 'GROUP' and b.agent_id = 'AGT-01' and h.scope_type <> 'PERSONAL') or (b.scope_type = 'BUSINESS' and public.helena_agent_serves(b.agent_id, h.business_id_area))) and (b.agent_id in ('AGT-01', 'AGT-04') or h.para = agent_name or h.de = agent_name)

      order by h.criado_em desc limit 8

    ) x), '[]'::jsonb),

    

    'validated_learnings', coalesce((select jsonb_agg(x) from (

      select m.id,j.job_id,j.business_id,j.agent_id,left(m.registro,2000) as lesson,

        left(m.evidencia_origem,500) as evidence, m.row_version

      from public.memoria_mestre m join public.agent_jobs j on j.job_id=m.related_object_id

      where m.scope_type='BUSINESS' and m.status='ATIVO' and m.business_id_area=j.business_id

      and m.registro like 'VALIDADA NO ESCOPO%'

      and j.status='COMPLETED' and j.result_payload->>'review_pending'='false'

      and j.evidence_refs @> jsonb_build_array(m.id)

      and ((b.scope_type='GROUP' and b.agent_id='AGT-01') or (b.scope_type='BUSINESS' and public.helena_agent_serves(b.agent_id, j.business_id)))

      and (b.agent_id in ('AGT-01','AGT-04') or j.agent_id=b.agent_id)

      and exists(select 1 from public.agent_job_events e where e.job_id=j.job_id

        and e.event_type='WORKFLOW_review_delivery' and e.agent_id<>j.agent_id

        and e.payload->'request'->'payload'->>'decision'='APPROVE')

      order by m.criado_em desc limit 5

    ) x),'[]'::jsonb),

    'rules', jsonb_build_array('Ler a versao antes de alterar; conflito exige releitura e comparacao.', 'Registrar acao, motivo, evidencia e proximo responsavel somente em marcos relevantes.', 'Entrega aguarda revisao; handoff cria tarefa em DRAFT e nao inicia outro modelo.', 'WIP global 1; ate 2 tentativas por job; sem loops, gastos ou mensagens externas automaticos.', 'Use get_job para detalhes do job; este contexto e um indice compacto, nao substitui a leitura da tarefa.')

  ) into result;

  return result;

end;

$function$;

-- gateway_list_recovery_candidates
CREATE OR REPLACE FUNCTION public.gateway_list_recovery_candidates(p_profile_slug text, p_limit integer DEFAULT 25, p_after_job_id text DEFAULT NULL::text, p_created_after timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$

declare b public.agent_runtime_bindings; result jsonb;

begin

 select * into b from public.agent_runtime_bindings where profile_slug=p_profile_slug for share;

 if not found or b.status<>'ACTIVE' or b.provider<>'HERMES' or b.agent_id not in ('AGT-01','AGT-04')

 or not (b.scope_type='BUSINESS' or (b.scope_type='GROUP' and b.agent_id='AGT-01')) then

 raise exception 'Coordenacao ativa obrigatoria' using errcode='42501'; end if;

 if p_limit is null or p_limit not between 1 and 25 then raise exception 'Limite invalido' using errcode='22023'; end if;

 select coalesce(jsonb_agg(x order by x.job_id),'[]'::jsonb) into result from (

 select j.job_id,j.task_id,j.agent_id,j.business_id,j.status,j.created_at,j.updated_at,j.attempt_count,j.max_attempts,j.error_code,

 case when exists(select 1 from public.agent_workflow_runs q where q.job_id=j.job_id

   and q.job_updated_at=j.updated_at and q.task_version=t.row_version

   and (q.status='NEEDS_ATTENTION' or (q.status='STARTED' and q.lease_until<clock_timestamp()))) then 'WORKFLOW_STALLED'

 when j.status='FAILED' then 'FAILURE' when j.status in ('CLAIMED','RUNNING') then 'STALE_EXECUTION'

 when j.result_payload->>'review_pending'='true' then 'PENDING_REVIEW' else 'MANAGER_DECISION' end as attention_kind

 from public.agent_jobs j join public.tarefas t on t.task_id=j.task_id and t.business_id=j.business_id

 where j.task_id is not null and j.business_id is not null

 and ((b.scope_type='GROUP' and b.agent_id='AGT-01') or public.helena_agent_serves(b.agent_id, j.business_id))

 and (p_after_job_id is null or j.job_id>p_after_job_id)

 and (p_created_after is null or j.created_at>=p_created_after)

 and (exists(select 1 from public.agent_workflow_runs q where q.job_id=j.job_id

   and q.job_updated_at=j.updated_at and q.task_version=t.row_version

   and (q.status='NEEDS_ATTENTION' or (q.status='STARTED' and q.lease_until<clock_timestamp())))

 or j.status in ('FAILED','WAITING_HELENA') or (j.status in ('CLAIMED','RUNNING')

 and j.updated_at<clock_timestamp()-interval '30 minutes')) order by j.job_id limit p_limit+1

 ) x;

 return jsonb_build_object('success',true,'candidates',(select coalesce(jsonb_agg(v order by ord),'[]'::jsonb)

 from jsonb_array_elements(result) with ordinality a(v,ord) where ord<=p_limit),

 'next_cursor',case when jsonb_array_length(result)>p_limit then result->(p_limit-1)->>'job_id' else null end);

end; $function$;

-- gateway_workflow_candidates
CREATE OR REPLACE FUNCTION public.gateway_workflow_candidates(p_profile_slug text, p_created_after timestamp with time zone, p_adopt_job_ids text[] DEFAULT '{}'::text[], p_after_job_id text DEFAULT NULL::text, p_limit integer DEFAULT 25)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$

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

  and ((b.scope_type='GROUP' and b.agent_id='AGT-01') or public.helena_agent_serves(b.agent_id, j.business_id))

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

end; $function$;

-- gateway_record_queue_attention
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

 if b.scope_type='BUSINESS' and not public.helena_agent_serves(b.agent_id, j.business_id) then

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

-- gateway_resolve_job_block
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

 if b.scope_type='BUSINESS' and not public.helena_agent_serves(b.agent_id, j.business_id) then raise exception 'Empresa fora do escopo' using errcode='42501'; end if;

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

-- gateway_revise_task_brief
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
     and not public.helena_agent_serves(coordinator.agent_id, job_row.business_id) then
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

-- gateway_workflow_checkpoint
CREATE OR REPLACE FUNCTION public.gateway_workflow_checkpoint(p_profile_slug text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$

declare b public.agent_runtime_bindings; j public.agent_jobs; t public.tarefas; r public.agent_workflow_runs;

 action text:=p_payload->>'action'; v_phase text:=p_payload->>'phase'; changed boolean; recovered_at timestamptz;

begin

 if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>4096 then raise exception 'Registro invalido' using errcode='22023'; end if;

 select * into b from public.agent_runtime_bindings where profile_slug=p_profile_slug for share;

 if not found or b.status<>'ACTIVE' or b.provider<>'HERMES' or b.agent_id not in ('AGT-01','AGT-04') or not (b.scope_type='BUSINESS' or (b.scope_type='GROUP' and b.agent_id='AGT-01')) then raise exception 'Coordenacao ativa obrigatoria' using errcode='42501'; end if;

 if action='list' then return jsonb_build_object('success',true,'runs',coalesce((select jsonb_agg(to_jsonb(x)) from (

 select q.* from public.agent_workflow_runs q where q.status in ('STARTED','NEEDS_ATTENTION') and ((b.scope_type='GROUP' and b.agent_id='AGT-01') or public.helena_agent_serves(b.agent_id, q.business_id)) and (p_payload->>'after_run_id' is null or q.run_id>(p_payload->>'after_run_id')::uuid) order by q.run_id limit 100) x),'[]'::jsonb)); end if;

 if action='reserve' then

 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('hermes:global-wip',0)) then raise exception 'WIP 1: transicao concorrente; reconciliar estado' using errcode='55000'; end if;

 select * into j from public.agent_jobs where job_id=p_payload->>'job_id' for update;

 if not found or j.task_id is null or j.business_id is null then raise exception 'Job empresarial obrigatorio'; end if;

 if b.scope_type='BUSINESS' and not public.helena_agent_serves(b.agent_id, j.business_id) then raise exception 'Empresa fora do escopo' using errcode='42501'; end if;

 select * into t from public.tarefas where task_id=j.task_id and business_id=j.business_id for share;

 if not found or t.row_version is distinct from (p_payload->>'expected_task_version')::bigint or j.status is distinct from p_payload->>'expected_status' or j.updated_at is distinct from (p_payload->>'expected_updated_at')::timestamptz then return jsonb_build_object('success',true,'status','STATE_CHANGED','reserved',false); end if;

 if v_phase is distinct from public.gateway_workflow_phase(j) then raise exception 'Etapa divergente' using errcode='22023'; end if;

 if v_phase in ('COORDINATE','RESOLVE') and coalesce(j.attempt_count,0)>=least(coalesce(j.max_attempts,2),2) then return jsonb_build_object('success',true,'status','ATTEMPT_LIMIT','reserved',false); end if;

 select * into r from public.agent_workflow_runs where job_id=j.job_id and phase=v_phase and (fingerprint=p_payload->>'fingerprint' or (task_version=t.row_version and job_updated_at=j.updated_at)) limit 1;

 if found then return jsonb_build_object('success',true,'status','UNCHANGED_NO_RETRY','reserved',false); end if;

 if exists(select 1 from public.agent_jobs where status in ('READY','CLAIMED','RUNNING')) or exists(select 1 from public.agent_workflow_runs where status='STARTED' and lease_until>clock_timestamp()) then return jsonb_build_object('success',true,'status','EXECUTOR_BUSY','reserved',false); end if;

 insert into public.agent_workflow_runs(job_id,business_id,phase,fingerprint,task_version,job_status,job_updated_at,profile_slug) values(j.job_id,j.business_id,v_phase,p_payload->>'fingerprint',t.row_version,j.status,j.updated_at,p_profile_slug) returning * into r;

 return jsonb_build_object('success',true,'status','RESERVED','reserved',true,'run',to_jsonb(r));

 elsif action='recover' then

 if p_payload->>'repair_version' is distinct from 'review-contract-v2' or p_payload->>'diagnostic' is distinct from 'REVIEW_CONTRACT_REJECTED' or v_phase is distinct from 'REVIEW' or p_payload->>'expected_status' is distinct from 'WAITING_HELENA' or nullif(p_payload->>'run_id','') is null or nullif(p_payload->>'run_token','') is null or nullif(p_payload->>'job_id','') is null or coalesce(p_payload->>'fingerprint','') !~ '^[a-f0-9]{64}$' or p_payload->>'expected_task_version' is null or p_payload->>'expected_updated_at' is null then raise exception 'Contrato de recuperacao REVIEW invalido' using errcode='22023'; end if;

 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('hermes:global-wip',0)) then raise exception 'WIP 1: transicao concorrente; reconciliar estado' using errcode='55000'; end if;

 select * into r from public.agent_workflow_runs where run_id=(p_payload->>'run_id')::uuid for update;

 if not found then raise exception 'Reserva nao confirmada' using errcode='42501'; end if;

 if b.scope_type='BUSINESS' and not public.helena_agent_serves(b.agent_id, r.business_id) then raise exception 'Empresa fora do escopo' using errcode='42501'; end if;

 if r.run_token is distinct from (p_payload->>'run_token')::uuid and (r.recovery_count=0 or (r.recovery_history->0->'original_receipt'->>'run_token')::uuid is distinct from (p_payload->>'run_token')::uuid) then raise exception 'Reserva nao confirmada' using errcode='42501'; end if;

 if r.recovery_count>=1 then return jsonb_build_object('success',true,'status','RECOVERY_LIMIT','reserved',false); end if;

 if r.phase is distinct from 'REVIEW' or r.status is distinct from 'NEEDS_ATTENTION' or r.diagnostic is distinct from p_payload->>'diagnostic' then raise exception 'Falha de contrato REVIEW obrigatoria' using errcode='22023'; end if;

 if r.job_id is distinct from p_payload->>'job_id' then raise exception 'Job da reserva divergente' using errcode='22023'; end if;

 select * into j from public.agent_jobs where job_id=r.job_id for update;

 if not found or j.task_id is null or j.business_id is null then raise exception 'Job empresarial obrigatorio' using errcode='22023'; end if;

 if j.business_id is distinct from r.business_id or (b.scope_type='BUSINESS' and not public.helena_agent_serves(b.agent_id, j.business_id)) then raise exception 'Empresa fora do escopo' using errcode='42501'; end if;

 select * into t from public.tarefas where task_id=j.task_id and business_id=j.business_id for share;

 if not found or t.row_version is distinct from (p_payload->>'expected_task_version')::bigint or j.status is distinct from p_payload->>'expected_status' or j.updated_at is distinct from (p_payload->>'expected_updated_at')::timestamptz or r.task_version is distinct from t.row_version or r.job_status is distinct from j.status or r.job_updated_at is distinct from j.updated_at or r.fingerprint is distinct from p_payload->>'fingerprint' then return jsonb_build_object('success',true,'status','STATE_CHANGED','reserved',false); end if;

 if j.status is distinct from 'WAITING_HELENA' or j.result_payload->>'review_pending' is distinct from 'true' or nullif(btrim(j.result_payload->>'reviewer_agent_id'),'') is null or j.result_payload->>'reviewer_agent_id' in ('FOUNDER',j.agent_id) or public.gateway_workflow_phase(j) is distinct from 'REVIEW' then raise exception 'Revisao independente pendente obrigatoria' using errcode='22023'; end if;

 if exists(select 1 from public.agent_jobs where status in ('READY','CLAIMED','RUNNING')) or exists(select 1 from public.agent_workflow_runs where status='STARTED' and lease_until>clock_timestamp()) then return jsonb_build_object('success',true,'status','EXECUTOR_BUSY','reserved',false); end if;

 recovered_at:=clock_timestamp();

 update public.agent_workflow_runs set recovery_count=1, recovery_history=recovery_history||jsonb_build_array(jsonb_build_object('original_receipt',to_jsonb(r),'recovered_at',recovered_at,'recovered_by_profile',p_profile_slug,'recovered_by_agent',b.agent_id,'repair_version',p_payload->>'repair_version','diagnostic',p_payload->>'diagnostic')), run_token=gen_random_uuid(),profile_slug=p_profile_slug,status='STARTED',started_at=recovered_at,lease_until=recovered_at+interval '10 minutes',finished_at=null,diagnostic=null where run_id=r.run_id returning * into r;

 return jsonb_build_object('success',true,'status','RESERVED','reserved',true,'run',to_jsonb(r));

 elsif action='finish' then

 select * into r from public.agent_workflow_runs where run_id=(p_payload->>'run_id')::uuid for update;

 if not found or r.run_token is distinct from (p_payload->>'run_token')::uuid then raise exception 'Reserva nao confirmada' using errcode='42501'; end if;

 if b.scope_type='BUSINESS' and not public.helena_agent_serves(b.agent_id, r.business_id) then raise exception 'Empresa fora do escopo' using errcode='42501'; end if;

 if p_payload->>'status' not in ('CONFIRMED','RECONCILED','NEEDS_ATTENTION') then raise exception 'Conclusao invalida'; end if;

 if r.status in ('CONFIRMED','RECONCILED') then return jsonb_build_object('success',true,'status',r.status); end if;

 select * into j from public.agent_jobs where job_id=r.job_id;

 select * into t from public.tarefas where task_id=j.task_id;

 changed:=j.status is distinct from r.job_status or j.updated_at is distinct from r.job_updated_at or t.row_version is distinct from r.task_version;

 if p_payload->>'status' in ('CONFIRMED','RECONCILED') and not changed and not (r.phase='HANDOFF' and exists(select 1 from public.agent_job_events e where e.job_id=j.job_id and e.event_type='WORKFLOW_handoff')) then raise exception 'Conclusao exige efeito confirmado no banco' using errcode='22023'; end if;

 update public.agent_workflow_runs set status=p_payload->>'status',finished_at=clock_timestamp(),diagnostic=left(p_payload->>'diagnostic',100) where run_id=r.run_id;

 return jsonb_build_object('success',true,'status',p_payload->>'status');

 end if;

 raise exception 'Acao desconhecida' using errcode='22023';

end; $function$;

-- gateway_workflow
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
        where (b.scope_type='GROUP' and b.agent_id='AGT-01' or b.scope_type='BUSINESS' and public.helena_agent_serves(b.agent_id, business_id))
          and (b.agent_id in ('AGT-01','AGT-04') or responsavel=agent_name)
        order by atualizado_em desc limit 30)x),'[]'::jsonb),
      'handoffs',coalesce((select jsonb_agg(x) from (select id,de,para,business_id_area,assunto,status,related_object_id,row_version from public.handoffs
        where (b.scope_type='GROUP' and b.agent_id='AGT-01' and scope_type<>'PERSONAL' or b.scope_type='BUSINESS' and public.helena_agent_serves(b.agent_id, business_id_area))
          and (b.agent_id in ('AGT-01','AGT-04') or para=agent_name or de=agent_name)
        order by criado_em desc limit 30)x),'[]'::jsonb),
      'pending_reviews',coalesce((select jsonb_agg(x) from (
        select job_id,task_id,agent_id,business_id,result_summary,evidence_refs,result_payload->>'reviewer_agent_id' as reviewer_agent_id
        from public.agent_jobs where status='WAITING_HELENA' and result_payload->>'review_pending'='true'
        and (b.scope_type='GROUP' and b.agent_id='AGT-01' or b.scope_type='BUSINESS' and public.helena_agent_serves(b.agent_id, business_id))
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
  if company is null or (b.scope_type='BUSINESS' and not public.helena_agent_serves(b.agent_id, company)) then
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
      and (scope_type='BUSINESS' and public.helena_agent_serves(agent_id, company) or scope_type='GROUP' and agent_id='AGT-01') and status in ('CONFIGURED','ACTIVE') for share;
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
    perform 1 from public.agent_runtime_bindings where agent_id=j.agent_id and status='ACTIVE' and provider='HERMES' and (scope_type='BUSINESS' and public.helena_agent_serves(agent_id, company) or scope_type='GROUP' and agent_id='AGT-01') for share;
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

-- Escopos: os agentes empresariais (AGT-03..AGT-21) atendem as 4 empresas ativas.
insert into public.agent_business_scopes(scope_id,agent_id,business_id,scope_role,authorization_status,runtime_status,runtime_profile_slug,source_reference,notes)
select 'ABS-'||b.agent_id||'-'||replace(p.business_id,'-',''), b.agent_id, p.business_id,
       case when b.agent_id='AGT-04' then 'COORDINATOR' else 'SPECIALIST' end,'AUTHORIZED','CONFIRMED', b.profile_slug,
       'FOUNDER:2026-10-07:pode fazer todas as empresas', 'Perfil unico do agente atende esta empresa; entrega fica na empresa da tarefa.'
from public.agent_runtime_bindings b cross join public.portfolio p
where b.provider='HERMES' and b.scope_type='BUSINESS' and p.ativo='SIM'
on conflict (agent_id, business_id) do update set runtime_status='CONFIRMED',
  runtime_profile_slug=excluded.runtime_profile_slug, notes=coalesce(agent_business_scopes.notes||' | ','')||'Runtime confirmado em 2026-10-07 (Fundador: pode fazer todas as empresas).', updated_at=now()
  where agent_business_scopes.authorization_status='AUTHORIZED';  -- REVOKED nunca e reativado aqui

commit;
