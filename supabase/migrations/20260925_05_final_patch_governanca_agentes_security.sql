-- ======================================================================
-- MIGRATION: 20260925_05_final_patch_governanca_agentes_security.sql
-- ÚLTIMO PATCH DA HOMOLOGAÇÃO: GOVERNANÇA GLOBAL, RESTAURAÇÃO DE CONTRATOS,
-- ENCERRAMENTO DE PUBLIC_REVIEW_MODE E SECURITY ADVISOR (SEARCH_PATH)
-- ======================================================================

-- ----------------------------------------------------------------------
-- 1. GOVERNANÇA: PURGA DE QUALQUER POLICY OU REFERÊNCIA A business_id
-- ----------------------------------------------------------------------

-- Limpeza de registros indevidos em helena_campos
DELETE FROM public.helena_campos 
WHERE tabela = 'governanca' AND coluna IN ('business_id', 'business_id_area');

-- Remove todas as policies residuais de public.governanca para garantir que nenhuma policy oculta consulte business_id
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'governanca' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.governanca', r.policyname);
    END LOOP;
END $$;

-- Habilita RLS e cria exclusivamente a policy canônica de leitura (global, sem filtros de business_id)
ALTER TABLE public.governanca ENABLE ROW LEVEL SECURITY;

CREATE POLICY "governanca_read_all"
ON public.governanca
FOR SELECT
TO anon, authenticated
USING (true);


-- ----------------------------------------------------------------------
-- 2. RESTAURAÇÃO CANÔNICA DE quando_ativar E missao (CONTRATO ORIGINAL V8)
-- Mantém rigorosamente intactos os nomes e cargo_funcao canônicos já definidos
-- ----------------------------------------------------------------------

UPDATE public.agentes SET 
    quando_ativar = 'Assunto geral, prioridades, conflitos entre áreas, painel, decisões',
    missao = 'Integrar todo o portfólio, escolher o especialista certo, manter foco, memória e execução sincronizados.'
WHERE agent_id = 'AGT-01';

UPDATE public.agentes SET 
    quando_ativar = 'Fala, clareza, hábitos, aprendizagem, leitura, desenvolvimento',
    missao = 'Treinar o fundador por prática guiada, observando 1–2 padrões de maior impacto por sessão.'
WHERE agent_id = 'AGT-02';

UPDATE public.agentes SET 
    quando_ativar = 'Modelo de negócio, posicionamento, cenários, escolhas estratégicas',
    missao = 'Transformar ambição em hipóteses, escolhas, trade-offs e critérios de validação.'
WHERE agent_id = 'AGT-03';

UPDATE public.agentes SET 
    quando_ativar = 'Projetos, cronogramas, dependências, prazos, conclusão',
    missao = 'Converter decisões em planos executáveis com definição de pronto, dependências, evidência e dono.'
WHERE agent_id = 'AGT-04';

UPDATE public.agentes SET 
    quando_ativar = 'Caixa, receita, despesa, margem, orçamento, runway, projeções',
    missao = 'Criar disciplina financeira e tornar caixa, custos e economia unitária visíveis.'
WHERE agent_id = 'AGT-05';

UPDATE public.agentes SET 
    quando_ativar = 'Contratos, privacidade, compliance, segurança, regulação',
    missao = 'Identificar riscos legais/compliance e definir controles e necessidade de aconselhamento profissional.'
WHERE agent_id = 'AGT-06';

UPDATE public.agentes SET 
    quando_ativar = 'Contratação, desempenho, estrutura de equipe, cultura',
    missao = 'Projetar papéis, responsabilidades, contratação e rituais sem burocracia prematura.'
WHERE agent_id = 'AGT-07';

UPDATE public.agentes SET 
    quando_ativar = 'KPIs, dashboard, métricas, análises',
    missao = 'Transformar dados em indicadores confiáveis e decisões mensuráveis.'
WHERE agent_id = 'AGT-08';

UPDATE public.agentes SET 
    quando_ativar = 'Arquitetura, integrações, automações, IA, escalabilidade',
    missao = 'Tomar decisões técnicas compatíveis com estágio, segurança e custo.'
WHERE agent_id = 'AGT-09';

UPDATE public.agentes SET 
    quando_ativar = 'Roadmap, funcionalidades, proposta de valor, experiência',
    missao = 'Priorizar produto pelo valor ao usuário e pela fase do negócio.'
WHERE agent_id = 'AGT-10';

UPDATE public.agentes SET 
    quando_ativar = 'Usuários, concorrência, hipóteses, validação',
    missao = 'Reduzir incerteza com pesquisa e evidência de mercado/usuário.'
WHERE agent_id = 'AGT-11';

UPDATE public.agentes SET 
    quando_ativar = 'Interface, fluxo, design system, usabilidade',
    missao = 'Criar experiências claras, consistentes e testáveis alinhadas ao produto.'
WHERE agent_id = 'AGT-12';

UPDATE public.agentes SET 
    quando_ativar = 'Testes, bugs, aceite, releases',
    missao = 'Garantir qualidade por critérios verificáveis e evidência de teste.'
WHERE agent_id = 'AGT-13';

UPDATE public.agentes SET 
    quando_ativar = 'SOPs, rotina operacional, eficiência',
    missao = 'Transformar trabalho recorrente em processo simples, controlável e melhorável.'
WHERE agent_id = 'AGT-14';

UPDATE public.agentes SET 
    quando_ativar = 'Prospecção, pipeline, abordagem, fechamento',
    missao = 'Gerar aprendizado e receita por atividade comercial mensurável.'
WHERE agent_id = 'AGT-15';

UPDATE public.agentes SET 
    quando_ativar = 'Aquisição, campanhas, canais, funil',
    missao = 'Criar aquisição mensurável e experimentos com hipótese e resultado.'
WHERE agent_id = 'AGT-16';

UPDATE public.agentes SET 
    quando_ativar = 'Narrativa, conteúdo, copy, posicionamento verbal',
    missao = 'Traduzir estratégia e proposta de valor em comunicação coerente e persuasiva.'
WHERE agent_id = 'AGT-17';

UPDATE public.agentes SET 
    quando_ativar = 'Parcerias, canais, afiliados, oportunidades',
    missao = 'Criar relações e canais que acelerem validação, distribuição ou receita.'
WHERE agent_id = 'AGT-18';

UPDATE public.agentes SET 
    quando_ativar = 'Ativação, retenção, valor, relacionamento',
    missao = 'Fazer clientes alcançarem valor e transformar sinais de churn em ação.'
WHERE agent_id = 'AGT-19';

UPDATE public.agentes SET 
    quando_ativar = 'Suporte, dúvidas, reclamações, experiência diária',
    missao = 'Resolver solicitações e transformar recorrências em sinais de produto/processo.'
WHERE agent_id = 'AGT-20';

UPDATE public.agentes SET 
    quando_ativar = 'Documentos, fornecedores, controles, rotinas administrativas',
    missao = 'Manter organização administrativa, registros e fornecedores sob controle.'
WHERE agent_id = 'AGT-21';


-- ----------------------------------------------------------------------
-- 3. ENCERRAMENTO DE PUBLIC_REVIEW_MODE & BLINDAGEM DE DADOS EMPRESARIAIS INTERNOS
-- ----------------------------------------------------------------------

-- Revoga a concessão global e irrestrita de SELECT para a role anon
REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM anon;

-- Revoga leitura anônima de todas as tabelas confidenciais, operacionais e de governança interna
REVOKE SELECT ON TABLE public.app_access FROM anon;
REVOKE SELECT ON TABLE public.acessos FROM anon;
REVOKE SELECT ON TABLE public.clientes FROM anon;
REVOKE SELECT ON TABLE public.crm FROM anon;
REVOKE SELECT ON TABLE public.financeiro FROM anon;
REVOKE SELECT ON TABLE public.contas_financeiras FROM anon;
REVOKE SELECT ON TABLE public.contratos FROM anon;
REVOKE SELECT ON TABLE public.comunicacoes FROM anon;
REVOKE SELECT ON TABLE public.consentimentos FROM anon;
REVOKE SELECT ON TABLE public.documentos FROM anon;
REVOKE SELECT ON TABLE public.memoria_mestre FROM anon;
REVOKE SELECT ON TABLE public.handoffs FROM anon;
REVOKE SELECT ON TABLE public.agent_jobs FROM anon;
REVOKE SELECT ON TABLE public.agent_job_events FROM anon;
REVOKE SELECT ON TABLE public.notification_outbox FROM anon;
REVOKE SELECT ON TABLE public.auditoria FROM anon;
REVOKE SELECT ON TABLE public.auditoria_sistema FROM anon;
REVOKE SELECT ON TABLE public.pessoas FROM anon;
REVOKE SELECT ON TABLE public.fundador FROM anon;

-- Remove policies residuais criadas para anon nas tabelas sensíveis
DROP POLICY IF EXISTS "anon_select_crm" ON public.crm;
DROP POLICY IF EXISTS "anon_select_financeiro" ON public.financeiro;
DROP POLICY IF EXISTS "anon_select_contas_financeiras" ON public.contas_financeiras;
DROP POLICY IF EXISTS "anon_select_contratos" ON public.contratos;
DROP POLICY IF EXISTS "anon_select_clientes" ON public.clientes;
DROP POLICY IF EXISTS "anon_select_documentos" ON public.documentos;
DROP POLICY IF EXISTS "anon_select_memoria_mestre" ON public.memoria_mestre;
DROP POLICY IF EXISTS "anon_select_handoffs" ON public.handoffs;
DROP POLICY IF EXISTS "anon_select_agent_jobs" ON public.agent_jobs;

-- Garante que a role anon só leia tabelas estritamente catalogadas / públicas
GRANT SELECT ON TABLE public.portfolio TO anon, authenticated;
GRANT SELECT ON TABLE public.agentes TO anon, authenticated;
GRANT SELECT ON TABLE public.agent_connections TO anon, authenticated;
GRANT SELECT ON TABLE public.governanca TO anon, authenticated;
GRANT SELECT ON TABLE public.integracoes TO anon, authenticated;
GRANT SELECT ON TABLE public.estado_mestre TO anon, authenticated;
GRANT SELECT ON TABLE public.foco_executivo TO anon, authenticated;
GRANT SELECT ON TABLE public.helena_campos TO anon, authenticated;
GRANT SELECT ON TABLE public.decisoes TO anon, authenticated;
GRANT SELECT ON TABLE public.riscos TO anon, authenticated;


-- ----------------------------------------------------------------------
-- 4. SECURITY ADVISOR: FIX DO search_path DAS FUNÇÕES
-- Zera alertas de function_search_path_mutable fixando search_path seguro
-- ----------------------------------------------------------------------

ALTER FUNCTION public.helena_financeiro_antes() SET search_path = public, pg_temp;
ALTER FUNCTION public.helena_um_foco() SET search_path = public, pg_temp;
ALTER FUNCTION public.helena_status_planejado() SET search_path = public, pg_temp;
ALTER FUNCTION public.helena_ideia_decisao() SET search_path = public, pg_temp;
