-- Bound the source summary copied into a downstream handoff.
-- A reviewed delivery can be large; copying it verbatim into the next
-- instruction can exceed the 8,000-character contract before the downstream
-- brief is even read. Keep enough source context for traceability while
-- preserving room for the coordinator's explicit brief.
do $$
declare
  current_definition text;
  patched_definition text;
begin
  select pg_get_functiondef('public.gateway_workflow(text,text,jsonb)'::regprocedure)
    into current_definition;

  -- This migration is also safe after the production hotfix was applied.
  if current_definition ~* 'left\s*\(\s*coalesce\s*\(\s*j[.]result_summary' then
    return;
  end if;

  patched_definition := regexp_replace(
    current_definition,
    '\|\|\s*j[.]result_summary\s*\|\|',
    '||left(coalesce(j.result_summary,' || chr(39) || chr(39) || '),1600)||',
    1,
    0,
    'in'
  );

  if patched_definition = current_definition then
    raise exception 'gateway_workflow resumo de handoff nao encontrado; migracao interrompida';
  end if;

  execute patched_definition;
end;
$$;
