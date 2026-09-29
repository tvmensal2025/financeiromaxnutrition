-- Publica V015 somente se V014 ainda for o checkpoint ativo.
with previous as (
  select * from public.checkpoint_mestre_atual
  where checkpoint_id = 'CP-20260927-V014'
), refreshed as (
  select p.*,
    p.snapshot || jsonb_build_object(
      'gerado_em', to_jsonb(now()),
      'agent_runtime_bindings', (
        select coalesce(jsonb_agg(to_jsonb(b) order by b.agent_id,b.scope_key),'[]'::jsonb)
        from (
          select agent_id,scope_key,scope_type,business_id,provider,profile_slug,model_id,status,activated_at
          from public.agent_runtime_bindings
        ) b
      ),
      'tarefas', (
        select coalesce(jsonb_agg(to_jsonb(t) order by t.task_id),'[]'::jsonb)
        from (
          select task_id,tarefa,status,bloqueio,evidencia,prioridade,project_id,business_id,responsavel,atualizado_em,row_version
          from public.tarefas
        ) t
      ),
      'contagens', (p.snapshot->'contagens') || jsonb_build_object(
        'agent_runtime_bindings',(select count(*) from public.agent_runtime_bindings),
        'helena_campos',(select count(*) from public.helena_campos),
        'tarefas',(select count(*) from public.tarefas)
      ),
      'mapeamento_supabase',(p.snapshot->'mapeamento_supabase') || jsonb_build_object(
        'fontes',71,'campos',1555,'campos_mapeados',1555,
        'campos_ausentes',0,'campos_obsoletos',0
      ),
      'hermes_migracao',(p.snapshot->'hermes_migracao') || jsonb_build_object(
        'status','PREPARACAO_SEM_EXECUCAO_HOMOLOGADA',
        'observado_em',to_char(now() at time zone 'America/Sao_Paulo','YYYY-MM-DD HH24:MI:SS'),
        'perfis_curadoria_pausada',22,
        'cron_todos_perfis',0,
        'canais_default_configurados',0,
        'vinculos_runtime_configurados',21,
        'vinculos_runtime_ativos',0,
        'guarda_execucao_trigger',true,
        'teste_guarda_com_rollback',true,
        'objetos_supabase',71,
        'campos_supabase',1555,
        'campos_helena_mapeados',1555,
        'bloqueios',jsonb_build_array(
          'MCP Supabase somente leitura cadastrado mas OAuth nao autorizado',
          'Adaptador de escrita autenticado por agente e isolado por empresa ainda nao existe',
          'Gateway alterado apenas localmente; deploy remoto nao comprovado',
          '23 jobs legados retidos e 27/28 sem task_id: revalidar antes de liberar',
          'Sem piloto real Hermes ou teto de custo aprovado'
        )
      ),
      'lacunas_operacionais',(p.snapshot->'lacunas_operacionais') || jsonb_build_object(
        'gateway_remoto','ALTERACAO_LOCAL_NAO_HOMOLOGADA_EM_PRODUCAO',
        'identidade_hermes','BINDINGS_CONFIGURADOS_INATIVOS_SEM_ADAPTADOR',
        'autenticacao_mcp','PENDENTE'
      ),
      'fontes_de_retomada',(p.snapshot->'fontes_de_retomada') || jsonb_build_object(
        'runtime_hermes','public.agent_runtime_bindings; TSK-0031; PAG-V10-010; MEM-HERMES-GPT6-20260927; relatorio local docs/helena/hermes/instalacao-2026-09-27.json',
        'proximo_passo','Autorizacao de leitura Supabase; adaptador minimo autenticado e isolado; deploy controlado; piloto unico com evidencia; orcamento antes de recorrencia'
      )
    ) as snapshot_atualizado
  from previous p
)
select (public.helena_publish_checkpoint(
  'CP-20260927-V014',
  'Hermes preparado e travado ate homologacao',
  '21 perfis Hermes em GPT-6 (Helena Sol, 20 Luna), 21 vinculos no Supabase em CONFIGURED e zero ACTIVE. Curadoria semanal pausada em 22 perfis incluindo default; Cron geral 0 e canais default 0. Guarda no banco bloqueia CLAIMED/RUNNING sem perfil ativo, tarefa e empresa; testes com rollback passaram. Catalogo 1555/1555 campos. Grok segue inativo e 23 jobs retidos. MCP Supabase sem OAuth, adaptador e deploy remoto pendentes; nenhuma tarefa de negocio iniciada.',
  '# Estado vigente — 27/09/2026 (V015)' || E'\n\n' ||
  'Supabase ecosistemadossonhos (wxkgrykduqtsgmjkzlou) e fonte oficial. Helena AGT-01 supervisiona e o fundador decide. Hermes Hostinger v0.21.4 esta em preparacao, sem execucao empresarial homologada.' || E'\n\n' ||
  '## Preparacao confirmada' || E'\n' ||
  '- Helena helena--grupo: openai-codex/gpt-6-sol; 20 especialistas: openai-codex/gpt-6-luna. Dois testes curtos de resposta OK; nenhum deles provou acesso ao Supabase.' || E'\n' ||
  '- agent_runtime_bindings: 21 CONFIGURED, 0 ACTIVE. Escopo BIZ-003 para 19 especialistas, GROUP para Helena, PERSONAL para Laura. Nao concede chave ou acesso de escrita aos perfis.' || E'\n' ||
  '- Curadoria semanal pausada nos 21 perfis Helena e no default. Cron do Hermes mostra 0 jobs em todos os perfis; default tem 0 canais configurados. Gateways dos 21 novos perfis continuam Off.' || E'\n' ||
  '- Trigger no Supabase bloqueia entrada em CLAIMED/RUNNING sem perfil ativo, tarefa existente e business_id igual ao da tarefa e do perfil. Testes reversiveis: inativo recusado, ativo temporario aceito, sem mudanca persistente. Fila final: 0 READY/CLAIMED/RUNNING.' || E'\n' ||
  '- Catalogo helena_campos reconciliado com 71 objetos do esquema publico e 1555 campos: zero faltando e zero obsoleto. Mapa local confere os mesmos nomes e colunas.' || E'\n' ||
  '- Vinte conexoes historicas Grok NOT_CONNECTED e 23 jobs historicos WAITING_HELENA. Preservar historico; nao liberar em lote. TSK-0031 permanece BLOQUEADA.' || E'\n\n' ||
  '## Falta antes de iniciar trabalho' || E'\n' ||
  '1. Autorizar e testar MCP Supabase de leitura no perfil Helena com escopo do projeto; hoje zero ferramentas conectadas.' || E'\n' ||
  '2. Construir e implantar adaptador com identidade propria de cada perfil, permissoes por empresa e escrita limitada. Nunca entregar service_role ou token administrativo do Gateway aos agentes.' || E'\n' ||
  '3. Implantar mudancas locais do Gateway e testar um unico job com tarefa, empresa, aceite, marcos e evidencias no Supabase e na pagina. So depois ativar um vinculo por vez.' || E'\n' ||
  '4. Definir teto de custo e agenda de supervisao antes de qualquer automacao recorrente. Nenhum cron de negocio foi criado.' || E'\n\n' ||
  'Ler public.checkpoint_mestre_atual, PAG-V10-010, TSK-0031 e fontes operacionais atuais. Nao confundir perfil configurado com bot executando. Registrar falhas e conferir no banco e na tela antes de declarar conclusao.' ||
  E'\n\n---\nContexto do checkpoint anterior (historico; estado vigente acima prevalece):\n\n' || r.conteudo_markdown,
  r.snapshot_atualizado,
  jsonb_build_array(
    'Curadoria semanal pausada em 22 perfis e Cron geral confirmado vazio',
    '21 vinculos Hermes no Supabase em CONFIGURED, nenhum ACTIVE',
    'Trigger de execucao por perfil, tarefa e empresa aplicado e testado com rollback',
    'Catalogo e mapa reconciliados com 1555 campos em 71 objetos',
    'TSK-0031 atualizada, permanece BLOQUEADA; nenhuma tarefa de negocio iniciada'
  ),
  coalesce(r.fontes,'[]'::jsonb) || jsonb_build_array(
    'public.agent_runtime_bindings',
    'public.tarefas:TSK-0031',
    'supabase/migrations/20260927113100_hermes_runtime_bindings_and_execution_guard.sql',
    'Hermes System/Cron/Channels, 27/09/2026'
  ),
  'Helena / Codex',
  'Registrar preparacao controlada antes de qualquer tarefa empresarial'
)).checkpoint_id as checkpoint_publicado
from refreshed r;
