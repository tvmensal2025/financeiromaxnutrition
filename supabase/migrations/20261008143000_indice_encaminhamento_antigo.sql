-- Encaminhamentos parados na regra antiga (antes de 08/10 10h) deixam de ocupar a unicidade por estado,
-- para a nova tentativa unica com a regra nova poder ser gravada. Todos os demais continuam unicos.
alter table public.agent_workflow_runs drop constraint if exists agent_workflow_runs_job_id_phase_task_version_job_updated_a_key;
drop index if exists public.agent_workflow_runs_job_id_phase_task_version_job_updated_a_key;
create unique index agent_workflow_runs_job_phase_state_key on public.agent_workflow_runs (job_id, phase, task_version, job_updated_at)
  where not (phase = 'HANDOFF' and status = 'NEEDS_ATTENTION' and started_at < timestamptz '2026-10-08 10:00:00+00');
