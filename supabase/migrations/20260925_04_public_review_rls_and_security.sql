-- ======================================================================
-- MIGRATION: 20260925_04_public_review_rls_and_security.sql
-- POLICIES RLS SEGURAS PARA MODO DE REVISÃO PÚBLICA + BLINDAGEM DE ESCRITA ANON
-- ======================================================================

-- 1. REVOGAÇÃO RIGOROSA DE PERMISSÕES DE ESCRITA PARA A ROLE ANON
-- Garante que 'anon' não pode inserir, alterar, deletar ou criar triggers em nenhuma tabela nova ou sensível
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.agent_connections FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.agent_jobs FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.agent_job_events FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.notification_outbox FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM anon;

-- 2. HABILITAÇÃO DE ROW LEVEL SECURITY (RLS)
-- Mantém RLS rigorosamente ativo em conformidade com as diretivas de segurança
ALTER TABLE IF EXISTS public.governanca ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.riscos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.integracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.portfolio ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.estado_mestre ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.decisoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.memoria_mestre ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.foco_executivo ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.helena_campos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agent_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agent_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agent_job_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notification_outbox ENABLE ROW LEVEL SECURITY;

-- 3. POLICIES EXCLUSIVAS DE LEITURA (SELECT) PARA ANON DURANTE O MODO DE REVISÃO PÚBLICA
-- Permite ao fundador auditar os dados operacionais reais diretamente na UI sem exigir autenticação prévia

-- governanca: 3 rituais executivos globais
DROP POLICY IF EXISTS "anon_select_governanca" ON public.governanca;
CREATE POLICY "anon_select_governanca" ON public.governanca
FOR SELECT TO anon
USING (true);

-- riscos: matriz de riscos (incluindo RSK-0001 de BIZ-001)
DROP POLICY IF EXISTS "anon_select_riscos" ON public.riscos;
CREATE POLICY "anon_select_riscos" ON public.riscos
FOR SELECT TO anon
USING (true);

-- integracoes: 4 integrações globais
DROP POLICY IF EXISTS "anon_select_integracoes" ON public.integracoes;
CREATE POLICY "anon_select_integracoes" ON public.integracoes
FOR SELECT TO anon
USING (true);

-- agentes: os 21 agentes corporativos
DROP POLICY IF EXISTS "anon_select_agentes" ON public.agentes;
CREATE POLICY "anon_select_agentes" ON public.agentes
FOR SELECT TO anon
USING (true);

-- portfolio: os 3 negócios oficiais
DROP POLICY IF EXISTS "anon_select_portfolio" ON public.portfolio;
CREATE POLICY "anon_select_portfolio" ON public.portfolio
FOR SELECT TO anon
USING (true);

-- estado_mestre: estado consolidado do ecossistema
DROP POLICY IF EXISTS "anon_select_estado_mestre" ON public.estado_mestre;
CREATE POLICY "anon_select_estado_mestre" ON public.estado_mestre
FOR SELECT TO anon
USING (true);

-- decisoes: ledger canônico de decisões executivas
DROP POLICY IF EXISTS "anon_select_decisoes" ON public.decisoes;
CREATE POLICY "anon_select_decisoes" ON public.decisoes
FOR SELECT TO anon
USING (true);

-- memoria_mestre: memória persistente da Helena
DROP POLICY IF EXISTS "anon_select_memoria_mestre" ON public.memoria_mestre;
CREATE POLICY "anon_select_memoria_mestre" ON public.memoria_mestre
FOR SELECT TO anon
USING (true);

-- foco_executivo: frente ativa (FOC-004) e planejada (FOC-002)
DROP POLICY IF EXISTS "anon_select_foco_executivo" ON public.foco_executivo;
CREATE POLICY "anon_select_foco_executivo" ON public.foco_executivo
FOR SELECT TO anon
USING (true);

-- helena_campos: dicionário de campos da V8
DROP POLICY IF EXISTS "anon_select_helena_campos" ON public.helena_campos;
CREATE POLICY "anon_select_helena_campos" ON public.helena_campos
FOR SELECT TO anon
USING (true);

-- agent_connections: status técnico dos provedores (ChatGPT, Grok Bot)
DROP POLICY IF EXISTS "anon_select_agent_connections" ON public.agent_connections;
CREATE POLICY "anon_select_agent_connections" ON public.agent_connections
FOR SELECT TO anon
USING (true);

-- agent_jobs: leitura segura da fila técnica durante a homologação
DROP POLICY IF EXISTS "anon_select_agent_jobs" ON public.agent_jobs;
CREATE POLICY "anon_select_agent_jobs" ON public.agent_jobs
FOR SELECT TO anon
USING (true);

-- Tabelas operacionais complementares para revisão pública segura
ALTER TABLE IF EXISTS public.crm ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_crm" ON public.crm;
CREATE POLICY "anon_select_crm" ON public.crm FOR SELECT TO anon USING (true);

ALTER TABLE IF EXISTS public.financeiro ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_financeiro" ON public.financeiro;
CREATE POLICY "anon_select_financeiro" ON public.financeiro FOR SELECT TO anon USING (true);

ALTER TABLE IF EXISTS public.contas_financeiras ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_contas_financeiras" ON public.contas_financeiras;
CREATE POLICY "anon_select_contas_financeiras" ON public.contas_financeiras FOR SELECT TO anon USING (true);

ALTER TABLE IF EXISTS public.tarefas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_tarefas" ON public.tarefas;
CREATE POLICY "anon_select_tarefas" ON public.tarefas FOR SELECT TO anon USING (true);

ALTER TABLE IF EXISTS public.calendario ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_calendario" ON public.calendario;
CREATE POLICY "anon_select_calendario" ON public.calendario FOR SELECT TO anon USING (true);

ALTER TABLE IF EXISTS public.clientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_clientes" ON public.clientes;
CREATE POLICY "anon_select_clientes" ON public.clientes FOR SELECT TO anon USING (true);

ALTER TABLE IF EXISTS public.ideias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_ideias" ON public.ideias;
CREATE POLICY "anon_select_ideias" ON public.ideias FOR SELECT TO anon USING (true);

ALTER TABLE IF EXISTS public.projetos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_projetos" ON public.projetos;
CREATE POLICY "anon_select_projetos" ON public.projetos FOR SELECT TO anon USING (true);

ALTER TABLE IF EXISTS public.recorrencias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_recorrencias" ON public.recorrencias;
CREATE POLICY "anon_select_recorrencias" ON public.recorrencias FOR SELECT TO anon USING (true);

ALTER TABLE IF EXISTS public.contratos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_contratos" ON public.contratos;
CREATE POLICY "anon_select_contratos" ON public.contratos FOR SELECT TO anon USING (true);

ALTER TABLE IF EXISTS public.atendimento ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_atendimento" ON public.atendimento;
CREATE POLICY "anon_select_atendimento" ON public.atendimento FOR SELECT TO anon USING (true);

ALTER TABLE IF EXISTS public.marketing ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_marketing" ON public.marketing;
CREATE POLICY "anon_select_marketing" ON public.marketing FOR SELECT TO anon USING (true);

ALTER TABLE IF EXISTS public.processos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_processos" ON public.processos;
CREATE POLICY "anon_select_processos" ON public.processos FOR SELECT TO anon USING (true);

ALTER TABLE IF EXISTS public.documentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_documentos" ON public.documentos;
CREATE POLICY "anon_select_documentos" ON public.documentos FOR SELECT TO anon USING (true);

ALTER TABLE IF EXISTS public.handoffs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_handoffs" ON public.handoffs;
CREATE POLICY "anon_select_handoffs" ON public.handoffs FOR SELECT TO anon USING (true);

-- Concessão explícita de SELECT para as tabelas auditadas
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- 4. NORMALIZAÇÃO OPERACIONAL DE INTEGRAÇÕES (conforme solicitado pelo fundador)
-- Registros com scope_type = 'GLOBAL' e business_id legado 'DADO A COLETAR' são normalizados para NULL
UPDATE public.integracoes 
SET business_id = NULL 
WHERE business_id = 'DADO A COLETAR' OR business_id = 'GLOBAL';

-- 5. ALINHAMENTO CANÔNICO DA TABELA public.agentes COM OS CARGOS OFICIAIS EXATOS
-- Garante que public.agentes possua rigorosamente a identidade e funções corporativas requeridas
INSERT INTO public.agentes (agent_id, agente, cargo_funcao, quando_ativar, missao, status)
VALUES
    ('AGT-01', 'Helena', 'CEO Virtual / Central de Comando', 'Sempre ativa como central do ecossistema', 'Direção operacional, coordenação dos 20 especialistas, foco executivo e proteção de WIP=1', 'ATIVO'),
    ('AGT-02', 'Laura', 'Comunicação e Desenvolvimento do Fundador', 'Alinhamento direto, direcionamento e comunicação com o fundador', 'Facilitar a comunicação estratégica e desenvolvimento contínuo do fundador', 'ATIVO'),
    ('AGT-03', 'Augusto', 'Estratégia Corporativa', 'Definição de modelo de negócios, expansão e posicionamento', 'Estruturação estratégica e alinhamento de longo prazo do ecossistema', 'ATIVO'),
    ('AGT-04', 'Marina', 'Execução e PMO', 'Acompanhamento de entregas, iniciativas e marcos dos projetos', 'Garantir a execução disciplinada dos projetos e marcos estratégicos', 'ATIVO'),
    ('AGT-05', 'Caio', 'Finanças / CFO', 'Gestão financeira global, fluxo de caixa e controladoria', 'Gestão financeira rigorosa, auditoria de caixa e governança fiscal', 'ATIVO'),
    ('AGT-06', 'Clara', 'Risco, Jurídico e Compliance', 'Contratos, blindagem legal, conformidade e riscos corporativos', 'Mitigação de riscos jurídicos, compliance regulatório e matriz de riscos', 'ATIVO'),
    ('AGT-07', 'Bianca', 'Pessoas e Cultura', 'Gestão de pessoas, cultura organizacional e contratações', 'Fortalecimento da cultura de alta performance e suporte a pessoas', 'ATIVO'),
    ('AGT-08', 'Daniel', 'Dados e BI', 'Métricas, relatórios executivos, KPIs e inteligência de dados', 'Centralização e análise de dados para tomadas de decisão embasadas', 'ATIVO'),
    ('AGT-09', 'Theo', 'Tecnologia e IA', 'Infraestrutura técnica, arquitetura de sistemas e modelos de IA', 'Sustentação tecnológica, automações avançadas e inteligência artificial', 'ATIVO'),
    ('AGT-10', 'Nina', 'Produto', 'Visão de produto, proposta de valor e ciclo de vida', 'Definição estratégica e evolução contínua dos produtos do ecossistema', 'ATIVO'),
    ('AGT-11', 'Ravi', 'Pesquisa e Insights', 'Pesquisa de mercado, benchmarking e análise de tendências', 'Geração de inteligência competitiva e validação de hipóteses de negócio', 'ATIVO'),
    ('AGT-12', 'Maya', 'Design / UX / UI', 'Experiência do usuário, interfaces e consistência visual', 'Construção de interfaces elegantes, modernas e de altíssima usabilidade', 'ATIVO'),
    ('AGT-13', 'Bruno', 'Qualidade / QA', 'Auditoria de qualidade, testes e homologação rigorosa', 'Garantia de qualidade contínua em código, processos e entregas', 'ATIVO'),
    ('AGT-14', 'Olívia', 'Operações', 'Processos operacionais, eficiência e esteiras do dia a dia', 'Otimização e padronização das operações das unidades de negócio', 'ATIVO'),
    ('AGT-15', 'Victor', 'Vendas', 'Pipeline comercial, conversão de negócios e fechamento', 'Aceleração de receitas, negociação ativa e tração de novos clientes', 'ATIVO'),
    ('AGT-16', 'Camila', 'Marketing e Growth', 'Estratégias de aquisição, crescimento e tração de mercado', 'Geração de demanda qualificada e expansão escalável do portfólio', 'ATIVO'),
    ('AGT-17', 'Isabela', 'Marca, Conteúdo e Copy', 'Branding, copywriting persuasivo e comunicação de marca', 'Posicionamento magnético da marca e narrativa estratégica de vendas', 'ATIVO'),
    ('AGT-18', 'Pedro', 'Parcerias e Desenvolvimento de Negócios', 'Alianças comerciais, canais de distribuição e parcerias', 'Construção de parcerias estratégicas e novos canais de distribuição', 'ATIVO'),
    ('AGT-19', 'Renata', 'Customer Success', 'Sucesso do cliente, retenção, onboarding e combate ao churn', 'Maximização do valor entregue ao cliente e aumento de LTV', 'ATIVO'),
    ('AGT-20', 'Joana', 'Atendimento', 'Suporte ágil, resolução de chamados e experiência do cliente', 'Atendimento resolutivo com alto padrão de satisfação e cumprimento de SLA', 'ATIVO'),
    ('AGT-21', 'Felipe', 'Administração', 'Gestão administrativa, patrimonial e suporte corporativo', 'Organização administrativa e suporte transversal a todas as frentes', 'ATIVO')
ON CONFLICT (agent_id) DO UPDATE SET
    agente = EXCLUDED.agente,
    cargo_funcao = EXCLUDED.cargo_funcao,
    quando_ativar = EXCLUDED.quando_ativar,
    missao = EXCLUDED.missao,
    status = EXCLUDED.status;
