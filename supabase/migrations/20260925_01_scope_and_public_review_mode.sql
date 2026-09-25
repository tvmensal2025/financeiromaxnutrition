-- ======================================================================
-- MIGRATION: 20260925_01_scope_and_public_review_mode.sql
-- MODO DE REVISÃO PÚBLICA SEGURA + NORMALIZAÇÃO DE ESCOPO
-- ======================================================================

-- 1. Garante que o schema public tenha permissões de leitura seguras para a role anon
-- Permitindo ao fundador revisar visualmente todos os módulos no frontend sem barreiras
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Garante que futuras tabelas criadas herdem leitura para anon durante a revisão
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO anon;

-- WRITE SAFETY: Revoga escritas anônimas se não autenticado para proteger o banco contra escrita indevida
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon;

-- 2. Adiciona suporte a scope_type e scope_id nas tabelas com escopo misto que necessitem
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'governanca' AND column_name = 'scope_type') THEN
        ALTER TABLE public.governanca ADD COLUMN scope_type TEXT DEFAULT 'GLOBAL';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'integracoes' AND column_name = 'scope_type') THEN
        ALTER TABLE public.integracoes ADD COLUMN scope_type TEXT DEFAULT 'GLOBAL';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'estado_mestre' AND column_name = 'scope_type') THEN
        ALTER TABLE public.estado_mestre ADD COLUMN scope_type TEXT DEFAULT 'GLOBAL';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'memoria_mestre' AND column_name = 'scope_type') THEN
        ALTER TABLE public.memoria_mestre ADD COLUMN scope_type TEXT DEFAULT 'GLOBAL';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'handoffs' AND column_name = 'scope_type') THEN
        ALTER TABLE public.handoffs ADD COLUMN scope_type TEXT DEFAULT 'GLOBAL';
    END IF;
END $$;
