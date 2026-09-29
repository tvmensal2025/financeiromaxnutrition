-- Registro enxuto de marcos operacionais. Um evento por marco, sem polling nem LLM.
create unique index if not exists agent_job_events_progress_step_uq
  on public.agent_job_events (job_id, (payload ->> 'step_key'))
  where event_type = 'PROGRESS';

create or replace function public.gateway_record_agent_progress(
  p_job_id text,
  p_agent_id text,
  p_step_key text,
  p_action text,
  p_reason text,
  p_next_step text,
  p_evidence_refs jsonb,
  p_actor jsonb
)
returns public.agent_job_events
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_job public.agent_jobs%rowtype;
  v_event public.agent_job_events%rowtype;
  v_payload jsonb;
begin
  if p_job_id is null or p_agent_id is null or p_step_key is null
     or p_action is null or p_reason is null or p_next_step is null
     or p_step_key !~ '^[a-zA-Z0-9][a-zA-Z0-9_-]*$'
     or length(p_step_key) > 80
     or length(trim(p_action)) not between 1 and 400
     or length(trim(p_reason)) not between 1 and 600
     or length(trim(p_next_step)) not between 1 and 400
     or jsonb_typeof(p_evidence_refs) is distinct from 'array'
     or jsonb_array_length(p_evidence_refs) > 10
     or jsonb_typeof(p_actor) is distinct from 'object' then
    raise exception 'Marco operacional inválido' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_evidence_refs) ref
    where jsonb_typeof(ref) <> 'string' or length(trim(ref #>> '{}')) not between 1 and 500
  ) then
    raise exception 'Referência de evidência inválida' using errcode = '22023';
  end if;

  select * into v_job from public.agent_jobs
   where job_id = p_job_id for update;
  if not found or v_job.agent_id <> p_agent_id then
    raise exception 'Job ou agente incompatível' using errcode = '22023';
  end if;

  v_payload := jsonb_build_object(
    'step_key', p_step_key,
    'reason', trim(p_reason),
    'next_step', trim(p_next_step),
    'evidence_refs', p_evidence_refs,
    'task_id', v_job.task_id,
    'actor', p_actor
  );

  select * into v_event from public.agent_job_events
   where job_id = p_job_id and event_type = 'PROGRESS'
     and payload ->> 'step_key' = p_step_key;
  if found then
    if v_event.agent_id <> p_agent_id or v_event.message <> trim(p_action)
       or v_event.payload is distinct from v_payload then
      raise exception 'step_key já usado com conteúdo diferente' using errcode = '22023';
    end if;
    return v_event;
  end if;

  if v_job.status <> 'RUNNING' then
    raise exception 'O job precisa estar RUNNING para registrar progresso' using errcode = '22023';
  end if;

  insert into public.agent_job_events
    (job_id, agent_id, business_id, event_type, status, message, payload, correlation_id)
  values
    (v_job.job_id, v_job.agent_id, v_job.business_id, 'PROGRESS', v_job.status,
     trim(p_action), v_payload, v_job.correlation_id)
  returning * into v_event;

  return v_event;
end;
$function$;

revoke all on function public.gateway_record_agent_progress(text,text,text,text,text,text,jsonb,jsonb)
  from public, anon, authenticated;
grant execute on function public.gateway_record_agent_progress(text,text,text,text,text,text,jsonb,jsonb)
  to service_role;

-- Todos os prompts_base já mandam ler o Protocolo_Agentes vigente. Uma regra
-- comum evita replicar instruções (e tokens) em 21 prompts individuais.
insert into public.protocolo_agentes
  (protocolo_id, versao, secao, regra, aplicacao, responsavel, status, ultima_atualizacao)
values
  ('PAG-V9-019', '9.2', 'R19 — Registro operacional enxuto',
   'Todo agente atual ou futuro registra no Supabase, na empresa e tarefa corretas, o início, cada marco que altera resultado/estado, bloqueio ou handoff e o encerramento. Cada marco descreve o que foi feito, por qual motivo de negócio, próximo passo e referência de evidência quando existir. Usar a fonte canônica da tarefa e o Gateway record_progress quando disponível; registrar falha de gravação como bloqueio, sem declarar entrega comprovada. Não registrar cada pensamento, clique, consulta ou status repetido. Helena supervisiona por exceção e revisão de evidência, sem invocação contínua de IA.',
   'TODOS', 'AGT-01 Helena', 'ATIVA', '2026-09-26')
on conflict (protocolo_id) do nothing;
