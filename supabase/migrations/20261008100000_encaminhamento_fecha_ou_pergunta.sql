-- Encaminhamento nunca para em silêncio (Fundador, 2026-10-08: "quero que eles sejam meu funcionário").
-- Na fase HANDOFF a coordenação termina de uma de duas formas: handoff_task (próxima etapa) ou
-- record_coordination_note com close_handoff=true. Com founder_question, a pergunta vira handoff
-- ABERTO para o Fundador no app, em vez de ficar só numa nota que ninguém lê.
create or replace function public.gateway_record_coordination_note(p_profile_slug text, p_payload jsonb)
 returns jsonb
 language plpgsql
 set search_path to ''
as $function$
declare
  b public.agent_runtime_bindings; j public.agent_jobs; e public.agent_job_events;
  k text; note text; next_step text; refs jsonb; body jsonb; closes boolean; question text;
  agent_name text; handoff_id text;
begin
  if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>8192 then
    raise exception 'Payload invalido' using errcode='22023'; end if;
  select * into b from public.agent_runtime_bindings where profile_slug=p_profile_slug for share;
  if not found or b.status<>'ACTIVE' or b.provider<>'HERMES' or b.agent_id not in ('AGT-01','AGT-04')
     or not (b.scope_type='BUSINESS' or (b.scope_type='GROUP' and b.agent_id='AGT-01')) then
    raise exception 'Somente Helena ou Marina ativa registra nota de coordenacao' using errcode='42501'; end if;
  k:=nullif(btrim(p_payload->>'idempotency_key'),'');
  note:=nullif(btrim(p_payload->>'note'),''); next_step:=nullif(btrim(p_payload->>'next_step'),'');
  refs:=coalesce(p_payload->'evidence_refs','[]'::jsonb);
  closes:=coalesce((p_payload->>'close_handoff')::boolean,false);
  question:=nullif(btrim(p_payload->>'founder_question'),'');
  if k is null or length(k)>120 or note is null or length(note)<20 or length(note)>2000
     or next_step is null or length(next_step)>600 or jsonb_typeof(refs)<>'array' or jsonb_array_length(refs)>10 then
    raise exception 'Chave, nota (20 a 2000), proximo passo e ate 10 evidencias obrigatorios' using errcode='22023'; end if;
  if question is not null and (length(question)<20 or length(question)>1500) then
    raise exception 'founder_question objetiva de 20 a 1500 caracteres' using errcode='22023'; end if;
  if question is not null and not closes then
    raise exception 'founder_question so acompanha close_handoff=true' using errcode='22023'; end if;
  select * into j from public.agent_jobs where job_id=p_payload->>'job_id';
  if not found or j.business_id is null then raise exception 'Job exige empresa' using errcode='22023'; end if;
  if b.scope_type='BUSINESS' and not public.helena_agent_serves(b.agent_id, j.business_id) then
    raise exception 'Empresa fora do escopo' using errcode='42501'; end if;
  if closes and public.gateway_workflow_phase(j) is distinct from 'HANDOFF' then
    raise exception 'close_handoff so vale para entrega aprovada aguardando encaminhamento (fase HANDOFF)' using errcode='22023'; end if;
  body:=jsonb_build_object('workflow_key',k,'note',note,'next_step',next_step,'evidence_refs',refs,
    'profile_slug',p_profile_slug,'job_status',j.status,'close_handoff',closes,'founder_question',question);
  select * into e from public.agent_job_events where job_id=j.job_id and event_type='COORDINATION_NOTE' and payload->>'workflow_key'=k;
  if e.event_id is not null then
    if e.payload is distinct from body then raise exception 'Chave reutilizada com conteudo diferente' using errcode='22023'; end if;
    return jsonb_build_object('success',true,'job_id',j.job_id,'recorded',true,'replayed',true,'handoff_closed',closes);
  end if;
  insert into public.agent_job_events(job_id,agent_id,business_id,event_type,status,message,payload,correlation_id)
    values(j.job_id,b.agent_id,j.business_id,'COORDINATION_NOTE',j.status,left(note,600),body,j.correlation_id);
  if closes then
    if question is not null then
      select agente into agent_name from public.agentes where agent_id=b.agent_id;
      handoff_id:='HND-HANDOFF-'||md5(p_profile_slug||':'||k);
      insert into public.handoffs(id,data_hora,de,para,business_id_area,assunto,contexto_essencial,pergunta_tarefa_transferida,pendencias,prioridade,status,related_object_id,scope_type)
        values(handoff_id,clock_timestamp()::text,coalesce(agent_name,'Helena'),'Fundador',j.business_id,
          'Decisão necessária: '||left(j.objective,200),note,question,next_step,'ALTA','ABERTO',j.job_id,'BUSINESS')
        on conflict (id) do nothing;
    end if;
    insert into public.agent_job_events(job_id,agent_id,business_id,event_type,status,message,payload,correlation_id)
      values(j.job_id,b.agent_id,j.business_id,'HANDOFF_CLOSED',j.status,left(next_step,600),
        jsonb_build_object('workflow_key',k,'profile_slug',p_profile_slug,'founder_handoff_id',handoff_id,'reason',left(note,600)),
        j.correlation_id);
  end if;
  return jsonb_build_object('success',true,'job_id',j.job_id,'recorded',true,'replayed',false,
    'handoff_closed',closes,'founder_handoff_id',handoff_id);
end;
$function$;
revoke all on function public.gateway_record_coordination_note(text, jsonb) from public, anon, authenticated;
grant execute on function public.gateway_record_coordination_note(text, jsonb) to service_role;
