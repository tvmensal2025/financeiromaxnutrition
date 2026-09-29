-- Mapeia cada identidade Hermes sem reescrever as conexoes historicas do Grok.
-- A migracao apenas configura perfis; nenhum deles fica habilitado para executar.
create table if not exists public.agent_runtime_bindings (
  agent_id text not null references public.agentes(agent_id),
  scope_key text not null,
  scope_type text not null check (scope_type in ('GROUP', 'PERSONAL', 'BUSINESS')),
  business_id text references public.portfolio(business_id),
  provider text not null default 'HERMES' check (provider = 'HERMES'),
  profile_slug text not null unique,
  model_id text not null,
  status text not null default 'CONFIGURED' check (status in ('CONFIGURED', 'ACTIVE', 'PAUSED')),
  activation_reference text,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (agent_id, scope_key),
  constraint agent_runtime_bindings_scope_check check (
    (scope_type = 'BUSINESS' and business_id is not null and scope_key = business_id)
    or (scope_type = 'GROUP' and business_id is null and scope_key = 'GROUP')
    or (scope_type = 'PERSONAL' and business_id is null and scope_key = 'PERSONAL')
  ),
  constraint agent_runtime_bindings_activation_check check (
    status <> 'ACTIVE' or (activated_at is not null and nullif(btrim(activation_reference), '') is not null)
  )
);

alter table public.agent_runtime_bindings enable row level security;
revoke all on public.agent_runtime_bindings from public, anon, authenticated;
grant select on public.agent_runtime_bindings to authenticated;
grant all on public.agent_runtime_bindings to service_role;

create policy agent_runtime_bindings_read_authorized
  on public.agent_runtime_bindings for select to authenticated
  using (
    public.is_founder()
    or (scope_type = 'BUSINESS' and public.user_has_business_access(business_id))
  );

insert into public.agent_runtime_bindings
  (agent_id, scope_key, scope_type, business_id, profile_slug, model_id)
values
  ('AGT-01','GROUP','GROUP',null,'helena--grupo','gpt-6-sol'),
  ('AGT-02','PERSONAL','PERSONAL',null,'laura--pessoal','gpt-6-luna'),
  ('AGT-03','BIZ-003','BUSINESS','BIZ-003','augusto--biz003','gpt-6-luna'),
  ('AGT-04','BIZ-003','BUSINESS','BIZ-003','marina--biz003','gpt-6-luna'),
  ('AGT-05','BIZ-003','BUSINESS','BIZ-003','caio--biz003','gpt-6-luna'),
  ('AGT-06','BIZ-003','BUSINESS','BIZ-003','clara--biz003','gpt-6-luna'),
  ('AGT-07','BIZ-003','BUSINESS','BIZ-003','bianca--biz003','gpt-6-luna'),
  ('AGT-08','BIZ-003','BUSINESS','BIZ-003','daniel--biz003','gpt-6-luna'),
  ('AGT-09','BIZ-003','BUSINESS','BIZ-003','theo--biz003','gpt-6-luna'),
  ('AGT-10','BIZ-003','BUSINESS','BIZ-003','nina--biz003','gpt-6-luna'),
  ('AGT-11','BIZ-003','BUSINESS','BIZ-003','ravi--biz003','gpt-6-luna'),
  ('AGT-12','BIZ-003','BUSINESS','BIZ-003','maya--biz003','gpt-6-luna'),
  ('AGT-13','BIZ-003','BUSINESS','BIZ-003','bruno--biz003','gpt-6-luna'),
  ('AGT-14','BIZ-003','BUSINESS','BIZ-003','olivia--biz003','gpt-6-luna'),
  ('AGT-15','BIZ-003','BUSINESS','BIZ-003','victor--biz003','gpt-6-luna'),
  ('AGT-16','BIZ-003','BUSINESS','BIZ-003','camila--biz003','gpt-6-luna'),
  ('AGT-17','BIZ-003','BUSINESS','BIZ-003','isabela--biz003','gpt-6-luna'),
  ('AGT-18','BIZ-003','BUSINESS','BIZ-003','pedro--biz003','gpt-6-luna'),
  ('AGT-19','BIZ-003','BUSINESS','BIZ-003','renata--biz003','gpt-6-luna'),
  ('AGT-20','BIZ-003','BUSINESS','BIZ-003','joana--biz003','gpt-6-luna'),
  ('AGT-21','BIZ-003','BUSINESS','BIZ-003','felipe--biz003','gpt-6-luna');

-- A protecao vale tambem para escritas diretas pela chave de servico: nenhum
-- caller pode marcar um job CLAIMED/RUNNING sem perfil ativo, tarefa e empresa.
create or replace function public.agent_job_hermes_execution_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status not in ('CLAIMED', 'RUNNING') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    raise exception 'execution_requires_ready_job';
  end if;
  if (new.status = 'CLAIMED' and old.status <> 'READY')
     or (new.status = 'RUNNING' and old.status <> 'CLAIMED') then
    raise exception 'invalid_execution_transition:%->%', old.status, new.status;
  end if;
  if new.task_id is null or new.business_id is null then
    raise exception 'execution_requires_task_and_business';
  end if;

  perform 1
  from public.agent_runtime_bindings b
  join public.tarefas t on t.task_id = new.task_id
  where b.agent_id = new.agent_id
    and b.status = 'ACTIVE'
    and b.provider = 'HERMES'
    and (
      (b.scope_type = 'BUSINESS' and b.business_id = new.business_id)
      or (new.agent_id = 'AGT-01' and b.scope_type = 'GROUP')
    )
    and t.business_id = new.business_id
  for share of b;
  if not found then
    raise exception 'hermes_runtime_not_active_or_task_business_mismatch';
  end if;

  return new;
end;
$$;

revoke all on function public.agent_job_hermes_execution_guard() from public, anon, authenticated;
drop trigger if exists agent_job_hermes_execution_guard on public.agent_jobs;
create trigger agent_job_hermes_execution_guard
before insert or update of status, task_id, agent_id, business_id
on public.agent_jobs
for each row execute function public.agent_job_hermes_execution_guard();
