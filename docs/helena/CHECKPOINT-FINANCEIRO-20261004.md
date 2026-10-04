# CHECKPOINT MESTRE — MÓDULO FINANCEIRO HELENA-HUB
**Data de Registro:** 04/10/2026  
**Repositório:** `tvmensal2025/financeiromaxnutrition`  
**Escopo:** Gestão Financeira, Cockpit Executivo, Regime de Caixa e Competência, Orçamento e Contas  
**Status de Homologação Local:** 100% Aprovado (154 testes passando, build de produção validado)

---

## 1. RESUMO EXECUTIVO PARA A HELENA
O **Módulo Financeiro** do Helena-HUB foi elevado do estágio analítico estático para um **Cockpit Financeiro Operacional Completo**. 

Agora o fundador e a governança executiva têm visibilidade e capacidade operacional em tempo real de:
1. **Regime de Caixa vs. Competência:** Separação contábil rigorosa entre dinheiro efetivamente liquidado e apuração econômica por competência contábil (DRE).
2. **Multiempresa Ativa:** Isolamento estrito por negócio (`BIZ-001` iGreen Energy, `BIZ-002` Ecossistema de Saúde, `BIZ-003` Humano Digital) ou Visão Consolidada do Grupo.
3. **Novo Lançamento & Edição:** Modal executivo com validação contábil (números positivos no `valor_original`, sentido no `fluxo`, concorrência otimista via `escreverRegistro`).
4. **Planejamento Orçamentário:** Metas e tetos de gastos por centro de custo com cálculo automático de desvio e barras visuais de realização.
5. **Contas Financeiras:** Visibilidade de carteiras, contas bancárias e gateways cadastrados.
6. **Exportação & Agilidade:** Exportação instantânea de lançamentos para CSV e liquidação rápida com 1 clique para títulos pendentes.

---

## 2. ARQUITETURA DE TELAS E COMPONENTES
- **Página Central:** [FinanceiroPage.tsx](file:///c:/Users/plata/financeiromaxnutrition/src/pages/FinanceiroPage.tsx) (Rota `/financeiro` no [App.tsx](file:///c:/Users/plata/financeiromaxnutrition/src/App.tsx))
- **Abas Operacionais (8 Abas):**
  1. `visao_geral`: Cockpit executivo com 6 cartões de métricas (Caixa Realizado, Entradas, Saídas, Resultado DRE, A Receber, A Pagar) e card de Fluxo de Caixa Consolidado.
  2. `lancamentos`: Tabela analítica completa com busca em tempo real, filtros por status/fluxo, liquidação rápida, edição e exportação CSV.
  3. `fluxo_caixa`: Consolidação periódica de entradas, saídas e fluxo líquido.
  4. `dre`: Demonstração do Resultado do Exercício apurada no regime de competência contábil.
  5. `orcamento`: Metas orçamentárias por centro de custo com comparativo Orçado vs. Realizado.
  6. `recorrencias`: Gestão de assinaturas, custos fixos e contratos com cálculo do equivalente mensal.
  7. `plano_contas`: Catálogo contábil gerencial com código, tipo e categorias macro.
  8. `contas_bancarias`: Visão de contas cadastradas (`public.contas_financeiras`), instituições e saldos.

- **Modais Criados:**
  - [LancamentoModal.tsx](file:///c:/Users/plata/financeiromaxnutrition/src/components/financeiro/LancamentoModal.tsx): Criação e edição com validação do trigger `helena_financeiro_antes`.
  - [OrcamentoModal.tsx](file:///c:/Users/plata/financeiromaxnutrition/src/components/financeiro/OrcamentoModal.tsx): Cadastro de metas e tetos para centros de custo na tabela `public.orcamento`.

---

## 3. MOTOR DE CÁLCULO CONTÁBIL (`caixa.ts`)
Arquivo canônico: [caixa.ts](file:///c:/Users/plata/financeiromaxnutrition/src/lib/caixa.ts)
- **`lerCaixa(linhas, businessId)`**:
  - Exclui lançamentos com status `FORA_CAIXA` (`PREVISTO`, `CANCELADO`, `ABERTO`, `VENCIDO`).
  - Exclui transferências entre contas (`TRANSFERÊNCIA`).
  - Exige moeda `BRL` (retém valores em moeda estrangeira até taxa de conversão).
  - Trata quitações parciais via `valor_liquidado_informado_brl`.
- **`lerDre(linhas, businessId)` / `lerDreMes(linhas, yyyyMm, businessId)`**:
  - Apura receitas e despesas vinculadas ao mês de competência contábil (`competencia`).
  - Exclui apenas cancelados ou previsões hipotéticas.
- **`variacaoPercentual(atual, anterior)`**: Cálculo relativo de desvio orçamentário.

---

## 4. GOVERNANÇA E O AGENTE CAIO (AGT-05 — FINANÇAS / CFO)
- **Papel:** Caio atua na legibilidade de custos, margens, caixa e economia unitária.
- **Regra de Ouro:** Caio opera em modo analítico e consultivo. O agente **NÃO autoriza pagamentos, não assume dívidas e não cria despesas fictícias**. Qualquer lançamento financeiro exige comprovação ou confirmação pelo operador autorizado no sistema.
- **Conexão com o Supabase:** O acesso anônimo permanece estritamente bloqueado (`42501 permission denied`). Toda escrita/leitura em ambiente de produção é condicionada à sessão autenticada com papel ativo em `public.app_access`.

---

## 5. EVIDÊNCIAS DE VALIDAÇÃO
- **Testes Unitários:**
  - `src/lib/caixa.test.ts`: 6 testes aprovados.
  - `src/pages/FinanceiroPage.test.tsx`: 6 testes aprovados.
  - **Suíte Global do Projeto:** 26 arquivos de teste, **154 testes aprovados** (100% passando).
- **Compilação de Produção:**
  - `npm run build` aprovado em ~10.9s com geração limpa de bundles para distribuição.
