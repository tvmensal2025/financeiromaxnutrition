-- ======================================================================
-- SCRIPT ÚNICO CONSOLIDADO: 20260925_PATCH_FINAL_CONSOLIDADO.sql
-- EXECUTE APENAS ESTE SQL NO SUPABASE SQL EDITOR
-- ======================================================================

-- ----------------------------------------------------------------------
-- PARTE 1. RECONCILIAÇÃO DO ESTADO MESTRE (SUPABASE COMO FONTE CANÔNICA)
-- ----------------------------------------------------------------------

UPDATE public.estado_mestre
SET estado_atual = 'Sistema Helena v8.0 homologado para Supabase Operacional. Aplicação web com multiempresa e RLS blindado.',
    ultima_mudanca = NOW()::text,
    fonte = 'Fundador & Helena',
    confirmacao = 'CONFIRMADO',
    proxima_acao = 'Auditoria final pós-deploy e transição para FOC-002 Caixa',
    responsavel = 'Helena (CEO Virtual)'
WHERE item = 'Versão' OR area = 'Sistema';

UPDATE public.estado_mestre
SET estado_atual = 'Supabase é a fonte operacional canônica. Planilha V8 é referência histórica. Integrações externas planejadas e conectadas conforme status real (Evolution API, Supabase, Grok Bot e ChatGPT).',
    ultima_mudanca = NOW()::text,
    fonte = 'Fundador & Helena',
    confirmacao = 'CONFIRMADO',
    proxima_acao = 'Configuração gradual de webhooks e bots no Grok',
    responsavel = 'Theo (Tecnologia & IA) & Helena'
WHERE item = 'Plano futuro' OR (item ILIKE '%plano%' AND area ILIKE '%integra%');

UPDATE public.estado_mestre
SET estado_atual = 'Helena atua como CEO Virtual no ChatGPT. Os 20 especialistas corporativos estão definidos com status canônico PLANNED para ativação no Grok.',
    ultima_mudanca = NOW()::text,
    fonte = 'Fundador & Helena',
    confirmacao = 'CONFIRMADO',
    proxima_acao = 'Ativação técnica dos bots no Grok',
    responsavel = 'Helena & Theo'
WHERE item = 'Equipe de 20 Especialistas' OR item ILIKE '%especialistas%';

UPDATE public.estado_mestre
SET estado_atual = 'FOC-004: Homologação técnica do Sistema Helena (EM EXECUÇÃO). Caixa (FOC-002) permanece como próxima prioridade (PLANEJADO).',
    ultima_mudanca = NOW()::text,
    fonte = 'Fundador & Helena',
    confirmacao = 'CONFIRMADO',
    proxima_acao = 'Auditoria final da Helena e transição para FOC-002',
    responsavel = 'Helena (CEO Virtual)'
WHERE item = 'Frente atual';

UPDATE public.estado_mestre
SET estado_atual = 'Supabase Operacional (wxkgrykduqtsgmjkzlou). Planilha V8 como referência histórica.',
    ultima_mudanca = NOW()::text,
    fonte = 'Fundador & Helena',
    confirmacao = 'CONFIRMADO',
    proxima_acao = 'Operação contínua no Supabase',
    responsavel = 'Helena (CEO Virtual)'
WHERE item = 'Fonte Canônica de Verdade';

-- ----------------------------------------------------------------------
-- PARTE 2. TABELA CANÔNICA DE ACESSO: public.user_business_access
-- ----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_business_access (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id TEXT NOT NULL REFERENCES public.portfolio(business_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  role TEXT DEFAULT 'member',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, business_id)
);

CREATE INDEX IF NOT EXISTS idx_user_business_access_lookup ON public.user_business_access(user_id, business_id, active);

-- ----------------------------------------------------------------------
-- PARTE 3. FUNÇÕES CANÔNICAS (FOUNDER & ACESSO MULTIEMPRESA)
-- ----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_founder()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.app_access
    WHERE user_id = auth.uid()
      AND role = 'founder'
      AND active = true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.user_has_business_access(check_biz text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text;
  v_active boolean;
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  -- 1. Regra do Founder: acesso total a todas as empresas
  SELECT role, active INTO v_role, v_active
  FROM public.app_access
  WHERE user_id = v_uid;

  IF v_active IS TRUE AND v_role = 'founder' THEN
    RETURN true;
  END IF;

  IF check_biz IS NULL THEN
    RETURN false;
  END IF;

  -- 2. Regra Não-Founder: vínculo estrito ativo
  RETURN EXISTS (
    SELECT 1 FROM public.user_business_access
    WHERE user_id = v_uid
      AND business_id = check_biz
      AND active = true
  );
END;
$$;

-- ----------------------------------------------------------------------
-- PARTE 4. POLICIES RLS NA TABELA user_business_access
-- ----------------------------------------------------------------------

ALTER TABLE public.user_business_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_business_access_select" ON public.user_business_access;
CREATE POLICY "user_business_access_select" ON public.user_business_access
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_founder());

DROP POLICY IF EXISTS "user_business_access_admin" ON public.user_business_access;
CREATE POLICY "user_business_access_admin" ON public.user_business_access
FOR ALL TO authenticated
USING (public.is_founder())
WITH CHECK (public.is_founder());

-- ----------------------------------------------------------------------
-- PARTE 5. POLICIES RLS NAS 13 TABELAS BUSINESS-BOUND (+ IDEIAS)
-- ----------------------------------------------------------------------

DO $$
DECLARE
  r RECORD;
  tab text;
  tabelas text[] := ARRAY[
    'crm', 'clientes', 'financeiro', 'contas_financeiras', 'projetos',
    'tarefas', 'marketing', 'atendimento', 'contratos', 'documentos',
    'riscos', 'calendario', 'obrigacoes', 'ideias'
  ];
BEGIN
  -- 1. Remove globalmente todas as 42 ocorrências de fundador_autenticado
  FOR r IN (
    SELECT schemaname, tablename, policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND policyname ILIKE '%fundador_autenticado%'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I;', r.policyname, r.schemaname, r.tablename);
  END LOOP;

  -- 2. Mantém EXCLUSIVAMENTE a policy canônica de isolamento por business_id
  FOREACH tab IN ARRAY tabelas LOOP
    EXECUTE format('ALTER TABLE IF EXISTS public.%I ENABLE ROW LEVEL SECURITY;', tab);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', tab || '_business_isolation', tab);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', tab || '_authenticated_policy', tab);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', tab || '_authenticated_all', tab);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'authenticated_all_' || tab, tab);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'anon_select_' || tab, tab);
    EXECUTE format('
      CREATE POLICY %I ON public.%I
      FOR ALL TO authenticated
      USING (public.user_has_business_access(business_id))
      WITH CHECK (public.user_has_business_access(business_id));
    ', tab || '_business_isolation', tab);
  END LOOP;
END $$;

-- ----------------------------------------------------------------------
-- PARTE 6. PRIVACIDADE TOTAL PARA MEMORIA_MESTRE E HANDOFFS
-- (Somente o Founder autenticado acessa)
-- ----------------------------------------------------------------------

ALTER TABLE IF EXISTS public.memoria_mestre ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_memoria_mestre" ON public.memoria_mestre;
DROP POLICY IF EXISTS "memoria_mestre_founder_only" ON public.memoria_mestre;
CREATE POLICY "memoria_mestre_founder_only" ON public.memoria_mestre
FOR ALL TO authenticated
USING (public.is_founder())
WITH CHECK (public.is_founder());

ALTER TABLE IF EXISTS public.handoffs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_handoffs" ON public.handoffs;
DROP POLICY IF EXISTS "handoffs_founder_only" ON public.handoffs;
CREATE POLICY "handoffs_founder_only" ON public.handoffs
FOR ALL TO authenticated
USING (public.is_founder())
WITH CHECK (public.is_founder());

-- ----------------------------------------------------------------------
-- PARTE 7. PRESERVAÇÃO DE GOVERNANÇA GLOBAL
-- ----------------------------------------------------------------------

DELETE FROM public.helena_campos 
WHERE tabela = 'governanca' AND coluna IN ('business_id', 'business_id_area');

ALTER TABLE IF EXISTS public.governanca ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "governanca_read_all" ON public.governanca;
CREATE POLICY "governanca_read_all" ON public.governanca
FOR SELECT TO anon, authenticated
USING (true);

-- ----------------------------------------------------------------------
-- PARTE 8. SECURITY ADVISOR (FIX DE search_path EM FUNÇÕES TRIGGER)
-- ----------------------------------------------------------------------

ALTER FUNCTION public.helena_financeiro_antes() SET search_path = public, pg_temp;
ALTER FUNCTION public.helena_um_foco() SET search_path = public, pg_temp;
ALTER FUNCTION public.helena_status_planejado() SET search_path = public, pg_temp;
ALTER FUNCTION public.helena_ideia_decisao() SET search_path = public, pg_temp;

-- ----------------------------------------------------------------------
-- CONCLUSÃO COM SUCESSO
-- ----------------------------------------------------------------------
DO $$
BEGIN
  RAISE NOTICE '=======================================================';
  RAISE NOTICE 'PATCH FINAL CONSOLIDADO APLICADO COM SUCESSO!';
  RAISE NOTICE '1. Estado Mestre reconciliado com Supabase canônico.';
  RAISE NOTICE '2. RLS Multiempresa ativo nas 13 tabelas business-bound.';
  RAISE NOTICE '3. Regra do Founder: acesso total irrestrito.';
  RAISE NOTICE '4. Não-Founder: restrito à sua empresa via user_business_access.';
  RAISE NOTICE '5. Memória Mestre e Handoffs privadas para Founder.';
  RAISE NOTICE '6. Governança preservada estritamente global.';
  RAISE NOTICE '=======================================================';
END $$;
