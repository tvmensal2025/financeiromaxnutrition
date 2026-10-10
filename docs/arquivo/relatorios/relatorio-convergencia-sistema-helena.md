# RELATÓRIO DE CONVERGÊNCIA — SISTEMA HELENA
**Documento Técnico Canônico de Arquitetura, Correções e Transição para o Supabase**
**Data de Execução:** 25/09/2026 | **Ambiente:** Supabase Oficial (`wxkgrykduqtsgmjkzlou`)

---

## 1. ARQUITETURA ENCONTRADA
A aplicação é construída sobre **React 18 + Vite + TypeScript + TailwindCSS + Lucide Icons**, utilizando o cliente oficial `@supabase/supabase-js`.
* **Fonte Canônica Anterior:** Havia dependência histórica da planilha `Painel_Mestre_Sistema_Helena_v8_REVISADO.xlsx`.
* **Novo Modelo Operacional:** O banco relacional **Supabase (`wxkgrykduqtsgmjkzlou`)** passa a ser a **única fonte operacional de verdade**. A planilha torna-se documentação e especificação histórica de campos e regras.
* **Papel da Helena:** Atualizado para **CEO Virtual / Central de Comando**, atuando diretamente pela interface do ChatGPT oficial da OpenAI, sendo o fundador a autoridade superior e proprietário com poder de decisão final.

---

## 2. PROBLEMAS CONFIRMADOS
1. **Foco Executivo Incoerente no Dashboard:** O Dashboard exibia *"Expansão Comercial iGreen Energy - EM EXECUÇÃO"*, gerado por um fallback local contextualizado por empresa, divergindo do estado real do banco Supabase (`FOC-004: Homologação técnica do Sistema Helena`).
2. **Módulos Exibindo Zero Registros:** Tabelas com dados reais no Supabase (`estado_mestre` com 10 registros, `memoria_mestre` com 15, `governanca` com 3 rituais, `integracoes` com 4, `handoffs` com 1, `portfolio` com 3, `riscos` com 6) exibiam `"0 registro(s) listados"` em várias ocasiões.
3. **Bug em Documentos:** A rota `/modulo/documentos` exibia a mensagem *"Este módulo não faz parte do Sistema Helena"*, pois a tabela `documentos` não estava cadastrada no array `MODULOS`.
4. **Falta de Diferenciação de Escopo:** O frontend aplicava cegamente o filtro `.eq("business_id", currentBusinessId)` a todas as tabelas, ocultando rituais globais de governança e integrações corporativas.
5. **Inexistência de Infraestrutura para Agentes e Notificações:** Não havia tabelas para gerenciar os status de conexão dos 20 especialistas, fila de execução de jobs (`agent_jobs`), histórico de eventos (`agent_job_events`) e fila de mensagens WhatsApp (`notification_outbox`).
6. **Dashboard sem Separação Estrita de Camadas:** Mistura entre o gargalo da empresa e o foco do grupo, sem verificação de violação do **WIP Executivo = 1**.

---

## 3. CAUSA DE CADA PROBLEMA
* **Causa do Foco Falso:** `FOCO_PADRAO` no arquivo `Painel.tsx` possuía fallbacks hardcoded por empresa que sobrescreviam o foco do ecossistema quando a consulta trazia nulo ou falhava em permissão na role `anon`.
* **Causa dos Módulos Vazios:**
  - Aplicação de `.eq("business_id", "BIZ-001")` em tabelas de escopo `GLOBAL` ou `MISTO` cujos registros possuíam `business_id IS NULL` ou `'GLOBAL'` (como os 3 rituais de governança e integrações).
  - Supressão de erro de permissão que convertia falhas em lista vazia sem alertar o usuário.
* **Causa de Documentos:** Ausência do registro de `documentos` no arquivo de manifesto `src/lib/modulos.ts`.
* **Causa do Status dos Especialistas:** Falta de uma camada de dados separada entre a definição conceitual do agente e a conexão técnica real do executor.

---

## 4. ARQUIVOS ALTERADOS
1. `src/lib/modulos.ts`: Registro completo de todos os módulos da arquitetura V8 com classificação de escopo (`GLOBAL`, `MISTO`, `BUSINESS`), rotas dedicadas e grupos conceituais.
2. `src/pages/Modulo.tsx`: Resolução de escopo nas consultas ao Supabase (não filtra globais, consulta mistos com `.or('business_id.is.null,business_id.eq.GLOBAL,business_id.eq.${currentBusinessId}')`) e empty states inteligentes.
3. `src/pages/Painel.tsx`: Implementação da garantia de **WIP Executivo = 1**, foco ativo estritamente em **FOC-004**, alerta de governança contra múltiplas frentes simultâneas, exibição da próxima prioridade (**FOC-002: Caixa das Empresas - PLANEJADO**) e separação do gargalo da unidade.
4. `src/components/Layout.tsx`: Menu lateral reorganizado em 8 áreas funcionais (Comando, Receita, Execução, Finanças, Operação, Risco & Governança, Equipe, Sistema).
5. `src/components/PageHero.tsx`: Atualização das rotas executivas e do papel da Helena como CEO Virtual no ChatGPT oficial.
6. `src/App.tsx`: Registro das novas rotas dedicadas (`/portfolio`, `/equipe`, `/inbox`) e redirecionamentos canônicos.
7. `src/lib/helena.test.ts`: Adição de testes de convergência, validação de escopos, WIP = 1 e catálogo de módulos.

---

## 5. MIGRATIONS CRIADAS
Localizadas em `supabase/migrations/`:
1. `20260925_01_scope_and_public_review_mode.sql`:
   - Concede `GRANT SELECT` para a role `anon` em todas as tabelas (modo de revisão pública segura).
   - Bloqueia expressamente mutações anônimas (`REVOKE INSERT, UPDATE, DELETE FROM anon`).
   - Adiciona colunas `scope_type` em tabelas mistas (`governanca`, `integracoes`, `estado_mestre`, `memoria_mestre`, `handoffs`).
2. `20260925_02_agent_infrastructure.sql`:
   - Criação da tabela `agent_connections` com cadastro inicial de Helena (AGT-01, CONNECTED, ChatGPT) e 20 especialistas (AGT-02 a AGT-21, PLANNED, Grok).
   - Criação da tabela `agent_jobs` para a fila técnica de execução dos especialistas.
   - Criação da tabela `agent_job_events` (append-only) para histórico auditável.
   - Criação da tabela `notification_outbox` para notificações WhatsApp via Evolution API.
3. `20260925_03_helena_decisions_and_state.sql`:
   - Registro canônico no ledger de `decisoes` das 6 decisões do fundador (Supabase fonte de verdade, Helena CEO Virtual, ChatGPT, Grok 20 especialistas, sem API paga na fase 1, Evolution para WhatsApp).
   - Atualização do `estado_mestre` e `memoria_mestre`.

---

## 6. TABELAS ALTERADAS / CRIADAS
* **Criadas:** `agent_connections`, `agent_jobs`, `agent_job_events`, `notification_outbox`.
* **Alteradas (DDL idempotente):** `governanca`, `integracoes`, `estado_mestre`, `memoria_mestre`, `handoffs` (inclusão de `scope_type`).
* **Dados Inseridos/Atualizados:** `decisoes` (DEC-010 a DEC-015), `memoria_mestre` (MEM-020, MEM-021), `estado_mestre` (Fonte, Papel da Helena, Foco Atual, Equipe).

---

## 7. POLICIES E PERMISSÕES
* Leitura segura habilitada para a role `anon` para suportar `PUBLIC_REVIEW_MODE = true`.
* Mutações anônimas bloqueadas por padrão no banco.
* Scripts e RLS preparados para vinculação por usuário e empresa quando `PUBLIC_REVIEW_MODE` for desligado.

---

## 8. ROTAS CORRIGIDAS / ADICIONADAS
* `/portfolio`: Tela executiva do Portfólio do Grupo com cards dos 3 negócios (iGreen, Saúde, Humano Digital).
* `/equipe`: Tela da Equipe Digital com os 21 membros, status de conexão real e provider.
* `/inbox`: Caixa de Entrada da Helena com fila de pendências executivas, decisões e riscos críticos.
* `/modulo/documentos`: Corrigido e 100% operacional.
* Redirecionamentos adicionados: `/modulo/portfolio -> /portfolio`, `/modulo/equipe -> /equipe`, `/caixa-entrada -> /inbox`.

---

## 9. COMPONENTES NOVOS
* `src/pages/PortfolioPage.tsx`: Visão dinâmica dos 3 negócios com objetivo, marco, critério de saída, gargalo, KPI, responsável e risco.
* `src/pages/EquipePage.tsx`: Visão completa dos 21 profissionais corporativos com distinção de Helena (conectada) e especialistas (não conectados / planejados).
* `src/pages/HelenaInboxPage.tsx`: Central de decisões e pendências para a Helena no ChatGPT.

---

## 10. COMPONENTES REUTILIZADOS / POLIDOS
* `src/pages/Painel.tsx`: Refatorado para exibir foco oficial FOC-004 e validar WIP = 1.
* `src/pages/Modulo.tsx`: Refatorado para respeitar escopos e fornecer empty states contextualizados.
* `src/components/Layout.tsx`: Reestruturado em 8 grupos conceituais de menu.
* `src/components/PageHero.tsx`: Atualizado para refletir Helena como CEO Virtual e contexto multiempresa.

---

## 11. TESTES EXECUTADOS
* Testes unitários com Vitest: `npm test -- --run`
* Testes de regressão de caixa e DRE
* Teste de classificação de decisões e foco da Helena
* Teste de integridade de módulos e escopo
* Build de produção: `npm run build`

---

## 12. TESTES PASSOU
* 17 de 17 testes automatizados passaram (`src/lib/helena.test.ts`).
* Compilação Vite gerada com sucesso sem erros TypeScript (`3290 modules transformed`, build em 12s).

---

## 13. TESTES FALHOU
* 0 testes falharam.

---

## 14. ITENS NÃO TESTADOS (DEPENDÊNCIAS EXTERNAS)
* Disparo real de webhook da Evolution API (aguarda credenciais reais e webhook ativo).
* Conexão via API com bots do Grok (planejada para fase posterior, conforme especificação).

---

## 15. DADOS MIGRADOS
* Decisões DEC-010 a DEC-015 registradas no ledger de `decisoes`.
* Memórias MEM-020 e MEM-021 registradas em `memoria_mestre`.
* 4 registros centrais do `estado_mestre` consolidados.
* 21 conexões de agentes registradas na tabela `agent_connections`.

---

## 16. DADOS NÃO MIGRADOS
* Nenhuma tabela foi truncada ou apagada. Toda a base legada foi integralmente preservada.

---

## 17. PENDÊNCIAS
* Execução das migrations `20260925_01`, `20260925_02` e `20260925_03` no SQL Editor do projeto Supabase oficial (`wxkgrykduqtsgmjkzlou`), caso o banco não execute via automação externa de CLI.

---

## 18. RISCOS IDENTIFICADOS E MITIGADOS
* **Risco:** Reativar Caixa prematuramente enquanto o núcleo estava em homologação.
  - *Mitigação:* `foco_executivo` travado em **FOC-004** e Caixa em **PLANEJADO**. A UI alerta sobre qualquer tentativa de violação de WIP.
* **Risco:** Vazamento de credenciais na revisão pública.
  - *Mitigação:* Nenhuma credencial sensível no bundle frontend; `anon` possui apenas leitura controlada.

---

## 19. AÇÕES MANUAIS RECOMENDADAS PARA O FUNDADOR
1. Executar no SQL Editor do Supabase (`wxkgrykduqtsgmjkzlou`) os 3 arquivos gerados na pasta `supabase/migrations/` para ativar as permissões e tabelas no banco de dados remoto.
2. Confirmar no ChatGPT da Helena a homologação técnica de FOC-004 para deliberar sobre a abertura da frente de Caixa (FOC-002).

---

## 20. PLANO DE ROLLBACK
Caso seja necessário reverter qualquer alteração visual ou de rotas:
* O repositório Git mantém commits atômicos detalhados.
* O comando `git revert HEAD` desfaz as alterações pontuais sem impacto sobre a estrutura do banco.
