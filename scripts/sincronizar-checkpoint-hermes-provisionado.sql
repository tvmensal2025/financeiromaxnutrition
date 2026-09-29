-- Executar somente apos conferir os 21 testes de autenticacao no Hermes.
begin;
select public.helena_write_record('tarefas','TSK-0031',2504,jsonb_build_object(
 'status','BLOQUEADA',
 'bloqueio','Provisionamento e autenticacao dos 21 perfis concluidos. Falta ativar o piloto e validar tarefa real, revisao e handoff pelo MCP. Acionador automatico, escrita nas tabelas de dominio e memoria pessoal permanecem pendentes.',
 'evidencia','2026-09-27: operador executou configurar_perfis.py --apply; backup /data/helena-runtime/backup-20260927T103719643399Z. 21 hashes individuais cadastrados em agent_runtime_credentials; 21 autenticacoes tools/list confirmadas no Gateway; bloqueio de perfil inativo confirmado por get_work_context. Relatorio: /data/helena-runtime/verificacao-publica.json. Nenhum token exibido. 21 CONFIGURED, 0 ACTIVE, 0 READY/CLAIMED/RUNNING. Gateway health v2 OK.'));

with previous as (
 select * from public.checkpoint_mestre_atual where checkpoint_id='CP-20260927-V018'
), refreshed as (
 select p.*,p.snapshot || jsonb_build_object(
  'gerado_em',to_jsonb(clock_timestamp()),
  'tarefas',(select jsonb_agg(to_jsonb(t) order by task_id) from (select task_id,tarefa,status,bloqueio,evidencia,prioridade,business_id,responsavel,atualizado_em,row_version from public.tarefas)t),
  'hermes_migracao',(p.snapshot->'hermes_migracao') || jsonb_build_object(
   'observado_em',to_char(clock_timestamp() at time zone 'America/Sao_Paulo','YYYY-MM-DD HH24:MI:SS'),
   'credenciais_individuais_provisionadas',21,'credenciais_hashes_registradas',21,
   'autenticacoes_perfil_testadas',21,'bloqueio_perfil_inativo_testado',true,
   'vinculos_runtime_configurados',21,'vinculos_runtime_ativos',0,'instalador_executado',true,
   'backup_provisionamento','/data/helena-runtime/backup-20260927T103719643399Z',
   'relatorio_autenticacao','/data/helena-runtime/verificacao-publica.json',
   'fluxo_agente_real_testado',false,
   'bloqueios',jsonb_build_array(
    'Ativar piloto e homologar uma tarefa real pelo MCP, com revisao e handoff',
    'Acionador real do Hermes ainda nao conectado: liberar READY nao inicia modelo',
    'Escrita especifica em CRM/financeiro/produto/demais dominios e memoria pessoal ainda precisa contrato e teste',
    'Revisar jobs historicos individualmente; nao liberar 23 legados em lote',
    'Definir teto mensal e agenda antes de rotinas automaticas')
  ),
  'fontes_de_retomada',(p.snapshot->'fontes_de_retomada') || jsonb_build_object('ultimo_preparo','21 perfis provisionados pelo operador e autenticados. Hashes registrados; perfis continuam CONFIGURED. Fonte: TSK-0031 e verificacao-publica.json. Falta piloto real; nao confundir autenticacao com execucao.')
 ) as next_snapshot from previous p
)
select (public.helena_publish_checkpoint(
 'CP-20260927-V018','Hermes: 21 perfis provisionados e autenticados; fila pausada',
 'Instalador executado pelo operador no Hermes; backup confirmado. 21 hashes individuais registrados no Supabase e 21 autenticacoes tools/list validadas. Recusa de get_work_context para perfil inativo confirmada. Nenhum perfil ativado e nenhum job iniciado. Backend workflow v2 permanece publicado. Falta piloto real com tarefa, revisao e handoff e acionador automatico.',
 '# Estado atual - Hermes provisionado' || E'\n\n' ||
 'Supabase ecosistemadossonhos wxkgrykduqtsgmjkzlou continua fonte canonica. Helena e CEO virtual; fundador decide. Helena GPT-6 Sol e outros 20 GPT-6 Luna. PAG-V10-011 rege tarefa, evidencias, memoria, revisao e handoff. Backend publicado f49c88b, workflow v2, testes anteriores preservados no snapshot.' || E'\n\n' ||
 'CONCLUIDO: operador executou /data/configurar_perfis.py --apply; backup privado em /data/helena-runtime/backup-20260927T103719643399Z. Manifesto publico conferido para 21 perfis unicos; somente SHA256 cadastrado em agent_runtime_credentials. Teste HTTPS tools/list no proprio host com as credenciais existentes confirmou 21 autenticacoes. Um erro de transcricao do hash de Felipe foi corrigido e retestado. Nenhum token exposto. Relatorio em /data/helena-runtime/verificacao-publica.json. get_work_context recusou perfil inativo como esperado.' || E'\n\n' ||
 'ESTADO: 21 CONFIGURED, zero ACTIVE; 23 WAITING_HELENA e cinco COMPLETED historicos; zero READY/CLAIMED/RUNNING. A autenticacao esta validada, a execucao por agentes nao. Nenhuma agenda, campanha ou mensagem externa criada. Perfil do Hermes nao e isolamento de sistema operacional.' || E'\n\n' ||
 'PROXIMOS PASSOS: ativar piloto autorizado e testar pelo MCP uma tarefa real com evidencia, revisao e handoff. Acionador automatico do Hermes ainda falta; READY nao inicia modelo. Implementar contratos especificos para escrita de dominio e memoria pessoal; revisar jobs historicos, teto financeiro e agenda antes de recorrencias. Os filtros MCP ainda devem incluir fail_job/waiting_helena antes do piloto para registrar falhas. Nao declarar integracao completa nem reiniciar legado em lote.' || E'\n\n' ||
 'Este checkpoint substitui o estado atual V018 sem apagar o historico. Para retomar, ler checkpoint_mestre_atual, TSK-0031, PAG-V10-011 e contagens vivas. Nao solicitar novamente provisionamento ja concluido.',
 r.next_snapshot,
 jsonb_build_array('Instalador executado e backup confirmado','21 hashes cadastrados sem tokens','21 autenticacoes confirmadas e perfil inativo bloqueado','Fila e agentes continuam pausados; piloto ainda pendente'),
 coalesce(r.fontes,'[]'::jsonb)||jsonb_build_array('/data/helena-runtime/manifest-publico.json','/data/helena-runtime/verificacao-publica.json','agent_runtime_credentials','TSK-0031'),
 'Helena / Codex','Registrar provisionamento e autenticacao reais sem confundir com inicio de operacao'
)).checkpoint_id as checkpoint_publicado from refreshed r;
commit;
