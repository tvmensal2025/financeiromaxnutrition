-- Stores only non-reversible hashes; profile secrets stay on the Hermes host.
create table public.agent_runtime_credentials (
  profile_slug text primary key references public.agent_runtime_bindings(profile_slug),
  token_sha256 text not null unique check (token_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default clock_timestamp(),
  revoked_at timestamptz
);
alter table public.agent_runtime_credentials enable row level security;
revoke all on public.agent_runtime_credentials from public,anon,authenticated;
grant select,insert,update,delete on public.agent_runtime_credentials to service_role;
comment on table public.agent_runtime_credentials is 'Individual Hermes credentials: hashes only, backend access only. A credential does not activate a binding.';
