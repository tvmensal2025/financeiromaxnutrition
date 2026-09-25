-- ======================================================================
-- MIGRATION: 20260925_03_helena_decisions_and_state.sql
-- REGISTRO CANÔNICO DAS NOVAS DECISÕES DO FUNDADOR E ATUALIZAÇÃO DO ESTADO MESTRE
-- (COMPATIBILIDADE TOTAL COM MEMORIA_MESTRE TEXT PK E ESTADO_MESTRE BIGINT PK)
-- ======================================================================

-- 1. Inserção das novas decisões executivas do fundador no ledger
-- Chave primária: decision_id (TEXT)
INSERT INTO public.decisoes (decision_id, decisao, motivo, decisor, status, data_hora, escopo, tipo)
VALUES
    ('DEC-010', 'Supabase é a fonte operacional canônica de verdade. A planilha V8 torna-se especificação histórica e referência arquitetural.', 'Necessidade de banco relacional transacional com integridade, isolamento multiempresa e RLS.', 'Fundador', 'ATIVO', NOW()::text, 'GLOBAL', 'ARQUITETURA'),
    ('DEC-011', 'Helena assume formalmente o papel de CEO Virtual / Central de Comando do ecossistema. O fundador permanece proprietário e decisor final.', 'Consolidar a direção operacional e coordenação dos especialistas em uma autoridade única de IA.', 'Fundador', 'ATIVO', NOW()::text, 'GLOBAL', 'GOVERNANCA'),
    ('DEC-012', 'Helena permanece operando pela interface do ChatGPT oficial da OpenAI.', 'Interface conversacional mais flexível para direcionamento executivo do fundador sem custos adicionais de API.', 'Fundador', 'ATIVO', NOW()::text, 'GLOBAL', 'SISTEMA'),
    ('DEC-013', 'Os 20 especialistas corporativos serão conectados gradualmente via Grok Bot.', 'Arquitetura de bots dedicados para execução técnica ponta a ponta.', 'Fundador', 'ATIVO', NOW()::text, 'GLOBAL', 'EQUIPE'),
    ('DEC-014', 'Não utilizar OpenAI API paga automática nesta fase. Fluxo de entrega: Especialista -> Supabase -> WhatsApp (Evolution) -> Fundador -> ChatGPT/Helena.', 'Controle de custos, supervisão humana e validação de qualidade passo a passo.', 'Fundador', 'ATIVO', NOW()::text, 'GLOBAL', 'OPERACAO'),
    ('DEC-015', 'Evolution API definida como o canal planejado para notificações automáticas via WhatsApp ao fundador.', 'Envio seguro de avisos de conclusão de jobs e pedidos de aprovação.', 'Fundador', 'ATIVO', NOW()::text, 'GLOBAL', 'INTEGRACAO')
ON CONFLICT (decision_id) DO UPDATE SET
    decisao = EXCLUDED.decisao,
    motivo = EXCLUDED.motivo,
    decisor = EXCLUDED.decisor,
    status = EXCLUDED.status,
    data_hora = EXCLUDED.data_hora,
    tipo = EXCLUDED.tipo;

-- 2. Registro em memoria_mestre sobre o novo papel da Helena e evolução de arquitetura
-- Gera ID de forma dinâmica com prefixo 'MEM-' caso não possua sequence no Postgres
DO $$
DECLARE
    next_mem_id TEXT;
    max_num INT;
BEGIN
    -- Obter o maior número de ID atual em memoria_mestre
    SELECT COALESCE(MAX(NULLIF(regexp_replace(id, '[^0-9]', '', 'g'), '')::integer), 0)
    INTO max_num
    FROM public.memoria_mestre;

    IF max_num < 20 THEN
        max_num := 19;
    END IF;

    -- Registro 1: Helena CEO Virtual e Supabase como Fonte Operacional
    IF NOT EXISTS (SELECT 1 FROM public.memoria_mestre WHERE assunto = 'Helena CEO Virtual e Supabase como Fonte Operacional') THEN
        max_num := max_num + 1;
        next_mem_id := 'MEM-' || LPAD(max_num::text, 4, '0');

        INSERT INTO public.memoria_mestre (id, tipo, assunto, registro, related_object_id, agente_origem, status, data_hora, scope_type)
        VALUES (
            next_mem_id,
            'DECISAO',
            'Helena CEO Virtual e Supabase como Fonte Operacional',
            'O fundador formalizou a transição do ecossistema: Supabase torna-se a fonte canônica, a planilha V8 passa a ser especificação histórica, e Helena atua como CEO Virtual.',
            'DEC-010',
            'AGT-01',
            'ATIVO',
            NOW()::text,
            'GLOBAL'
        );
    END IF;

    -- Registro 2: Estratégia dos 20 Especialistas e Grok Bot
    IF NOT EXISTS (SELECT 1 FROM public.memoria_mestre WHERE assunto = 'Estratégia dos 20 Especialistas e Grok Bot') THEN
        max_num := max_num + 1;
        next_mem_id := 'MEM-' || LPAD(max_num::text, 4, '0');

        INSERT INTO public.memoria_mestre (id, tipo, assunto, registro, related_object_id, agente_origem, status, data_hora, scope_type)
        VALUES (
            next_mem_id,
            'ARQUITETURA',
            'Estratégia dos 20 Especialistas e Grok Bot',
            'Os 20 especialistas corporativos ficam em estado planejado (PLANNED) até a criação dos bots no Grok. A comunicação será notificada via Evolution API.',
            'DEC-013',
            'AGT-01',
            'ATIVO',
            NOW()::text,
            'GLOBAL'
        );
    END IF;
END $$;

-- 3. Atualização do estado_mestre com o estado consolidado
-- Compatível tanto com BIGINT gerado por identity/sequence quanto com BIGINT manual
DO $$
DECLARE
    next_reg_id BIGINT;
    has_identity BOOLEAN;
BEGIN
    SELECT (column_default IS NOT NULL OR is_identity = 'YES')
    INTO has_identity
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'estado_mestre' AND column_name = 'registro_id';

    SELECT COALESCE(MAX(registro_id), 0) INTO next_reg_id FROM public.estado_mestre;

    -- Item 1: Fonte Canônica de Verdade
    IF EXISTS (SELECT 1 FROM public.estado_mestre WHERE item = 'Fonte Canônica de Verdade') THEN
        UPDATE public.estado_mestre 
        SET estado_atual = 'Supabase Operacional (wxkgrykduqtsgmjkzlou). Planilha V8 como referência histórica.',
            ultima_mudanca = NOW()::text,
            fonte = 'Fundador & Helena',
            confirmacao = 'CONFIRMADO',
            proxima_acao = 'Consolidação de RLS e queries por escopo',
            responsavel = 'Helena (CEO Virtual)'
        WHERE item = 'Fonte Canônica de Verdade';
    ELSE
        IF has_identity IS TRUE THEN
            INSERT INTO public.estado_mestre (area, item, estado_atual, ultima_mudanca, fonte, confirmacao, proxima_acao, responsavel, scope_type)
            VALUES ('Sistema', 'Fonte Canônica de Verdade', 'Supabase Operacional (wxkgrykduqtsgmjkzlou). Planilha V8 como referência histórica.', NOW()::text, 'Fundador & Helena', 'CONFIRMADO', 'Consolidação de RLS e queries por escopo', 'Helena (CEO Virtual)', 'GLOBAL');
        ELSE
            next_reg_id := next_reg_id + 1;
            INSERT INTO public.estado_mestre (registro_id, area, item, estado_atual, ultima_mudanca, fonte, confirmacao, proxima_acao, responsavel, scope_type)
            VALUES (next_reg_id, 'Sistema', 'Fonte Canônica de Verdade', 'Supabase Operacional (wxkgrykduqtsgmjkzlou). Planilha V8 como referência histórica.', NOW()::text, 'Fundador & Helena', 'CONFIRMADO', 'Consolidação de RLS e queries por escopo', 'Helena (CEO Virtual)', 'GLOBAL');
        END IF;
    END IF;

    -- Item 2: Papel da Helena
    IF EXISTS (SELECT 1 FROM public.estado_mestre WHERE item = 'Papel da Helena') THEN
        UPDATE public.estado_mestre 
        SET estado_atual = 'CEO Virtual / Central de Comando. Fundador como autoridade superior.',
            ultima_mudanca = NOW()::text,
            fonte = 'Fundador',
            confirmacao = 'CONFIRMADO',
            proxima_acao = 'Orquestração executiva das 3 unidades de negócio',
            responsavel = 'Helena (CEO Virtual)'
        WHERE item = 'Papel da Helena';
    ELSE
        IF has_identity IS TRUE THEN
            INSERT INTO public.estado_mestre (area, item, estado_atual, ultima_mudanca, fonte, confirmacao, proxima_acao, responsavel, scope_type)
            VALUES ('Comando', 'Papel da Helena', 'CEO Virtual / Central de Comando. Fundador como autoridade superior.', NOW()::text, 'Fundador', 'CONFIRMADO', 'Orquestração executiva das 3 unidades de negócio', 'Helena (CEO Virtual)', 'GLOBAL');
        ELSE
            next_reg_id := next_reg_id + 1;
            INSERT INTO public.estado_mestre (registro_id, area, item, estado_atual, ultima_mudanca, fonte, confirmacao, proxima_acao, responsavel, scope_type)
            VALUES (next_reg_id, 'Comando', 'Papel da Helena', 'CEO Virtual / Central de Comando. Fundador como autoridade superior.', NOW()::text, 'Fundador', 'CONFIRMADO', 'Orquestração executiva das 3 unidades de negócio', 'Helena (CEO Virtual)', 'GLOBAL');
        END IF;
    END IF;

    -- Item 3: Foco Executivo Atual
    IF EXISTS (SELECT 1 FROM public.estado_mestre WHERE item = 'Foco Executivo Atual') THEN
        UPDATE public.estado_mestre 
        SET estado_atual = 'FOC-004: Homologação técnica do Sistema Helena (EM EXECUÇÃO). Caixa (FOC-002) permanece planejado.',
            ultima_mudanca = NOW()::text,
            fonte = 'Helena',
            confirmacao = 'CONFIRMADO',
            proxima_acao = 'Finalização da homologação do app e migrations',
            responsavel = 'Helena & Engenharia'
        WHERE item = 'Foco Executivo Atual';
    ELSE
        IF has_identity IS TRUE THEN
            INSERT INTO public.estado_mestre (area, item, estado_atual, ultima_mudanca, fonte, confirmacao, proxima_acao, responsavel, scope_type)
            VALUES ('Foco', 'Foco Executivo Atual', 'FOC-004: Homologação técnica do Sistema Helena (EM EXECUÇÃO). Caixa (FOC-002) permanece planejado.', NOW()::text, 'Helena', 'CONFIRMADO', 'Finalização da homologação do app e migrations', 'Helena & Engenharia', 'GLOBAL');
        ELSE
            next_reg_id := next_reg_id + 1;
            INSERT INTO public.estado_mestre (registro_id, area, item, estado_atual, ultima_mudanca, fonte, confirmacao, proxima_acao, responsavel, scope_type)
            VALUES (next_reg_id, 'Foco', 'Foco Executivo Atual', 'FOC-004: Homologação técnica do Sistema Helena (EM EXECUÇÃO). Caixa (FOC-002) permanece planejado.', NOW()::text, 'Helena', 'CONFIRMADO', 'Finalização da homologação do app e migrations', 'Helena & Engenharia', 'GLOBAL');
        END IF;
    END IF;

    -- Item 4: Equipe de 20 Especialistas
    IF EXISTS (SELECT 1 FROM public.estado_mestre WHERE item = 'Equipe de 20 Especialistas') THEN
        UPDATE public.estado_mestre 
        SET estado_atual = '21 funções cadastradas. Helena conectada no ChatGPT. 20 especialistas em estado PLANEJADO no Grok.',
            ultima_mudanca = NOW()::text,
            fonte = 'Helena',
            confirmacao = 'CONFIRMADO',
            proxima_acao = 'Configuração gradual dos agentes externos',
            responsavel = 'Helena & Fundador'
        WHERE item = 'Equipe de 20 Especialistas';
    ELSE
        IF has_identity IS TRUE THEN
            INSERT INTO public.estado_mestre (area, item, estado_atual, ultima_mudanca, fonte, confirmacao, proxima_acao, responsavel, scope_type)
            VALUES ('Equipe', 'Equipe de 20 Especialistas', '21 funções cadastradas. Helena conectada no ChatGPT. 20 especialistas em estado PLANEJADO no Grok.', NOW()::text, 'Helena', 'CONFIRMADO', 'Configuração gradual dos agentes externos', 'Helena & Fundador', 'GLOBAL');
        ELSE
            next_reg_id := next_reg_id + 1;
            INSERT INTO public.estado_mestre (registro_id, area, item, estado_atual, ultima_mudanca, fonte, confirmacao, proxima_acao, responsavel, scope_type)
            VALUES (next_reg_id, 'Equipe', 'Equipe de 20 Especialistas', '21 funções cadastradas. Helena conectada no ChatGPT. 20 especialistas em estado PLANEJADO no Grok.', NOW()::text, 'Helena', 'CONFIRMADO', 'Configuração gradual dos agentes externos', 'Helena & Fundador', 'GLOBAL');
        END IF;
    END IF;
END $$;
