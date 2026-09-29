-- Publicacao unica, com predecessora explicita para impedir sobrescrita concorrente.
with previous as (
 select * from public.checkpoint_mestre_atual where checkpoint_id='CP-20260927-V016'
), refreshed as (
 select p.*,
 p.snapshot || jsonb_build_object(
  'gerado_em',to_jsonb(now()),
  'tarefas',(select coalesce(jsonb_agg(to_jsonb(t) order by t.task_id),'[]'::jsonb) from (
   select task_id,tarefa,status,bloqueio,evidencia,prioridade,project_id,business_id,responsavel,atualizado_em,row_version from public.tarefas
  ) t),
  'hermes_migracao',(p.snapshot->'hermes_migracao') || jsonb_build_object(
   'observado_em',to_char(now() at time zone 'America/Sao_Paulo','YYYY-MM-DD HH24:MI:SS'),
   'mcp_helena_autenticados',1,'mcp_helena_conectados',1,
   'mcp_helena_somente_leitura',true,'mcp_leitura_real_confirmada',true,
   'mcp_teste_checkpoint','CP-20260927-V016',
   'oauth_retorno_loopback_contornado',true,
   'gateway_remoto_atualizado',true,
   'gateway_commit','83b7ea852c6a598f6df313edbadd31b0096d544b',
   'gateway_branch','codex/hermes-runtime-preparation',
   'gateway_base_main','4aff8c3',
   'gateway_runtime_access','hermes-scoped-v1',
   'gateway_health_ok',true,
   'gateway_anonimo_rejeitado_401',true,
   'gateway_testes_release',jsonb_build_object('node',88,'http',11,'integracoes',22,'falhas',0),
   'credenciais_individuais_provisionadas',0,
   'vinculos_runtime_configurados',21,'vinculos_runtime_ativos',0,
   'bloqueios',jsonb_build_array(
    'Provisionar credenciais individuais Hermes por canal protegido, sem token administrativo nos perfis',
    'Homologar uma unica tarefa com escrita e evidencia antes de ativar rotina',
    '23 jobs legados retidos e 27/28 sem task_id: revisar individualmente',
    'Definir teto de custo antes de recorrencias',
    'OAuth novo pode exigir correcao da URL de retorno publica; login atual e leitura estao funcionais'
   )
  ),
  'fontes_de_retomada',(p.snapshot->'fontes_de_retomada') || jsonb_build_object(
   'ultimo_preparo','Leitura Supabase pela Helena no Hermes confirmada. Gateway 83b7ea8 publicado/testado em health, fila segue pausada; faltam credenciais individuais e piloto.'
  )
 ) as snapshot_atualizado from previous p
)
select (public.helena_publish_checkpoint(
 'CP-20260927-V016',
 'Helena le Supabase e Gateway Hermes publicado; execucao pausada',
 'Helena no Hermes autenticada ao Supabase oficial somente leitura; consulta real confirmou V016, 21 agentes, 51 tarefas e 28 jobs. Gateway por agente/empresa publicado no EasyPanel, commit 83b7ea8, health remoto saudavel e acesso anonimo rejeitado. Release validada: 88 Node + 11 HTTP + 22 integracoes. 21 perfis CONFIGURED/0 ACTIVE; nenhuma tarefa de negocio iniciada. TSK-0031 BLOQUEADA por credenciais individuais/piloto/custo.',
 '# Estado vigente — 27/09/2026 (V017)' || E'\n\n' ||
 'Helena e AGT-01, CEO virtual; fundador decide. Supabase ecosistemadossonhos (wxkgrykduqtsgmjkzlou) e fonte oficial. Hermes Hostinger v0.21.4: Helena GPT-6 Sol; outros 20 GPT-6 Luna.' || E'\n\n' ||
 '- Leitura operacional confirmada: OAuth oficial, perfil helena--grupo, MCP supabase-helena-leitura, restrito a este projeto e somente leitura. Consulta real retornou V016, 21 agentes, 51 tarefas, 23 jobs WAITING_HELENA e 5 COMPLETED historicos. O retorno do OAuth apontava loopback e foi encaminhado a origem Hostinger; novo login pode exigir corrigir a URL publica.' || E'\n' ||
 '- Gateway publicado no EasyPanel: branch codex/hermes-runtime-preparation, commit 83b7ea8, base main 4aff8c3 preservando atualizacoes de voz. Build concluiu 09:50:35 UTC. Health remoto ok/supabase/oauth=true, runtime_access=hermes-scoped-v1; MCP anonimo HTTP 401. Suite de release: 88 + 11 + 22 testes, todos passaram.' || E'\n' ||
 '- Credenciais por perfil e escopo implementadas, mas nenhuma provisionada. 21 bindings CONFIGURED, zero ACTIVE. Especialista so opera seus jobs na empresa; Marina despacha na empresa; Helena supervisiona grupo. Laura PERSONAL nao opera fila empresarial. Enqueue/handoff automaticos continuam negados aos perfis. Leitura MCP nao concede escrita empresarial geral.' || E'\n' ||
 '- Fila preservada: 0 READY/CLAIMED/RUNNING; 23 jobs legados retidos. Nao reativar em lote: 27/28 jobs historicos sem task_id e 20 sem business_id. Guardas no banco e RPCs exigem perfil ativo/tarefa/empresa; testes com rollback passaram.' || E'\n' ||
 '- Cobertura estrutural: 71 objetos, 1555 campos mapeados. Isso nao comprova que todas as integracoes ou formulas estejam homologadas. Curadoria de 22 perfis pausada; Cron geral 0.' || E'\n\n' ||
 'Antes de iniciar trabalho: provisionar acesso individual protegido, homologar uma tarefa controlada com evidencias e definir teto de custo antes da recorrencia. TSK-0031 permanece BLOQUEADA. Nao entregar service_role nem token administrativo aos agentes. A origem do Gateway ficou na branch de preparacao; integrar essa branch ao main antes de retornar a origem para main.' || E'\n\n' ||
 'Carregamento economico: leia este resumo; consulte somente chaves necessarias do snapshot e confira dados volateis nas tabelas. V016/V015 guardam etapas anteriores.',
 r.snapshot_atualizado,
 jsonb_build_array('Leitura real da Helena no Hermes confirmada pelo MCP','Gateway publicado com identidade por perfil e empresa','121 testes da release passaram; health remoto saudavel','Fila e vinculos continuam sem ativacao'),
 coalesce(r.fontes,'[]'::jsonb) || jsonb_build_array('Hermes Chat: Consultar checkpoint e contagens por status','GitHub commit 83b7ea852c6a598f6df313edbadd31b0096d544b','EasyPanel: helena-automation/helena-gateway','docs/helena/hermes/instalacao-2026-09-27.json'),
 'Helena / Codex','Sincronizar leitura autorizada e deploy real sem liberar tarefas'
)).checkpoint_id as checkpoint_publicado from refreshed r;
