-- Allow the coordinator to create a post-review handoff.
-- Executors still own submit_delivery and record_memory; Helena/Marina own handoff.
-- The regex assertion aborts safely if the deployed function has drifted.
do $$
declare
  current_definition text;
  patched_definition text;
  guard_pattern text := $pattern$if\s+p_action\s+in\s*\(\s*'submit_delivery'\s*,\s*'handoff'\s*,\s*'record_memory'\s*\)\s+and\s+j[.]agent_id\s*<>\s*b[.]agent_id\s+then\s+raise\s+exception\s*'Job pertence a outro agente'\s+using\s+errcode\s*=\s*'42501'\s*;\s*end\s+if\s*;$pattern$;
  guard_replacement text := $replacement$if p_action in ('submit_delivery','record_memory') and j.agent_id<>b.agent_id then
      raise exception 'Job pertence a outro agente' using errcode='42501';
    end if;
    if p_action='handoff' and b.agent_id not in ('AGT-01','AGT-04') then
      raise exception 'Somente Helena ou Marina encaminha tarefas apos revisao' using errcode='42501';
    end if;$replacement$;
begin
  select pg_get_functiondef('public.gateway_workflow(text,text,jsonb)'::regprocedure)
    into current_definition;

  -- The live function may already contain this guard because the change was
  -- applied manually while validating the pilot. Keep the migration safe to
  -- replay instead of failing on an already-correct production function.
  if current_definition ~* $guard$p_action\s*=\s*'handoff'\s+and\s+b[.]agent_id\s+not\s+in\s*\(\s*'AGT-01'\s*,\s*'AGT-04'\s*\)$guard$ then
    return;
  end if;

  patched_definition := regexp_replace(current_definition, guard_pattern, guard_replacement, 1, 0, 'in');
  if patched_definition = current_definition then
    raise exception 'gateway_workflow guard nao encontrado; migracao interrompida';
  end if;
  execute patched_definition;
end;
$$;
