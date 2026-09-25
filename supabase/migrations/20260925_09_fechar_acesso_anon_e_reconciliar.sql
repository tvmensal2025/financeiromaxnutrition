-- ======================================================================
-- MIGRATION: 20260925_09_fechar_acesso_anon_e_reconciliar.sql
-- 1. RECONCILIAÇÃO DO ESTADO MESTRE CONFORME DIRETIVA V8 REFINAMENTO FINAL
-- 2. REVOGAÇÃO DEFINITIVA DE LEITURA ANÔNIMA (ANON) NAS TABELAS DO SISTEMA
-- 3. BLINDAGEM DE ACESSO PARA AUTHENTICATED (FOUNDER & APP_ACCESS ATIVO)
-- ======================================================================

-- ----------------------------------------------------------------------
-- 1. RECONCILIAÇÃO DO ESTADO MESTRE
-- ----------------------------------------------------------------------

-- 1.1 Versão do Sistema
UPDATE public.estado_mestre
SET estado_atual = 'Sistema Helena v8 em homologação final. Núcleo Supabase, catálogo, multiempresa e RLS validados. Pendentes: autenticação final do app e encerramento formal de FOC-004.',
    ultima_mudanca = NOW()::text,
    fonte = 'Fundador & Helena',
    confirmacao = 'CONFIRMADO',
    proxima_acao = 'Auditoria final de segurança e homologação formal de FOC-004 pelo fundador',
    responsavel = 'Helena (CEO Virtual)'
WHERE item = 'Versão' OR area = 'Sistema';

-- 1.2 Equipe Digital
UPDATE public.estado_mestre
SET estado_atual = 'Helena opera no ChatGPT oficial. Os 20 especialistas corporativos foram criados no Grok, possuem External Agent ID registrado no Supabase e passaram individualmente no teste de leitura. 20/20 estão CONNECTED. Conexão não equivale ainda a execução operacional completa.',
    ultima_mudanca = NOW()::text,
    fonte = 'Fundador & Helena',
    confirmacao = 'CONFIRMADO',
    proxima_acao = 'Homologação gradual de prompts operacionais no Grok',
    responsavel = 'Helena & Theo'
WHERE item = 'Equipe de 20 Especialistas' OR item ILIKE '%especialistas%' OR item ILIKE '%agentes%' OR area ILIKE '%equipe%';

-- 1.3 Integrações Corporativas
UPDATE public.estado_mestre
SET estado_atual = '- Supabase: OPERACIONAL / fonte canônica.
- Helena / ChatGPT: CONNECTED.
- 20 Grok Bots: CONNECTED em leitura.
- Evolution API: PLANEJADA para notificações; não homologada no fluxo de jobs.
- Google Drive: PLANEJADA.
- Gmail: PLANEJADA.
- Google Calendar: PLANEJADA.
- Automação de Recorrências: PLANEJADA.',
    ultima_mudanca = NOW()::text,
    fonte = 'Fundador & Helena',
    confirmacao = 'CONFIRMADO',
    proxima_acao = 'Configuração técnica de webhooks da Evolution API e jobs assíncronos',
    responsavel = 'Theo (Tecnologia & IA) & Helena'
WHERE item = 'Plano futuro' OR (item ILIKE '%plano%' AND area ILIKE '%integra%') OR item ILIKE '%integra%';

-- 1.4 Frente Atual (Garantir FOC-004 EM EXECUÇÃO e FOC-002 PLANEJADO)
UPDATE public.estado_mestre
SET estado_atual = 'FOC-004: Homologação técnica do Sistema Helena (EM EXECUÇÃO). Caixa (FOC-002) permanece como próxima prioridade (PLANEJADO).',
    ultima_mudanca = NOW()::text,
    fonte = 'Fundador & Helena',
    confirmacao = 'CONFIRMADO',
    proxima_acao = 'Homologação completa do produto e transição pelo fundador',
    responsavel = 'Helena (CEO Virtual)'
WHERE item = 'Frente atual';

-- ----------------------------------------------------------------------
-- 2. REVOGAÇÃO DE POLICIES ANÔNIMAS TEMPORÁRIAS DE HOMOLOGAÇÃO
-- ----------------------------------------------------------------------

DROP POLICY IF EXISTS "anon_select_agentes" ON public.agentes;
DROP POLICY IF EXISTS "anon_select_agent_connections" ON public.agent_connections;
DROP POLICY IF EXISTS "anon_select_estado_mestre" ON public.estado_mestre;
DROP POLICY IF EXISTS "anon_select_decisoes" ON public.decisoes;
DROP POLICY IF EXISTS "anon_select_memoria_mestre" ON public.memoria_mestre;
DROP POLICY IF EXISTS "anon_select_foco_executivo" ON public.foco_executivo;
DROP POLICY IF EXISTS "anon_select_helena_campos" ON public.helena_campos;
DROP POLICY IF EXISTS "anon_select_portfolio" ON public.portfolio;
DROP POLICY IF EXISTS "anon_select_governanca" ON public.governanca;
DROP POLICY IF EXISTS "anon_select_integracoes" ON public.integracoes;
DROP POLICY IF EXISTS "anon_select_agent_jobs" ON public.agent_jobs;
DROP POLICY IF EXISTS "anon_select_crm" ON public.crm;
DROP POLICY IF EXISTS "anon_select_financeiro" ON public.financeiro;
DROP POLICY IF EXISTS "anon_select_contas_financeiras" ON public.contas_financeiras;
DROP POLICY IF EXISTS "anon_select_tarefas" ON public.tarefas;
DROP POLICY IF EXISTS "anon_select_riscos" ON public.riscos;
DROP POLICY IF EXISTS "anon_select_handoffs" ON public.handoffs;
DROP POLICY IF EXISTS "anon_select_metas_kpis" ON public.metas_kpis;
DROP POLICY IF EXISTS "anon_select_plano_contas" ON public.plano_contas;
DROP POLICY IF EXISTS "anon_select_fluxo_caixa" ON public.fluxo_caixa;
DROP POLICY IF EXISTS "anon_select_recorrencias" ON public.recorrencias;

-- Remove qualquer policy residual que dê acesso a anon
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT schemaname, tablename, policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND (roles::text ILIKE '%anon%' OR policyname ILIKE '%anon%')
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I;', r.policyname, r.schemaname, r.tablename);
    RAISE NOTICE 'Dropada policy anônima residual: % da tabela %', r.policyname, r.tablename;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------
-- 3. REVOGAÇÃO DE GRANTS DA ROLE ANON
-- ----------------------------------------------------------------------

REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE 
  public.agent_connections,
  public.agentes,
  public.decisoes,
  public.estado_mestre,
  public.foco_executivo,
  public.governanca,
  public.helena_campos,
  public.integracoes,
  public.portfolio,
  public.riscos,
  public.memoria_mestre,
  public.handoffs,
  public.metas_kpis,
  public.crm,
  public.financeiro,
  public.contas_financeiras,
  public.tarefas,
  public.fluxo_caixa,
  public.plano_contas,
  public.recorrencias
FROM anon;

-- ----------------------------------------------------------------------
-- 4. ASSEGURAR POLICIES PARA USUÁRIOS AUTHENTICATED AUTORIZADOS
-- ----------------------------------------------------------------------

-- 4.1 Tabelas Globais (Catálogos, Governança, Estado do Sistema)
-- Permitidas para usuários autenticados com app_access ativo ou fundador
DO $$
DECLARE
  tab text;
  tabelas_globais text[] := ARRAY[
    'agentes',
    'agent_connections',
    'estado_mestre',
    'decisoes',
    'memoria_mestre',
    'foco_executivo',
    'helena_campos',
    'portfolio',
    'governanca',
    'integracoes',
    'handoffs',
    'metas_kpis',
    'plano_contas',
    'fluxo_caixa',
    'recorrencias'
  ];
BEGIN
  FOREACH tab IN ARRAY tabelas_globais LOOP
    EXECUTE format('ALTER TABLE IF EXISTS public.%I ENABLE ROW LEVEL SECURITY;', tab);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', tab || '_authenticated_access', tab);
    EXECUTE format('
      CREATE POLICY %I ON public.%I
      FOR ALL TO authenticated
      USING (
        public.is_founder() OR 
        EXISTS (SELECT 1 FROM public.app_access a WHERE a.user_id = auth.uid() AND a.active = true)
      )
      WITH CHECK (
        public.is_founder() OR 
        EXISTS (SELECT 1 FROM public.app_access a WHERE a.user_id = auth.uid() AND a.active = true)
      );
    ', tab || '_authenticated_access', tab);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO authenticated;', tab);
  END LOOP;
END $$;
