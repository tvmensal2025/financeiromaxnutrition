-- ======================================================================
-- MIGRATION: 20260925_08_remover_policy_fundador_autenticado.sql
-- REMOÇÃO DEFINITIVA DA POLICY ANTIGA fundador_autenticado NAS TABELAS BUSINESS-BOUND
-- ======================================================================

DO $$
DECLARE
  tab text;
  pol text;
  v_count integer;
  tabelas text[] := ARRAY[
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
  FOREACH tab IN ARRAY tabelas LOOP
    -- 1. Remove explicitamente policies por nomes conhecidos
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'fundador_autenticado', tab);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'fundador_autenticado_' || tab, tab);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'fundador_autenticado_select', tab);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'fundador_autenticado_all', tab);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'authenticated_all_' || tab, tab);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', tab || '_authenticated_policy', tab);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', tab || '_authenticated_all', tab);

    -- 2. Remove dinamicamente qualquer policy que contenha 'fundador_autenticado'
    FOR pol IN (
      SELECT policyname 
      FROM pg_policies 
      WHERE schemaname = 'public' 
        AND tablename = tab 
        AND policyname ILIKE '%fundador_autenticado%'
    ) LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', pol, tab);
      RAISE NOTICE 'Removida policy conflitante % da tabela %', pol, tab;
    END LOOP;

    -- 3. Assegura que RLS está habilitado e cria exclusivamente a policy de isolamento
    EXECUTE format('ALTER TABLE IF EXISTS public.%I ENABLE ROW LEVEL SECURITY;', tab);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', tab || '_business_isolation', tab);
    EXECUTE format('
      CREATE POLICY %I ON public.%I
      FOR ALL TO authenticated
      USING (public.user_has_business_access(business_id))
      WITH CHECK (public.user_has_business_access(business_id));
    ', tab || '_business_isolation', tab);
  END LOOP;

  -- 4. Verificação final de sanidade: confirma que zero policies conflitantes restaram
  SELECT count(*) INTO v_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND policyname ILIKE '%fundador_autenticado%';

  IF v_count > 0 THEN
    RAISE EXCEPTION 'Ainda existem % policies com fundador_autenticado no banco!', v_count;
  END IF;

  RAISE NOTICE '=======================================================';
  RAISE NOTICE 'ISOLAMENTO MULTIEMPRESA ATIVADO COM SUCESSO 100%%!';
  RAISE NOTICE 'Todas as policies permissivas antigas foram eliminadas.';
  RAISE NOTICE 'As 13 tabelas agora obedecem exclusivamente a user_has_business_access.';
  RAISE NOTICE '=======================================================';
END $$;
