-- Autorizado pelo Fundador em 2026-10-07 ("pode liberar a Helena corrigir briefing de rascunho").
-- 1) Encaminhamento enxuto: o handoff deixa de anexar o resumo da entrega anterior ao briefing
--    (estourava 8000 caracteres e copiava IDs de versoes devolvidas). Fonte e evidencias continuam.
-- 2) Coordenacao corrige briefing de rascunho nunca executado (tentativa 0, sem entrega),
--    com versoes conferidas, fontes aprovadas e historico, sem contornar REQUEST_CHANGES.
begin;

do $patch$
declare
  src text := pg_get_functiondef('public.gateway_workflow'::regproc);
  old text := $o$'Fonte: '||j.job_id||E'\nEntrega revisada: '||left(coalesce(j.result_summary,''),1600)||E'\nEvidencias: '||j.evidence_refs::text$o$;
  new text := $n$'Fonte: '||j.job_id||E'\nEntrega revisada: aprovada por revisao independente; conteudo integral na fonte e nas evidencias abaixo.'||E'\nEvidencias: '||j.evidence_refs::text$n$;
begin
  if position(old in src) = 0 then raise exception 'Trecho do handoff nao encontrado; nada alterado'; end if;
  execute replace(src, old, new);
end $patch$;

create or replace function public.gateway_revise_draft_brief(p_profile_slug text, p_payload jsonb)
 returns jsonb
 language plpgsql
 set search_path to ''
as $function$
declare
  b public.agent_runtime_bindings; j public.agent_jobs; t public.tarefas; e public.agent_job_events;
  k text; ins text; dod text; summary text; req jsonb; res jsonb; history jsonb; mem text; updated jsonb;
begin
  if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>24576 then
    raise exception 'Payload invalido' using errcode='22023'; end if;
  select * into b from public.agent_runtime_bindings where profile_slug=p_profile_slug for share;
  if not found or b.status<>'ACTIVE' or b.provider<>'HERMES' or b.agent_id not in ('AGT-01','AGT-04')
     or not (b.scope_type='BUSINESS' or (b.scope_type='GROUP' and b.agent_id='AGT-01')) then
    raise exception 'Somente Helena ou Marina ativa corrige briefing' using errcode='42501'; end if;
  k:=nullif(btrim(p_payload->>'idempotency_key'),''); ins:=nullif(btrim(p_payload->>'instruction'),'');
  dod:=nullif(btrim(p_payload->>'definition_of_done'),''); summary:=nullif(btrim(p_payload->>'revision_summary'),'');
  if k is null or length(k)>120 or ins is null or length(ins) not between 700 and 8000
     or dod is null or length(dod) not between 80 and 4000 or summary is null or length(summary) not between 20 and 1200 then
    raise exception 'Chave, briefing (700-8000), definicao de pronto (80-4000) e resumo da correcao obrigatorios' using errcode='22023'; end if;
  perform public.helena_validate_professional_brief(ins);
  req:=jsonb_build_object('profile',p_profile_slug,'action','revise_draft_brief','payload',p_payload);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_profile_slug||':'||k,0));
  select * into j from public.agent_jobs where job_id=p_payload->>'job_id' for update;
  if not found or j.business_id is null or j.task_id is null then raise exception 'Job exige tarefa e empresa' using errcode='22023'; end if;
  if b.scope_type='BUSINESS' and not public.helena_agent_serves(b.agent_id, j.business_id) then
    raise exception 'Empresa fora do escopo' using errcode='42501'; end if;
  select * into e from public.agent_job_events where job_id=j.job_id and payload->>'workflow_key'=k and event_type='WORKFLOW_revise_task_brief';
  if e.event_id is not null then
    if e.payload->'request' is distinct from req then raise exception 'Chave reutilizada com conteudo diferente' using errcode='22023'; end if;
    return e.payload->'response'; end if;
  select * into t from public.tarefas where task_id=j.task_id for update;
  if not found or t.business_id is distinct from j.business_id then raise exception 'Tarefa divergente' using errcode='22023'; end if;
  if (p_payload->>'expected_task_version')::bigint is distinct from t.row_version
     or j.updated_at is distinct from (p_payload->>'expected_job_updated_at')::timestamptz then
    raise exception 'CONFLITO_DE_VERSAO: releia job e tarefa antes de corrigir' using errcode='PT409'; end if;
  -- Somente rascunho nunca executado: entrega devolvida segue o caminho rigoroso de revise_task_brief.
  if j.status<>'DRAFT' or coalesce(j.attempt_count,0)<>0 or coalesce(j.result_payload,'{}'::jsonb) ? 'delivery'
     or coalesce(j.result_payload->>'review_pending','false')='true' or t.status<>'NÃO INICIADA' then
    raise exception 'Correcao de rascunho exige job DRAFT nunca executado (tentativa 0, sem entrega); apos devolucao use revise_task_brief' using errcode='22023'; end if;
  for mem in select distinct (regexp_matches(ins,'MEM-HR-[a-f0-9]{32}','gi'))[1] loop
    if not exists(select 1 from public.memoria_mestre m join public.agent_jobs o on o.job_id=m.related_object_id
        where m.id=mem and m.business_id_area=j.business_id and o.business_id=j.business_id
          and o.status='COMPLETED' and o.approval_status='APPROVED' and nullif(o.result_payload->>'reviewed_by','') is not null
          and o.evidence_refs ? m.id) then
      raise exception 'Fonte % sem revisao aprovada nesta empresa; descreva sem citar o ID', mem using errcode='22023'; end if;
  end loop;
  history:=case when jsonb_typeof(j.result_payload->'brief_revision_history')='array' then j.result_payload->'brief_revision_history' else '[]'::jsonb end;
  if jsonb_array_length(history)>=5 then raise exception 'Limite de cinco revisoes atingido; replanejar' using errcode='22023'; end if;
  history:=history||jsonb_build_array(jsonb_build_object('workflow_key',k,'mode','PRE_RELEASE','revised_by',b.agent_id,
    'revised_at',clock_timestamp(),'revision_summary',summary,'previous_instruction',j.instruction,
    'previous_definition_of_done',t.definicao_de_pronto,'instruction',ins,'definition_of_done',dod));
  update public.agent_jobs set instruction=ins, updated_at=clock_timestamp(),
      result_payload=coalesce(result_payload,'{}'::jsonb)||jsonb_build_object('brief_revision_history',history)
    where job_id=j.job_id;
  updated:=public.helena_write_record('tarefas',t.task_id,t.row_version,jsonb_build_object('definicao_de_pronto',dod));
  res:=jsonb_build_object('success',true,'mode','PRE_RELEASE','job_id',j.job_id,'task_id',t.task_id,'status','DRAFT',
    'task_version',updated->'row_version','started',false,'released',false);
  insert into public.agent_job_events(job_id,agent_id,business_id,event_type,status,message,payload,correlation_id)
    values(j.job_id,b.agent_id,j.business_id,'WORKFLOW_revise_task_brief','DRAFT',summary,
      jsonb_build_object('workflow_key',k,'request',req,'response',res,'profile_slug',p_profile_slug,'mode','PRE_RELEASE'),j.correlation_id);
  return res;
end;
$function$;
revoke all on function public.gateway_revise_draft_brief(text, jsonb) from public, anon, authenticated;
grant execute on function public.gateway_revise_draft_brief(text, jsonb) to service_role;

commit;
