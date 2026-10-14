-- Ajuste do indice autorizado pelo Fundador (08/10): o encaminhamento antigo, ao ser reconciliado,
-- sai de NEEDS_ATTENTION e voltava a colidir com a nova tentativa. A exclusao passa a valer para
-- todo encaminhamento iniciado antes de 08/10 10h, qualquer que seja o status.
drop index if exists public.agent_workflow_runs_job_phase_state_key;
create unique index agent_workflow_runs_job_phase_state_key on public.agent_workflow_runs (job_id, phase, task_version, job_updated_at)
  where not (phase = 'HANDOFF' and started_at < timestamptz '2026-10-08 10:00:00+00');
