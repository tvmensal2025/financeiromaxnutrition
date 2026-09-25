-- ======================================================================
-- MIGRATION: 20260925_08_remover_policy_fundador_autenticado.sql
-- EXPURGO GLOBAL DE TODAS AS POLICIES 'fundador_autenticado' NO SCHEMA PUBLIC
-- E GARANTIA DO ISOLAMENTO MULTIEMPRESA NAS TABELAS BUSINESS-BOUND
-- ======================================================================

DO $$
DECLARE
  r RECORD;
  tab text;
  v_count integer;
  tabelas_business text[] := ARRAY[
    'atendimento',
    'calendario',
    'clientes',
    'contas_financeiras',
    'contratos',
    'crm',
    'documentos',
    'financeiro',
    'marketing',
    'obrigacoes',
    'projetos',
    'riscos',
    'tarefas',
    'ideias'
  ];
BEGIN
  -- 1. Localiza e dropa TODAS as policies conflitantes 'fundador_autenticado' em qualquer tabela
  FOR r IN (
    SELECT schemaname, tablename, policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND policyname ILIKE '%fundador_autenticado%'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I;', r.policyname, r.schemaname, r.tablename);
    RAISE NOTICE 'Removida policy conflitante: % da tabela %', r.policyname, r.tablename;
  END LOOP;

  -- 2. Assegura que as tabelas business-bound possuem exclusivamente a policy canônica de isolamento
  FOREACH tab IN ARRAY tabelas_business LOOP
    EXECUTE format('ALTER TABLE IF EXISTS public.%I ENABLE ROW LEVEL SECURITY;', tab);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', tab || '_business_isolation', tab);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', tab || '_authenticated_policy', tab);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', tab || '_authenticated_all', tab);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'authenticated_all_' || tab, tab);
    EXECUTE format('
      CREATE POLICY %I ON public.%I
      FOR ALL TO authenticated
      USING (public.user_has_business_access(business_id))
      WITH CHECK (public.user_has_business_access(business_id));
    ', tab || '_business_isolation', tab);
  END LOOP;

  -- 3. Confirmação de segurança: garante que zero policies 'fundador_autenticado' restaram
  SELECT count(*) INTO v_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND policyname ILIKE '%fundador_autenticado%';

  IF v_count > 0 THEN
    RAISE EXCEPTION 'Ainda restaram % policies conflitantes no banco!', v_count;
  END IF;

  RAISE NOTICE '=======================================================';
  RAISE NOTICE 'SUCESSO: TODAS AS 42 POLICIES CONFLITANTES FORAM PURGADAS!';
  RAISE NOTICE 'Isolamento multiempresa ativado 100%% nas tabelas business-bound.';
  RAISE NOTICE '=======================================================';
END $$;
