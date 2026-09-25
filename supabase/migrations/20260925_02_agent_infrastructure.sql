-- ======================================================================
-- MIGRATION: 20260925_02_agent_infrastructure.sql
-- CAMADA OPERACIONAL DOS AGENTES, JOBS, EVENTOS E OUTBOX DE NOTIFICAÇÕES
-- ======================================================================

-- 1. TABELA: agent_connections
-- Registra a conexão técnica e provedor de cada um dos 21 agentes corporativos
CREATE TABLE IF NOT EXISTS public.agent_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id TEXT UNIQUE NOT NULL,
    provider TEXT NOT NULL CHECK (provider IN ('CHATGPT', 'GROK', 'HUMAN', 'OTHER')),
    external_agent_id TEXT,
    connection_status TEXT NOT NULL DEFAULT 'PLANNED' CHECK (connection_status IN ('CONNECTED', 'PLANNED', 'NOT_CONNECTED', 'ERROR')),
    capabilities JSONB DEFAULT '[]'::jsonb,
    last_seen_at TIMESTAMPTZ,
    last_tested_at TIMESTAMPTZ,
    approval_policy TEXT DEFAULT 'STANDARD',
    credential_reference TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABELA: agent_jobs
-- Fila de trabalho técnica dos especialistas digitais
CREATE TABLE IF NOT EXISTS public.agent_jobs (
    job_id TEXT PRIMARY KEY,
    task_id TEXT,
    agent_id TEXT NOT NULL,
    business_id TEXT,
    objective TEXT NOT NULL,
    instruction TEXT,
    priority TEXT DEFAULT 'MEDIA' CHECK (priority IN ('CRITICA', 'ALTA', 'MEDIA', 'BAIXA')),
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
        'DRAFT', 'SCHEDULED', 'READY', 'CLAIMED', 'RUNNING',
        'WAITING_APPROVAL', 'WAITING_HELENA', 'COMPLETED', 'FAILED', 'CANCELLED'
    )),
    scheduled_at TIMESTAMPTZ,
    available_at TIMESTAMPTZ,
    claimed_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    approval_required BOOLEAN DEFAULT FALSE,
    approval_status TEXT DEFAULT 'NOT_REQUIRED',
    result_summary TEXT,
    result_payload JSONB,
    evidence_refs JSONB DEFAULT '[]'::jsonb,
    attempt_count INT DEFAULT 0,
    max_attempts INT DEFAULT 3,
    idempotency_key TEXT UNIQUE,
    correlation_id TEXT,
    error_code TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices otimizados para busca rápida na fila de jobs
CREATE INDEX IF NOT EXISTS idx_agent_jobs_status ON public.agent_jobs(status);
CREATE INDEX IF NOT EXISTS idx_agent_jobs_agent_id ON public.agent_jobs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_jobs_business_id ON public.agent_jobs(business_id);

-- 3. TABELA: agent_job_events
-- Histórico append-only de eventos de transição e execução dos jobs
CREATE TABLE IF NOT EXISTS public.agent_job_events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    business_id TEXT,
    event_type TEXT NOT NULL,
    status TEXT NOT NULL,
    message TEXT,
    payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    correlation_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_job_events_job_id ON public.agent_job_events(job_id);

-- 4. TABELA: notification_outbox
-- Outbox assíncrono para notificações WhatsApp via Evolution API
CREATE TABLE IF NOT EXISTS public.notification_outbox (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id TEXT,
    job_id TEXT,
    channel TEXT NOT NULL DEFAULT 'WHATSAPP',
    recipient_reference TEXT NOT NULL,
    template TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'CANCELLED')),
    scheduled_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    provider_message_id TEXT,
    attempt_count INT DEFAULT 0,
    error TEXT,
    idempotency_key TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outbox_status ON public.notification_outbox(status);

-- 5. CADASTRO INICIAL CANÔNICO DOS 21 AGENTES
INSERT INTO public.agent_connections (agent_id, provider, connection_status, capabilities)
VALUES
    ('AGT-01', 'CHATGPT', 'CONNECTED', '["direcao_estrategica", "coordenacao_geral", "analise_gargalo", "gestao_foco"]'::jsonb)
ON CONFLICT (agent_id) DO UPDATE SET
    provider = EXCLUDED.provider,
    connection_status = EXCLUDED.connection_status,
    updated_at = NOW();

-- Os 20 especialistas são inicialmente registrados como PLANNED / NOT_CONNECTED no Grok Bot
INSERT INTO public.agent_connections (agent_id, provider, connection_status, capabilities)
VALUES
    ('AGT-02', 'GROK', 'PLANNED', '["gestao_financeira", "caixa"]'::jsonb),
    ('AGT-03', 'GROK', 'PLANNED', '["controladoria", "dre"]'::jsonb),
    ('AGT-04', 'GROK', 'PLANNED', '["juridico", "contratos"]'::jsonb),
    ('AGT-05', 'GROK', 'PLANNED', '["crm", "vendas"]'::jsonb),
    ('AGT-06', 'GROK', 'PLANNED', '["pre_vendas", "qualificacao"]'::jsonb),
    ('AGT-07', 'GROK', 'PLANNED', '["sucesso_cliente", "retencao"]'::jsonb),
    ('AGT-08', 'GROK', 'PLANNED', '["atendimento", "suporte"]'::jsonb),
    ('AGT-09', 'GROK', 'PLANNED', '["trafego_pago", "marketing_performance"]'::jsonb),
    ('AGT-10', 'GROK', 'PLANNED', '["copywriting", "conteudo"]'::jsonb),
    ('AGT-11', 'GROK', 'PLANNED', '["gestao_produto", "backlog"]'::jsonb),
    ('AGT-12', 'GROK', 'PLANNED', '["ui_ux", "experiencia_digital"]'::jsonb),
    ('AGT-13', 'GROK', 'PLANNED', '["arquitetura_software", "dados"]'::jsonb),
    ('AGT-14', 'GROK', 'PLANNED', '["qa", "testes"]'::jsonb),
    ('AGT-15', 'GROK', 'PLANNED', '["automacoes", "integracoes"]'::jsonb),
    ('AGT-16', 'GROK', 'PLANNED', '["governanca", "riscos"]'::jsonb),
    ('AGT-17', 'GROK', 'PLANNED', '["gestao_projetos", "prazos"]'::jsonb),
    ('AGT-18', 'GROK', 'PLANNED', '["suprimentos", "fornecedores"]'::jsonb),
    ('AGT-19', 'GROK', 'PLANNED', '["inteligencia_competitiva"]'::jsonb),
    ('AGT-20', 'GROK', 'PLANNED', '["parcerias", "afiliados"]'::jsonb),
    ('AGT-21', 'GROK', 'PLANNED', '["seguranca_informacao", "lgpd"]'::jsonb)
ON CONFLICT (agent_id) DO NOTHING;

-- Permissões de leitura pública segura
GRANT SELECT ON public.agent_connections TO anon;
GRANT SELECT ON public.agent_jobs TO anon;
GRANT SELECT ON public.agent_job_events TO anon;
GRANT SELECT ON public.notification_outbox TO anon;
