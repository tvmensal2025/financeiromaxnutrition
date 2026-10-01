-- Match the installed Helena profile; do not change scope, credentials or job state.
begin;
do $$
begin
  if not exists(select 1 from public.agent_runtime_bindings
    where agent_id='AGT-01' and profile_slug='helena--grupo' and scope_type='GROUP') then
    raise exception 'Expected Helena GROUP binding missing';
  end if;
end;
$$;
update public.agent_runtime_bindings set model_id='gpt-6.1-sol', updated_at=clock_timestamp()
where agent_id='AGT-01' and profile_slug='helena--grupo' and scope_type='GROUP'
and model_id is distinct from 'gpt-6.1-sol';
commit;
