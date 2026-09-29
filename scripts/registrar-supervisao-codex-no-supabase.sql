-- Registra a agenda existente do Codex como dependencia externa da Helena.
-- CONFIGURADA significa agenda local ativa; nao afirma rodada automatica homologada.
begin;

insert into public.integracoes (
  integration_id, sistema, objeto, direcao, source_sheet, chave_interna,
  chave_externa, frequencia, dono, status, observacoes, business_id, source_system
) values (
  'INT-0011', 'Codex Automations', 'Supervisao diaria em lote da Helena',
  'Supabase → Codex → Supabase', 'task_activity; decisoes; agent_job_events',
  'automation_id', 'helena-checkpoint-di-rio-de-supervis-o',
  'DIARIA 18:00 America/Sao_Paulo', 'AGT-01 Helena', 'CONFIGURADA',
  'Agenda heartbeat local ativa e vinculada a esta tarefa do Codex. Primeira rodada automatica nao homologada; ultima_sync vazia. Nao e portavel automaticamente para outra conversa ou host.',
  'GRUPO', 'CODEX_LOCAL'
) on conflict (integration_id) do nothing;

insert into public.automacoes (
  automation_id, nome, gatilho, condicao, acao, source_sheet, target_sheet,
  frequencia, responsavel, status, external_automation_id, observacoes,
  business_id, integration_id
) values (
  'AUTO-0006', 'Checkpoint diario de supervisao em lote da Helena',
  'Agenda Codex local, 18:00 America/Sao_Paulo',
  'Mudanca material: 5 ou mais atividades, decisao estrategica, bloqueio, falha, risco critico ou acao do fundador',
  'Ler apenas o necessario; gravar no maximo um parecer idempotente em auditoria e avisar nesta tarefa do Codex',
  'task_activity; decisoes; agent_job_events', 'auditoria',
  'DIARIA 18:00 America/Sao_Paulo', 'AGT-01 Helena', 'CONFIGURADA',
  'helena-checkpoint-di-rio-de-supervis-o',
  'Uma janela por dia; sem Grok, OpenAI API ou WhatsApp. AUD-HCP-20260926-BASE foi revisao assistida, nao rodada agendada. Exige rodada automatica, registro e mensagem comprovados para HOMOLOGADA.',
  'GRUPO', 'INT-0011'
) on conflict (automation_id) do nothing;

insert into public.auditoria (
  audit_id, data_hora, session_id, agente_usuario, acao, sheet, object_id,
  campo, valor_novo, motivo, fonte_evidencia, sensibilidade
) values (
  'AUD-HELENA-CONTINUIDADE-20260926', now()::text,
  'HELENA-CONTINUIDADE-20260926', 'Codex / Helena', 'RECONCILIACAO',
  'integracoes; automacoes', 'AUTO-0006', 'dependencia_externa',
  jsonb_build_object(
    'integracao','INT-0011', 'automacao','AUTO-0006',
    'external_automation_id','helena-checkpoint-di-rio-de-supervis-o',
    'estado','CONFIGURADA_NAO_HOMOLOGADA',
    'primeiro_parecer','AUD-HCP-20260926-BASE_ASSISTIDO'
  )::text,
  'Registrar no Supabase a agenda local existente para retomada em nova conversa.',
  'docs/helena/checkpoint-supervisao-lote.md; Codex automation local',
  'INTERNO'
) on conflict (audit_id) do nothing;

commit;
