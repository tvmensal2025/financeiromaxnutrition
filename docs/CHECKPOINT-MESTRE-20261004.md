# Sistema Helena — Checkpoint Mestre de Continuidade de 04/10/2026

Documento canônico publicado para garantir que qualquer agente ou conversa opere com o estado real atualizado do ecossistema, regras invioláveis e materialização de comandos do fundador.

---

## 1. Diretiva Suprema de Materialização de Comandos (DEC-022)
**REGRA DE EXECUÇÃO REAL VS PLANEJAMENTO FICTÍCIO:**
1. Sempre que o Fundador solicitar no chat, por voz ou por comando a criação de uma nova empresa, negócio, marca, conta bancária ou módulo, a Helena e qualquer agente **DEVEM MATERIALIZAR IMEDIATAMENTE** o registro correspondente na tabela canônica de destino:
   - **Empresas/Negócios:** Inserir imediatamente em `public.portfolio` com o próximo ID (`BIZ-xxx`), marcando `ativo = 'SIM'` e habilitando a empresa no seletor multiempresa.
   - **Contas Financeiras:** Inserir em `public.contas_financeiras`.
   - **Lançamentos:** Inserir em `public.financeiro`.
2. **A trava `WIP executivo = 1` NÃO bloqueia a criação de entidades ordenadas pelo Fundador.** Ela governa a esteira de tarefas autônomas dos agentes de IA, nunca a autoridade soberana do Fundador.
3. É **TERMINANTEMENTE PROIBIDO** responder que uma empresa ou entidade foi criada se ela apenas existir como rascunho de texto, tarefa não iniciada ou memória. Ela deve estar persistida na tabela canônica.

---

## 2. Portfólio Oficial Ativo (4 Negócios)
O ecossistema conta formalmente com 4 negócios ativos:
1. **BIZ-001 — iGreen Energy:** Energia solar e sustentabilidade. Foco em validação e aquisição comercial.
2. **BIZ-002 — Ecossistema de Saúde:** Saúde, nutrição, longevidade e medicina preventiva.
3. **BIZ-003 — Humano Digital:** Plataforma/agência que conecta pessoas adultas a oportunidades de dados para Inteligência Artificial.
4. **BIZ-004 — E-living:** *"Onde sua evolução ganha direção."* Plataforma global de evolução pessoal, saúde, hábitos, comportamento e inteligência artificial. Missão: transformar dados em decisão, informação em evolução e tecnologia em cuidado contínuo.

---

## 3. Cockpit Financeiro e Aplicação Frontend
- **8 Abas Operacionais:** Visão Geral, Transações, DRE Gerencial, Fluxo de Caixa, Centros de Custo, Análise de Metas, Auditoria e Relatórios.
- **Modais Completos:** `LancamentoModal` e `OrcamentoModal` com validação de dados e proteção de concorrência.
- **Seletor Multiempresa:** Integrado no cabeçalho com alternância dinâmica para todas as 4 empresas e visão de Grupo Consolidado.
- **Qualidade Técnica:** 177 testes automatizados passando (100% verde) e build de produção validado.

---

## 4. Precedência e Continuidade
- Fonte canônica: Supabase `ecosistemadossonhos` (`wxkgrykduqtsgmjkzlou`).
- Predecessor canônico superado: `CP-20261001-V034` (Versão 34).
- Checkpoint ativo atual: **CP-20261004-V035** (Versão 35).
