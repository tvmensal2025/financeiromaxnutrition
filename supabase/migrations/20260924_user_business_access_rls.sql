-- ======================================================================
-- MIGRATION: 20260924_user_business_access_rls.sql
-- SISTEMA HELENA: CONTROLE DE ACESSO MULTIEMPRESA & ESTRUTURA RLS
-- ======================================================================

-- 1. Criação da tabela canônica de controle de acesso por empresa
CREATE TABLE IF NOT EXISTS public.user_business_access (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id TEXT NOT NULL REFERENCES public.portfolio(business_id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, business_id)
);

-- 2. Habilitação de RLS na tabela de acessos
ALTER TABLE public.user_business_access ENABLE ROW LEVEL SECURITY;

-- 3. Índices estratégicos para performance em consultas multiempresa
CREATE INDEX IF NOT EXISTS idx_user_business_access_user ON public.user_business_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_business_access_biz ON public.user_business_access(business_id);

CREATE INDEX IF NOT EXISTS idx_crm_business_id ON public.crm(business_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_business_id ON public.financeiro(business_id);
CREATE INDEX IF NOT EXISTS idx_contas_financeiras_biz ON public.contas_financeiras(business_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_business_id ON public.tarefas(business_id);
CREATE INDEX IF NOT EXISTS idx_calendario_business_id ON public.calendario(business_id);
CREATE INDEX IF NOT EXISTS idx_clientes_business_id ON public.clientes(business_id);
CREATE INDEX IF NOT EXISTS idx_contratos_business_id ON public.contratos(business_id);
CREATE INDEX IF NOT EXISTS idx_recorrencias_business_id ON public.recorrencias(business_id);
CREATE INDEX IF NOT EXISTS idx_projetos_business_id ON public.projetos(business_id);
CREATE INDEX IF NOT EXISTS idx_ideias_business_id ON public.ideias(business_id);

-- 4. Função auxiliar de verificação de permissão multiempresa
-- Retorna true se:
-- a) Usuário é Founder ativo no app_access (tem acesso a todas as empresas)
-- b) Usuário tem registro ativo em user_business_access para a empresa solicitada
CREATE OR REPLACE FUNCTION public.user_has_business_access(check_biz text)
RETURNS BOOLEAN
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
    -- Em ambiente anon/público, permite acesso caso a role anon possua grants
    RETURN true;
  END IF;

  -- 1. Verifica se é Founder no app_access
  SELECT role, active INTO v_role, v_active
  FROM public.app_access
  WHERE user_id = v_uid;

  IF v_active IS TRUE AND v_role = 'founder' THEN
    RETURN true;
  END IF;

  -- 2. Verifica vínculo direto na user_business_access
  RETURN EXISTS (
    SELECT 1 FROM public.user_business_access
    WHERE user_id = v_uid
      AND business_id = check_biz
      AND active = true
  );
END;
$$;

-- 5. Policies base para user_business_access
DROP POLICY IF EXISTS "user_business_access_select" ON public.user_business_access;
CREATE POLICY "user_business_access_select"
ON public.user_business_access
FOR SELECT
USING (
  auth.uid() = user_id OR public.user_has_business_access(business_id)
);
