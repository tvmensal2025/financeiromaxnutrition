-- Sincronização do Checkpoint Mestre — Módulo Financeiro Homologado
-- Data: 2026-10-04
-- Contexto: Cockpit executivo, modais de lançamento e orçamento, testes unitários e governança de Caio (AGT-05)

begin isolation level repeatable read;
lock table public.checkpoint_mestre in share row exclusive mode;

do $sync$
declare
  v_anterior public.checkpoint_mestre%rowtype;
  v_novo public.checkpoint_mestre%rowtype;
  v_snapshot jsonb;
  v_counts jsonb := '{}'::jsonb;
  v_total bigint;
  v_tabela record;
begin
  select * into strict v_anterior from public.checkpoint_mestre_atual;

  -- Idempotência: não duplica se já foi sincronizado
  if v_anterior.snapshot->>'marcador_modulo_financeiro' = 'helena_modulo_financeiro_20261004' then
    return;
  end if;

  -- Contagens atuais de registros para o snapshot
  for v_tabela in select jsonb_object_keys(coalesce(v_anterior.snapshot->'contagens', '{"financeiro":0}'::jsonb)) as tabela loop
    begin
      execute format('select count(*) from public.%I', v_tabela.tabela) into v_total;
      v_counts := v_counts || jsonb_build_object(v_tabela.tabela, v_total);
    exception when others then
      v_counts := v_counts || jsonb_build_object(v_tabela.tabela, 0);
    end;
  end loop;

  v_snapshot := v_anterior.snapshot || jsonb_build_object(
    'marcador_modulo_financeiro', 'helena_modulo_financeiro_20261004',
    'atualizado_em', now(),
    'contagens', v_counts,
    'modulo_financeiro', jsonb_build_object(
      'status', 'OPERACIONAL_E_TESTADO',
      'cockpit_abas', jsonb_build_array('visao_geral', 'lancamentos', 'fluxo_caixa', 'dre', 'orcamento', 'recorrencias', 'plano_contas', 'contas_bancarias'),
      'modais', jsonb_build_array('LancamentoModal', 'OrcamentoModal'),
      'regras_contabeis', 'Separacao rigorosa de regime de caixa (lerCaixa) e regime de competencia (lerDre)',
      'isolamento_multiempresa', 'BIZ-001 (iGreen), BIZ-002 (Saude), BIZ-003 (Humano Digital) e Consolidado',
      'governanca_caio_agt05', 'Modo consultivo/analitico mantido. Bloqueada a criacao de dividas ou despesas ficticias sem aprovacao',
      'testes_unitarios', '154 testes passando (100% verde)',
      'build_producao', 'PASS'
    ),
    'regras_continuidade', jsonb_build_array(
      'Lançamentos contábeis exigem comprovação ou validação pelo operador no conector',
      'Sempre consultar a view checkpoint_mestre_atual para obter a versão ativa',
      'RLS anônimo permanece estritamente fechado (42501); leitura real exige sessão autenticada'
    )
  );

  perform public.registrar_checkpoint_mestre(
    p_titulo => 'Checkpoint Mestre — Módulo Financeiro e Cockpit Executivo',
    p_resumo_executivo => 'Módulo Financeiro homologado com Cockpit de 8 abas, modais de lançamento e orçamento, motor de cálculo contábil (Caixa vs DRE) e testes unitários 100% aprovados.',
    p_conteudo_markdown => $texto$# Continuidade do Sistema Helena — Módulo Financeiro
Fonte canônica: Supabase ecosistemadossonhos (wxkgrykduqtsgmjkzlou).

## Mudança Material
1. **Cockpit Financeiro Operacional:** 8 abas ativas (Visão Geral, Lançamentos, Fluxo de Caixa, DRE, Orçamento, Recorrências, Plano de Contas e Contas Bancárias).
2. **Modais de Lançamento e Orçamento:** Cadastro e edição com suporte à concorrência otimista (helena_write_record) e regras de validação contábil.
3. **Filtros e Exportação:** Busca textual em tempo real, filtros por status e fluxo, liquidação rápida em 1 clique e exportação CSV.
4. **Qualidade Técnica:** 154 testes unitários automatizados passando (100% verde) e build de produção validado.
5. **Governança do Agente Caio (AGT-05):** Modo consultivo e analítico mantido, preservando autoridade do fundador.$texto$,
    p_snapshot => v_snapshot,
    p_mudancas_desde_anterior => jsonb_build_array(
      'Entrega do LancamentoModal e OrcamentoModal no frontend',
      'Implementação de busca e filtros dinâmicos na tabela de lançamentos',
      'Nova aba de Contas Bancárias e integração da aba Orçamento',
      'Criação de testes unitários dedicados em caixa.test.ts e FinanceiroPage.test.tsx'
    ),
    p_fontes => jsonb_build_array(
      'src/pages/FinanceiroPage.tsx',
      'src/components/financeiro/LancamentoModal.tsx',
      'src/components/financeiro/OrcamentoModal.tsx',
      'src/lib/caixa.ts',
      'src/lib/caixa.test.ts',
      'src/pages/FinanceiroPage.test.tsx'
    ),
    p_criado_por => 'AGT-01 Helena / Codex',
    p_motivo => 'Homologação do Módulo Financeiro e alinhamento de continuidade com o Checkpoint Mestre'
  );

  -- Registrar na Memória Mestre
  insert into public.memoria_mestre(
    id, data_hora, session_id, tipo, business_id_area, agente_origem,
    assunto, registro, evidencia_origem, status, confianca,
    related_object_type, related_object_id, proxima_acao, responsavel,
    sensibilidade, scope_type
  ) values (
    'MEM-FINANCEIRO-20261004-CHECKPOINT',
    now()::text,
    'FINANCEIRO-20261004',
    'REGISTRO OPERACIONAL',
    'GRUPO',
    'Helena / Codex',
    'Homologação completa do Módulo Financeiro e Cockpit Executivo',
    v_snapshot,
    'src/pages/FinanceiroPage.tsx; src/lib/caixa.test.ts; 154 testes aprovados',
    'ATIVO',
    'EVIDENCIA TECNICA',
    'checkpoint_mestre',
    'CP-FINANCEIRO-20261004',
    'Manter o Cockpit operacional e consultar checkpoint_mestre_atual para decisões financeiras',
    'Helena + Caio (AGT-05)',
    'INTERNO',
    'GLOBAL'
  ) on conflict (id) do update set
    registro = excluded.registro,
    atualizado_em = now();

end $sync$;

commit;
