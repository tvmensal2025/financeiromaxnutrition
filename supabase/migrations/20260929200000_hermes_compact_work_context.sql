-- Compact, queryable context for Hermes profiles.
-- The previous gateway_workflow('context') response mixed long checkpoint,
-- task and handoff rows and could be truncated before an agent could inspect
-- the 21-agent roster. Keep the legacy RPC unchanged and expose a bounded,
-- read-only context RPC used by the Gateway runtime.
create or replace function public.gateway_context(p_profile_slug text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  b public.agent_runtime_bindings;
  agent_name text;
  result jsonb;
begin
  select * into b
  from public.agent_runtime_bindings
  where profile_slug = p_profile_slug
  for share;

  if not found or b.provider <> 'HERMES' or b.status <> 'ACTIVE' then
    raise exception 'Perfil Hermes nao ativo' using errcode = '42501';
  end if;

  select a.agente into agent_name
  from public.agentes a
  where a.agent_id = b.agent_id;

  select jsonb_build_object(
    'context_version', 'hermes-context-v2',
    'truncated', false,
    'profile', jsonb_build_object(
      'profile_slug', b.profile_slug,
      'agent_id', b.agent_id,
      'business_id', b.business_id,
      'scope_type', b.scope_type,
      'provider', b.provider,
      'status', b.status
    ),
    'role', (
      select jsonb_build_object(
        'agent_id', a.agent_id,
        'name', left(coalesce(a.agente, ''), 100),
        'function', left(coalesce(a.cargo_funcao, ''), 180),
        'status', a.status
      )
      from public.agentes a
      where a.agent_id = b.agent_id
    ),
    'checkpoint', (
      select jsonb_build_object(
        'checkpoint_id', c.checkpoint_id,
        'summary', left(coalesce(c.resumo_executivo, ''), 2200)
      )
      from public.checkpoint_mestre_atual c
      order by c.checkpoint_id desc
      limit 1
    ),
    'fleet', jsonb_build_object(
      'total', (select count(*) from public.agentes),
      'agents', coalesce((
        select jsonb_agg(x order by x.agent_id)
        from (
          select
            a.agent_id,
            left(coalesce(a.agente, ''), 80) as name,
            left(coalesce(a.cargo_funcao, ''), 140) as function,
            a.status,
            case
              when exists (
                select 1 from public.agent_runtime_bindings rb
                where rb.agent_id = a.agent_id
                  and rb.provider = 'HERMES'
                  and rb.status = 'ACTIVE'
                  and (rb.scope_type = 'GROUP' or rb.business_id = b.business_id)
              ) then 'ACTIVE'
              when exists (
                select 1 from public.agent_runtime_bindings rb
                where rb.agent_id = a.agent_id
                  and rb.provider = 'HERMES'
                  and rb.status = 'CONFIGURED'
                  and (rb.scope_type = 'GROUP' or rb.business_id = b.business_id)
              ) then 'CONFIGURED'
              else 'MISSING'
            end as runtime_status
          from public.agentes a
        ) x
      ), '[]'::jsonb)
    ),
    'queue_summary', jsonb_build_object(
      'business_id', b.business_id,
      'open_tasks', (
        select count(*)
        from public.tarefas t
        where (b.scope_type = 'GROUP' and b.agent_id = 'AGT-01')
           or (b.scope_type = 'BUSINESS' and t.business_id = b.business_id)
      ),
      'ready_jobs', (
        select count(*)
        from public.agent_jobs j
        where j.status = 'READY'
          and ((b.scope_type = 'GROUP' and b.agent_id = 'AGT-01')
            or (b.scope_type = 'BUSINESS' and j.business_id = b.business_id))
      ),
      'pending_reviews', (
        select count(*)
        from public.agent_jobs j
        where j.status = 'WAITING_HELENA'
          and ((b.agent_id = 'AGT-01') or j.result_payload->>'reviewer_agent_id' = b.agent_id)
          and ((b.scope_type = 'GROUP' and b.agent_id = 'AGT-01')
            or (b.scope_type = 'BUSINESS' and j.business_id = b.business_id))
      )
    ),
    'tasks', coalesce((
      select jsonb_agg(x)
      from (
        select
          t.task_id,
          t.business_id,
          left(coalesce(t.tarefa, ''), 180) as title,
          left(coalesce(t.responsavel, ''), 100) as responsible,
          t.status,
          left(coalesce(t.bloqueio, ''), 180) as blocking,
          t.row_version
        from public.tarefas t
        where (
          (b.scope_type = 'GROUP' and b.agent_id = 'AGT-01')
          or (b.scope_type = 'BUSINESS' and t.business_id = b.business_id)
        )
        and (b.agent_id in ('AGT-01', 'AGT-04') or t.responsavel = agent_name)
        order by t.atualizado_em desc
        limit 12
      ) x
    ), '[]'::jsonb),
    'pending_reviews_detail', coalesce((
      select jsonb_agg(x)
      from (
        select
          j.job_id,
          j.business_id,
          j.agent_id,
          left(coalesce(j.objective, ''), 180) as objective,
          j.status,
          left(coalesce(j.result_summary, ''), 240) as result_summary,
          j.updated_at
        from public.agent_jobs j
        where j.status = 'WAITING_HELENA'
          and ((b.agent_id = 'AGT-01') or j.result_payload->>'reviewer_agent_id' = b.agent_id)
          and ((b.scope_type = 'GROUP' and b.agent_id = 'AGT-01')
            or (b.scope_type = 'BUSINESS' and j.business_id = b.business_id))
        order by j.updated_at desc
        limit 8
      ) x
    ), '[]'::jsonb),
    'handoffs', coalesce((
      select jsonb_agg(x)
      from (
        select
          h.id,
          h.de,
          h.para,
          h.business_id_area,
          left(coalesce(h.assunto, ''), 160) as subject,
          h.status,
          h.related_object_id,
          h.row_version
        from public.handoffs h
        where (
          (b.scope_type = 'GROUP' and b.agent_id = 'AGT-01' and h.scope_type <> 'PERSONAL')
          or (b.scope_type = 'BUSINESS' and h.business_id_area = b.business_id)
        )
        and (b.agent_id in ('AGT-01', 'AGT-04') or h.para = agent_name or h.de = agent_name)
        order by h.criado_em desc
        limit 8
      ) x
    ), '[]'::jsonb),
    'rules', jsonb_build_array(
      'Ler a versao antes de alterar; conflito exige releitura e comparacao.',
      'Registrar acao, motivo, evidencia e proximo responsavel somente em marcos relevantes.',
      'Entrega aguarda revisao; handoff cria tarefa em DRAFT e nao inicia outro modelo.',
      'WIP global 1; ate 2 tentativas por job; sem loops, gastos ou mensagens externas automaticos.',
      'Use get_job para detalhes do job; este contexto e um indice compacto, nao substitui a leitura da tarefa.'
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.gateway_context(text) from public, anon, authenticated;
grant execute on function public.gateway_context(text) to service_role;
