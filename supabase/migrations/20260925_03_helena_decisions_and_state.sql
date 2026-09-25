-- ======================================================================
-- MIGRATION: 20260925_03_helena_decisions_and_state.sql
-- REGISTRO CANÔNICO DAS NOVAS DECISÕES DO FUNDADOR E ATUALIZAÇÃO DO ESTADO MESTRE
-- (TOTALMENTE COMPATÍVEL COM PKs BIGINT/SERIAL EM ESTADO E MEMÓRIA)
-- ======================================================================

-- 1. Inserção das novas decisões executivas do fundador (preservando o ledger histórico)
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
-- Omite a coluna id para permitir que o Postgres gere via sequência (BIGINT/IDENTITY)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.memoria_mestre WHERE assunto = 'Helena CEO Virtual e Supabase como Fonte Operacional') THEN
        INSERT INTO public.memoria_mestre (tipo, assunto, registro, related_object_id, agente_origem, status, data_hora)
        VALUES ('DECISAO', 'Helena CEO Virtual e Supabase como Fonte Operacional', 'O fundador formalizou a transição do ecossistema: Supabase torna-se a fonte canônica, a planilha V8 passa a ser especificação histórica, e Helena atua como CEO Virtual.', 'DEC-010', 'AGT-01', 'ATIVO', NOW()::text);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.memoria_mestre WHERE assunto = 'Estratégia dos 20 Especialistas e Grok Bot') THEN
        INSERT INTO public.memoria_mestre (tipo, assunto, registro, related_object_id, agente_origem, status, data_hora)
        VALUES ('ARQUITETURA', 'Estratégia dos 20 Especialistas e Grok Bot', 'Os 20 especialistas corporativos ficam em estado planejado (PLANNED) até a criação dos bots no Grok. A comunicação será notificada via Evolution API.', 'DEC-013', 'AGT-01', 'ATIVO', NOW()::text);
    END IF;
END $$;

-- 3. Atualização do estado_mestre com o estado consolidado
-- Omite registro_id (BIGINT gerado pelo banco) e atualiza por 'item' de forma idempotente
DO $$
BEGIN
    -- Item 1: Fonte Canônica
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
        INSERT INTO public.estado_mestre (area, item, estado_atual, ultima_mudanca, fonte, confirmacao, proxima_acao, responsavel)
        VALUES ('Sistema', 'Fonte Canônica de Verdade', 'Supabase Operacional (wxkgrykduqtsgmjkzlou). Planilha V8 como referência histórica.', NOW()::text, 'Fundador & Helena', 'CONFIRMADO', 'Consolidação de RLS e queries por escopo', 'Helena (CEO Virtual)');
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
        INSERT INTO public.estado_mestre (area, item, estado_atual, ultima_mudanca, fonte, confirmacao, proxima_acao, responsavel)
        VALUES ('Comando', 'Papel da Helena', 'CEO Virtual / Central de Comando. Fundador como autoridade superior.', NOW()::text, 'Fundador', 'CONFIRMADO', 'Orquestração executiva das 3 unidades de negócio', 'Helena (CEO Virtual)');
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
        INSERT INTO public.estado_mestre (area, item, estado_atual, ultima_mudanca, fonte, confirmacao, proxima_acao, responsavel)
        VALUES ('Foco', 'Foco Executivo Atual', 'FOC-004: Homologação técnica do Sistema Helena (EM EXECUÇÃO). Caixa (FOC-002) permanece planejado.', NOW()::text, 'Helena', 'CONFIRMADO', 'Finalização da homologação do app e migrations', 'Helena & Engenharia');
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
        INSERT INTO public.estado_mestre (area, item, estado_atual, ultima_mudanca, fonte, confirmacao, proxima_acao, responsavel)
        VALUES ('Equipe', 'Equipe de 20 Especialistas', '21 funções cadastradas. Helena conectada no ChatGPT. 20 especialistas em estado PLANEJADO no Grok.', NOW()::text, 'Helena', 'CONFIRMADO', 'Configuração gradual dos agentes externos', 'Helena & Fundador');
    END IF;
END $$;
