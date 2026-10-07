-- Nota de coordenação (Fundador, 2026-10-07: "corrigir a lacuna da coordenação").
-- Helena/Marina registram conferência, decisão ou impedimento em missão de qualquer agente
-- da empresa atendida, em qualquer estado, sem alterar status, tentativas ou aprovação.
create or replace function public.gateway_record_coordination_note(p_profile_slug text, p_payload jsonb)
 returns jsonb
 language plpgsql
 set search_path to ''
as $function$
declare
  b public.agent_runtime_bindings; j public.agent_jobs; e public.agent_job_events;
  k text; note text; next_step text; refs jsonb; body jsonb;
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
  if k is null or length(k)>120 or note is null or length(note)<20 or length(note)>2000
     or next_step is null or length(next_step)>600 or jsonb_typeof(refs)<>'array' or jsonb_array_length(refs)>10 then
    raise exception 'Chave, nota (20 a 2000), proximo passo e ate 10 evidencias obrigatorios' using errcode='22023'; end if;
  select * into j from public.agent_jobs where job_id=p_payload->>'job_id';
  if not found or j.business_id is null then raise exception 'Job exige empresa' using errcode='22023'; end if;
  if b.scope_type='BUSINESS' and not public.helena_agent_serves(b.agent_id, j.business_id) then
    raise exception 'Empresa fora do escopo' using errcode='42501'; end if;
  body:=jsonb_build_object('workflow_key',k,'note',note,'next_step',next_step,'evidence_refs',refs,
    'profile_slug',p_profile_slug,'job_status',j.status);
  select * into e from public.agent_job_events where job_id=j.job_id and event_type='COORDINATION_NOTE' and payload->>'workflow_key'=k;
  if e.event_id is not null then
    if e.payload is distinct from body then raise exception 'Chave reutilizada com conteudo diferente' using errcode='22023'; end if;
    return jsonb_build_object('success',true,'job_id',j.job_id,'recorded',true,'replayed',true);
  end if;
  insert into public.agent_job_events(job_id,agent_id,business_id,event_type,status,message,payload,correlation_id)
    values(j.job_id,b.agent_id,j.business_id,'COORDINATION_NOTE',j.status,left(note,600),body,j.correlation_id);
  return jsonb_build_object('success',true,'job_id',j.job_id,'recorded',true,'replayed',false);
end;
$function$;
revoke all on function public.gateway_record_coordination_note(text, jsonb) from public, anon, authenticated;
grant execute on function public.gateway_record_coordination_note(text, jsonb) to service_role;
