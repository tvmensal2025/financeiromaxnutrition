-- Entrega aprovada sem sucessora: HANDOFF_CLOSED encerra o encaminhamento sem apagar nem
-- desaprovar a entrega (Fundador, 2026-10-07: banco limpo para novas missoes).
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
  and not exists(select 1 from public.agent_job_events e where e.job_id=j.job_id
   and e.event_type in ('WORKFLOW_handoff','HANDOFF_CLOSED')) then 'HANDOFF'
 else null end
$function$;
