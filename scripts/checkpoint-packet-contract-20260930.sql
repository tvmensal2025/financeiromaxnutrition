-- Append-only; preserves the master checkpoint pointer and ongoing execution.
begin;
insert into public.memoria_mestre
 (id,data_hora,tipo,business_id_area,scope_type,agente_origem,assunto,registro,evidencia_origem,status,confianca,related_object_type,related_object_id,proxima_acao,responsavel,sensibilidade)
select 'MEM-PACKET-CONTRACT-20260930-V1',now()::text,'CHECKPOINT','BIZ-003','BUSINESS','Helena / Codex',
 'Contrato real de contexto corrigido; sucessora visual retomada sem duplicacao',
 jsonb_build_object('commit','92e4067','cause','Prompt exigia context_version do cadastro no pacote authorized-work-packet-v1. Maya falhou antes de gerar imagens.',
 'fix','Contrato separado e coerente; pacote explicita truncated=false; runtime mantem validacao de identidade e contexto completo. Query-file real validado no Hermes com dados reais e Popen substituido somente no teste: PASS, sem inferencia.',
 'tests','81 testes locais: 80 aprovados, 1 fcntl/Linux pulado. Instalacao remota com backup e hashes em packet-contract-install.json.',
 'recovery','Mesmo JOB-HR-c392de57a9b00edb8879f291b077714d recuperado por comparacao estrita do erro/estado/versao, OPERATOR_CONTEXT_RECOVERY gravado e tentativas preservadas. Liberado pela ferramenta da Helena. Sem novo job, sem ampliar permissoes.',
 'launch','2026-10-01T01:05:37.720489Z PID17183; visual-packet-fixed-20260930-worker.py. Uma retomada, sem retry automatico; Nina revisa somente se houver entrega.',
 'observed','Maya passou pelo bloqueio de contexto, confirmou runtime READY, iniciou producao. Receipt post-v1 VERIFIED e story-1-v1 STARTED observados no Hermes. Isso nao comprova qualidade nem pacote completo.',
 'live_job',(select jsonb_build_object('status',status,'attempt_count',attempt_count,'max_attempts',max_attempts,'updated_at',updated_at,'review',result_payload) from public.agent_jobs where job_id='JOB-HR-c392de57a9b00edb8879f291b077714d'),
 'next','Consultar job e recibo final antes de agir; nao relancar worker. Conferir 4 PNGs reais e revisao independente. Operacao dos 21 agentes nao homologada por este teste.')::text,
 'GitHub main 92e4067; packet-contract-install.json; OPERATOR_CONTEXT_RECOVERY; visual-packet-fixed-20260930-launch.json',
 'ATIVA','VERIFICADO NO ESCOPO DESCRITO','agent_jobs','JOB-HR-c392de57a9b00edb8879f291b077714d',
 'Conferir producao e revisao sem repetir chamada paga.','AGT-01 Helena','INTERNO'
where not exists(select 1 from public.memoria_mestre where id='MEM-PACKET-CONTRACT-20260930-V1');
select id,status,assunto from public.memoria_mestre where id='MEM-PACKET-CONTRACT-20260930-V1';
commit;
