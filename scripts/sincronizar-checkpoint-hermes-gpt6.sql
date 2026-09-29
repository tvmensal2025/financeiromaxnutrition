-- Publicar uma nova fotografia apenas se V013 ainda for o checkpoint ativo.
-- Nao altera o historico; consulta as fontes atuais na mesma transacao.
with previous as (
  select * from public.checkpoint_mestre_atual
  where checkpoint_id = 'CP-20260927-V013'
), refreshed as (
  select p.*,
    p.snapshot || jsonb_build_object(
      'gerado_em', to_jsonb(now()),
      'agent_jobs', (select coalesce(jsonb_agg(to_jsonb(x) order by x.updated_at desc), '[]'::jsonb) from (
        select job_id,status,task_id,agent_id,updated_at,business_id,max_attempts,attempt_count,approval_status
        from public.agent_jobs
      ) x),
      'agent_job_events', (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb) from (
        select job_id,status,agent_id,event_id,created_at,event_type,business_id
        from public.agent_job_events
      ) x),
      'conexoes_agentes', (select coalesce(jsonb_agg(to_jsonb(x) order by x.agent_id), '[]'::jsonb) from (
        select agent_id,provider,updated_at,last_seen_at,last_tested_at,connection_status
        from public.agent_connections
      ) x),
      'tarefas', (select coalesce(jsonb_agg(to_jsonb(x) order by x.task_id), '[]'::jsonb) from (
        select prazo,status,tarefa,task_id,bloqueio,prioridade,project_id,business_id,responsavel,atualizado_em,definicao_de_pronto
        from public.tarefas
      ) x),
      'integracoes', (select coalesce(jsonb_agg(to_jsonb(x) order by x.integration_id), '[]'::jsonb) from (
        select dono,objeto,status,direcao,sistema,frequencia,business_id,observacoes,ultima_sync,atualizado_em,source_system,integration_id
        from public.integracoes
      ) x),
      'protocolo_agentes', (select coalesce(jsonb_agg(to_jsonb(x) order by x.protocolo_id), '[]'::jsonb) from (
        select regra,secao,status,versao,aplicacao,responsavel,protocolo_id,atualizado_em
        from public.protocolo_agentes
      ) x),
      'memorias_recentes', (select coalesce(jsonb_agg(to_jsonb(x) order by x.atualizado_em desc), '[]'::jsonb) from (
        select id,tipo,status,assunto,proxima_acao,agente_origem,atualizado_em,business_id_area,related_object_id
        from public.memoria_mestre order by atualizado_em desc limit 30
      ) x),
      'contagens', (p.snapshot->'contagens') || jsonb_build_object(
        'agent_jobs',(select count(*) from public.agent_jobs),
        'agent_job_events',(select count(*) from public.agent_job_events),
        'agent_connections',(select count(*) from public.agent_connections),
        'tarefas',(select count(*) from public.tarefas),
        'integracoes',(select count(*) from public.integracoes),
        'protocolo_agentes',(select count(*) from public.protocolo_agentes),
        'memoria_mestre',(select count(*) from public.memoria_mestre)
      ),
      'hermes_migracao', (p.snapshot->'hermes_migracao') || jsonb_build_object(
        'status','CONFIGURACAO_GPT6_PARCIAL_NAO_HOMOLOGADA',
        'observado_em',to_char(now() at time zone 'America/Sao_Paulo','YYYY-MM-DD HH24:MI:SS'),
        'memoria','MEM-HERMES-GPT6-20260927',
        'regra','PAG-V10-010',
        'modelo_helena','openai-codex/gpt-6-sol',
        'modelos_especialistas','openai-codex/gpt-6-luna',
        'perfis_sol',1,
        'perfis_luna',20,
        'testes_de_resposta',2,
        'grok_conexoes_inativas',20,
        'jobs_em_espera',23,
        'jobs_ready',0,
        'jobs_sem_task_id',27,
        'jobs_sem_business_id',20,
        'mcp_helena',1,
        'mcp_helena_autenticados',0,
        'mcp_helena_conectados',0,
        'conexoes_hermes',0,
        'cron_helena',0,
        'bloqueios',jsonb_build_array(
          'MCP read-only cadastrado mas OAuth nao autorizado',
          'Sem adaptador de escrita com identidade e isolamento empresarial',
          '23 jobs legados retidos; vinculos incompletos em 27/28 jobs',
          'Sem piloto real Hermes e sem teto de custo aprovado'
        )
      ),
      'lacunas_operacionais',(p.snapshot->'lacunas_operacionais') || jsonb_build_object(
        'revisao_automatica_helena','HERMES_SEM_CRON_MCP_NAO_AUTENTICADO',
        'gateway_remoto','ALTERACAO_LOCAL_NAO_HOMOLOGADA_EM_PRODUCAO',
        'jobs_sem_task_id',27
      ),
      'fontes_de_retomada',(p.snapshot->'fontes_de_retomada') || jsonb_build_object(
        'runtime_hermes','MEM-HERMES-GPT6-20260927; PAG-V10-010; TSK-0031; Hermes Hostinger perfis por agente',
        'proximo_passo','Autorizar MCP somente leitura; construir adaptador restrito; pilotar um job; comprovar aceite e custos'
      )
    ) as snapshot_atualizado
  from previous p
)
select (public.helena_publish_checkpoint(
  'CP-20260927-V013',
  'Helena no Hermes: GPT-6, Grok suspenso e Supabase pendente',
  'Decisao vigente: Helena em GPT-6 Sol e 20 especialistas em GPT-6 Luna no Hermes; dois testes curtos de resposta passaram. Grok desativado (20 conexoes) e 23 jobs legados em espera com historico preservado. A migracao da RPC bloqueia claim/start de conexao inativa. O MCP Supabase de leitura foi cadastrado mas nao autenticado; adaptador de escrita, isolamento por empresa e execucao real ainda nao foram homologados. Sem cron ou despacho automatico.',
  '# Estado vigente — 27/09/2026 (V014)' || E'\n\n' ||
  'Helena e AGT-01, CEO virtual supervisora; o fundador decide. Supabase ecosistemadossonhos (wxkgrykduqtsgmjkzlou) e fonte oficial. Hermes Agent v0.21.4 na Hostinger e o runtime em implantacao.' || E'\n\n' ||
  '## Decisao de modelo e prova' || E'\n' ||
  '- Helena: perfil helena--grupo, openai-codex/gpt-6-sol. Outros 20 perfis: openai-codex/gpt-6-luna. Configuracoes relidas nos 21 perfis; testes curtos OK em Helena e Marina. Modelo respondendo nao significa acesso ao banco ou trabalho executado.' || E'\n' ||
  '- Grok nao e usado. Vinte conexoes historicas GROK estao NOT_CONNECTED; 23 jobs historicos estao WAITING_HELENA com eventos de retencao. Cinco jobs COMPLETED sao historia. Migração pause_disabled_agent_runtime bloqueia claim/start para Grok e conexoes inativas; teste reversivel passou.' || E'\n' ||
  '- 28 jobs totais: 27 sem task_id, 20 sem business_id. A fila retida inclui tres trabalhos WhatsApp BIZ-001 e um piloto Pedro BIZ-003; revalidar separadamente antes de liberar. Nao despachar em massa.' || E'\n\n' ||
  '## Pendencias reais' || E'\n' ||
  '- MCP Supabase oficial read_only=true foi cadastrado para Helena, mas OAuth nao foi autorizado: zero ferramentas conectadas no chat, nenhuma leitura Supabase pelo Hermes comprovada.' || E'\n' ||
  '- Nao existe conexao Hermes em agent_connections nem adaptador de escrita com identidade e isolamento por empresa. Gateway remoto ainda nao recebeu a alteracao local verificada. Nenhum job foi executado pelo Hermes de ponta a ponta.' || E'\n' ||
  '- Nao ha cron Hermes, despacho automatico nem orcamento fechado. TSK-0031 permanece BLOQUEADA.' || E'\n\n' ||
  '## Como retomar' || E'\n' ||
  'Ler checkpoint_mestre_atual, PAG-V10-009, PAG-V10-010, MEM-HERMES-GPT6-20260927 e TSK-0031; depois consultar fontes operacionais atuais. Autorizar MCP de leitura com escopo do projeto, validar leitura, construir adaptador minimo de escrita, vincular tarefa/empresa e testar um unico job com evidencia. Manter CAS para alteracoes e nao declarar concluido antes de conferir no Supabase e na pagina.' || E'\n\n---\nContexto do checkpoint anterior (historico; estado vigente acima prevalece):\n\n' || r.conteudo_markdown,
  r.snapshot_atualizado,
  jsonb_build_array(
    'Fundador escolheu GPT-6 Sol para Helena e GPT-6 Luna para 20 especialistas; modelos salvos e testados',
    'Grok desativado: 20 conexoes NOT_CONNECTED, 23 jobs WAITING_HELENA com eventos',
    'RPC claim/start bloqueia conexoes inativas; teste com rollback passou',
    'MCP Supabase read-only cadastrado, ainda sem OAuth e sem acesso operacional',
    'INT-0005, TSK-0031, PAG-V10-010 e MEM-HERMES-GPT6-20260927 atualizados'
  ),
  r.fontes || jsonb_build_array(
    'public.memoria_mestre:MEM-HERMES-GPT6-20260927',
    'public.protocolo_agentes:PAG-V10-010',
    'public.integracoes:INT-0005',
    'public.tarefas:TSK-0031',
    'supabase/migrations/20260927113000_pause_disabled_agent_runtime.sql',
    'Hermes Hostinger: 21 perfis Models/Config, testes Chat Helena e Marina em 27/09/2026'
  ),
  'Helena / Codex',
  'Sincronizar decisao GPT-6 e desativacao Grok sem liberar execucao nao homologada'
)).checkpoint_id as checkpoint_publicado
from refreshed r;
