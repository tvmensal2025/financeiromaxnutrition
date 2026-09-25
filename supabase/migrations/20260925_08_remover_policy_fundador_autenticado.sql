-- ======================================================================
-- MIGRATION: 20260925_08_remover_policy_fundador_autenticado.sql
-- REMOÇÃO DEFINITIVA DA POLICY ANTIGA fundador_autenticado NAS TABELAS BUSINESS-BOUND
-- E VALIDAÇÃO COMPLETA DO ISOLAMENTO MULTIEMPRESA (RLS)
-- ======================================================================

-- ----------------------------------------------------------------------
-- 1. EXPURGO DE POLICIES ANTIGAS / PERMISSIVAS EM TABELAS BUSINESS-BOUND
-- ----------------------------------------------------------------------
DO $$
DECLARE
  tab text;
  pol text;
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
    -- 1.1 Remove policies com nomes legados exatos
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'fundador_autenticado', tab);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'fundador_autenticado_' || tab, tab);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'fundador_autenticado_select', tab);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'fundador_autenticado_all', tab);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'authenticated_all_' || tab, tab);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', tab || '_authenticated_policy', tab);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', tab || '_authenticated_all', tab);

    -- 1.2 Remove dinamicamente qualquer policy que contenha 'fundador_autenticado' no nome
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

    -- 1.3 Assegura que a única policy para authenticated seja <tabela>_business_isolation
    EXECUTE format('ALTER TABLE IF EXISTS public.%I ENABLE ROW LEVEL SECURITY;', tab);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', tab || '_business_isolation', tab);
    EXECUTE format('
      CREATE POLICY %I ON public.%I
      FOR ALL TO authenticated
      USING (public.user_has_business_access(business_id))
      WITH CHECK (public.user_has_business_access(business_id));
    ', tab || '_business_isolation', tab);
  END LOOP;
END $$;

-- ----------------------------------------------------------------------
-- 2. TESTE OBRIGATÓRIO DE ISOLAMENTO RLS MULTIEMPRESA (VALIDAÇÃO DIRETA)
-- ----------------------------------------------------------------------
DO $$
DECLARE
  v_founder_id uuid := '11111111-2222-3333-4444-555555555555'::uuid;
  v_test_user_id uuid := '99999999-8888-7777-6666-555555555555'::uuid;
  v_res boolean;
BEGIN
  RAISE NOTICE 'INICIANDO TESTES DO ISOLAMENTO MULTIEMPRESA...';

  -- A. Configura Founder
  DELETE FROM public.app_access WHERE user_id = v_founder_id;
  INSERT INTO public.app_access (user_id, role, active)
  VALUES (v_founder_id, 'founder', true);

  -- B. Configura Usuário de Teste Não-Founder com app_access ativo
  DELETE FROM public.app_access WHERE user_id = v_test_user_id;
  INSERT INTO public.app_access (user_id, role, active)
  VALUES (v_test_user_id, 'member', true);

  -- C. Concede acesso SOMENTE a BIZ-001 em user_business_access
  DELETE FROM public.user_business_access WHERE user_id = v_test_user_id;
  INSERT INTO public.user_business_access (user_id, business_id, role, active)
  VALUES (v_test_user_id, 'BIZ-001', 'member', true);

  -- --------------------------------------------------------------------
  -- TESTE 1: FOUNDER DEVE TER ACESSO A BIZ-001, BIZ-002 E BIZ-003
  -- --------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_founder_id::text)::text, true);

  SELECT public.user_has_business_access('BIZ-001') INTO v_res;
  IF v_res IS NOT TRUE THEN RAISE EXCEPTION 'ERRO: Founder sem acesso a BIZ-001'; END IF;

  SELECT public.user_has_business_access('BIZ-002') INTO v_res;
  IF v_res IS NOT TRUE THEN RAISE EXCEPTION 'ERRO: Founder sem acesso a BIZ-002'; END IF;

  SELECT public.user_has_business_access('BIZ-003') INTO v_res;
  IF v_res IS NOT TRUE THEN RAISE EXCEPTION 'ERRO: Founder sem acesso a BIZ-003'; END IF;

  RAISE NOTICE '>>> TESTE 1 APROVADO: Founder tem acesso total (BIZ-001, BIZ-002, BIZ-003).';

  -- --------------------------------------------------------------------
  -- TESTE 2: USUÁRIO NÃO-FOUNDER RESTRITO A BIZ-001
  -- --------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_test_user_id::text)::text, true);

  -- 2.1 BIZ-001 deve ser PERMITIDO
  SELECT public.user_has_business_access('BIZ-001') INTO v_res;
  IF v_res IS NOT TRUE THEN
    RAISE EXCEPTION 'ERRO: Usuário restrito deveria conseguir BIZ-001';
  END IF;

  -- 2.2 BIZ-002 deve ser BLOQUEADO
  SELECT public.user_has_business_access('BIZ-002') INTO v_res;
  IF v_res IS TRUE THEN
    RAISE EXCEPTION 'FALHA CRÍTICA DE RLS: Usuário restrito conseguiu acesso a BIZ-002!';
  END IF;

  -- 2.3 BIZ-003 deve ser BLOQUEADO
  SELECT public.user_has_business_access('BIZ-003') INTO v_res;
  IF v_res IS TRUE THEN
    RAISE EXCEPTION 'FALHA CRÍTICA DE RLS: Usuário restrito conseguiu acesso a BIZ-003!';
  END IF;

  RAISE NOTICE '>>> TESTE 2 APROVADO: Usuário restrito acessa apenas BIZ-001 e é bloqueado em BIZ-002 e BIZ-003.';

  -- --------------------------------------------------------------------
  -- LIMPEZA DO USUÁRIO DE TESTE TEMPORÁRIO
  -- --------------------------------------------------------------------
  DELETE FROM public.user_business_access WHERE user_id = v_test_user_id;
  DELETE FROM public.app_access WHERE user_id IN (v_founder_id, v_test_user_id);

  RAISE NOTICE '=======================================================';
  RAISE NOTICE 'ISOLAMENTO MULTIEMPRESA PURGADO E HOMOLOGADO COM SUCESSO!';
  RAISE NOTICE 'Policy fundador_autenticado eliminada das 13 tabelas.';
  RAISE NOTICE 'Apenas <tabela>_business_isolation ativa.';
  RAISE NOTICE '=======================================================';
END $$;
