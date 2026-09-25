-- ==============================================================================
-- PROPOSTA DE ESTRUTURA SQL PARA TELEFONIA E AUDITORIA LAYA
-- NOTA: ESTE ARQUIVO É UMA PROPOSTA ARQUITETURAL PARA REVISÃO.
-- NÃO FOI EXECUTADO AUTOMATICAMENTE NO BANCO DE PRODUÇÃO.
-- ==============================================================================

-- 1. Tabela de Sessões de Chamadas de Voz (Telefonia WhatsApp via Meowcaller)
CREATE TABLE IF NOT EXISTS public.call_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id VARCHAR(64) NOT NULL UNIQUE,
    business_id VARCHAR(32) NOT NULL,
    agent_id VARCHAR(32) NOT NULL,
    current_owner VARCHAR(64) NOT NULL,
    contact_phone VARCHAR(32) NOT NULL,
    contact_name VARCHAR(128),
    lead_id UUID,
    direction VARCHAR(16) NOT NULL DEFAULT 'INBOUND' CHECK (direction IN ('INBOUND', 'OUTBOUND')),
    status VARCHAR(32) NOT NULL DEFAULT 'RINGING' CHECK (status IN ('RINGING', 'ACCEPTED', 'ACTIVE', 'COMPLETED', 'FAILED', 'REJECTED')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER DEFAULT 0,
    intent VARCHAR(64),
    result_summary TEXT,
    handoffs_count INTEGER DEFAULT 0,
    next_action TEXT,
    failure_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Índices operacionais
CREATE INDEX IF NOT EXISTS idx_call_sessions_business ON public.call_sessions(business_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_agent ON public.call_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_status ON public.call_sessions(status);
CREATE INDEX IF NOT EXISTS idx_call_sessions_started_at ON public.call_sessions(started_at DESC);

-- 2. Tabela de Eventos de Chamadas de Voz (Telemetria Técnica e Handoffs)
CREATE TABLE IF NOT EXISTS public.call_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id VARCHAR(64) NOT NULL REFERENCES public.call_sessions(call_id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    timestamp_ms BIGINT NOT NULL,
    latency_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_call_events_call_id ON public.call_events(call_id);
CREATE INDEX IF NOT EXISTS idx_call_events_event_type ON public.call_events(event_type);

-- 3. Tabela de Auditoria e Decisões Rápidas Laya
CREATE TABLE IF NOT EXISTS public.laya_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trace_id VARCHAR(64) NOT NULL UNIQUE,
    business_id VARCHAR(32) NOT NULL,
    channel VARCHAR(32) NOT NULL DEFAULT 'whatsapp',
    message_hash VARCHAR(64),
    area VARCHAR(64) NOT NULL,
    intent VARCHAR(64) NOT NULL,
    urgency INTEGER NOT NULL DEFAULT 1,
    risk_score INTEGER NOT NULL DEFAULT 1,
    commercial_opportunity BOOLEAN NOT NULL DEFAULT false,
    churn_risk BOOLEAN NOT NULL DEFAULT false,
    needs_human BOOLEAN NOT NULL DEFAULT false,
    needs_helena BOOLEAN NOT NULL DEFAULT false,
    needs_founder BOOLEAN NOT NULL DEFAULT false,
    suggested_agent_id VARCHAR(32) NOT NULL,
    confidence NUMERIC(5, 4) NOT NULL,
    decision_mode VARCHAR(32) NOT NULL CHECK (decision_mode IN ('AUTO', 'AUTO_AUDIT', 'FALLBACK')),
    latency_ms NUMERIC(8, 2) NOT NULL,
    model_version VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_laya_decisions_biz ON public.laya_decisions(business_id);
CREATE INDEX IF NOT EXISTS idx_laya_decisions_mode ON public.laya_decisions(decision_mode);
CREATE INDEX IF NOT EXISTS idx_laya_decisions_confidence ON public.laya_decisions(confidence);
