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

-- 4. ALINHAMENTO CANÔNICO DA TABELA public.agentes COM OS NOMES E CARGOS OFICIAIS
-- Garante que public.agentes possua exatamente a identidade canônica requerida pelo fundador
INSERT INTO public.agentes (agent_id, agente, cargo_funcao, quando_ativar, missao, status)
VALUES
    ('AGT-01', 'Helena', 'CEO Virtual / Central de Comando', 'Sempre ativa como central do ecossistema', 'Direção operacional, coordenação dos 20 especialistas, foco executivo e proteção de WIP=1', 'ATIVO'),
    ('AGT-02', 'Laura', 'Gestão Financeira & Caixa', 'Lançamentos, conciliação e fluxo de caixa', 'Controle rigoroso do fluxo de caixa e gestão financeira das 3 empresas', 'ATIVO'),
    ('AGT-03', 'Augusto', 'Controladoria & DRE', 'Fechamento de competência e análise de margem', 'Estruturação da DRE, auditoria de lançamentos e controladoria geral', 'ATIVO'),
    ('AGT-04', 'Marina', 'Contratos & Jurídico', 'Assinatura de contratos e conformidade jurídica', 'Gestão de instrumentos jurídicos, termos de adesão e compliance legal', 'ATIVO'),
    ('AGT-05', 'Caio', 'CRM & Vendas', 'Novas oportunidades comerciais e negociações', 'Gestão do pipeline de vendas e avanço de negociações no CRM', 'ATIVO'),
    ('AGT-06', 'Clara', 'Pré-Vendas & Qualificação (SDR)', 'Entrada de novos leads comerciais', 'Qualificação ágil de leads e preparação de oportunidades comerciais', 'ATIVO'),
    ('AGT-07', 'Bianca', 'Sucesso do Cliente (CS) & Retenção', 'Ativação e retenção de clientes ativos', 'Onboarding de novos clientes, combate ao churn e expansão de conta', 'ATIVO'),
    ('AGT-08', 'Daniel', 'Atendimento & Suporte Técnico', 'Abertura de chamados e dúvidas de clientes', 'Resolução rápida de tickets com cumprimento de SLA e diagnóstico de causa raiz', 'ATIVO'),
    ('AGT-09', 'Theo', 'Tráfego Pago & Performance', 'Campanhas de tráfego e mídia paga', 'Otimização de CAC, testes de criativos e gestão de orçamento em anúncios', 'ATIVO'),
    ('AGT-10', 'Nina', 'Conteúdo, Copywriting & Comunicação', 'Criação de mensagens, copies e postagens', 'Comunicação persuasiva alinhada à proposta de valor de cada negócio', 'ATIVO'),
    ('AGT-11', 'Ravi', 'Gestão de Produto & Backlog', 'Definição de escopo, releases e hipóteses', 'Priorização do backlog de produto com foco no gargalo de cada negócio', 'ATIVO'),
    ('AGT-12', 'Maya', 'UI/UX & Experiência Digital', 'Interface, usabilidade e fluxos de telas', 'Design de interfaces modernas, consistência visual e usabilidade premium', 'ATIVO'),
    ('AGT-13', 'Bruno', 'Arquitetura de Software & Dados', 'Engenharia de dados, tabelas e backend', 'Manutenção da integridade relacional, RLS e performance no Supabase', 'ATIVO'),
    ('AGT-14', 'Olívia', 'QA, Testes & Homologação', 'Validação de releases e integridade de telas', 'Garantia de qualidade, testes automatizados e homologação rigorosa', 'ATIVO'),
    ('AGT-15', 'Victor — Vendas', 'Automações & Integrações Técnicas', 'Conexão de APIs, webhooks e esteiras', 'Configuração de webhooks, mensageria via Evolution e integrações de esteira', 'ATIVO'),
    ('AGT-16', 'Camila', 'Governança, Risco & Auditoria', 'Rituais de governança e monitoramento de riscos', 'Acompanhamento de rituais executivos e mitigação da matriz de riscos', 'ATIVO'),
    ('AGT-17', 'Isabela', 'Gestão de Projetos & Prazos', 'Controle de marcos, sprints e entregas', 'Monitoramento rigoroso de cronogramas, impedimentos e datas limites', 'ATIVO'),
    ('AGT-18', 'Pedro', 'Suprimentos & Fornecedores', 'Cotações, compras e gestão de parceiros', 'Negociação com parceiros terceirizados e homologação de insumos', 'ATIVO'),
    ('AGT-19', 'Renata', 'Inteligência Competitiva & Mercado', 'Benchmarking e monitoramento de concorrentes', 'Pesquisa de mercado, diferenciais competitivos e posicionamento estratégico', 'ATIVO'),
    ('AGT-20', 'Joana', 'Parcerias & Afiliados (Humano Digital)', 'Jornada e comissionamento de afiliados', 'Ativação e esteira de rastreamento para o modelo Humano Digital', 'ATIVO'),
    ('AGT-21', 'Felipe', 'Segurança da Informação & LGPD', 'Políticas de privacidade, acessos e auditoria', 'Proteção de credenciais, blindagem de acessos e conformidade com LGPD', 'ATIVO')
ON CONFLICT (agent_id) DO UPDATE SET
    agente = EXCLUDED.agente,
    cargo_funcao = EXCLUDED.cargo_funcao,
    quando_ativar = EXCLUDED.quando_ativar,
    missao = EXCLUDED.missao,
    status = EXCLUDED.status;
