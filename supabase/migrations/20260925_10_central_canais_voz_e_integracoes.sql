-- ======================================================================
-- MIGRATION: 20260925_10_central_canais_voz_e_integracoes.sql
-- SISTEMA HELENA — Central de Canais, Voz e Roteamento
-- Tabelas: voice_profiles, channel_connections, call_sessions, integration_events
-- Registros canônicos em public.integracoes e RLS estrita
-- ======================================================================

-- 1. TABELA voice_profiles
CREATE TABLE IF NOT EXISTS public.voice_profiles (
    profile_id text PRIMARY KEY,
    nome text NOT NULL,
    business_id text NULL,
    provider text NOT NULL DEFAULT 'ELEVENLABS',
    eleven_agent_id text NULL,
    voice_id text NOT NULL,
    language text DEFAULT 'pt-BR',
    first_message text NULL,
    settings jsonb DEFAULT '{}'::jsonb,
    enabled boolean DEFAULT true,
    is_default boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. TABELA channel_connections
CREATE TABLE IF NOT EXISTS public.channel_connections (
    connection_id text PRIMARY KEY,
    provider text NOT NULL,
    business_id text NOT NULL DEFAULT 'BIZ-001',
    purpose text NOT NULL, -- 'MESSAGES', 'VOICE_CALLS'
    instance_name text NULL,
    status text NOT NULL DEFAULT 'DISCONNECTED',
    connected_identifier text NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    last_seen_at timestamptz NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 3. TABELA call_sessions
CREATE TABLE IF NOT EXISTS public.call_sessions (
    call_id text PRIMARY KEY,
    business_id text NULL,
    provider text NOT NULL DEFAULT 'MEOWCALLER',
    direction text NOT NULL, -- 'INBOUND', 'OUTBOUND'
    remote_number text NOT NULL,
    status text NOT NULL DEFAULT 'INITIATED',
    voice_profile_id text NULL REFERENCES public.voice_profiles(profile_id) ON DELETE SET NULL,
    eleven_conversation_id text NULL,
    laya_trace_id text NULL,
    routed_agent_id text NULL,
    started_at timestamptz DEFAULT now(),
    answered_at timestamptz NULL,
    ended_at timestamptz NULL,
    duration_seconds integer DEFAULT 0,
    summary text NULL,
    error text NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 4. TABELA integration_events (Append-only)
CREATE TABLE IF NOT EXISTS public.integration_events (
    event_id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    provider text NOT NULL,
    business_id text NULL,
    event_type text NOT NULL,
    external_id text NULL,
    correlation_id text NULL,
    status text DEFAULT 'INFO',
    payload jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

-- 5. ATUALIZAR OU INSERIR REGISTROS CANÔNICOS EM public.integracoes
INSERT INTO public.integracoes (
    integration_id, sistema, objeto, direcao, frequencia,
    dono, status, chave_interna, chave_externa, retry_politica,
    conflict_policy, max_attempts, backoff_seconds, observacoes, scope_type
) VALUES
(
    'INT-0006',
    'Evolution API',
    'WhatsApp Mensagens (Texto, Mídia e Notificações)',
    'BIDIRECIONAL',
    'EVENTO/WEBHOOK',
    'Theo + Helena',
    'CONFIGURADA',
    'Communication_ID',
    'external_message_id',
    'Deduplicar por external_message_id e idempotency_key; retry com backoff exponencial.',
    'CONFLITO: manter idempotência, não duplicar registro em comunicacoes.',
    '5',
    '60',
    'Sessão WhatsApp dedicada a mensagens de texto, envio de notificações e triagem de atendimento.',
    'GLOBAL'
),
(
    'INT-0007',
    'Meowcaller',
    'WhatsApp Chamadas de Voz (Transporte WebRTC/VoIP)',
    'BIDIRECIONAL',
    'EVENTO/CHAMADA',
    'Theo + Helena',
    'CONFIGURADA',
    'Call_ID',
    'session_call_id',
    'Não disparar chamadas repetidas; timeout seguro e registro de call_sessions.',
    'CONFLITO: uma chamada ativa por vez por canal.',
    '3',
    '30',
    'Sessão WhatsApp independente e exclusiva para transporte de chamadas de voz e ponte com IA.',
    'GLOBAL'
),
(
    'INT-0008',
    'ElevenLabs',
    'Motor de Voz, TTS, Conversational AI & Personas',
    'BIDIRECIONAL',
    'REALTIME/WEBSOCKET',
    'Theo + Nina + Helena',
    'CONFIGURADA',
    'Voice_Profile_ID',
    'voice_id / conversation_id',
    'Signed URL temporária server-side; failover de streaming sem travar chamada.',
    'CONFLITO: usar perfis de voz canônicos por negócio.',
    '3',
    '15',
    'Infraestrutura de voz e agentes conversacionais para atendimento e vendas de alta fidelidade.',
    'GLOBAL'
),
(
    'INT-0009',
    'Laya Service',
    'Sistema 1: Classificação Rápida, Score, Roteamento & Gating',
    'SAÍDA',
    'EVENTO/REST',
    'Theo + Helena',
    'CONFIGURADA',
    'Trace_ID',
    'trace_id',
    'Inferência síncrona com fallback heurístico seguro caso o motor esteja indisponível.',
    'CONFLITO: confiança menor que threshold aciona gating de supervisão.',
    '3',
    '10',
    'Microserviço de decisão rápida (urgência, risco, churn, oportunidade) com isolamento operacional.',
    'GLOBAL'
)
ON CONFLICT (integration_id) DO UPDATE SET
    sistema = EXCLUDED.sistema,
    objeto = EXCLUDED.objeto,
    direcao = EXCLUDED.direcao,
    frequencia = EXCLUDED.frequencia,
    dono = EXCLUDED.dono,
    status = EXCLUDED.status,
    observacoes = EXCLUDED.observacoes,
    atualizado_em = now();

-- 6. HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.voice_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_events ENABLE ROW LEVEL SECURITY;

-- 7. POLÍTICAS RLS ESTRITAS
-- Revogar qualquer privilégio residual de anon
REVOKE ALL ON public.voice_profiles FROM anon;
REVOKE ALL ON public.channel_connections FROM anon;
REVOKE ALL ON public.call_sessions FROM anon;
REVOKE ALL ON public.integration_events FROM anon;

-- Conceder permissões para authenticated
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_connections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_sessions TO authenticated;
GRANT SELECT, INSERT ON public.integration_events TO authenticated;

-- Policies para voice_profiles (Founder ou acesso à empresa)
DROP POLICY IF EXISTS "voice_profiles_authenticated_select" ON public.voice_profiles;
CREATE POLICY "voice_profiles_authenticated_select" ON public.voice_profiles
    FOR SELECT TO authenticated
    USING (
        public.is_founder() OR 
        business_id IS NULL OR 
        public.user_has_business_access(business_id)
    );

DROP POLICY IF EXISTS "voice_profiles_founder_all" ON public.voice_profiles;
CREATE POLICY "voice_profiles_founder_all" ON public.voice_profiles
    FOR ALL TO authenticated
    USING (public.is_founder())
    WITH CHECK (public.is_founder());

-- Policies para channel_connections
DROP POLICY IF EXISTS "channel_connections_authenticated_select" ON public.channel_connections;
CREATE POLICY "channel_connections_authenticated_select" ON public.channel_connections
    FOR SELECT TO authenticated
    USING (
        public.is_founder() OR 
        business_id = 'GLOBAL' OR 
        public.user_has_business_access(business_id)
    );

DROP POLICY IF EXISTS "channel_connections_founder_all" ON public.channel_connections;
CREATE POLICY "channel_connections_founder_all" ON public.channel_connections
    FOR ALL TO authenticated
    USING (public.is_founder())
    WITH CHECK (public.is_founder());

-- Policies para call_sessions
DROP POLICY IF EXISTS "call_sessions_authenticated_select" ON public.call_sessions;
CREATE POLICY "call_sessions_authenticated_select" ON public.call_sessions
    FOR SELECT TO authenticated
    USING (
        public.is_founder() OR 
        business_id IS NULL OR 
        public.user_has_business_access(business_id)
    );

DROP POLICY IF EXISTS "call_sessions_founder_all" ON public.call_sessions;
CREATE POLICY "call_sessions_founder_all" ON public.call_sessions
    FOR ALL TO authenticated
    USING (public.is_founder())
    WITH CHECK (public.is_founder());

-- Policies para integration_events (Append-only / auditoria)
DROP POLICY IF EXISTS "integration_events_authenticated_select" ON public.integration_events;
CREATE POLICY "integration_events_authenticated_select" ON public.integration_events
    FOR SELECT TO authenticated
    USING (
        public.is_founder() OR 
        business_id IS NULL OR 
        business_id = 'GLOBAL' OR 
        public.user_has_business_access(business_id)
    );

DROP POLICY IF EXISTS "integration_events_authenticated_insert" ON public.integration_events;
CREATE POLICY "integration_events_authenticated_insert" ON public.integration_events
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_founder() OR 
        business_id IS NULL OR 
        business_id = 'GLOBAL' OR 
        public.user_has_business_access(business_id)
    );

-- 8. PERMISSÕES PARA service_role (Backend Facade / Gateway)
GRANT ALL ON public.voice_profiles TO service_role;
GRANT ALL ON public.channel_connections TO service_role;
GRANT ALL ON public.call_sessions TO service_role;
GRANT ALL ON public.integration_events TO service_role;
