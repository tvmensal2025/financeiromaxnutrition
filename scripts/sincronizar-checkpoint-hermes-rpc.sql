-- Publicacao curta: nao duplica o markdown historico V015 no contexto da IA.
-- O snapshot anterior e preservado; detalhes antigos continuam consultaveis pelo ID.
with previous as (
  select * from public.checkpoint_mestre_atual
  where checkpoint_id = 'CP-20260927-V015'
), refreshed as (
  select p.*,
    p.snapshot || jsonb_build_object(
      'gerado_em',to_jsonb(now()),
      'tarefas',(
        select coalesce(jsonb_agg(to_jsonb(t) order by t.task_id),'[]'::jsonb)
        from (
          select task_id,tarefa,status,bloqueio,evidencia,prioridade,project_id,business_id,responsavel,atualizado_em,row_version
          from public.tarefas
        ) t
      ),
      'hermes_migracao',(p.snapshot->'hermes_migracao') || jsonb_build_object(
        'observado_em',to_char(now() at time zone 'America/Sao_Paulo','YYYY-MM-DD HH24:MI:SS'),
        'rpc_claim_start_exige_binding_ativo',true,
        'rpc_claim_start_testado_com_rollback',true,
        'gateway_local_consulta_binding_por_empresa',true,
        'gateway_local_teste_despacho',7,
        'gateway_remoto_atualizado',false
      ),
      'comando_carregamento_checkpoint',(p.snapshot->'comando_carregamento_checkpoint') || jsonb_build_object(
        'passos',jsonb_build_array(
          'Ler ID, versao, resumo_executivo e conteudo_markdown do checkpoint ativo',
          'Ler apenas chaves do snapshot necessarias para a pergunta, evitando arrays completos por padrao',
          'Conferir itens volateis diretamente nas tabelas do Supabase',
          'Consultar V015 e anteriores sob demanda para historico',
          'Aplicar precedencia canonica e sinalizar divergencia material'
        )
      ),
      'fontes_de_retomada',(p.snapshot->'fontes_de_retomada') || jsonb_build_object(
        'ultimo_preparo','RPCs claim/start com binding Hermes ACTIVE; teste com rollback. Gateway local ajustado, ainda sem deploy remoto. TSK-0031 BLOQUEADA.'
      )
    ) as snapshot_atualizado
  from previous p
)
select (public.helena_publish_checkpoint(
  'CP-20260927-V015',
  'Helena Hermes preparada, fila travada e RPCs por empresa',
  'Preparacao sem tarefas de negocio: 21 perfis GPT-6, 21 vinculos Hermes CONFIGURED/0 ACTIVE, 23 jobs historicos WAITING_HELENA e fila executavel zero. Curadoria semanal pausada nos 22 perfis, Cron geral zero. Catalogo 1555/1555 campos. Trigger e RPCs claim/start exigem binding ativo, tarefa e empresa; testes reversiveis passaram. Gateway local atualizado e testado, sem deploy remoto. MCP Supabase Helena sem OAuth e sem adaptador autenticado de escrita; TSK-0031 BLOQUEADA.',
  '# Estado vigente — 27/09/2026 (V016)' || E'\n\n' ||
  'Helena e AGT-01, CEO virtual. O fundador decide; Supabase ecosistemadossonhos (wxkgrykduqtsgmjkzlou) e a fonte oficial. Hermes Hostinger v0.21.4 esta configurado, sem trabalho de negocio homologado.' || E'\n\n' ||
  '- Modelos: Helena openai-codex/gpt-6-sol; 20 especialistas openai-codex/gpt-6-luna. Dois testes curtos responderam, sem acesso ao banco.' || E'\n' ||
  '- 21 bindings Hermes: 19 BIZ-003, Helena GROUP, Laura PERSONAL; todos CONFIGURED, zero ACTIVE. Curadoria pausada em 22 perfis; Cron geral 0; canais default 0.' || E'\n' ||
  '- Supabase: 71 objetos e 1555 campos mapeados sem ausentes/obsoletos. Trigger e RPCs claim/start recusam job sem binding ACTIVE, tarefa e empresa iguais; teste com rollback confirmou negativo e positivo, deixando 0 READY/CLAIMED/RUNNING.' || E'\n' ||
  '- Grok: 20 conexoes antigas NOT_CONNECTED; 23 jobs legados WAITING_HELENA com eventos. Nao reativar em lote. TSK-0031 permanece BLOQUEADA.' || E'\n' ||
  '- Gateway local ja filtra binding por empresa e confere destino; testes isolados passaram. Codigo remoto EasyPanel ainda nao atualizado. O MCP Supabase read-only da Helena esta cadastrado, mas nao autenticado; teste diz que nao ha token OAuth em cache.' || E'\n\n' ||
  'Antes de iniciar tarefas: autorizar/testar leitura Supabase, construir adaptador com identidade individual e escrita limitada por empresa, implantar Gateway, testar um unico job de ponta a ponta e definir teto de custo antes da rotina automatica. Nao dar service_role nem token administrativo aos perfis.' || E'\n\n' ||
  'Para historia completa, consultar CP-20260927-V015 e anteriores. Leia apenas as chaves relevantes do snapshot para poupar contexto; confira dados volateis nas tabelas.' ,
  r.snapshot_atualizado,
  jsonb_build_array(
    'RPCs claim/start agora exigem binding Hermes ativo, tarefa e empresa correspondentes',
    'Teste negativo/positivo com rollback confirmou comportamento e estado final pausado',
    'Gateway local filtra por binding; testes de despacho passaram; remoto pendente',
    'TSK-0031 atualizada e segue BLOQUEADA'
  ),
  coalesce(r.fontes,'[]'::jsonb) || jsonb_build_array(
    'supabase/migrations/20260927113200_claim_start_require_hermes_binding.sql',
    'services/helena-gateway/src/server.mjs',
    'services/helena-gateway/test/record-dispatch.test.mjs'
  ),
  'Helena / Codex',
  'Registrar RPCs por binding e reduzir contexto do checkpoint sem liberar execucao'
)).checkpoint_id as checkpoint_publicado
from refreshed r;
