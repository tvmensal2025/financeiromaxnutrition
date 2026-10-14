-- Helena Outcome v1 — impedimento vira resolução e a missão permanece ativa.
-- Incremental: aplica depois de helena_reliability_v1.sql e helena_mission_v2.sql.
begin;

do $$ begin
 if to_regclass('public.helena_commands') is null or to_regclass('public.helena_mission_steps') is null then
   raise exception 'Contrato de missão ausente; aplique reliability + mission v2 primeiro';
 end if;
end $$;

alter table public.helena_commands drop constraint if exists helena_commands_state_check;
alter table public.helena_commands add constraint helena_commands_state_check
 check(state in ('RECEIVED','CAPABILITY_PENDING','RESOLVING','BLOCKED','DRAFT','QUEUED','RUNNING','REVIEW','DELIVERED','RECORDED','FAILED'));

create table if not exists public.helena_mission_resolutions (
 resolution_id text primary key check(resolution_id ~ '^RES-[a-f0-9]{32}$'),
 command_id text not null references public.helena_commands(command_id),
 business_id text not null references public.portfolio(business_id),
 step_key text,
 issue_code text not null,
 owner_agent_id text not null references public.agentes(agent_id),
 status text not null default 'OPEN' check(status in ('OPEN','RUNNING','RESOLVED')),
 reason text not null,
 next_action text not null,
 task_id text references public.tarefas(task_id),
 job_id text references public.agent_jobs(job_id),
 target_job_id text references public.agent_jobs(job_id),
 evidence_refs jsonb not null default '[]'::jsonb check(jsonb_typeof(evidence_refs)='array'),
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 resolved_at timestamptz
);
alter table public.helena_mission_resolutions enable row level security;
revoke all on public.helena_mission_resolutions from public,anon,authenticated;
grant select on public.helena_mission_resolutions to authenticated;
grant all on public.helena_mission_resolutions to service_role;
create index if not exists helena_mission_resolutions_command on public.helena_mission_resolutions(command_id,status,created_at);
drop policy if exists helena_mission_resolutions_read on public.helena_mission_resolutions;
create policy helena_mission_resolutions_read on public.helena_mission_resolutions for select to authenticated
 using(exists(select 1 from public.helena_commands c where c.command_id=helena_mission_resolutions.command_id));

create or replace function private.helena_resolution_owner(p_code text)
returns text language sql immutable set search_path='' as $$
 select case
  when p_code in ('EXECUTION_FAILED','ATTEMPT_LIMIT','RUNTIME_UNAVAILABLE','CAPABILITY_MISSING','MISSION_UNCONFIRMED','MISSION_SNAPSHOT_DIVERGENT','MISSION_DEPENDENCY_GAP') then 'AGT-09'
  else 'AGT-01' end;
$$;

create or replace function public.helena_open_resolution(p_command_id text,p_step_key text,p_code text,p_reason text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.helena_commands; s public.helena_mission_steps; r public.helena_mission_resolutions;
 owner text; owner_name text; rid text; tid text; jid text; root text; t public.tarefas; runtime_ok boolean;
begin
 if p_code is null or length(p_code) not between 3 and 80 or length(btrim(coalesce(p_reason,'')))<8 then
  raise exception 'Diagnóstico de resolução inválido' using errcode='22023'; end if;
 select * into c from public.helena_commands where command_id=p_command_id for update;
 if not found or c.payload->>'kind' is distinct from 'TASK' then raise exception 'Missão inexistente' using errcode='22023'; end if;
 if c.state='DELIVERED' then return jsonb_build_object('verified',true,'command_id',c.command_id,'state',c.state,'resolution',null); end if;
 if p_step_key is not null then select * into s from public.helena_mission_steps where command_id=c.command_id and step_key=p_step_key;
 else select * into s from public.helena_mission_steps where command_id=c.command_id order by ordinal limit 1; end if;
 owner:=private.helena_resolution_owner(p_code); select agente into owner_name from public.agentes where agent_id=owner;
 if owner_name is null then owner:='AGT-01'; select agente into owner_name from public.agentes where agent_id=owner; end if;
 rid:='RES-'||md5(c.command_id||':'||coalesce(p_step_key,'MISSION')||':'||p_code);
 select * into r from public.helena_mission_resolutions where resolution_id=rid for update;
 if not found then
  tid:='TSK-RES-'||md5(rid); jid:='JOB-HR-'||md5('resolution:'||rid); root:='JOB-HR-'||md5('command:'||c.command_id);
  insert into public.tarefas(task_id,business_id,tarefa,tipo,responsavel,prioridade,status,definicao_de_pronto,source_system,related_object_type,related_object_id,idempotency_key,prazo)
   values(tid,c.business_id,'Resolver '||p_code||' da missão '||c.command_id,'RESOLUÇÃO',owner_name,'ALTA','NÃO INICIADA',
    'Identificar causa, aplicar correção segura, registrar evidência verificável e devolver a etapa original em condição de continuar.','HELENA_RESOLUTION','MISSION_RESOLUTION',rid,'resolution:'||rid,c.payload->>'deadline')
   on conflict(task_id) do nothing;
  select exists(select 1 from public.agent_runtime_bindings b where b.agent_id=owner and b.provider='HERMES' and b.status='ACTIVE'
    and ((b.scope_type='BUSINESS' and b.business_id=c.business_id) or (owner='AGT-01' and b.scope_type='GROUP'))) into runtime_ok;
  if runtime_ok then
   insert into public.agent_jobs(job_id,task_id,agent_id,business_id,objective,instruction,priority,status,approval_required,approval_status,max_attempts,idempotency_key,correlation_id,result_payload)
    values(jid,tid,owner,c.business_id,'Resolver '||p_code||' e retomar a missão',
     'Diagnostique a causa real sem repetir resultado incerto. Corrija dentro das permissões existentes, teste, registre evidência e entregue um parecer operacional que permita retomar a mesma etapa. Não abandone nem crie missão paralela.',
     'ALTA','DRAFT',true,'PENDING',2,'resolution-job:'||rid,jid,
     jsonb_build_object('managed_by','helena-resolution-v1','resolution_id',rid,'command_id',c.command_id,'mission_step',p_step_key,'issue_code',p_code,'target_job_id',s.job_id));
  else jid:=null; end if;
  insert into public.helena_mission_resolutions(resolution_id,command_id,business_id,step_key,issue_code,owner_agent_id,reason,next_action,task_id,job_id,target_job_id)
   values(rid,c.command_id,c.business_id,p_step_key,p_code,owner,p_reason,
    case when runtime_ok then 'Executar a resolução, revisar a evidência e retomar automaticamente a etapa original.' else 'Helena coordena a habilitação da capacidade necessária e retoma a mesma missão; nenhum pedido é abandonado.' end,
    tid,jid,s.job_id) returning * into r;
  insert into public.handoffs(id,data_hora,de,para,business_id_area,assunto,contexto_essencial,pergunta_tarefa_transferida,status,prioridade,pendencias,related_object_id,scope_type)
   values('HND-RES-'||md5(rid),clock_timestamp()::text,'Helena',owner_name,c.business_id,'Resolução '||p_code,
    'Missão '||c.command_id||'; etapa '||coalesce(p_step_key,'geral')||'; motivo: '||p_reason,
    'Resolver a causa, comprovar a correção e devolver a missão ao fluxo.','ABERTO','ALTA',null,rid,'BUSINESS') on conflict(id) do nothing;
 else
  update public.helena_mission_resolutions set reason=p_reason,updated_at=case when reason is distinct from p_reason then clock_timestamp() else updated_at end
   where resolution_id=rid returning * into r;
 end if;
 select * into t from public.tarefas where task_id=c.task_id for update;
 if found and (t.status is distinct from 'EM EXECUÇÃO' or t.bloqueio is distinct from 'EM RESOLUÇÃO: '||p_reason) then
  perform public.helena_write_record('tarefas',t.task_id,t.row_version,jsonb_build_object('status','EM EXECUÇÃO','bloqueio','EM RESOLUÇÃO: '||p_reason),false);
 end if;
 update public.helena_commands set state='RESOLVING',reason='EM RESOLUÇÃO · '||owner_name||': '||p_reason,
  updated_at=case when state is distinct from 'RESOLVING' or reason is distinct from 'EM RESOLUÇÃO · '||owner_name||': '||p_reason then clock_timestamp() else updated_at end
  where command_id=c.command_id returning * into c;
 return jsonb_build_object('verified',true,'command_id',c.command_id,'business_id',c.business_id,'state',c.state,'resolution_id',r.resolution_id,'owner_agent_id',r.owner_agent_id,'task_id',r.task_id,'job_id',r.job_id,'next_action',r.next_action);
end $$;

create or replace function public.helena_reconcile_resolution(p_resolution_id text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.helena_mission_resolutions; j public.agent_jobs; target public.agent_jobs; t public.tarefas; c public.helena_commands; h public.handoffs; approved boolean:=false;
begin
 select * into r from public.helena_mission_resolutions where resolution_id=p_resolution_id for update;
 if not found then raise exception 'Resolução inexistente' using errcode='22023'; end if;
 if r.status='RESOLVED' then return jsonb_build_object('verified',true,'resolution_id',r.resolution_id,'status',r.status,'resumed',true); end if;
 if r.job_id is null then return jsonb_build_object('verified',true,'resolution_id',r.resolution_id,'status','OPEN','resumed',false,'reason','CAPABILITY_RESOLUTION_REQUIRED'); end if;
 select * into j from public.agent_jobs where job_id=r.job_id for update;
 approved:=j.status='COMPLETED' and j.approval_status='APPROVED' and coalesce(j.result_payload->>'review_pending','true')='false' and jsonb_array_length(coalesce(j.evidence_refs,'[]'::jsonb))>0;
 if not approved then
  update public.helena_mission_resolutions set status=case when j.status in ('READY','CLAIMED','RUNNING','WAITING_HELENA') then 'RUNNING' else 'OPEN' end,updated_at=clock_timestamp() where resolution_id=r.resolution_id;
  return jsonb_build_object('verified',true,'resolution_id',r.resolution_id,'status',case when j.status in ('READY','CLAIMED','RUNNING','WAITING_HELENA') then 'RUNNING' else 'OPEN' end,'resumed',false);
 end if;
 if r.target_job_id is not null then
  select * into target from public.agent_jobs where job_id=r.target_job_id for update;
  if found and target.status<>'COMPLETED' then
   update public.agent_jobs set status='DRAFT',attempt_count=0,approval_status='PENDING',completed_at=null,error_code=null,error_message=null,result_summary=null,evidence_refs='[]'::jsonb,
    result_payload=(coalesce(target.result_payload,'{}'::jsonb)-'review_pending'-'reviewed_by'-'review_reason'-'quality_review'-'visual_review')||jsonb_build_object('recovery',jsonb_build_object('resolution_id',r.resolution_id,'approved_at',clock_timestamp(),'previous_status',target.status,'previous_attempt_count',target.attempt_count)),updated_at=clock_timestamp()
    where job_id=target.job_id;
   insert into public.agent_job_events(job_id,agent_id,business_id,event_type,status,message,payload,correlation_id)
    values(target.job_id,'AGT-01',target.business_id,'MISSION_RESOLUTION_RESUMED','DRAFT','Causa tratada por resolução aprovada; a mesma etapa foi retomada sem apagar o histórico.',jsonb_build_object('resolution_id',r.resolution_id,'resolution_job_id',r.job_id),target.correlation_id);
  end if;
 end if;
 update public.helena_mission_resolutions set status='RESOLVED',evidence_refs=j.evidence_refs,resolved_at=clock_timestamp(),updated_at=clock_timestamp() where resolution_id=r.resolution_id returning * into r;
 for h in select * from public.handoffs where related_object_id=r.resolution_id and status='ABERTO' for update loop
  perform public.helena_write_record('handoffs',h.id,h.row_version,jsonb_build_object('status','CONCLUÍDO','retorno_conclusao','Resolução aprovada; missão retomada.','pendencias',null),false);
 end loop;
 select * into c from public.helena_commands where command_id=r.command_id for update;
 select * into t from public.tarefas where task_id=c.task_id for update;
 if found then perform public.helena_write_record('tarefas',t.task_id,t.row_version,jsonb_build_object('status','EM EXECUÇÃO','bloqueio',null),false); end if;
 update public.helena_commands set state='DRAFT',reason='Resolução '||r.resolution_id||' aprovada; mesma missão retomada.',updated_at=clock_timestamp() where command_id=r.command_id;
 return jsonb_build_object('verified',true,'resolution_id',r.resolution_id,'status','RESOLVED','resumed',true,'command_id',r.command_id);
end $$;

revoke all on function private.helena_resolution_owner(text),public.helena_open_resolution(text,text,text,text),public.helena_reconcile_resolution(text) from public,anon,authenticated;
grant execute on function private.helena_resolution_owner(text),public.helena_open_resolution(text,text,text,text),public.helena_reconcile_resolution(text) to service_role;

commit;
