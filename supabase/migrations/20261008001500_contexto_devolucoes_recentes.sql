-- Autoconferencia (Fundador, 2026-10-08): cada agente recebe no contexto os 3 ultimos motivos
-- de devolucao (REQUEST_CHANGES) das suas proprias entregas, para nao repetir o erro.
do $patch$
declare
  src text := pg_get_functiondef('public.gateway_context'::regproc);
  anchor text := $a$'profile', jsonb_build_object('profile_slug', b.profile_slug,$a$;
  addition text := $n$'recent_rejections', (select coalesce(jsonb_agg(x.reason), '[]'::jsonb) from (select left(e.payload->'request'->'payload'->>'reason', 500) as reason from public.agent_job_events e join public.agent_jobs rj on rj.job_id = e.job_id where e.event_type = 'WORKFLOW_review_delivery' and e.payload->'request'->'payload'->>'decision' = 'REQUEST_CHANGES' and rj.agent_id = b.agent_id order by e.created_at desc limit 3) x),
    $n$;
begin
  if position('recent_rejections' in src) > 0 then return; end if;
  if (length(src) - length(replace(src, anchor, ''))) / length(anchor) <> 1 then
    raise exception 'Ponto de insercao do contexto nao encontrado exatamente uma vez; nada alterado';
  end if;
  execute replace(src, anchor, addition || anchor);
end $patch$;
