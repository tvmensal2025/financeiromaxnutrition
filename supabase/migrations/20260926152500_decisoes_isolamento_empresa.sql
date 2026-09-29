-- O ledger executivo segue o mesmo isolamento por empresa das tarefas.
-- Decisões sem business_id permanecem visíveis apenas ao fundador.
DROP POLICY IF EXISTS decisoes_authenticated_access ON public.decisoes;
CREATE POLICY decisoes_business_isolation ON public.decisoes
  FOR ALL TO authenticated
  USING (public.user_has_business_access(business_id))
  WITH CHECK (public.user_has_business_access(business_id));

-- RLS não se aplica a TRUNCATE, REFERENCES e TRIGGER.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.decisoes FROM authenticated;
REVOKE ALL ON public.decisoes FROM anon;
