-- Global agent/integration metadata may be read by authorized app users, but
-- only the founder may change it. Structural privileges bypass row policies.
-- Existing public tables are owned by postgres in the canonical Helena project.

do $revoke$
declare
  item record;
begin
  for item in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format(
      'revoke truncate, references, trigger on table public.%I from anon, authenticated',
      item.tablename
    );
  end loop;
end;
$revoke$;

alter default privileges for role postgres in schema public
  revoke truncate, references, trigger on tables from anon, authenticated;

drop policy if exists agentes_authenticated_access on public.agentes;
drop policy if exists agent_connections_authenticated_access on public.agent_connections;
drop policy if exists integracoes_authenticated_access on public.integracoes;

create policy agentes_authenticated_select
  on public.agentes for select to authenticated
  using (
    public.is_founder() or exists (
      select 1 from public.app_access a
      where a.user_id = auth.uid() and a.active = true
    )
  );
create policy agentes_founder_write
  on public.agentes for all to authenticated
  using (public.is_founder()) with check (public.is_founder());

create policy agent_connections_authenticated_select
  on public.agent_connections for select to authenticated
  using (
    public.is_founder() or exists (
      select 1 from public.app_access a
      where a.user_id = auth.uid() and a.active = true
    )
  );
create policy agent_connections_founder_write
  on public.agent_connections for all to authenticated
  using (public.is_founder()) with check (public.is_founder());

create policy integracoes_authenticated_select
  on public.integracoes for select to authenticated
  using (
    public.is_founder() or exists (
      select 1 from public.app_access a
      where a.user_id = auth.uid() and a.active = true
    )
  );
create policy integracoes_founder_write
  on public.integracoes for all to authenticated
  using (public.is_founder()) with check (public.is_founder());
