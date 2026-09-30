-- Supplemental, append-only continuity. Current production state outranks this snapshot.
begin;
insert into public.memoria_mestre
 (id,data_hora,session_id,tipo,business_id_area,scope_type,agente_origem,assunto,registro,
 evidencia_origem,status,confianca,related_object_type,related_object_id,proxima_acao,responsavel,sensibilidade)
select 'MEM-AUTH-20260930-V1',now()::text,'HD-CAMPANHA-20260930-01','CHECKPOINT','BIZ-003','BUSINESS',
 'Helena / Codex','Autorizacao dos 21 perfis, contexto integral e retomada controlada',
 jsonb_build_object(
  'estado','PARCIAL: ciclo comercial e execucao real dos 21 agentes NAO homologados. Arte fotografica e inspecao visual real ainda pendentes.',
  'gateway','e3f0c3a, GitHub main e EasyPanel Success 2026-09-30T20:53:13Z; e3fdbb5 anterior publicado 20:41:27Z',
  'runtime','6a94cd2 instalado em /data/helena-runtime com backup authorization-backup-20260930T203137153823Z; 21 perfis conferidos e 18 filtros reduzidos; sem alterar credenciais, modelos ou agenda; preflight nativo Marina/Nina READY',
  'teste_autorizacao','21 identidades/contextos; 20 rotas empresariais/grupo de execucao e revisao, autoaprovacao negada, especialistas sem criar/liberar fila, isolamento de empresa, idempotencia. Fixtures revertidas por rollback, sem IA. Laura pessoal e Helena com revisao humana da propria entrega.',
  'correcao_contexto','Pacote completo e autorizado antes da inferencia, sem historico duplicado; manifest para conferir frescor, releitura somente se mudou. Nunca truncar. get_job inclui approved_output com a entrega integral de fontes explicitamente citadas, mesma empresa, concluidas e revisadas.',
  'correcao_transicao','Primeira edicao mudava a tarefa para NAO INICIADA, impedindo segunda edicao. Migration 20260930210000_helena_continue_reviewed_brief aplicada: continuar somente com recibo exato da mesma versao/briefing, parecer REQUEST_CHANGES e coordenador autorizado. Sem liberar, iniciar ou zerar tentativas. Teste rollback aprovou continuacao/idempotencia e rejeitou perfil indevido, versao antiga e alteracao sem recibo.',
  'fontes','Estrategia MEM-HR-1aece577f4fcabb065c9a75429cc1bb9 / JOB-HR-a3ac89587826124257ccace27fe5cef8; copy correta MEM-HR-2b125554d7cbe28e611f6278eb8d97b5 / JOB-HR-7aa2ab1e4f80b68bccaac535dda850e7. Aprovacao legada nao aprova a campanha atual. Textos completos confirmados com 6607 e 8956 caracteres.',
  'testes','252 Node + 29 verificacoes adicionais + 67 Python passaram. Duas validacoes SQL transacionais com rollback. Testes tecnicos sem modelos ou mensagens reais.',
  'retomada','Mesma tarefa Marina, briefing corrigido versao 3296 e liberado versao 3297. Um despacho controlado autorizado. Jev classificou com baixa confianca e preservou modelo do perfil, sem escalar arbitrariamente. Resultado persistido dos jobs abaixo deve prevalecer.',
  'resultado_real','Marina GPT-6 Luna encerrou em FAILED/HERMES_NO_DELIVERY, tentativa 2/2. Sessao 20260930_204417_55e6e0: 10 ferramentas, 31910 tokens entrada, 4665 saida; sem conversao monetaria confirmada. Progresso e memoria registrados, mas dois submit_delivery recusados por acceptance_checks[].evidence_ref fora de evidence_refs: IDs de tarefas/IDs combinados e ancoras delivery: inventadas. Nao houve nova revisao ou handoff. Entrega antiga no payload nao comprova sucesso desta retomada.',
  'correcao_submissao','Codigo e3f0c3a. Descricao de evidence_ref publicada no esquema MCP: copiar literalmente referencia da entrega, normalmente memory_id de record_memory; trecho/fato pertence a finding. Erro especifico com lista permitida e valores invalidos, separado de criterio duplicado. Nao relaxa aprovacao nem inicia IA. Regressao passou; execucao real posterior ainda NAO validada.',
  'jobs',(select jsonb_agg(jsonb_build_object('job_id',job_id,'agent_id',agent_id,'status',status,'approval_status',approval_status,
    'attempt_count',attempt_count,'max_attempts',max_attempts,'reviewed_by',result_payload->>'reviewed_by',
    'review_pending',result_payload->'review_pending','review_reason',result_payload->>'review_reason',
    'delivery_title',result_payload->'delivery'->>'title','result_summary',left(result_summary,2400),'updated_at',updated_at))
    from public.agent_jobs where job_id in ('JOB-HR-6e9e2c7f008a9993f7689e5e0defb53f','JOB-HR-7a09bb163135240c4b8c1ec90c5efbeb','JOB-HR-d4b5b488e4716e749cb7b1392e308424')),
  'checkpoint_mestre',(select checkpoint_id from public.checkpoint_mestre_atual),
  'aviso','CHECKPOINT REQUER SINCRONIZACAO. Este suplemento nao troca o apontador mestre. Nao repetir tentativa consumida, duplicar campanha, aprovar arte por metadados ou publicar sem autorizacao.'
 )::text,
 'GitHub main e3f0c3a; docs/helena/continuidade-fluxo-20260930.md; authorization-install-receipt.json; campaign-context-repair-20260930.json; Supabase atual',
 'ATIVA','VERIFICADO NO ESCOPO DESCRITO','CAMPANHA','HD-CAMPANHA-20260930-01',
 'Ler resultados atuais e recibos. Concluir geracao/inspecao visual e ciclo comercial; nao repetir pagamentos sem corrigir causa.','AGT-01 Helena','INTERNO'
where not exists(select 1 from public.memoria_mestre where id='MEM-AUTH-20260930-V1');
select id,status,assunto from public.memoria_mestre where id='MEM-AUTH-20260930-V1';
commit;
