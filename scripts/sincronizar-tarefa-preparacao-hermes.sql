-- Executar uma vez: o registro da tarefa fica bloqueado ate a homologacao.
with atual as (
  select task_id, row_version, evidencia
  from public.tarefas
  where task_id = 'TSK-0031'
  for update
)
select public.helena_write_record(
  'tarefas', atual.task_id, atual.row_version,
  jsonb_build_object(
    'bloqueio',
    '21 vinculos Hermes configurados, 0 ativos. Falta autorizar/testar leitura Supabase, construir adaptador de escrita autenticado e isolado por empresa, atualizar/implantar Gateway, homologar um job real e definir teto de custo. Os 23 jobs legados continuam retidos; nao iniciar tarefas de negocio.',
    'evidencia',
    coalesce(atual.evidencia, '') || E'\n' ||
    to_char(now() at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI:SS') ||
    ': curadoria semanal pausada e relida nos 21 perfis Helena e no default; Hermes Cron: 0 jobs em todos os perfis; canais do default: 0 configurados. Supabase: agent_runtime_bindings 21 CONFIGURED/0 ACTIVE; trigger bloqueia CLAIMED/RUNNING sem perfil ativo, tarefa e empresa iguais. Testes negativos e positivos com rollback, estado final sem READY/CLAIMED/RUNNING. Catalogo helena_campos reconciliado: 1555/1555 campos, 0 ausentes/obsoletos. MCP Supabase da Helena ainda sem OAuth; sem execucao real homologada.'
  )
) from atual;
