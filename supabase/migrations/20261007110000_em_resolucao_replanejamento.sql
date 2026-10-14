-- EM_RESOLUÇÃO (autorizado pelo Fundador em 2026-10-07: "pode fazer o em resolução").
-- Missão com tentativas esgotadas deixa de morrer em silêncio: entra na fase REPLAN da
-- coordenação. Helena/Marina substituem por missão corrigida (mesmo create_task, sem tabela
-- nova) ou escalam ao Fundador. No máximo 2 replanejamentos por linhagem; histórico preservado.
begin;

alter table public.agent_workflow_runs drop constraint if exists agent_workflow_runs_phase_check;
alter table public.agent_workflow_runs add constraint agent_workflow_runs_phase_check
  check (phase = any (array['REVIEW','HANDOFF','COORDINATE','RESOLVE','REPLAN']));

create or replace function public.gateway_workflow_phase(j agent_jobs)
 returns text
 language sql
 stable
 set search_path to ''
as $function$
 select case
 when j.status='DRAFT' and coalesce(j.attempt_count,0)>=least(coalesce(j.max_attempts,2),2) then 'REPLAN'
 when j.status='DRAFT' then 'COORDINATE'
 when j.status='WAITING_HELENA' and j.result_payload->>'review_pending'='true'
  and j.result_payload->>'reviewer_agent_id' is not null
  and j.result_payload->>'reviewer_agent_id' not in ('FOUNDER',j.agent_id) then 'REVIEW'
 when j.status='WAITING_HELENA' and coalesce(j.result_payload->>'review_pending','false')<>'true'
  and j.agent_id<>'AGT-01' and coalesce(j.attempt_count,0)>=least(coalesce(j.max_attempts,2),2) then 'REPLAN'
 when j.status='WAITING_HELENA' and coalesce(j.result_payload->>'review_pending','false')<>'true'
  and j.agent_id<>'AGT-01' then 'RESOLVE'
 when j.status='COMPLETED' and j.result_payload->>'review_pending'='false'
  and nullif(j.result_payload->>'reviewed_by','') is not null
  and coalesce(j.result_payload->'delivery'->>'stage','')<>'FINAL'
  and exists(select 1 from public.agent_job_events e where e.job_id=j.job_id
   and e.event_type='WORKFLOW_review_delivery' and e.agent_id=j.result_payload->>'reviewed_by'
   and e.payload->'request'->'payload'->>'decision'='APPROVE')
  and not exists(select 1 from public.agent_job_events e where e.job_id=j.job_id and e.event_type='WORKFLOW_handoff') then 'HANDOFF'
 else null end
$function$;

create or replace function public.gateway_replan_job(p_profile_slug text, p_payload jsonb)
 returns jsonb
 language plpgsql
 set search_path to ''
as $function$
declare
  b public.agent_runtime_bindings; j public.agent_jobs; t public.tarefas; e public.agent_job_events;
  k text; reason text; mode text; req jsonb; res jsonb; created jsonb; agent_name text;
  replans integer; root text; mem text; question text;
begin
  if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>16384 then
    raise exception 'Payload invalido' using errcode='22023'; end if;
  select * into b from public.agent_runtime_bindings where profile_slug=p_profile_slug for share;
  if not found or b.status<>'ACTIVE' or b.provider<>'HERMES' or b.agent_id not in ('AGT-01','AGT-04')
     or not (b.scope_type='BUSINESS' or (b.scope_type='GROUP' and b.agent_id='AGT-01')) then
    raise exception 'Somente Helena ou Marina ativa replaneja' using errcode='42501'; end if;
  k:=nullif(btrim(p_payload->>'idempotency_key'),''); reason:=nullif(btrim(p_payload->>'reason'),''); mode:=p_payload->>'mode';
  if k is null or length(k)>120 or reason is null or length(reason)<40 or length(reason)>4000 or mode not in ('REPLACE','ESCALATE') then
    raise exception 'Chave, motivo (40+ caracteres) e modo REPLACE ou ESCALATE obrigatorios' using errcode='22023'; end if;
  req:=jsonb_build_object('profile',p_profile_slug,'action','replan_job','payload',p_payload);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_profile_slug||':'||k,0));
  select * into j from public.agent_jobs where job_id=p_payload->>'job_id' for update;
  if not found or j.business_id is null or j.task_id is null then raise exception 'Job exige tarefa e empresa' using errcode='22023'; end if;
  if b.scope_type='BUSINESS' and not public.helena_agent_serves(b.agent_id, j.business_id) then
    raise exception 'Empresa fora do escopo' using errcode='42501'; end if;
  select * into e from public.agent_job_events where job_id=j.job_id and payload->>'workflow_key'=k and event_type like 'WORKFLOW_%';
  if e.event_id is not null then
    if e.payload->'request' is distinct from req then raise exception 'Chave reutilizada com conteudo diferente' using errcode='22023'; end if;
    return e.payload->'response'; end if;
  if public.gateway_workflow_phase(j) is distinct from 'REPLAN' then
    raise exception 'Replanejamento exige missao com tentativas esgotadas (fase REPLAN)' using errcode='22023'; end if;
  select * into t from public.tarefas where task_id=j.task_id for update;
  if not found or t.business_id is distinct from j.business_id then raise exception 'Tarefa divergente' using errcode='22023'; end if;
  if (p_payload->>'expected_task_version')::bigint is distinct from t.row_version then
    raise exception 'CONFLITO_DE_VERSAO' using errcode='PT409'; end if;
  replans:=coalesce((j.result_payload->>'replan_count')::int,0);
  root:=coalesce(j.result_payload->>'replan_root',j.job_id);
  select agente into agent_name from public.agentes where agent_id=b.agent_id;

  if mode='REPLACE' then
    if replans>=2 then
      raise exception 'REPLAN_LIMIT: missao ja replanejada 2 vezes; use mode=ESCALATE para decisao do Fundador' using errcode='22023'; end if;
    -- Fonte citada precisa ser memoria de entrega aprovada da mesma empresa (mesma regra do Gateway).
    for mem in select distinct (regexp_matches(coalesce(p_payload->>'instruction',''),'MEM-HR-[a-f0-9]{32}','gi'))[1] loop
      if not exists(select 1 from public.memoria_mestre m join public.agent_jobs o on o.job_id=m.related_object_id
          where m.id=mem and m.business_id_area=j.business_id and o.business_id=j.business_id
            and o.status='COMPLETED' and o.approval_status='APPROVED' and nullif(o.result_payload->>'reviewed_by','') is not null
            and o.evidence_refs ? m.id) then
        raise exception 'Fonte % sem revisao aprovada nesta empresa; descreva sem citar o ID', mem using errcode='22023'; end if;
    end loop;
    created:=public.gateway_workflow(p_profile_slug,'create_task',jsonb_build_object(
      'business_id',j.business_id,'target_agent_id',coalesce(nullif(p_payload->>'target_agent_id',''),j.agent_id),
      'objective',p_payload->>'objective','instruction',p_payload->>'instruction',
      'definition_of_done',p_payload->>'definition_of_done','idempotency_key',k||':replace'));
    if created->>'success' is distinct from 'true' or nullif(created->>'job_id','') is null then
      raise exception 'Missao substituta nao confirmada' using errcode='22023'; end if;
    update public.agent_jobs set result_payload=coalesce(result_payload,'{}'::jsonb)||jsonb_build_object(
        'replan_of',j.job_id,'replan_root',root,'replan_count',replans+1,'replan_reason',reason)
      where job_id=created->>'job_id';
    update public.agent_jobs set status='CANCELLED',error_code='SUPERSEDED',
        error_message='Substituida por '||(created->>'job_id')||': '||left(reason,500),completed_at=clock_timestamp(),updated_at=clock_timestamp(),
        result_payload=coalesce(result_payload,'{}'::jsonb)||jsonb_build_object('replaced_by',created->>'job_id')
      where job_id=j.job_id;
    perform public.helena_write_record('tarefas',t.task_id,t.row_version,jsonb_build_object('status','CANCELADA','bloqueio',null));
    res:=jsonb_build_object('success',true,'mode','REPLACE','job_id',j.job_id,'status','CANCELLED',
      'replacement_job_id',created->>'job_id','replacement_task_id',created->>'task_id','replan_count',replans+1,'started',false);
  else
    question:=nullif(btrim(p_payload->>'founder_question'),'');
    if question is null or length(question)<20 or length(question)>1500 then
      raise exception 'Escalada exige founder_question objetiva (20 a 1500 caracteres)' using errcode='22023'; end if;
    update public.agent_jobs set status='WAITING_APPROVAL',updated_at=clock_timestamp(),
        result_payload=coalesce(result_payload,'{}'::jsonb)||jsonb_build_object('founder_decision_required',true,
          'decisao_necessaria',question,'contexto',reason,'escalated_by',b.agent_id,'escalated_at',clock_timestamp())
      where job_id=j.job_id;
    perform public.helena_write_record('tarefas',t.task_id,t.row_version,jsonb_build_object('status','BLOQUEADA','bloqueio','Decisão do Fundador: '||left(question,500)));
    insert into public.handoffs(id,data_hora,de,para,business_id_area,assunto,contexto_essencial,pergunta_tarefa_transferida,pendencias,prioridade,status,related_object_id,scope_type)
      values('HND-REPLAN-'||md5(p_profile_slug||':'||k),clock_timestamp()::text,coalesce(agent_name,'Helena'),'Fundador',j.business_id,
        'Decisão necessária: '||left(j.objective,200),reason,question,'Aguardando decisão do Fundador','ALTA','ABERTO',j.job_id,'BUSINESS');
    res:=jsonb_build_object('success',true,'mode','ESCALATE','job_id',j.job_id,'status','WAITING_APPROVAL','replan_count',replans,'started',false);
  end if;

  insert into public.agent_job_events(job_id,agent_id,business_id,event_type,status,message,payload,correlation_id)
    values(j.job_id,b.agent_id,j.business_id,'WORKFLOW_replan_job',res->>'status',reason,
      jsonb_build_object('workflow_key',k,'request',req,'response',res,'profile_slug',p_profile_slug,
        'previous_status',j.status,'attempt_count',j.attempt_count,'replan_root',root),j.correlation_id);
  return res;
end;
$function$;
revoke all on function public.gateway_replan_job(text, jsonb) from public, anon, authenticated;
grant execute on function public.gateway_replan_job(text, jsonb) to service_role;

commit;
