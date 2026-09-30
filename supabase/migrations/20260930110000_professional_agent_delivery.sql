-- Additive upgrade; existing jobs, reviews, identities and permissions are preserved.
do $migration$
declare
  original text;
  patched text;
  submission text := $match$jsonb_build_object('reviewer_agent_id',reviewer,'review_pending',true)$match$;
  review text := $match$jsonb_build_object('review_pending',false,'reviewed_by',b.agent_id,'review_reason',p_payload->>'reason')$match$;
begin
  select pg_get_functiondef('public.gateway_workflow(text,text,jsonb)'::regprocedure) into original;
  patched := original;
  if position($marker$'delivery',p_payload->'delivery'$marker$ in patched) = 0 then
    if position(submission in patched) = 0 then raise exception 'Contrato de entrega divergiu; migracao cancelada'; end if;
    patched := replace(patched, submission, submission || $append$||jsonb_build_object('delivery',p_payload->'delivery','quality_review',null,'quality_version','helena-delivery-quality-v1')$append$);
    if position($branch$elsif p_action='submit_delivery' then$branch$ in patched) = 0 then raise exception 'Ramo de entrega divergiu'; end if;
    patched := replace(patched, $branch$elsif p_action='submit_delivery' then$branch$, $guard$elsif p_action='submit_delivery' then
      if jsonb_typeof(p_payload->'delivery') is distinct from 'object'
        or p_payload->'delivery'->>'schema_version' is distinct from '1'
        or length(btrim(coalesce(p_payload->'delivery'->>'content',''))) < 40
        or jsonb_typeof(p_payload->'delivery'->'acceptance_checks') is distinct from 'array' then
        raise exception 'Entrega exige material profissional e criterios verificaveis' using errcode='22023';
      end if;
    $guard$);
  end if;
  if position($marker$'quality_review',p_payload->'quality_review'$marker$ in patched) = 0 then
    if position(review in patched) = 0 then raise exception 'Contrato de revisao divergiu; migracao cancelada'; end if;
    patched := replace(patched, review, review || $append$||jsonb_build_object('quality_review',p_payload->'quality_review')$append$);
    if position($branch$elsif p_action='review_delivery' then$branch$ in patched) = 0 then raise exception 'Ramo de revisao divergiu'; end if;
    patched := replace(patched, $branch$elsif p_action='review_delivery' then$branch$, $guard$elsif p_action='review_delivery' then
      if p_payload->>'decision'='APPROVE' and (jsonb_typeof(j.result_payload->'delivery') is distinct from 'object'
        or jsonb_typeof(p_payload->'quality_review') is distinct from 'object'
        or p_payload->'quality_review'->>'requirements_met' is distinct from 'true') then
        raise exception 'Aprovacao exige entrega profissional e revisao de qualidade' using errcode='22023';
      end if;
    $guard$);
  end if;
  if patched <> original then execute patched; end if;
end;
$migration$;
