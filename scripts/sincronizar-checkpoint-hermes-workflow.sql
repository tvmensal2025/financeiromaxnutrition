-- Estado observado apos deploy f49c88b; nao ativa perfis nem inicia tarefas.
begin;
select public.helena_write_record('tarefas','TSK-0031',2453,jsonb_build_object(
 'status','BLOQUEADA',
 'bloqueio','Backend publicado e fluxo validado no Supabase. Aguardando execucao pelo fundador do instalador de credenciais no Hermes, registro dos hashes e homologacao de uma tarefa real. Acionador automatico e contratos de escrita das demais tabelas permanecem pendentes.',
 'evidencia','2026-09-27: Gateway f49c88b publicado; health workflow_version=hermes-workflow-v2; MCP anonimo 401. Suite: 96 Node + 11 HTTP + 22 integracoes; 2 testes de provisionamento. Teste SQL integral com rollback passou. 72 objetos/1559 campos, 0 ausentes/obsoletos. /data/configurar_perfis.py enviado ao Hermes, nao executado. 21 CONFIGURED/0 ACTIVE; 0 credenciais; 0 jobs em execucao.'));

with previous as (
 select * from public.checkpoint_mestre_atual where checkpoint_id='CP-20260927-V017'
), refreshed as (
 select p.*,p.snapshot || jsonb_build_object(
  'gerado_em',to_jsonb(clock_timestamp()),
  'tarefas',(select jsonb_agg(to_jsonb(t) order by task_id) from (select task_id,tarefa,status,bloqueio,evidencia,prioridade,business_id,responsavel,atualizado_em,row_version from public.tarefas)t),
  'hermes_migracao',(p.snapshot->'hermes_migracao') || jsonb_build_object(
   'observado_em',to_char(clock_timestamp() at time zone 'America/Sao_Paulo','YYYY-MM-DD HH24:MI:SS'),
   'gateway_commit','f49c88b','gateway_workflow_version','hermes-workflow-v2','gateway_health_ok',true,
   'gateway_testes_release',jsonb_build_object('node',96,'http',11,'integracoes',22,'python_provisionamento',2,'falhas',0),
   'teste_sql_fluxo_com_rollback','PASSOU','protocolo_vigente','PAG-V10-011',
   'cobertura',jsonb_build_object('objetos',72,'campos',1559,'ausentes',0,'obsoletos',0),
   'credenciais_individuais_provisionadas',0,'vinculos_runtime_configurados',21,'vinculos_runtime_ativos',0,
   'ferramentas_gateway',18,'instalador_preparado','/data/configurar_perfis.py','instalador_executado',false,
   'bloqueios',jsonb_build_array('Fundador iniciar instalador de credenciais no Hermes; politica de navegador exige handoff de autenticacao',
    'Registrar manifesto de hashes e homologar acesso por perfil e uma tarefa real',
    'Acionador real do Hermes ainda nao conectado: liberar READY nao inicia modelo',
    'Escrita especifica em CRM/financeiro/produto/demais dominios e memoria pessoal ainda precisa contrato e teste',
    'Revisar jobs historicos individualmente; nao liberar 23 legados em lote',
    'Definir teto mensal e agenda antes de rotinas automaticas')
  ),
  'fontes_de_retomada',(p.snapshot->'fontes_de_retomada') || jsonb_build_object('ultimo_preparo','Workflow v2 publicado e testado. Fonte: PAG-V10-011, TSK-0031, services/helena-gateway/HERMES-WORKFLOW.md. Conexao de escrita e piloto Hermes ainda pendentes.')
 ) as next_snapshot from previous p
)
select (public.helena_publish_checkpoint(
 'CP-20260927-V017','Hermes: workflow persistente publicado; falta ativar conexao individual',
 'Backend de tarefas, evidencias, memoria, revisao e handoff implementado no Supabase e publicado no Gateway f49c88b. 131 testes locais e fluxo SQL com rollback passaram. 72 objetos e 1559 campos mapeados, sem ausentes. Instalador para 21 perfis preparado no Hermes, aguardando o fundador iniciar credenciais. 21 CONFIGURED, 0 ACTIVE, 0 credenciais e nenhuma tarefa de negocio iniciada. Integracao completa ainda nao homologada.',
 '# Estado atual — Hermes workflow v2' || E'\n\n' ||
 'Helena e a CEO virtual; o fundador decide. Supabase ecosistemadossonhos wxkgrykduqtsgmjkzlou e fonte canonica. Hermes Hostinger v0.21.4: Helena GPT-6 Sol; demais 20 GPT-6 Luna. Leitura oficial do Supabase ja conectada a Helena. Este estado substitui o resumo V017, preservando seu historico.' || E'\n\n' ||
 'IMPLEMENTADO E PUBLICADO: create_task_job cria tarefa+job DRAFT+handoff atomicamente; release_job exige coordenacao, executor ativo e WIP 1; claim/start confirma inicio e sincroniza cartao; record_progress/record_memory gravam marcos/fontes; submit_delivery exige evidencia e versao e encaminha ao revisor; review_delivery impede autoaprovacao e sincroniza conclusao; handoff_task cria proxima tarefa somente apos aprovacao. Tudo fica no Supabase, com horario do servidor, chave de repeticao e protecao de versao. Ate 2 tentativas/job e 10 etapas/cadeia. Regras PAG-V10-011.' || E'\n\n' ||
 'VALIDADO: Gateway remoto health workflow_version=hermes-workflow-v2, anonimo 401; 96 testes Node, 11 HTTP, 22 integracoes e 2 Python. SQL testou criacao, reenvio, conflito, escopo, claim, progresso, memoria, revisao, handoff e limites; rollback deixou 0 residuos. 72 objetos/1559 campos, 0 ausentes/obsoletos. Credenciais tem tabela com somente hashes e acesso somente backend; nenhum token cadastrado.' || E'\n\n' ||
 'PENDENTE: fundador iniciar /data/configurar_perfis.py --apply no host Hermes (nao presumir mesmo host do servico EasyPanel homonimo); registrar manifesto-publico.json; testar autenticacao e uma tarefa real antes de ativar rotina. Script faz backup, preserva modelos/OAuth, nao imprime segredos e nao inicia jobs. Credencial nao ativa binding. Acionador real do Hermes ainda nao conectado. Escrita geral nas tabelas de dominio e memoria pessoal de Laura ainda nao homologadas. Nao afirmar integracao completa.' || E'\n\n' ||
 'FILA: 21 perfis CONFIGURED/0 ACTIVE; 23 jobs WAITING_HELENA e 5 COMPLETED historicos; 0 READY/CLAIMED/RUNNING. 27 jobs sem task_id e 20 sem business_id precisam reconciliacao individual. Nao reativar em lote. Sem nova agenda, campanha ou mensagens externas. Limites operacionais nao substituem teto financeiro. TSK-0031 continua BLOQUEADA com evidencia atual. Branch de deploy codex/hermes-runtime-preparation precisa integrar ao main antes de trocar a origem.' || E'\n\n' ||
 'Retomada economica: consultar checkpoint_mestre_atual, PAG-V10-011, TSK-0031 e contagens vivas; ler somente registros pertinentes. Arquivos e conversa nao comprovam execucao.',
 r.next_snapshot,
 jsonb_build_array('Workflow e revisao persistentes publicados','Registro de credenciais com hashes e acesso backend','131 testes locais e rollback SQL passaram','Cobertura 72 objetos/1559 campos','Instalador preparado no Hermes; aguarda acao do fundador'),
 coalesce(r.fontes,'[]'::jsonb)||jsonb_build_array('GitHub f49c88b','PAG-V10-011','services/helena-gateway/HERMES-WORKFLOW.md','services/helena-gateway/test/workflow-rollback.sql','/data/configurar_perfis.py'),
 'Helena / Codex','Registrar implementacao real, verificacoes e bloqueios sem declarar agentes iniciados'
)).checkpoint_id as checkpoint_publicado from refreshed r;
commit;
