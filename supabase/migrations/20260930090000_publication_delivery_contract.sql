-- Preserve structured public content and version-specific visual inspection
-- in the existing transaction, identity checks and optimistic locking.
do $migration$
declare
  original text;
  patched text;
  submission text := $match$jsonb_build_object('reviewer_agent_id',reviewer,'review_pending',true)$match$;
  review text := $match$jsonb_build_object('review_pending',false,'reviewed_by',b.agent_id,'review_reason',p_payload->>'reason')$match$;
begin
  select pg_get_functiondef('public.gateway_workflow(text,text,jsonb)'::regprocedure) into original;
  patched := original;
  if position($marker$'publication',p_payload->'publication'$marker$ in patched) = 0 then
    if position(submission in patched) = 0 then raise exception 'Contrato de entrega divergiu; migracao cancelada'; end if;
    patched := replace(patched, submission, submission || $append$||jsonb_build_object('publication',p_payload->'publication','visual_review',null)$append$);
  end if;
  if position($marker$'visual_review',p_payload->'visual_review'$marker$ in patched) = 0 then
    if position(review in patched) = 0 then raise exception 'Contrato de revisao divergiu; migracao cancelada'; end if;
    patched := replace(patched, review, review || $append$||jsonb_build_object('visual_review',p_payload->'visual_review')$append$);
  end if;
  if patched <> original then execute patched; end if;
end;
$migration$;
