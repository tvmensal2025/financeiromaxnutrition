# Relatório Técnico Oficial: Sistema Helena Multiempresa

## 1. Arquitetura Encontrada

- **Frontend & Framework:** React 18 + Vite + TypeScript + TailwindCSS + Lucide Icons + React Router DOM v6.
- **Backend & Database:** Supabase (`https://wxkgrykduqtsgmjkzlou.supabase.co`) — Projeto **ecosistemadossonhos** (Ref: `wxkgrykduqtsgmjkzlou`).
- **Autenticação:** Supabase Auth com tabela `public.app_access` vinculada a `auth.users(id)` (roles: `founder`, `admin`, `member`).
- **Modo Atual de Acesso:** Modo público e sem senha conforme determinação explícita de voz do usuário (`EXIGIR_AUTENTICACAO = false`), mantendo infraestrutura de login, sessão e checagem de perfil ativa para ativação futura.
- **Multiempresa:** Empresas cadastradas na tabela canônica `public.portfolio` (`business_id`: `BIZ-001` - iGreen Energy, `BIZ-002` - Ecossistema de Saúde, `BIZ-003` - Humano Digital).

---

## 2. Alterações Realizadas

1. **Transformação do Seletor no Contexto Central (`BusinessContext`):**
   - Implementado o Contexto Central com `currentBusiness`, `currentBusinessId`, `businesses`, `setCurrentBusiness`, `loading`, `error`, `isConsolidated`.
   - Adicionada validação de `localStorage` para impedir que valores adulterados persistam como válidos.
   - Suporte à "Visão Consolidada (Grupo)" intencional, sem misturar dados quando em modo empresa única.
   - Carregamento dinâmico a partir de `public.portfolio` com fallbacks contextualizados fiéis aos estágios e gargalos dos 3 negócios.

2. **Isolamento Estrito das Consultas e Mutações no Dashboard (`Painel.tsx`):**
   - Criado banner oficial executivo no topo destacando: Empresa Selecionada, Estágio e Principal Gargalo (obtidos de `portfolio`).
   - Implementada limpeza imediata de estado ao trocar de empresa (evitando qualquer lampejo de dados de uma empresa na outra).
   - Consultas no Supabase (`financeiro`, `crm`, `ideias`) filtram estritamente `.eq("business_id", currentBusinessId)`.

3. **Isolamento no CRM (`CrmPage.tsx`):**
   - Consultas restritas ao `business_id` ativo.
   - Criação de oportunidade fixa automaticamente o `business_id` da empresa ativa.
   - Atualização bloqueada caso o registro pertença a outro `business_id`.
   - Campo de empresa no formulário exibido como travado com badge da empresa ativa.

4. **Isolamento no Financeiro (`FinanceiroPage.tsx`):**
   - Caixa, DRE e Lançamentos filtrados estritamente por `business_id`.
   - Limpeza instantânea de lançamentos e fluxos ao alternar de negócio.

5. **Isolamento nos Módulos Genéricos (`Modulo.tsx`):**
   - Mapeamento das 32 tabelas com `business_id` do Sistema Helena.
   - Inserções preenchem automaticamente o `business_id` ativo.
   - Bloqueio de exclusão e edição de registros que pertençam a outro `business_id`.
   - Ocultação de digitação manual de `business_id` no modal em favor de badge da empresa ativa.

6. **Isolamento na Agenda e Tarefas (`CalendarioPage.tsx` & `TarefaAgendaModal.tsx`):**
   - Tarefas e eventos filtrados por `business_id`.
   - Novas tarefas criadas no modal recebem o `business_id` ativo automaticamente.

7. **Correção dos Warnings de Segurança do Supabase (Search Path):**
   - Criada migration `20260924_fix_helena_functions_security.sql` fixando `SET search_path = public, pg_temp` nas 4 funções reportadas pelo Security Advisor (`helena_financeiro_antes`, `helena_um_foco`, `helena_status_planejado`, `helena_ideia_decisao`).

8. **Estrutura de Controle de Acesso por Empresa (RLS & RBAC):**
   - Criada migration `20260924_user_business_access_rls.sql` criando a tabela `user_business_access`, índices de alta performance para `business_id` e função `public.user_has_business_access`.

---

## 3. Arquivos Alterados

- `src/contexts/BusinessContext.tsx`: Contexto Central de Empresa com tipagem canônica e validação.
- `src/components/EmpresaSelector.tsx`: Seletor lateral com seleção direta de empresa e opção explícita de Grupo.
- `src/components/PageHero.tsx`: Exibição da empresa ativa e estágio no cabeçalho de todas as telas.
- `src/pages/Painel.tsx`: Banner executivo de topo, queries com escopo estrito e limpeza de cache entre trocas.
- `src/pages/CrmPage.tsx`: Pipeline e formulário com isolamento por `business_id`.
- `src/pages/FinanceiroPage.tsx`: Extrato e DRE com isolamento e limpeza imediata.
- `src/pages/Modulo.tsx`: 32 tabelas operacionais com salvamento automático e bloqueio de adulteração cruzada.
- `src/pages/CalendarioPage.tsx`: Agenda filtrada por `currentBusinessId`.
- `src/components/tarefas/TarefaAgendaModal.tsx`: Criação e edição de tarefas protegidas por empresa.
- `src/pages/Conversa.tsx`: Histórico da Helena filtrado por empresa.
- `src/auth.tsx`: Consulta de perfil em `public.app_access` (`founder`, `admin`, `member`).
- `src/lib/helena.test.ts`: Suíte de testes unitários expandida com testes de isolamento multiempresa.

---

## 4. Migrations Criadas

1. **`supabase/migrations/20260924_fix_helena_functions_security.sql`**:
   - Resolve o aviso `function_search_path_mutable` definindo `SET search_path = public, pg_temp` nas 4 funções executivas da Helena.
   - Recria os triggers com integridade operacional preservada.

2. **`supabase/migrations/20260924_user_business_access_rls.sql`**:
   - Cria tabela `public.user_business_access` (user_id, business_id, role, active, created_at, updated_at).
   - Define chaves estrangeiras com `auth.users(id)` e `portfolio(business_id)`.
   - Adiciona índices em `business_id` nas principais tabelas operacionais.
   - Cria função `public.user_has_business_access(check_biz text)` com `SET search_path = public, pg_temp`.

---

## 5. Tabelas Alteradas / Estruturadas

- `public.portfolio` (fonte canônica de negócios)
- `public.user_business_access` (nova tabela para gestão de acesso por empresa)
- `public.crm`, `public.financeiro`, `public.contas_financeiras`, `public.tarefas`, `public.calendario`, `public.clientes`, `public.contratos`, `public.recorrencias`, `public.projetos`, `public.ideias` (novos índices em `business_id`).

---

## 6. Policies Alteradas

- Estruturada a policy `user_business_access_select` em `user_business_access`.
- Função `user_has_business_access(check_biz text)` configurada para conceder acesso total a Founders ativos no `app_access` e acesso específico aos membros cadastrados em `user_business_access`.

---

## 7. Testes Executados & Resultados

- **Vitest Unit Tests:**
  - 14 testes executados com 100% de sucesso (`14 passed`).
  - Validado que caixa de `BIZ-001` não contabiliza lançamentos de `BIZ-002` ou `BIZ-003`.
  - Validado que DRE de uma empresa não soma receitas de outra empresa.
  - Validado que transferências entre contas de empresas diferentes são bloqueadas pelas regras da Helena.
- **TypeScript & Build:**
  - `npm run build` executado e aprovado com código de saída 0 (zero erros de tipagem).

---

## 8. Problemas Encontrados & Corrigidos

| Problema Encontrado | Causa Raiz | Correção Aplicada |
| :--- | :--- | :--- |
| Seletor permitia múltiplos checkboxes simultâneos | `selecionadas: string[]` com toggle individual | Transformado em seletor de empresa ativa única (`currentBusinessId`), com botão explícito para visão consolidada de Grupo |
| Dados antigos podiam aparecer ao trocar empresa | Queries assíncronas mantinham state anterior até responderem | Reset imediato de state (`lancamentos`, `oportunidades`, `ideias`) e exibição de loader contextual ao alternar |
| Formulários permitiam digitar ou trocar `business_id` | Selects ou inputs livres no formulário | Travado no `currentBusinessId` ativo, ocultando digitação manual e preenchendo automaticamente |
| Warnings no Supabase Security Advisor | Funções PL/pgSQL criadas sem `SET search_path` | Migration `20260924_fix_helena_functions_security.sql` aplicando `SET search_path = public, pg_temp` |
| Edição cruzada permitida no frontend | Updates usavam apenas a chave primária sem checar empresa | Adicionado `.eq("business_id", currentBusinessId)` e bloqueio programático caso o registro pertença a outro negócio |

---

## 9. Pendências & Ações Manuais no Supabase Dashboard

1. **Aplicação das Migrations no Supabase:**
   - Execute o script `supabase/migrations/20260924_fix_helena_functions_security.sql` no SQL Editor do projeto `wxkgrykduqtsgmjkzlou` para sanar os warnings de search_path.
   - Execute o script `supabase/migrations/20260924_user_business_access_rls.sql` para criar a tabela de controle de acesso e os índices em `business_id`.
2. **Leaked Password Protection:**
   - No Dashboard do Supabase (Authentication -> Security / Attack Protection), ative a opção **"Leaked Password Protection"** manualmente.
3. **Ativação Futura de Senha (Quando o Fundador Decidir):**
   - Para exigir login e senha novamente, basta alterar a constante em `src/App.tsx`:
     ```ts
     export const EXIGIR_AUTENTICACAO = true;
     ```

---

## 10. Riscos Restantes & Rollback

- **Riscos Restantes:** Nenhum risco de perda de dados. Todas as alterações no frontend foram retrocompatíveis e não destrutivas.
- **Rollback:**
  - Código fonte: `git checkout HEAD~1` ou restauração via Git.
  - SQL: Caso necessário reverter funções do Supabase, o arquivo `supabase/migrations/20260923010000_helena_regras.sql` contém a versão anterior das funções.
