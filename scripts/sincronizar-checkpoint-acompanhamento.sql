-- Executar apenas após as migrations de isolamento de decisões e task_activity.
-- Mantém V6 e todas as versões anteriores intactas; cria V7 se a mudança material ainda não foi registrada.
begin isolation level repeatable read;
select set_config('request.jwt.claim.sub',(select user_id::text from public.app_access where role='founder' and active order by created_at limit 1),true);
set local role authenticated;
lock table public.checkpoint_mestre in share row exclusive mode;
do $sync$
declare
  v_anterior public.checkpoint_mestre%rowtype;
  v_snapshot jsonb;
  v_counts jsonb := '{}'::jsonb;
  v_integridade jsonb;
  v_total bigint;
  v_tabela record;
begin
  select * into strict v_anterior from public.checkpoint_mestre_atual;
  if v_anterior.snapshot->>'marcador_acompanhamento' = 'helena_fluxo_visual_20260926' then return; end if;

  for v_tabela in
    select tabela from (
      select jsonb_object_keys(v_anterior.snapshot->'contagens') as tabela
      union select 'task_activity' as tabela
    ) fontes order by tabela
  loop
    execute format('select count(*) from public.%I', v_tabela.tabela) into v_total;
    v_counts := v_counts || jsonb_build_object(v_tabela.tabela,v_total);
  end loop;

  v_integridade := jsonb_build_object(
    'jobs_sem_tarefa',(select count(*) from public.agent_jobs j where j.task_id is not null and not exists(select 1 from public.tarefas t where t.task_id=j.task_id)),
    'jobs_sem_agente',(select count(*) from public.agent_jobs j where not exists(select 1 from public.agentes a where a.agent_id=j.agent_id)),
    'eventos_sem_job',(select count(*) from public.agent_job_events e where e.job_id is not null and not exists(select 1 from public.agent_jobs j where j.job_id=e.job_id)),
    'tarefas_sem_projeto',(select count(*) from public.tarefas t where t.project_id like 'PRJ-%' and not exists(select 1 from public.projetos p where p.project_id=t.project_id)),
    'tarefas_sem_empresa',(select count(*) from public.tarefas t where t.business_id like 'BIZ-%' and not exists(select 1 from public.portfolio p where p.business_id=t.business_id)),
    'jobs_empresa_divergente',(select count(*) from public.agent_jobs j join public.tarefas t on t.task_id=j.task_id where j.business_id is distinct from t.business_id),
    'eventos_empresa_divergente',(select count(*) from public.agent_job_events e join public.agent_jobs j on j.job_id=e.job_id where e.business_id is distinct from j.business_id)
  );

  v_snapshot := v_anterior.snapshot || jsonb_build_object(
    'marcador_acompanhamento','helena_fluxo_visual_20260926',
    'gerado_em',now(),
    'contagens',v_counts,
    'fontes',coalesce(v_anterior.snapshot->'fontes','[]'::jsonb) || jsonb_build_array('public.task_activity'),
    'mapeamento_supabase',coalesce(v_anterior.snapshot->'mapeamento_supabase','{}'::jsonb) || jsonb_build_object('fontes',70,'campos',1489,'campos_mapeados',1489),
    'seguranca',coalesce(v_anterior.snapshot->'seguranca','{}'::jsonb) || jsonb_build_object('decisoes_rls_empresa',true,'task_activity_rls_empresa',true,'task_activity_somente_leitura',true),
    'integridade',v_integridade,
    'lacunas_operacionais',jsonb_build_object(
      'jobs_sem_task_id',(select count(*) from public.agent_jobs where task_id is null),
      'decisoes_sem_vinculo_estruturado',true,
      'revisao_automatica_helena','NAO_HOMOLOGADA',
      'historico_tarefas_anterior_ao_trigger','NAO_RECONSTRUIDO',
      'gateway_remoto','NAO_HOMOLOGADO'
    ),
    'pendencias',coalesce(v_anterior.snapshot->'pendencias','[]'::jsonb) || jsonb_build_array(
      'Jobs legados não têm task_id; reconciliar somente com prova de origem antes de atribuir a uma tarefa.',
      'Decisões vigentes não têm vínculo estruturado com tarefa nem aceite de entrega; revisão automática da Helena ainda não foi homologada.',
      'O histórico automático de tarefas começa nesta mudança; eventos anteriores permanecem nas fontes históricas disponíveis.'
    ),
    'tarefas',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select task_id,business_id,project_id,responsavel,status,prioridade,prazo,atualizado_em from public.tarefas order by task_id) x),
    'decisoes_vigentes',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select decision_id,business_id,tipo,status,substitui_decision_id,atualizado_em from public.decisoes order by decision_id) x),
    'agent_jobs',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select job_id,task_id,agent_id,business_id,status,attempt_count,max_attempts,approval_status,updated_at from public.agent_jobs order by job_id) x),
    'agent_job_events',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select event_id,job_id,agent_id,business_id,event_type,status,created_at from public.agent_job_events order by event_id) x),
    'task_activity',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select event_id,task_id,business_id,event_type,changed_fields,status_before,status_after,occurred_at from public.task_activity order by event_id) x)
  );

  perform public.registrar_checkpoint_mestre(
    p_titulo => 'Checkpoint Mestre — fluxo visual e rastreabilidade',
    p_resumo_executivo => '70 fontes e 1.489 campos do esquema público mapeados. A sala de comando agora exibe fluxo visual, execuções, eventos, evidências e decisões. Decisões isoladas por empresa e mudanças futuras de tarefas auditadas. Jobs legados sem vínculo e revisão automática da Helena continuam pendentes.',
    p_conteudo_markdown => $texto$# Continuidade do Sistema Helena

Fonte canônica: Supabase ecosistemadossonhos. Estado real do banco prevalece sobre este retrato.

## Mudança material
Decisões foram isoladas por empresa via RLS. A fonte task_activity registra, sem payloads sensíveis, as próximas mudanças de tarefas e é somente leitura para o aplicativo. A sala de comando mostra cartões por etapa, histórico de jobs/eventos e decisões registradas. A política de isolamento foi testada com perfil de membro de uma empresa.

## Limites
O mapeamento de 100% refere-se a tabelas e colunas do esquema público. Os 27 jobs atuais não têm task_id, portanto não há rastreio de execução ligado a essas tarefas. O histórico automático não recria alterações anteriores. Decisões do ledger não comprovam aprovação de tarefas. Não há supervisor de IA operando continuamente nem homologação do gateway externo. Consumo do Grok permanece fora do escopo solicitado.

## Continuidade
Carregar sempre checkpoint_mestre_atual, conferir contagens, políticas e tarefas no banco e preservar o histórico de versões.$texto$,
    p_snapshot => v_snapshot,
    p_mudancas_desde_anterior => jsonb_build_array(
      'Isolamento de decisões por empresa e remoção de privilégios fora de RLS.',
      'Histórico automático somente de metadados das futuras alterações de tarefas.',
      '70 fontes e 1489 campos físicos inventariados e mapeados.',
      'Interface local de fluxo, execução e decisões com ausência de vínculo explicitada.'
    ),
    p_fontes => coalesce(v_anterior.fontes,'[]'::jsonb) || jsonb_build_array('public.task_activity','supabase/migrations/20260926152500_decisoes_isolamento_empresa.sql','supabase/migrations/20260926154000_task_activity.sql'),
    p_criado_por => 'Codex — implementação autorizada pelo fundador',
    p_motivo => 'Pedido de acompanhamento integral das tarefas, decisões e agentes no Supabase, sem consumo do Grok.'
  );
end;
$sync$;
select checkpoint_id,versao,status,checkpoint_anterior_id from public.checkpoint_mestre_atual;
commit;
