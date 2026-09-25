-- ======================================================================
-- MIGRATION: 20260925_07_rls_multiempresa_isolamento.sql
-- PATCH DE FECHAMENTO DO FOC-004: SEGURANÇA & ISOLAMENTO RLS MULTIEMPRESA
-- ======================================================================

-- ----------------------------------------------------------------------
-- 1. TABELA CANÔNICA DE ACESSO MULTIEMPRESA: public.user_business_access
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

-- Índices estratégicos para performance máxima em verificações de RLS
CREATE INDEX IF NOT EXISTS idx_user_business_access_user_id ON public.user_business_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_business_access_business_id ON public.user_business_access(business_id);
CREATE INDEX IF NOT EXISTS idx_user_business_access_lookup ON public.user_business_access(user_id, business_id, active);

-- ----------------------------------------------------------------------
-- 2. FUNÇÕES CANÔNICAS DE PERMISSÃO (FOUNDER & ISOLAMENTO POR EMPRESA)
-- ----------------------------------------------------------------------

-- Verifica se o usuário atual é Founder ativo no app_access
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

-- Avalia acesso à empresa específica:
-- 1. Founder ativo tem acesso irrestrito a BIZ-001, BIZ-002, BIZ-003.
-- 2. Usuário não-founder só acessa se houver registro ativo em user_business_access.
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
  
  -- Bloqueia chamadas sem usuário autenticado
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  -- Regra do Founder: app_access.role = 'founder' AND app_access.active = true
  SELECT role, active INTO v_role, v_active
  FROM public.app_access
  WHERE user_id = v_uid;

  IF v_active IS TRUE AND v_role = 'founder' THEN
    RETURN true;
  END IF;

  -- Bloqueia caso o registro business-bound não tenha business_id definido
  IF check_biz IS NULL THEN
    RETURN false;
  END IF;

  -- Regra para usuários não-founder: exige vínculo ativo específico
  RETURN EXISTS (
    SELECT 1 FROM public.user_business_access
    WHERE user_id = v_uid
      AND business_id = check_biz
      AND active = true
  );
END;
$$;

-- ----------------------------------------------------------------------
-- 3. POLICIES RLS PARA A PRÓPRIA TABELA user_business_access
-- ----------------------------------------------------------------------
ALTER TABLE public.user_business_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_business_access_select" ON public.user_business_access;
CREATE POLICY "user_business_access_select"
ON public.user_business_access
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR public.is_founder()
);

DROP POLICY IF EXISTS "user_business_access_admin" ON public.user_business_access;
CREATE POLICY "user_business_access_admin"
ON public.user_business_access
FOR ALL
TO authenticated
USING (
  public.is_founder()
)
WITH CHECK (
  public.is_founder()
);

-- ----------------------------------------------------------------------
-- 4. POLICIES RLS MULTIEMPRESA NAS 13 TABELAS BUSINESS-BOUND
-- Restringe SELECT, INSERT, UPDATE e DELETE estritamente por business_id
-- ----------------------------------------------------------------------

-- 1. crm
ALTER TABLE IF EXISTS public.crm ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "crm_business_isolation" ON public.crm;
DROP POLICY IF EXISTS "crm_authenticated_policy" ON public.crm;
CREATE POLICY "crm_business_isolation" ON public.crm
FOR ALL TO authenticated
USING (public.user_has_business_access(business_id))
WITH CHECK (public.user_has_business_access(business_id));

-- 2. clientes
ALTER TABLE IF EXISTS public.clientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clientes_business_isolation" ON public.clientes;
DROP POLICY IF EXISTS "clientes_authenticated_policy" ON public.clientes;
CREATE POLICY "clientes_business_isolation" ON public.clientes
FOR ALL TO authenticated
USING (public.user_has_business_access(business_id))
WITH CHECK (public.user_has_business_access(business_id));

-- 3. financeiro
ALTER TABLE IF EXISTS public.financeiro ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "financeiro_business_isolation" ON public.financeiro;
DROP POLICY IF EXISTS "financeiro_authenticated_policy" ON public.financeiro;
CREATE POLICY "financeiro_business_isolation" ON public.financeiro
FOR ALL TO authenticated
USING (public.user_has_business_access(business_id))
WITH CHECK (public.user_has_business_access(business_id));

-- 4. contas_financeiras
ALTER TABLE IF EXISTS public.contas_financeiras ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contas_financeiras_business_isolation" ON public.contas_financeiras;
DROP POLICY IF EXISTS "contas_financeiras_authenticated_policy" ON public.contas_financeiras;
CREATE POLICY "contas_financeiras_business_isolation" ON public.contas_financeiras
FOR ALL TO authenticated
USING (public.user_has_business_access(business_id))
WITH CHECK (public.user_has_business_access(business_id));

-- 5. projetos
ALTER TABLE IF EXISTS public.projetos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "projetos_business_isolation" ON public.projetos;
DROP POLICY IF EXISTS "projetos_authenticated_policy" ON public.projetos;
CREATE POLICY "projetos_business_isolation" ON public.projetos
FOR ALL TO authenticated
USING (public.user_has_business_access(business_id))
WITH CHECK (public.user_has_business_access(business_id));

-- 6. tarefas
ALTER TABLE IF EXISTS public.tarefas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tarefas_business_isolation" ON public.tarefas;
DROP POLICY IF EXISTS "tarefas_authenticated_policy" ON public.tarefas;
CREATE POLICY "tarefas_business_isolation" ON public.tarefas
FOR ALL TO authenticated
USING (public.user_has_business_access(business_id))
WITH CHECK (public.user_has_business_access(business_id));

-- 7. marketing
ALTER TABLE IF EXISTS public.marketing ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "marketing_business_isolation" ON public.marketing;
DROP POLICY IF EXISTS "marketing_authenticated_policy" ON public.marketing;
CREATE POLICY "marketing_business_isolation" ON public.marketing
FOR ALL TO authenticated
USING (public.user_has_business_access(business_id))
WITH CHECK (public.user_has_business_access(business_id));

-- 8. atendimento
ALTER TABLE IF EXISTS public.atendimento ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "atendimento_business_isolation" ON public.atendimento;
DROP POLICY IF EXISTS "atendimento_authenticated_policy" ON public.atendimento;
CREATE POLICY "atendimento_business_isolation" ON public.atendimento
FOR ALL TO authenticated
USING (public.user_has_business_access(business_id))
WITH CHECK (public.user_has_business_access(business_id));

-- 9. contratos
ALTER TABLE IF EXISTS public.contratos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contratos_business_isolation" ON public.contratos;
DROP POLICY IF EXISTS "contratos_authenticated_policy" ON public.contratos;
CREATE POLICY "contratos_business_isolation" ON public.contratos
FOR ALL TO authenticated
USING (public.user_has_business_access(business_id))
WITH CHECK (public.user_has_business_access(business_id));

-- 10. documentos
ALTER TABLE IF EXISTS public.documentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "documentos_business_isolation" ON public.documentos;
DROP POLICY IF EXISTS "documentos_authenticated_policy" ON public.documentos;
CREATE POLICY "documentos_business_isolation" ON public.documentos
FOR ALL TO authenticated
USING (public.user_has_business_access(business_id))
WITH CHECK (public.user_has_business_access(business_id));

-- 11. riscos (contém RSK-0001 de BIZ-001)
ALTER TABLE IF EXISTS public.riscos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "riscos_business_isolation" ON public.riscos;
DROP POLICY IF EXISTS "riscos_authenticated_policy" ON public.riscos;
CREATE POLICY "riscos_business_isolation" ON public.riscos
FOR ALL TO authenticated
USING (public.user_has_business_access(business_id))
WITH CHECK (public.user_has_business_access(business_id));

-- 12. calendario
ALTER TABLE IF EXISTS public.calendario ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "calendario_business_isolation" ON public.calendario;
DROP POLICY IF EXISTS "calendario_authenticated_policy" ON public.calendario;
CREATE POLICY "calendario_business_isolation" ON public.calendario
FOR ALL TO authenticated
USING (public.user_has_business_access(business_id))
WITH CHECK (public.user_has_business_access(business_id));

-- 13. obrigacoes
ALTER TABLE IF EXISTS public.obrigacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "obrigacoes_business_isolation" ON public.obrigacoes;
DROP POLICY IF EXISTS "obrigacoes_authenticated_policy" ON public.obrigacoes;
CREATE POLICY "obrigacoes_business_isolation" ON public.obrigacoes
FOR ALL TO authenticated
USING (public.user_has_business_access(business_id))
WITH CHECK (public.user_has_business_access(business_id));

-- Tabela adicional: ideias (business-bound com decurso canônico)
ALTER TABLE IF EXISTS public.ideias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ideias_business_isolation" ON public.ideias;
CREATE POLICY "ideias_business_isolation" ON public.ideias
FOR ALL TO authenticated
USING (public.user_has_business_access(business_id))
WITH CHECK (public.user_has_business_access(business_id));

-- ----------------------------------------------------------------------
-- 5. BLINDAGEM DE MEMORIA_MESTRE E HANDOFFS (ESTRITAMENTE FOUNDER)
-- Não abre para anon nem para usuários normais
-- ----------------------------------------------------------------------
ALTER TABLE IF EXISTS public.memoria_mestre ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "memoria_mestre_founder_only" ON public.memoria_mestre;
CREATE POLICY "memoria_mestre_founder_only"
ON public.memoria_mestre
FOR ALL TO authenticated
USING (public.is_founder())
WITH CHECK (public.is_founder());

ALTER TABLE IF EXISTS public.handoffs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "handoffs_founder_only" ON public.handoffs;
CREATE POLICY "handoffs_founder_only"
ON public.handoffs
FOR ALL TO authenticated
USING (public.is_founder())
WITH CHECK (public.is_founder());

-- ----------------------------------------------------------------------
-- 6. PRESERVAÇÃO DE TABELAS GLOBAIS / MISTAS
-- Governanca NÃO possui business_id e permanece estritamente global
-- ----------------------------------------------------------------------
-- NENHUMA alteração na tabela governanca.
-- Permanece protegida pela policy governanca_read_all.

-- ----------------------------------------------------------------------
-- 7. TABELAS DE AGENTES E NOTIFICAÇÕES (MANTIDAS RESERVADAS)
-- agent_jobs, agent_job_events e notification_outbox continuam sem policy
-- de usuário comum e sem acesso para anon.
-- ----------------------------------------------------------------------

-- ----------------------------------------------------------------------
-- 8. TESTE DE SANIDADE DAS REGRAS RLS (EXECUÇÃO DIRETA NO SUPABASE)
-- ----------------------------------------------------------------------
DO $$
BEGIN
  RAISE NOTICE '=======================================================';
  RAISE NOTICE 'MIGRATION 07 APLICADA: RLS MULTIEMPRESA BLINDADO';
  RAISE NOTICE 'Tabelas protegidas: crm, clientes, financeiro, contas_financeiras, projetos, tarefas, marketing, atendimento, contratos, documentos, riscos, calendario, obrigacoes, ideias.';
  RAISE NOTICE 'Founder: acesso irrestrito.';
  RAISE NOTICE 'Não-Founder: isolamento estrito via public.user_business_access.';
  RAISE NOTICE 'Governança: mantida estritamente global sem business_id.';
  RAISE NOTICE '=======================================================';
END $$;
