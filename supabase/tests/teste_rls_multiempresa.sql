-- ======================================================================
-- SCRIPT DE TESTE: teste_rls_multiempresa.sql
-- VALIDAÇÃO DAS REGRAS RLS MULTIEMPRESA (FOUNDER vs USUÁRIO RESTRITO)
-- ======================================================================

DO $$
DECLARE
  v_founder_id uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  v_user_biz01_id uuid := '22222222-2222-2222-2222-222222222222'::uuid;
  v_res boolean;
BEGIN
  RAISE NOTICE 'INICIANDO TESTES DE SEGURANÇA MULTIEMPRESA...';

  -- 1. Criação temporária de cenários de teste na sessão
  -- Usuário 1: Founder ativo
  DELETE FROM public.app_access WHERE user_id = v_founder_id;
  INSERT INTO public.app_access (user_id, role, active)
  VALUES (v_founder_id, 'founder', true);

  -- Usuário 2: Membro com acesso APENAS a BIZ-001
  DELETE FROM public.app_access WHERE user_id = v_user_biz01_id;
  INSERT INTO public.app_access (user_id, role, active)
  VALUES (v_user_biz01_id, 'member', true);

  DELETE FROM public.user_business_access WHERE user_id = v_user_biz01_id;
  INSERT INTO public.user_business_access (user_id, business_id, role, active)
  VALUES (v_user_biz01_id, 'BIZ-001', 'member', true);

  -- --------------------------------------------------------------------
  -- TESTE A: FOUNDER DEVE ACESSAR TODAS AS EMPRESAS (BIZ-001, BIZ-002, BIZ-003)
  -- --------------------------------------------------------------------
  -- Simula contexto de auth para v_founder_id
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_founder_id::text)::text, true);

  -- Teste A.1: BIZ-001
  SELECT public.user_has_business_access('BIZ-001') INTO v_res;
  IF v_res IS NOT TRUE THEN
    RAISE EXCEPTION 'FALHA NO TESTE: Founder deveria ter acesso a BIZ-001';
  END IF;

  -- Teste A.2: BIZ-002
  SELECT public.user_has_business_access('BIZ-002') INTO v_res;
  IF v_res IS NOT TRUE THEN
    RAISE EXCEPTION 'FALHA NO TESTE: Founder deveria ter acesso a BIZ-002';
  END IF;

  -- Teste A.3: BIZ-003
  SELECT public.user_has_business_access('BIZ-003') INTO v_res;
  IF v_res IS NOT TRUE THEN
    RAISE EXCEPTION 'FALHA NO TESTE: Founder deveria ter acesso a BIZ-003';
  END IF;

  RAISE NOTICE '>>> TESTE A APROVADO: Founder possui acesso irrestrito a BIZ-001, BIZ-002 e BIZ-003.';

  -- --------------------------------------------------------------------
  -- TESTE B: USUÁRIO RESTRITO A BIZ-001
  -- --------------------------------------------------------------------
  -- Simula contexto de auth para v_user_biz01_id
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_biz01_id::text)::text, true);

  -- Teste B.1: Consegue BIZ-001
  SELECT public.user_has_business_access('BIZ-001') INTO v_res;
  IF v_res IS NOT TRUE THEN
    RAISE EXCEPTION 'FALHA NO TESTE: Usuário deveria conseguir acessar BIZ-001';
  END IF;

  -- Teste B.2: Bloqueado em BIZ-002
  SELECT public.user_has_business_access('BIZ-002') INTO v_res;
  IF v_res IS TRUE THEN
    RAISE EXCEPTION 'FALHA DE SEGURANÇA: Usuário restrito conseguiu acessar BIZ-002!';
  END IF;

  -- Teste B.3: Bloqueado em BIZ-003
  SELECT public.user_has_business_access('BIZ-003') INTO v_res;
  IF v_res IS TRUE THEN
    RAISE EXCEPTION 'FALHA DE SEGURANÇA: Usuário restrito conseguiu acessar BIZ-003!';
  END IF;

  RAISE NOTICE '>>> TESTE B APROVADO: Usuário de BIZ-001 acessa BIZ-001 e é bloqueado em BIZ-002 e BIZ-003.';

  -- Limpeza dos registros de teste
  DELETE FROM public.user_business_access WHERE user_id = v_user_biz01_id;
  DELETE FROM public.app_access WHERE user_id IN (v_founder_id, v_user_biz01_id);

  RAISE NOTICE '=============================================================';
  RAISE NOTICE 'TODOS OS TESTES RLS MULTIEMPRESA PASSARAM COM SUCESSO 100%%!';
  RAISE NOTICE '=============================================================';
END $$;
