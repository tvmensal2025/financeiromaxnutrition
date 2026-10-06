-- Patch incremental: requer helena_reliability_v1.sql e o motor Hermes canônico.
-- Nenhum perfil ativado, job liberado, modelo chamado ou dado histórico apagado.
-- Não é bootstrap. Executar a bateria SQL em staging antes de implantar.
begin;
do $$ begin
 if to_regclass('public.helena_commands') is null
 or to_regprocedure('public.gateway_workflow_phase(public.agent_jobs)') is null then
  raise exception 'Base de comandos v1 e workflow canônico obrigatórios'; end if;
end $$;
alter table public.helena_commands add column if not exists mission_plan jsonb;
create table if not exists public.helena_mission_steps (
 command_id text not null references public.helena_commands(command_id),
 ordinal integer not null check(ordinal between 1 and 10),
 step_key text not null check(step_key ~ '^(strategy|copy|visual-[1-7]|qa|consolidate)$'),
 business_id text not null references public.portfolio(business_id),
 agent_id text not null references public.agentes(agent_id),
 reviewer_agent_id text not null,
 slots jsonb not null default '[]' check(jsonb_typeof(slots)='array' and jsonb_array_length(slots)<=4),
 task_id text unique references public.tarefas(task_id),
 job_id text unique references public.agent_jobs(job_id),
 created_at timestamptz not null default clock_timestamp(),
 primary key(command_id,step_key), unique(command_id,ordinal),
 check((task_id is null)=(job_id is null))
);
alter table public.helena_mission_steps enable row level security;
revoke all on public.helena_mission_steps from public,anon,authenticated;
grant select on public.helena_mission_steps to authenticated;
grant select,insert,update on public.helena_mission_steps to service_role;
create index if not exists helena_mission_steps_business on public.helena_mission_steps(business_id,command_id);
drop policy if exists helena_mission_steps_read on public.helena_mission_steps;
create policy helena_mission_steps_read on public.helena_mission_steps for select to authenticated
 using(exists(select 1 from public.helena_commands c where c.command_id=helena_mission_steps.command_id
  and c.business_id=helena_mission_steps.business_id)); -- comando também sujeito a RLS


-- Selos de aprovação vinculam a versão exata, não comparam now() e clock_timestamp().
-- O created_at de um evento pode ser o início da transação, anterior ao updated_at do job.
create table if not exists public.helena_mission_review_seals (
 event_id uuid primary key references public.agent_job_events(event_id),
 job_id text not null references public.agent_jobs(job_id),
 task_id text not null references public.tarefas(task_id),
 task_version bigint not null,
 job_updated_at timestamptz not null,
 evidence_refs jsonb not null,
 payload_hash text not null,
 reviewer text not null,
 sealed_at timestamptz not null default clock_timestamp()
);
alter table public.helena_mission_review_seals enable row level security;
revoke all on public.helena_mission_review_seals from public,anon,authenticated,service_role;
grant select on public.helena_mission_review_seals to authenticated,service_role;
create index if not exists helena_mission_review_seals_job on public.helena_mission_review_seals(job_id);
create index if not exists helena_commands_mission_poll on public.helena_commands(command_id)
 where payload->>'kind'='TASK' and state not in ('DELIVERED','RECORDED');
drop policy if exists helena_review_seals_read on public.helena_mission_review_seals;
create policy helena_review_seals_read on public.helena_mission_review_seals for select to authenticated
 using(exists(select 1 from public.helena_mission_steps s where s.job_id=helena_mission_review_seals.job_id));
create or replace function private.helena_seal_mission_review()
returns trigger language plpgsql security definer set search_path='' as $$
declare j public.agent_jobs; t public.tarefas; reviewer text;
begin
 if not exists(select 1 from public.helena_mission_steps s where s.job_id=new.job_id) then return new; end if;
 select * into j from public.agent_jobs where job_id=new.job_id;
 select * into t from public.tarefas where task_id=j.task_id;
 if j.status is distinct from 'COMPLETED' or j.approval_status is distinct from 'APPROVED'
  or j.result_payload->>'review_pending' is distinct from 'false' or j.business_id is distinct from new.business_id
  or t.business_id is distinct from j.business_id then return new; end if;
 if new.event_type='WORKFLOW_review_delivery' and new.payload->'request'->'payload'->>'decision'='APPROVE'
  and new.agent_id<>j.agent_id and new.agent_id=j.result_payload->>'reviewed_by'
  and j.result_payload->'quality_review'->>'requirements_met'='true' then reviewer:=new.agent_id;
 elsif new.event_type='FOUNDER_MISSION_REVIEW' and new.payload->>'decision'='APPROVE'
  and j.result_payload->>'reviewed_by'='FOUNDER:'||(new.payload->>'actor_user_id')
  and j.result_payload->'human_review'->>'requirements_met'='true' then reviewer:=j.result_payload->>'reviewed_by';
 else return new; end if;
 insert into public.helena_mission_review_seals(event_id,job_id,task_id,task_version,job_updated_at,evidence_refs,payload_hash,reviewer)
 values(new.event_id,j.job_id,t.task_id,t.row_version,j.updated_at,j.evidence_refs,md5(j.result_payload::text),reviewer);
 return new;
end $$;
drop trigger if exists helena_seal_mission_review on public.agent_job_events;
create trigger helena_seal_mission_review after insert on public.agent_job_events
 for each row when(new.event_type in ('WORKFLOW_review_delivery','FOUNDER_MISSION_REVIEW'))
 execute function private.helena_seal_mission_review();
revoke all on function private.helena_seal_mission_review() from public,anon,authenticated;

create or replace function private.helena_mission_job_approved(j public.agent_jobs)
returns boolean language sql stable security invoker set search_path='' as $$
 select j.status='COMPLETED' and j.approval_status='APPROVED'
 and j.result_payload->>'review_pending'='false'
 and jsonb_typeof(j.evidence_refs)='array' and jsonb_array_length(j.evidence_refs)>0
 and exists(select 1 from public.helena_mission_review_seals seal join public.tarefas t on t.task_id=seal.task_id
  join public.agent_job_events e on e.event_id=seal.event_id
  where seal.job_id=j.job_id and t.task_id=j.task_id and t.business_id=j.business_id and e.business_id=j.business_id
   and seal.task_version=t.row_version and seal.job_updated_at=j.updated_at and seal.evidence_refs=j.evidence_refs
   and seal.payload_hash=md5(j.result_payload::text) and seal.reviewer=j.result_payload->>'reviewed_by');
$$;

create or replace function public.helena_mission_snapshot(p_command_id text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.helena_commands; items jsonb;
begin
 select * into c from public.helena_commands where command_id=p_command_id;
 if not found then raise exception 'Pedido inexistente' using errcode='22023'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('key',s.step_key,'business_id',s.business_id,
  'agent_id',s.agent_id,'job_id',j.job_id,'status',j.status,'attempt_count',j.attempt_count,
  'updated_at',j.updated_at,'task_version',t.row_version,'review_pending',coalesce(j.result_payload->>'review_pending','false')='true',
  'delivery',case when private.helena_mission_job_approved(j) then j.result_payload->'delivery' else null end,
  'approved',coalesce(private.helena_mission_job_approved(j),false)) order by s.ordinal),'[]'::jsonb)
 into items from public.helena_mission_steps s join public.agent_jobs j on j.job_id=s.job_id
 join public.tarefas t on t.task_id=s.task_id where s.command_id=p_command_id;
 return jsonb_build_object('verified',true,'command_id',c.command_id,'business_id',c.business_id,'steps',items);
end $$;

-- A mesma fonte autorizadora de v1 deve continuar válida em todas as etapas.
create or replace function private.helena_mission_authorized(c public.helena_commands)
returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.portfolio p where p.business_id=c.business_id and p.ativo='SIM')
 and exists(select 1 from public.app_access a where a.user_id=c.user_id and a.active
   and (a.role='founder' or (a.role in ('admin','member') and exists(select 1 from public.user_business_access u
    where u.user_id=c.user_id and u.business_id=c.business_id and u.active))));
$$;

create or replace function public.helena_advance_mission(p_command_id text,p_plan jsonb,p_step_key text,p_instruction text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.helena_commands; s public.helena_mission_steps; prev public.helena_mission_steps;
 j public.agent_jobs; pj public.agent_jobs; t public.tarefas; meta jsonb; item jsonb;
 n integer; p integer; st integer; ord integer; batches integer; jid text; tid text; root text;
 agent_name text; stage text; why text; observed_at timestamptz; prepared boolean:=false;
 all_slots text[]:='{}'; expected_slots text[]:='{}'; required text[]; missing text[];
begin
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('helena-mission:'||p_command_id,0)) then
  raise exception 'Missão ocupada; conferir recibo depois' using errcode='40001'; end if;
 -- Mesmo sentido do motor: jobs -> comando -> tarefa. NOWAIT evita deadlock com revisões concorrentes.
 perform 1 from public.agent_jobs z where z.job_id in
   (select x.job_id from public.helena_mission_steps x where x.command_id=p_command_id)
 order by z.job_id for update nowait;
 select * into c from public.helena_commands where command_id=p_command_id for update nowait;
 if not found or c.payload->>'kind' is distinct from 'TASK' then raise exception 'Missão não encontrada' using errcode='22023'; end if;
 if c.state='DELIVERED' then return private.helena_command_receipt(c)||jsonb_build_object('prepared',false); end if;
 stage:='RESOLVING'; why:='Solicitante ou empresa inativos. Nenhuma nova etapa autorizada.';
 if private.helena_mission_authorized(c) then
  if c.job_id is not null and c.mission_plan is null then
   -- Não substituir job v1 nem reabrir tarefas antigas. Adoção exige conferência explícita.
   why:='Pedido possui ordem anterior ao plano v2. Conciliar a ordem existente; não duplicar nem apagar histórico.';
  else
   if jsonb_typeof(p_plan) is distinct from 'object' or octet_length(p_plan::text)>32768
    or p_plan->>'version' is distinct from 'helena-mission-v2' or p_plan->>'command_id' is distinct from c.command_id
    or p_plan->>'business_id' is distinct from c.business_id or p_plan->>'source_task_id' is distinct from c.task_id
    or coalesce(p_plan->>'fingerprint','') !~ '^[a-f0-9]{64}$' then raise exception 'Plano divergente' using errcode='22023'; end if;
   if c.mission_plan is not null and c.mission_plan is distinct from p_plan then raise exception 'Plano imutável; nova intenção exige revisão, não sobrescrita' using errcode='40001'; end if;
   p:=coalesce((c.payload->'requested'->>'posts')::integer,0); st:=coalesce((c.payload->'requested'->>'stories')::integer,0);
   if p not between 0 and 100 or st not between 0 and 100 then raise exception 'Quantidades inválidas' using errcode='22023'; end if;
   batches:=ceil((p+st)::numeric/4)::integer; n:=case when p+st>0 then batches+4 else 1 end;
   if p+st>9 or n>10 or jsonb_typeof(p_plan->'steps') is distinct from 'array' or jsonb_array_length(p_plan->'steps')<>n
    or (p_plan->'requested'->>'posts')::integer is distinct from p
    or (p_plan->'requested'->>'stories')::integer is distinct from st then raise exception 'Plano não corresponde ao pedido ou supera 10 etapas; não reduzir pedido' using errcode='22023'; end if;
   -- Validação independente do contrato recebido do worker, incluindo donos, sequência e todos os slots.
   for ord in 1..n loop
    item:=p_plan->'steps'->(ord-1);
    if item->>'key' is distinct from (case when ord=n then 'consolidate' when n>1 and ord=n-1 then 'qa' when ord=1 then 'strategy' when ord=2 then 'copy' else 'visual-'||(ord-2)::text end)
      or (item->>'ordinal')::integer is distinct from ord
      or item->>'agent_id' is distinct from (case when ord=n then 'AGT-01' when n>1 and ord=n-1 then 'AGT-13' when ord=1 then 'AGT-16' when ord=2 then 'AGT-17' else 'AGT-12' end)
      or item->>'reviewer_agent_id' is distinct from (case when ord=n then 'FOUNDER' when n>1 and ord=n-1 then 'AGT-01' when ord=1 then 'AGT-03' when ord=2 then 'AGT-16' else 'AGT-10' end)
      or item->'depends_on' is distinct from (case when ord=1 then '[]'::jsonb else jsonb_build_array(p_plan->'steps'->(ord-2)->>'key') end)
      or jsonb_typeof(item->'slots') is distinct from 'array' or jsonb_array_length(item->'slots')>4 then
       raise exception 'Etapa, dependências ou papéis divergentes' using errcode='22023'; end if;
    if (ord<=2 or ord>=n-1) and jsonb_array_length(item->'slots')<>0 then raise exception 'Etapa textual não gera arquivos' using errcode='22023'; end if;
    if ord>2 and ord<n-1 and jsonb_array_length(item->'slots')=0 then raise exception 'Lote visual vazio' using errcode='22023'; end if;
    all_slots:=all_slots||array(select jsonb_array_elements_text(item->'slots'));
   end loop;
   expected_slots:=array(select 'post-'||i::text from generate_series(1,p) i)||array(select 'story-'||i::text from generate_series(1,st) i);
   if all_slots is distinct from expected_slots then raise exception 'Slots omitidos, duplicados ou fora de ordem' using errcode='22023'; end if;
   if c.mission_plan is null then
    for ord in 1..n loop
     item:=p_plan->'steps'->(ord-1);
     insert into public.helena_mission_steps(command_id,ordinal,step_key,business_id,agent_id,reviewer_agent_id,slots)
      values(c.command_id,ord,item->>'key',c.business_id,item->>'agent_id',item->>'reviewer_agent_id',item->'slots');
    end loop;
    update public.helena_commands set mission_plan=p_plan where command_id=c.command_id returning * into c;
   end if;
   root:='JOB-HR-'||md5('command:'||c.command_id);
   select x.* into s from public.helena_mission_steps x left join public.agent_jobs z on z.job_id=x.job_id
    where x.command_id=c.command_id and not coalesce(private.helena_mission_job_approved(z),false) order by x.ordinal limit 1;
   if not found then stage:='REVIEW'; why:='Etapas encerradas; conferir o aceite final registrado. Nenhuma publicação autorizada.';
   elsif s.job_id is not null then
    select * into j from public.agent_jobs where job_id=s.job_id;
    stage:=case when j.status='DRAFT' then case when j.attempt_count>=2 then 'RESOLVING' else 'DRAFT' end
     when j.status='READY' then 'QUEUED' when j.status in ('CLAIMED','RUNNING') then 'RUNNING'
     when j.status='WAITING_HELENA' and j.result_payload->>'review_pending'='true' then case when s.step_key='consolidate' then 'REVIEW' else 'RUNNING' end
     when j.status='FAILED' then 'RESOLVING' else 'RESOLVING' end;
    why:='Etapa '||s.ordinal||'/'||n||' ('||s.step_key||'): '||j.status||'. '||case
     when j.status='WAITING_HELENA' and j.result_payload->>'review_pending'='true' then 'Aguardando revisão de '||s.reviewer_agent_id||'; não é entrega global.'
     when j.status='COMPLETED' then 'Aprovação/evidência atual não confirmada. Helena reconcilia antes de avançar.'
     when j.status='DRAFT' and j.attempt_count>=2 then 'Tentativas esgotadas; preservar histórico e exigir diagnóstico.'
     when j.status='FAILED' then 'Theo diagnostica; não repetir resultado incerto.'
     else 'Aguardar fluxo autorizado, sem concluir por cadastro.' end;
    select max(e.created_at) into observed_at from public.agent_job_events e where e.job_id=j.job_id
      and e.event_type in ('STARTED','PROGRESS','WORKFLOW_submit_delivery','WORKFLOW_review_delivery','FOUNDER_MISSION_REVIEW');
   else
    if s.step_key is distinct from p_step_key then raise exception 'Etapa mudou; releia snapshot' using errcode='40001'; end if;
    if p_instruction is null or length(p_instruction) not between 700 and 7000 then raise exception 'Briefing fora dos limites profissionais' using errcode='22023'; end if;
    -- Verifica autor e revisor da etapa, não supõe acesso pelo cadastro da empresa.
    required:=array[s.agent_id,s.reviewer_agent_id];
    select array_agg(a) into missing from unnest(required) a where a<>'FOUNDER' and not exists(
     select 1 from public.agent_runtime_bindings b where b.agent_id=a and b.provider='HERMES' and b.status='ACTIVE'
      and ((b.scope_type='BUSINESS' and b.business_id=c.business_id) or (a='AGT-01' and b.scope_type='GROUP')));
    if coalesce(cardinality(missing),0)>0 then stage:='RESOLVING'; why:='Etapa '||s.step_key||': executor/revisor sem vínculo ativo nesta empresa: '||array_to_string(missing,', ')||'. Theo valida capacidade; Helena coordena.';
    else
     jid:=case when s.step_key='consolidate' then root else 'JOB-HR-'||md5('mission:'||c.command_id||':'||s.step_key) end;
     tid:=case when s.step_key='consolidate' then c.task_id else 'TSK-HR-'||md5('mission:'||c.command_id||':'||s.step_key) end;
     meta:=p_plan->'steps'->(s.ordinal-1);
     select agente into agent_name from public.agentes where agent_id=s.agent_id;
     if agent_name is null then raise exception 'Executor ausente do cadastro' using errcode='22023'; end if;
     if s.step_key<>'consolidate' then
      insert into public.tarefas(task_id,business_id,tarefa,tipo,responsavel,prioridade,status,definicao_de_pronto,source_system,related_object_type,related_object_id,idempotency_key,prazo)
       values(tid,c.business_id,meta->>'title','OPERACIONAL',agent_name,case when c.payload->>'priority'='ALTA' then 'ALTA' else 'MEDIA' end,'NÃO INICIADA',
        meta->>'deliverables','HELENA_MISSION','agent_jobs',jid,'mission:'||c.command_id||':'||s.step_key,c.payload->>'deadline');
     end if;
     insert into public.agent_jobs(job_id,task_id,agent_id,business_id,objective,instruction,priority,status,approval_required,approval_status,max_attempts,idempotency_key,correlation_id,result_payload)
      values(jid,tid,s.agent_id,c.business_id,meta->>'title',p_instruction,case when c.payload->>'priority'='ALTA' then 'ALTA' else 'MEDIA' end,
       'DRAFT',true,'PENDING',2,'mission:'||c.command_id||':'||s.step_key,root,
       jsonb_build_object('managed_by','helena-mission-v2','command_id',c.command_id,'mission_step',s.step_key,'mission_contract',c.payload,'required_slots',s.slots,
        'source_job_ids',(select coalesce(jsonb_agg(x.job_id order by x.ordinal),'[]'::jsonb) from public.helena_mission_steps x where x.command_id=c.command_id and x.ordinal<s.ordinal)));
     update public.helena_mission_steps set task_id=tid,job_id=jid where command_id=c.command_id and step_key=s.step_key;
     insert into public.handoffs(id,data_hora,de,para,business_id_area,assunto,contexto_essencial,pergunta_tarefa_transferida,status,prioridade,pendencias,related_object_id,scope_type)
      values('HND-MIS-'||md5(c.command_id||':'||s.step_key),clock_timestamp()::text,'Helena',agent_name,c.business_id,meta->>'title',
       'Pedido integral: '||c.task_id||'; plano: '||(p_plan->>'fingerprint'),meta->>'deliverables','ABERTO','MEDIA','Ordem preparada; aguarda liberação do motor.',jid,'BUSINESS');
     insert into public.agent_job_events(job_id,agent_id,business_id,event_type,status,message,payload,correlation_id)
      values(jid,'AGT-01',c.business_id,'MISSION_STEP_PREPARED','DRAFT','Etapa preparada após conferência das dependências; nenhum modelo iniciado.',
       jsonb_build_object('command_id',c.command_id,'step',s.step_key,'plan_fingerprint',p_plan->>'fingerprint'),root);
     if s.step_key='consolidate' then update public.helena_commands set job_id=jid where command_id=c.command_id; end if;
     stage:='DRAFT'; why:='Etapa '||s.ordinal||'/'||n||' ('||s.step_key||') preparada. Liberação e execução pelo motor autorizado; não é missão cumprida.'; prepared:=true;
    end if;
   end if;
  end if;
 end if;
 update public.helena_commands set state=stage,reason=why,updated_at=case when state is distinct from stage or reason is distinct from why or observed_at>updated_at then clock_timestamp() else updated_at end
  where command_id=c.command_id returning * into c;
 return private.helena_command_receipt(c)||jsonb_build_object('prepared',prepared);
end $$;

-- Mesmo se outra interface tentar liberar antes da hora, o banco recusa.
create or replace function private.helena_mission_execution_guard()
returns trigger language plpgsql security invoker set search_path='' as $$
declare s public.helena_mission_steps; c public.helena_commands;
begin
 select * into s from public.helena_mission_steps where job_id=new.job_id;
 if not found then return new; end if;
 if new.business_id is distinct from s.business_id or new.agent_id is distinct from s.agent_id or new.task_id is distinct from s.task_id then
  raise exception 'Identidade da etapa imutável' using errcode='42501'; end if;
 if new.status in ('READY','CLAIMED','RUNNING') then
  select * into c from public.helena_commands where command_id=s.command_id;
  if not private.helena_mission_authorized(c) or exists(select 1 from public.helena_mission_steps p
    left join public.agent_jobs j on j.job_id=p.job_id where p.command_id=s.command_id and p.ordinal<s.ordinal
      and not coalesce(private.helena_mission_job_approved(j),false)) then
   raise exception 'Dependência não aprovada ou missão sem autorização vigente' using errcode='42501'; end if;
 end if;
 return new;
end $$;
drop trigger if exists helena_mission_execution_guard on public.agent_jobs;
create trigger helena_mission_execution_guard before update of status,agent_id,business_id,task_id on public.agent_jobs
 for each row execute function private.helena_mission_execution_guard();

-- A cadeia v2 tem sucessora determinística: não deixar o planejador legado duplicá-la.
-- Preserva integralmente a função instalada; aborta caso o contrato conhecido mude.
do $$ declare body text; patched text;
begin
 select pg_get_functiondef('public.gateway_workflow_phase(public.agent_jobs)'::regprocedure) into body;
 if position('helena-mission-v2' in body)=0 then
  patched:=replace(body,'select case',E'select case\n when j.status=''COMPLETED'' and j.result_payload->>''managed_by''=''helena-mission-v2'' then null');
  if patched=body then raise exception 'Contrato workflow_phase desconhecido; revisar antes de aplicar'; end if;
  execute patched;
 end if;
end $$;

revoke all on function private.helena_mission_job_approved(public.agent_jobs),private.helena_mission_authorized(public.helena_commands),
 private.helena_mission_execution_guard(),public.helena_mission_snapshot(text),public.helena_advance_mission(text,jsonb,text,text) from public,anon,authenticated;
grant execute on function private.helena_mission_job_approved(public.agent_jobs),private.helena_mission_authorized(public.helena_commands),
 public.helena_mission_snapshot(text),public.helena_advance_mission(text,jsonb,text,text) to service_role;
-- Trigger invoker não pode ter dependências inacessíveis para uma revisão humana legítima.
-- A guarda de execução não expõe RPC: consulta apenas linhas já visíveis ao papel chamador.
grant execute on function private.helena_mission_authorized(public.helena_commands),private.helena_mission_job_approved(public.agent_jobs) to authenticated;

-- Contexto de dependências: apenas a mesma missão/empresa e etapas anteriores aprovadas agora.
create or replace function public.helena_mission_context(p_job_id text,p_business_id text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare current_step public.helena_mission_steps; c public.helena_commands; inputs jsonb; files jsonb;
begin
 select * into current_step from public.helena_mission_steps where job_id=p_job_id and business_id=p_business_id;
 if not found then raise exception 'Etapa fora desta missão e empresa' using errcode='42501'; end if;
 select * into c from public.helena_commands where command_id=current_step.command_id;
 if not private.helena_mission_authorized(c) then raise exception 'Missão sem acesso vigente' using errcode='42501'; end if;
 if exists(select 1 from public.helena_mission_steps s left join public.agent_jobs j on j.job_id=s.job_id
  where s.command_id=c.command_id and s.ordinal<current_step.ordinal and not coalesce(private.helena_mission_job_approved(j),false)) then
  raise exception 'Fonte antecedente deixou de estar aprovada; reconciliar antes de continuar' using errcode='40001'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('job_id',j.job_id,'task_id',s.task_id,'step',s.step_key,
  'business_id',s.business_id,'approved',true,'delivery',j.result_payload->'delivery',
  'publication',j.result_payload->'publication','evidence_refs',j.evidence_refs,'reviewed_by',j.result_payload->>'reviewed_by') order by s.ordinal),'[]'::jsonb)
 into inputs from public.helena_mission_steps s join public.agent_jobs j on j.job_id=s.job_id
 where s.command_id=c.command_id and s.ordinal<current_step.ordinal and private.helena_mission_job_approved(j);
 select coalesce(jsonb_agg(x.item),'[]'::jsonb) into files from (
  select distinct on(e.payload->>'reference') e.payload||jsonb_build_object('source_job_id',j.job_id,'business_id',s.business_id,
    'authorized_for_job',p_job_id,'provenance','MISSION_APPROVED_SOURCE') as item
  from public.helena_mission_steps s join public.agent_jobs j on j.job_id=s.job_id
   join public.agent_job_events e on e.job_id=j.job_id and e.business_id=s.business_id
  where s.command_id=c.command_id and s.ordinal<current_step.ordinal and private.helena_mission_job_approved(j)
    and e.event_type='ARTIFACT_VERIFIED' and j.evidence_refs @> jsonb_build_array(e.payload->>'reference')
    and e.payload->>'reference' like 'storage://helena-deliveries/'||s.business_id||'/'||j.job_id||'/%'
    and e.payload->>'sha256' ~ '^[a-f0-9]{64}$'
  order by e.payload->>'reference',e.created_at desc
 ) x;
 return jsonb_build_object('verified',true,'job_id',p_job_id,'business_id',p_business_id,'command_id',c.command_id,
  'original_request',c.original,'definition_of_done',c.payload->>'definition_of_done','requested',c.payload->'requested',
  'step',current_step.step_key,'plan_fingerprint',c.mission_plan->>'fingerprint','sources',inputs,'artifacts',files);
end $$;

create or replace function public.helena_flag_mission(p_command_id text,p_code text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.helena_commands; why text;
begin
 if p_code is null or p_code not in ('MISSION_REPLAN_REQUIRED','MISSION_INVALID_QUANTITY','MISSION_ART_BRIEF_MISSING',
  'MISSION_ART_BRIEF_INVALID','MISSION_COPY_NOT_APPROVED','MISSION_BRIEF_TOO_LARGE','MISSION_SNAPSHOT_DIVERGENT',
  'MISSION_DEPENDENCY_GAP','MISSION_UNCONFIRMED') then raise exception 'Código de diagnóstico inválido' using errcode='22023'; end if;
 select * into c from public.helena_commands where command_id=p_command_id for update nowait;
 if not found then raise exception 'Pedido inexistente' using errcode='22023'; end if;
 if c.state in ('DELIVERED','RECORDED') then return private.helena_command_receipt(c); end if;
 why:=p_code||': '||case when p_code='MISSION_REPLAN_REQUIRED' then 'Helena deve reorganizar o pedido acima dos limites do contrato (9 imagens/10 referências e 10 etapas); não cortar quantidades nem ampliar tentativas.'
  when p_code like 'MISSION_ART_BRIEF_%' then 'Isabela e Camila devem fornecer a direção de arte estruturada e aprovada deste lote, baseada na marca atual. Não criar imagem sem insumos.'
  when p_code='MISSION_COPY_NOT_APPROVED' then 'Revisor da copy e Helena conferem a aprovação da fonte antes do design.'
  else 'Theo confere contrato, persistência e eventos; Helena reconcilia a mesma missão, sem duplicar ou repetir resultado incerto.' end;
 update public.helena_commands set state='RESOLVING',reason='EM RESOLUÇÃO: '||why,
  updated_at=case when state<>'RESOLVING' or reason is distinct from why then clock_timestamp() else updated_at end
  where command_id=p_command_id returning * into c;
 return private.helena_command_receipt(c);
end $$;

-- O aceite humano final não pode ignorar uma etapa anterior reprovada ou modificada.
create or replace function private.helena_mission_final_guard()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.state='DELIVERED' and new.mission_plan is not null and exists(
   select 1 from public.helena_mission_steps s left join public.agent_jobs j on j.job_id=s.job_id
   where s.command_id=new.command_id and not coalesce(private.helena_mission_job_approved(j),false)) then
  raise exception 'Missão ainda tem etapas sem aprovação atual' using errcode='22023'; end if;
 if old.mission_plan is not null and (new.mission_plan is distinct from old.mission_plan
   or new.original is distinct from old.original or new.business_id is distinct from old.business_id
   or new.task_id is distinct from old.task_id or new.command_id is distinct from old.command_id
   or new.user_id is distinct from old.user_id or new.payload is distinct from old.payload) then
  raise exception 'Contrato da missão imutável; não sobrescrever intenção ou empresa' using errcode='40001'; end if;
 return new;
end $$;
drop trigger if exists helena_mission_final_guard on public.helena_commands;
create trigger helena_mission_final_guard before update on public.helena_commands
 for each row execute function private.helena_mission_final_guard();

-- Trilha de mudanças do recibo, inclusive quando ainda não existe job. Não registra pensamentos.
create table if not exists public.helena_command_events (
 event_id bigint generated always as identity primary key,
 command_id text not null references public.helena_commands(command_id),
 business_id text,
 state_before text, state_after text not null, reason text,
 actor_user_id uuid, created_at timestamptz not null default clock_timestamp()
);
alter table public.helena_command_events enable row level security;
revoke all on public.helena_command_events from public,anon,authenticated,service_role;
grant select on public.helena_command_events to authenticated,service_role;
create index if not exists helena_command_events_command on public.helena_command_events(command_id,event_id);
drop policy if exists helena_command_events_read on public.helena_command_events;
create policy helena_command_events_read on public.helena_command_events for select to authenticated
 using(exists(select 1 from public.helena_commands c where c.command_id=helena_command_events.command_id));
create or replace function private.helena_audit_command()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  insert into public.helena_command_events(command_id,business_id,state_after,reason,actor_user_id)
   values(new.command_id,new.business_id,new.state,new.reason,auth.uid());
 elsif (new.state,new.reason,new.job_id) is distinct from (old.state,old.reason,old.job_id) then
  insert into public.helena_command_events(command_id,business_id,state_before,state_after,reason,actor_user_id)
   values(new.command_id,new.business_id,old.state,new.state,new.reason,auth.uid());
 end if;
 return new;
end $$;
drop trigger if exists helena_audit_command on public.helena_commands;
create trigger helena_audit_command after insert or update on public.helena_commands
 for each row execute function private.helena_audit_command();

revoke all on function public.helena_mission_context(text,text),public.helena_flag_mission(text,text),
 private.helena_mission_final_guard(),private.helena_audit_command() from public,anon,authenticated;
grant execute on function public.helena_mission_context(text,text),public.helena_flag_mission(text,text) to service_role;
-- Defesa de vínculo: o caminho legado não cria uma cadeia paralela na mesma missão.
create or replace function private.helena_managed_job_guard()
returns trigger language plpgsql security invoker set search_path='' as $$
declare c public.helena_commands; s public.helena_mission_steps; root text; expected_sources jsonb;
begin
 if tg_op='UPDATE' and old.result_payload->>'managed_by'='helena-mission-v2' then
  if new.result_payload->>'managed_by' is distinct from 'helena-mission-v2'
    or new.job_id is distinct from old.job_id or new.task_id is distinct from old.task_id
    or new.business_id is distinct from old.business_id or new.agent_id is distinct from old.agent_id
    or new.correlation_id is distinct from old.correlation_id or new.max_attempts is distinct from old.max_attempts
    or (new.result_payload->'command_id',new.result_payload->'mission_step',new.result_payload->'mission_contract',new.result_payload->'required_slots',new.result_payload->'source_job_ids')
      is distinct from (old.result_payload->'command_id',old.result_payload->'mission_step',old.result_payload->'mission_contract',old.result_payload->'required_slots',old.result_payload->'source_job_ids') then
   raise exception 'Identidade e contrato da missão não podem ser sobrescritos' using errcode='42501'; end if;
  if exists(select 1 from public.helena_commands x where x.command_id=old.result_payload->>'command_id' and x.state='DELIVERED')
    and to_jsonb(new) is distinct from to_jsonb(old) then
   raise exception 'Missão aceita é histórica; nova alteração exige nova intenção rastreável' using errcode='42501'; end if;
 end if;
 if new.result_payload->>'managed_by'='helena-mission-v2' then
  select * into c from public.helena_commands where command_id=new.result_payload->>'command_id';
  select * into s from public.helena_mission_steps where command_id=c.command_id and step_key=new.result_payload->>'mission_step';
  root:='JOB-HR-'||md5('command:'||c.command_id);
  select coalesce(jsonb_agg(x.job_id order by x.ordinal),'[]') into expected_sources from public.helena_mission_steps x where x.command_id=c.command_id and x.ordinal<s.ordinal;
  if c.command_id is null or c.mission_plan is null or s.step_key is null or c.business_id is distinct from new.business_id
    or s.business_id is distinct from c.business_id or s.agent_id is distinct from new.agent_id
    or new.correlation_id is distinct from root
    or new.job_id is distinct from (case when s.step_key='consolidate' then root else 'JOB-HR-'||md5('mission:'||c.command_id||':'||s.step_key) end)
    or new.task_id is distinct from (case when s.step_key='consolidate' then c.task_id else 'TSK-HR-'||md5('mission:'||c.command_id||':'||s.step_key) end)
    or new.result_payload->'mission_contract' is distinct from c.payload
    or new.result_payload->'required_slots' is distinct from s.slots
    or new.result_payload->'source_job_ids' is distinct from expected_sources then
   raise exception 'Job sem vínculo íntegro com a missão' using errcode='42501'; end if;
 else
  if exists(select 1 from public.helena_commands x where x.mission_plan is not null
    and new.correlation_id='JOB-HR-'||md5('command:'||x.command_id)) then
   raise exception 'Handoff legado não pode duplicar etapa de missão gerenciada' using errcode='42501'; end if;
 end if;
 return new;
end $$;
drop trigger if exists helena_managed_job_guard on public.agent_jobs;
create trigger helena_managed_job_guard before insert or update on public.agent_jobs
 for each row execute function private.helena_managed_job_guard();
revoke all on function private.helena_managed_job_guard() from public,anon,authenticated;
-- Selos e eventos não aceitam reescrita, nem pelos papéis de execução.
drop trigger if exists helena_mission_seals_append_only on public.helena_mission_review_seals;
create trigger helena_mission_seals_append_only before update or delete on public.helena_mission_review_seals
 for each row execute function public.helena_append_only();
drop trigger if exists helena_command_events_append_only on public.helena_command_events;
create trigger helena_command_events_append_only before update or delete on public.helena_command_events
 for each row execute function public.helena_append_only();

-- O cartão original não muda silenciosamente enquanto os especialistas usam sua fotografia.
create or replace function private.helena_mission_source_guard()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if exists(select 1 from public.helena_commands c where c.task_id=old.task_id and c.mission_plan is not null)
  and (new.task_id,new.business_id,new.tarefa,new.definicao_de_pronto)
   is distinct from (old.task_id,old.business_id,old.tarefa,old.definicao_de_pronto) then
  raise exception 'Pedido original vinculado à missão é imutável; registre nova intenção rastreável' using errcode='42501';
 end if;
 return new;
end $$;
drop trigger if exists helena_mission_source_guard on public.tarefas;
create trigger helena_mission_source_guard before update on public.tarefas
 for each row execute function private.helena_mission_source_guard();
revoke all on function private.helena_mission_source_guard() from public,anon,authenticated;

commit;
