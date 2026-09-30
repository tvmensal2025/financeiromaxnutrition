-- Supplemental append-only continuity record. Does not replace Checkpoint Mestre.
begin;
insert into public.memoria_mestre
 (id,data_hora,session_id,tipo,business_id_area,scope_type,agente_origem,assunto,registro,
  evidencia_origem,status,confianca,related_object_type,related_object_id,proxima_acao,responsavel,sensibilidade)
select 'MEM-FLUXO-20260930-REVISAO-V1',now()::text,'HD-CAMPANHA-20260930-01','CHECKPOINT',
 'BIZ-003','BUSINESS','Helena / Codex','Fluxo de revisao: implantacao, prova real e bloqueios restantes',
 jsonb_build_object(
  'estado','PARCIAL: ciclo comercial completo e 21 agentes NAO homologados',
  'gateway_commit','aff434a',
  'implantado','Gateway get_job manifest/page 4000 caracteres com revision e isolamento; runtime com consumidor de revisao/continuacao, lock compartilhado, recibos persistentes e nao repeticao; cron existente 90313a626ffe every 1h no_agent, sem duplicar',
  'teste_real','Marina executou e submeteu plano. Revisao inicial truncada; paginacao resolveu leitura. Segunda revisao atingiu 24 ferramentas; retomada supervisionada registrou REQUEST_CHANGES. Consumidor reconciliou e selecionou COORDINATE. Teste da coordenacao atingiu limite e manteve DRAFT, sem alterar briefing nem liberar. Nao repetir mesmo estado sem correcao da causa.',
  'correcao_mcp','revise_task_brief faltava nos filtros de Helena e Marina. Ambos corrigidos com backup; descoberta real da Helena READY. Provisionador e preflight exigem a ferramenta antes de gastar IA.',
  'recuperacao_final','Apos habilitar MCP, agente produziu proposta em seis ferramentas. Gateway recusou edicao usando indevidamente regra de liberacao. Corrigido aff434a e implantado 19:33:09 UTC: edicao de DRAFT validada separadamente, liberacao continua exigindo fontes aprovadas/capacidade. Proposta existente reaplicada sem outra IA. Confirmado DRAFT, task_version 3054, attempt_count 1, brief_matches true, um evento de revisao e released false. Recuperacao supervisionada; ciclo comercial ainda nao homologado.',
  'qualidade','Arte vazia teve aprovacao invalidada, arquivos/historico preservados e Nina designada. Nao apresentar como pronta. Fotografia/geracao realista e inspecao visual remota ainda nao homologadas.',
  'testes_locais','229 testes Node, 29 verificacoes adicionais, 59 Python passaram; cadeia completa automatizada apenas com servicos simulados',
  'runtime','/data/helena-runtime/hermes_workflow_tick.py; workflow-config.json; workflow-state.json; workflow-coordinate-validation.log; /data/scripts/helena_dispatch_poll.sh',
  'proximo','Briefing do MESMO job Marina corrigido; conferir dependencias e fontes corretas para liberar; resolver copy sem zerar duas tentativas; integrar geracao/inspecao real de imagens; provar entrega comercial final. Nao publicar, enviar mensagens ou duplicar campanha.',
  'checkpoint_mestre',(select checkpoint_id from public.checkpoint_mestre_atual),
  'aviso','CHECKPOINT REQUER SINCRONIZACAO: apontador mestre preservado; consultar estado atual antes de agir',
  'jobs',(select jsonb_agg(jsonb_build_object('job_id',job_id,'agent_id',agent_id,'status',status,
    'approval_status',approval_status,'attempt_count',attempt_count,'reviewer',result_payload->>'reviewer_agent_id',
    'reviewed_by',result_payload->>'reviewed_by','review_reason',result_payload->>'review_reason','updated_at',updated_at))
    from public.agent_jobs where job_id in ('JOB-HR-6e9e2c7f008a9993f7689e5e0defb53f','JOB-HR-7a09bb163135240c4b8c1ec90c5efbeb','JOB-HR-d4b5b488e4716e749cb7b1392e308424'))
 )::text,
 'GitHub main; docs/helena/continuidade-fluxo-20260930.md; deploy EasyPanel Success 2026-09-30T19:33:09Z; Supabase e Entregas conferidos',
 'ATIVA','VERIFICADO NO ESCOPO DESCRITO','CAMPANHA','HD-CAMPANHA-20260930-01',
 'Concluir coordenacao e capacidades visuais; nao declarar 100% nem repetir chamadas sem diagnostico.','AGT-01 Helena','INTERNO'
where not exists(select 1 from public.memoria_mestre where id='MEM-FLUXO-20260930-REVISAO-V1');
select id,status,assunto from public.memoria_mestre where id='MEM-FLUXO-20260930-REVISAO-V1';
commit;
