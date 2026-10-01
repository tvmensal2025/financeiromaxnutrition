-- Repair the existing function in place without replacing unrelated context changes.
-- Only group metadata selection changes; no tools, credentials, jobs or attempts.
begin;
do $repair$
declare source text; original text := '(rb.scope_type = ''GROUP'' or rb.business_id = b.business_id)';
replacement text := '((b.scope_type = ''GROUP'' and b.agent_id = ''AGT-01'') or rb.scope_type = ''GROUP'' or rb.business_id = b.business_id)';
begin
  source := pg_get_functiondef('public.gateway_context(text)'::regprocedure);
  if position(replacement in source)>0 then return; end if;
  if (length(source)-length(replace(source,original,'')))/length(original)<>2 then
    raise exception 'Unexpected fleet context implementation; no change';
  end if;
  execute replace(source,original,replacement);
end;
$repair$;
commit;
