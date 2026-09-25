-- ======================================================================
-- MIGRATION: 20260925_06_reconciliar_estado_mestre.sql
-- RECONCILIAÇÃO DO ESTADO MESTRE: ESTADO ATUAL COERENTE COM AS DECISÕES
-- ======================================================================

-- 1. Atualização do item 'Versão' (Área Sistema): Coerente com o estado atual da homologação
UPDATE public.estado_mestre
SET estado_atual = 'Sistema Helena v8.0 homologado para Supabase Operacional. Aplicação web com multiempresa e RLS blindado.',
    ultima_mudanca = NOW()::text,
    fonte = 'Fundador & Helena',
    confirmacao = 'CONFIRMADO',
    proxima_acao = 'Auditoria final pós-deploy e transição para FOC-002 Caixa',
    responsavel = 'Helena (CEO Virtual)'
WHERE item = 'Versão' OR area = 'Sistema';

-- 2. Atualização do item 'Plano futuro' (Área Integrações):
-- REMOVE referência a "manter a planilha como memória consolidada"
UPDATE public.estado_mestre
SET estado_atual = 'Supabase é a fonte operacional canônica. Planilha V8 é referência histórica. Integrações externas planejadas e conectadas conforme status real (Evolution API, Supabase, Grok Bot e ChatGPT).',
    ultima_mudanca = NOW()::text,
    fonte = 'Fundador & Helena',
    confirmacao = 'CONFIRMADO',
    proxima_acao = 'Configuração gradual de webhooks e bots no Grok',
    responsavel = 'Theo (Tecnologia & IA) & Helena'
WHERE item = 'Plano futuro' OR (item ILIKE '%plano%' AND area ILIKE '%integra%');

-- 3. Atualização do item 'Equipe de 20 Especialistas' (ou Agentes):
-- Reflete: Helena = CEO Virtual no ChatGPT. 20 especialistas = PLANNED no Grok.
UPDATE public.estado_mestre
SET estado_atual = 'Helena atua como CEO Virtual no ChatGPT. Os 20 especialistas corporativos estão definidos com status canônico PLANNED para ativação no Grok.',
    ultima_mudanca = NOW()::text,
    fonte = 'Fundador & Helena',
    confirmacao = 'CONFIRMADO',
    proxima_acao = 'Ativação técnica dos bots no Grok',
    responsavel = 'Helena & Theo'
WHERE item = 'Equipe de 20 Especialistas' OR item ILIKE '%especialistas%';

-- 4. Atualização do item 'Frente atual':
-- Reflete FOC-004 em execução e FOC-002 planejado
UPDATE public.estado_mestre
SET estado_atual = 'FOC-004: Homologação técnica do Sistema Helena (EM EXECUÇÃO). Caixa (FOC-002) permanece como próxima prioridade (PLANEJADO).',
    ultima_mudanca = NOW()::text,
    fonte = 'Fundador & Helena',
    confirmacao = 'CONFIRMADO',
    proxima_acao = 'Auditoria final da Helena e transição para FOC-002',
    responsavel = 'Helena (CEO Virtual)'
WHERE item = 'Frente atual';

-- 5. Atualização do item 'Fonte Canônica de Verdade':
-- Reflete Supabase como fonte canônica operacional e Planilha V8 como referência histórica
UPDATE public.estado_mestre
SET estado_atual = 'Supabase Operacional (wxkgrykduqtsgmjkzlou). Planilha V8 como referência histórica.',
    ultima_mudanca = NOW()::text,
    fonte = 'Fundador & Helena',
    confirmacao = 'CONFIRMADO',
    proxima_acao = 'Operação contínua no Supabase',
    responsavel = 'Helena (CEO Virtual)'
WHERE item = 'Fonte Canônica de Verdade';
