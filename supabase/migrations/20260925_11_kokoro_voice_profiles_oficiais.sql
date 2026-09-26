-- ======================================================================
-- MIGRATION: 20260925_11_kokoro_voice_profiles_oficiais.sql
-- SISTEMA HELENA — Registro Canônico Kokoro Neural TTS e Perfis de Voz
-- Homologação das vozes dos Assistentes e Pedro (Voz Jovem / Parcerias)
-- Kokoro TTS promovido a MOTOR OFICIAL; ElevenLabs colocado em STANDBY
-- ======================================================================

-- 1. PROMOVER KOKORO TTS A MOTOR OFICIAL (INT-0010)
INSERT INTO public.integracoes (
    integration_id,
    sistema,
    objeto,
    direcao,
    chave_interna,
    chave_externa,
    frequencia,
    dono,
    status,
    retry_politica,
    observacoes,
    conflict_policy,
    max_attempts,
    backoff_seconds,
    scope_type
) VALUES (
    'INT-0010',
    'Kokoro TTS VPS',
    'Síntese de Voz Neural (Open-Source)',
    'SAÍDA',
    'Voice_Profile_ID',
    'voice_id',
    'EVENTO/ON DEMAND',
    'Theo + Helena',
    'OFICIAL',
    'Fallback local se VPS oscilar',
    'Motor OFICIAL de síntese neural de voz do Sistema Helena para Meowcaller (ligações), WhatsApp (áudios) e agentes. Instância VPS: https://helena-automation-kokoro.d9v63q.easypanel.host/. Modelo model.',
    'CONFLITO: usar perfis de voz canônicos',
    '3',
    '10',
    'GLOBAL'
) ON CONFLICT (integration_id) DO UPDATE SET
    status = 'OFICIAL',
    observacoes = EXCLUDED.observacoes,
    atualizado_em = now();

-- 2. REBAIXAR ELEVENLABS PARA STANDBY (INT-0008)
UPDATE public.integracoes
SET 
    status = 'STANDBY',
    observacoes = 'Substituído pelo Kokoro TTS VPS como motor oficial do sistema. Mantido apenas como reserva.',
    atualizado_em = now()
WHERE integration_id = 'INT-0008';

-- 3. RESETAR DEFAULT EM TODOS OS PERFIS EXISTENTES
UPDATE public.voice_profiles
SET is_default = false, updated_at = now();

-- 4. REGISTRO DOS PERFIS CANÔNICOS DE VOZ NO KOKORO (public.voice_profiles)
-- Assistente da Sirlene (Mulher - Padrão Vital)
INSERT INTO public.voice_profiles (
    profile_id,
    nome,
    business_id,
    provider,
    voice_id,
    language,
    first_message,
    settings,
    enabled,
    is_default
) VALUES (
    'VP-KOKORO-FEM-01',
    'Assistente da Sirlene',
    'BIZ-001',
    'KOKORO',
    'pf_dora*0.7+af_heart*0.3',
    'pt-BR',
    'Olá! Eu sou a assistente da Sirlene.',
    jsonb_build_object(
        'gender', 'female',
        'style', 'vital_standard_heart',
        'model', 'model',
        'baseUrl', 'https://helena-automation-kokoro.d9v63q.easypanel.host'
    ),
    true,
    false
) ON CONFLICT (profile_id) DO UPDATE SET
    voice_id = EXCLUDED.voice_id,
    settings = EXCLUDED.settings,
    enabled = EXCLUDED.enabled,
    is_default = false,
    updated_at = now();

-- Assistente do Dr. Vital (Homem - Padrão Vital Maduro)
INSERT INTO public.voice_profiles (
    profile_id,
    nome,
    business_id,
    provider,
    voice_id,
    language,
    first_message,
    settings,
    enabled,
    is_default
) VALUES (
    'VP-KOKORO-MASC-01',
    'Assistente do Dr. Vital',
    'BIZ-001',
    'KOKORO',
    'pm_santa',
    'pt-BR',
    'Olá a todos! Eu sou o assistente do Dr. Vital.',
    jsonb_build_object(
        'gender', 'male',
        'style', 'vital_standard_santa',
        'model', 'model',
        'baseUrl', 'https://helena-automation-kokoro.d9v63q.easypanel.host'
    ),
    true,
    false
) ON CONFLICT (profile_id) DO UPDATE SET
    voice_id = EXCLUDED.voice_id,
    settings = EXCLUDED.settings,
    enabled = EXCLUDED.enabled,
    is_default = false,
    updated_at = now();

-- Alex (Assistente Executivo - Central de Suporte)
INSERT INTO public.voice_profiles (
    profile_id,
    nome,
    business_id,
    provider,
    voice_id,
    language,
    first_message,
    settings,
    enabled,
    is_default
) VALUES (
    'VP-KOKORO-MASC-02',
    'Alex (Assistente Executivo)',
    'BIZ-001',
    'KOKORO',
    'pm_santa*0.7+pm_alex*0.3',
    'pt-BR',
    'Olá! Eu sou o Alex, assistente da central de atendimento.',
    jsonb_build_object(
        'gender', 'male',
        'style', 'vital_standard_alex',
        'model', 'model',
        'baseUrl', 'https://helena-automation-kokoro.d9v63q.easypanel.host'
    ),
    true,
    false
) ON CONFLICT (profile_id) DO UPDATE SET
    voice_id = EXCLUDED.voice_id,
    settings = EXCLUDED.settings,
    enabled = EXCLUDED.enabled,
    is_default = false,
    updated_at = now();

-- Pedro (AGT-18: Homem Jovem - Parcerias & Novos Negócios)
-- HOMOLOGADO COMO VOZ OFICIAL PADRÃO DO SISTEMA HELENA
INSERT INTO public.voice_profiles (
    profile_id,
    nome,
    business_id,
    provider,
    voice_id,
    language,
    first_message,
    settings,
    enabled,
    is_default
) VALUES (
    'VP-KOKORO-MASC-03',
    'Pedro (Voz Jovem - Parcerias)',
    'BIZ-001',
    'KOKORO',
    'pm_alex*0.7+am_liam*0.3',
    'pt-BR',
    'Olá a todos! Eu sou o Pedro.',
    jsonb_build_object(
        'gender', 'male',
        'style', 'youthful_liam_blend',
        'model', 'model',
        'agent_id', 'AGT-18',
        'blend_details', 'pm_alex*0.7 + am_liam*0.3',
        'baseUrl', 'https://helena-automation-kokoro.d9v63q.easypanel.host'
    ),
    true,
    true
) ON CONFLICT (profile_id) DO UPDATE SET
    voice_id = EXCLUDED.voice_id,
    settings = EXCLUDED.settings,
    enabled = EXCLUDED.enabled,
    is_default = true,
    updated_at = now();
