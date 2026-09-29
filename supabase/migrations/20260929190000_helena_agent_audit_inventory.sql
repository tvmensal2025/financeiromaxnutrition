-- Auditoria idempotente do runtime Hermes: Skills, capacidades e testes por perfil.
-- Não armazena tokens, chaves, prompts completos ou conteúdo de clientes.
create table if not exists public.helena_agent_audit_runs (
  audit_run_id text primary key,
  observed_at timestamptz not null default clock_timestamp(),
  source text not null,
  scope text not null,
  total_profiles integer not null check (total_profiles >= 0),
  total_skills integer not null check (total_skills >= 0),
  total_tests integer not null check (total_tests >= 0),
  passed_tests integer not null check (passed_tests >= 0),
  failed_tests integer not null check (failed_tests >= 0),
  summary jsonb not null default '{}'::jsonb,
  created_by text not null default 'AGT-01 Helena'
);

create table if not exists public.helena_agent_profile_audit (
  audit_run_id text not null references public.helena_agent_audit_runs(audit_run_id) on delete cascade,
  agent_id text not null,
  profile_slug text not null,
  model text,
  skills_enabled integer not null default 0 check (skills_enabled >= 0),
  skills_disabled integer not null default 0 check (skills_disabled >= 0),
  skills_absent integer not null default 0 check (skills_absent >= 0),
  mcp_status text not null check (mcp_status in ('READY','FAILED','NOT_APPLICABLE','NOT_CONFIRMED')),
  mcp_tool_count integer not null default 0 check (mcp_tool_count >= 0),
  memory_status text not null check (memory_status in ('PRESENT','ABSENT','NOT_CONFIRMED')),
  automation_status text not null check (automation_status in ('DIRECTORY_PRESENT','NO_ACTIVE_JOBS_CONFIRMED','NOT_CONFIRMED')),
  handoff_status text not null check (handoff_status in ('CONFIGURED','NOT_CONFIGURED','NOT_CONFIRMED')),
  permission_status text not null check (permission_status in ('GUARDED','NOT_CONFIRMED')),
  evidence jsonb not null default '{}'::jsonb,
  primary key (audit_run_id, profile_slug),
  unique (audit_run_id, agent_id)
);

create table if not exists public.helena_agent_skill_inventory (
  audit_run_id text not null references public.helena_agent_audit_runs(audit_run_id) on delete cascade,
  agent_id text not null,
  profile_slug text not null,
  skill_name text not null,
  state text not null check (state in ('ENABLED','DISABLED','ABSENT')),
  source text not null,
  trust text,
  category text,
  evidence jsonb not null default '{}'::jsonb,
  primary key (audit_run_id, profile_slug, skill_name)
);

create table if not exists public.helena_agent_test_runs (
  audit_run_id text not null references public.helena_agent_audit_runs(audit_run_id) on delete cascade,
  agent_id text not null,
  profile_slug text not null,
  test_name text not null,
  status text not null check (status in ('PASS','FAIL','NOT_RUN')),
  return_code integer,
  response_marker text,
  tool_calls integer not null default 0 check (tool_calls >= 0),
  external_side_effects boolean not null default false,
  evidence jsonb not null default '{}'::jsonb,
  primary key (audit_run_id, profile_slug, test_name)
);

create index if not exists idx_helena_agent_skill_inventory_profile
  on public.helena_agent_skill_inventory(profile_slug, state);
create index if not exists idx_helena_agent_test_runs_status
  on public.helena_agent_test_runs(audit_run_id, status);

alter table public.helena_agent_audit_runs enable row level security;
alter table public.helena_agent_profile_audit enable row level security;
alter table public.helena_agent_skill_inventory enable row level security;
alter table public.helena_agent_test_runs enable row level security;

revoke all on table public.helena_agent_audit_runs from public, anon, authenticated;
revoke all on table public.helena_agent_profile_audit from public, anon, authenticated;
revoke all on table public.helena_agent_skill_inventory from public, anon, authenticated;
revoke all on table public.helena_agent_test_runs from public, anon, authenticated;
grant select, insert, update, delete on table public.helena_agent_audit_runs to service_role;
grant select, insert, update, delete on table public.helena_agent_profile_audit to service_role;
grant select, insert, update, delete on table public.helena_agent_skill_inventory to service_role;
grant select, insert, update, delete on table public.helena_agent_test_runs to service_role;

comment on table public.helena_agent_skill_inventory is
  'Snapshot credential-free das Skills efetivamente listadas pelo Hermes por perfil; não representa instalação de Skills ausentes.';
comment on table public.helena_agent_profile_audit is
  'Snapshot por perfil de MCP, memória, automação, handoff e guardrails observados no host Hermes.';
comment on table public.helena_agent_test_runs is
  'Resultado de testes one-shot sem ferramentas e sem efeitos externos por perfil Hermes.';
