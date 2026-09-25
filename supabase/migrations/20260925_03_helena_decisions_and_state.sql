-- ======================================================================
-- MIGRATION: 20260925_03_helena_decisions_and_state.sql
-- REGISTRO CANÔNICO DAS NOVAS DECISÕES DO FUNDADOR E ATUALIZAÇÃO DO ESTADO MESTRE
-- ======================================================================

-- 1. Inserção das novas decisões executivas do fundador (preservando o ledger histórico)
INSERT INTO public.decisoes (decisao_id, decisao, motivo, decisor, status, data_decisao, escopo)
VALUES
    ('DEC-010', 'Supabase é a fonte operacional canônica de verdade. A planilha V8 torna-se especificação histórica e referência arquitetural.', 'Necessidade de banco relacional transacional com integridade, isolamento multiempresa e RLS.', 'Fundador', 'ATIVO', '2026-09-24', 'GLOBAL'),
    ('DEC-011', 'Helena assume formalmente o papel de CEO Virtual / Central de Comando do ecossistema. O fundador permanece proprietário e decisor final.', 'Consolidar a direção operacional e coordenação dos especialistas em uma autoridade única de IA.', 'Fundador', 'ATIVO', '2026-09-24', 'GLOBAL'),
    ('DEC-012', 'Helena permanece operando pela interface do ChatGPT oficial da OpenAI.', 'Interface conversacional mais flexível para direcionamento executivo do fundador sem custos adicionais de API.', 'Fundador', 'ATIVO', '2026-09-24', 'GLOBAL'),
    ('DEC-013', 'Os 20 especialistas corporativos serão conectados gradualmente via Grok Bot.', 'Arquitetura de bots dedicados para execução técnica ponta a ponta.', 'Fundador', 'ATIVO', '2026-09-24', 'GLOBAL'),
    ('DEC-014', 'Não utilizar OpenAI API paga automática nesta fase. Fluxo de entrega: Especialista -> Supabase -> WhatsApp (Evolution) -> Fundador -> ChatGPT/Helena.', 'Controle de custos, supervisão humana e validação de qualidade passo a passo.', 'Fundador', 'ATIVO', '2026-09-24', 'GLOBAL'),
    ('DEC-015', 'Evolution API definida como o canal planejado para notificações automáticas via WhatsApp ao fundador.', 'Envio seguro de avisos de conclusão de jobs e pedidos de aprovação.', 'Fundador', 'ATIVO', '2026-09-24', 'GLOBAL')
ON CONFLICT (decisao_id) DO UPDATE SET
    decisao = EXCLUDED.decisao,
    motivo = EXCLUDED.motivo,
    decisor = EXCLUDED.decisor,
    status = EXCLUDED.status,
    data_decisao = EXCLUDED.data_decisao;

-- 2. Registro em memoria_mestre sobre o novo papel da Helena e evolução de arquitetura
INSERT INTO public.memoria_mestre (memoria_id, tipo, assunto, contexto, decisao_relacionada, agente_origem, status_validade)
VALUES
    ('MEM-020', 'DECISAO', 'Helena CEO Virtual e Supabase como Fonte Operacional', 'O fundador formalizou a transição do ecossistema: Supabase torna-se a fonte canônica, a planilha V8 passa a ser especificação histórica, e Helena atua como CEO Virtual.', 'DEC-010', 'AGT-01', 'ATIVO'),
    ('MEM-021', 'ARQUITETURA', 'Estratégia dos 20 Especialistas e Grok Bot', 'Os 20 especialistas corporativos ficam em estado planejado (PLANNED) até a criação dos bots no Grok. A comunicação será notificada via Evolution API.', 'DEC-013', 'AGT-01', 'ATIVO')
ON CONFLICT (memoria_id) DO NOTHING;

-- 3. Atualização do estado_mestre com o estado consolidado
INSERT INTO public.estado_mestre (item, area, estado_atual, ultima_mudanca, fonte, confirmacao, proxima_acao, responsavel)
VALUES
    ('Fonte Canônica de Verdade', 'Sistema', 'Supabase Operacional (wxkgrykduqtsgmjkzlou). Planilha V8 como referência histórica.', NOW()::text, 'Fundador & Helena', 'CONFIRMADO', 'Consolidação de RLS e queries por escopo', 'Helena (CEO Virtual)'),
    ('Papel da Helena', 'Comando', 'CEO Virtual / Central de Comando. Fundador como autoridade superior.', NOW()::text, 'Fundador', 'CONFIRMADO', 'Orquestração executiva das 3 unidades de negócio', 'Helena (CEO Virtual)'),
    ('Foco Executivo Atual', 'Foco', 'FOC-004: Homologação técnica do Sistema Helena (EM EXECUÇÃO). Caixa (FOC-002) permanece planejado.', NOW()::text, 'Helena', 'CONFIRMADO', 'Finalização da homologação do app e migrations', 'Helena & Engenharia'),
    ('Equipe de 20 Especialistas', 'Equipe', '21 funções cadastradas. Helena conectada no ChatGPT. 20 especialistas em estado PLANEJADO no Grok.', NOW()::text, 'Helena', 'CONFIRMADO', 'Configuração gradual dos agentes externos', 'Helena & Fundador')
ON CONFLICT (item) DO UPDATE SET
    estado_atual = EXCLUDED.estado_atual,
    ultima_mudanca = EXCLUDED.ultima_mudanca,
    confirmacao = EXCLUDED.confirmacao,
    proxima_acao = EXCLUDED.proxima_acao,
    responsavel = EXCLUDED.responsavel;
