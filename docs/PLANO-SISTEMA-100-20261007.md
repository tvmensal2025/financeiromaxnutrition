# Plano para o Sistema Helena funcionar 100% — 07/10/2026

Regra deste plano: reaproveitar o que já existe (JÁ EXISTE / PARCIAL / AUSENTE). Nada é reescrito do zero.

## Já feito e verificado (06–07/10)

| Item | Estado | Evidência |
|---|---|---|
| Supabase sem laço infinito (40001 → PT409) | FEITO | migration 20261006233000; rollbacks pararam; CPU ~14% |
| Hermes migrado para o VPS (EasyPanel) | FEITO | 21 perfis, skills, MCP, runtime, login OpenAI; Hostinger pausada (vence 27/10) |
| Despachante + revisão automática no VPS | FEITO | Camila, Victor e Augusto aprovados; Augusto corrigido e reentregue sozinho |
| Pacote de contexto 65k → 120k | FEITO | commit 0d144ff |
| Texto 300 s → 600 s; falha de infraestrutura não gasta tentativa | FEITO | commit f120448; migration 20261007070000 |
| Skills especializadas por função (1–6 por agente) + QA do Bruno | FEITO | `hermes skills list` nos perfis |
| App: Financeiro (colunas), Conversa (sem campanha falsa), login seguro, modo teste dev | FEITO | branch missao-cumprida-v4 (commits locais) |

## Ordem do que falta (cada passo usa o que já existe)

1. **Ferramentas por função para os agentes** — PARCIAL
   - Já existe: `toolsets_for()` em `services/helena-gateway/scripts/execution_policy.py` (web, visão, skills, todo; sem terminal/arquivos/código).
   - Falta: ligar no despachante e no ciclo de revisão; atualizar a política `bounded-autonomy` no Supabase. Aguarda OK específico do Fundador.

2. **Agentes atendendo todas as empresas** — PARCIAL
   - Já existe: tabela `agent_business_scopes` (39 escopos; BIZ-004 autorizado, runtime PENDING).
   - Falta: perfis sem empresa no nome (ou vínculo multiempresa) e regras de release/claim/create_task lendo `agent_business_scopes`. Não criar tabela nova.

3. **Missão nunca morre (EM_RESOLUÇÃO)** — PARCIAL
   - Já existe: `supabase/patches/helena_reliability_v1.sql`, `helena_mission_v2.sql`, `helena_outcome_v1.sql` (pacote V4) e a devolução de tentativa em falha de infraestrutura.
   - Falta: testar os 3 patches em transação revertida, aplicar e ligar o pipeline de missão do Gateway (flag `HELENA_MISSION_PIPELINE_ENABLED`). Não reescrever.

4. **Triagem do legado** — AUSENTE
   - 15 FAILED e ~32 WAITING_HELENA antigos (anteriores a `new_jobs_after`) não andam sozinhos.
   - Fazer: um script único de decisão por job (reabrir pelo `create_task` da Helena, encerrar como obsoleto ou manter). Mesmo método usado em 06/10 para Augusto/Victor/Camila/Marina.

5. **Financeiro: Helena recebe e delega, Caio lança e concilia** — PARCIAL
   - Contratos no Supabase: Helena (AGT-01) não executa nem decide gastos; Caio (AGT-05) é o dono do financeiro.
   - Helena: perguntas de controle (pessoal/empresa, conta, pago/previsto) e delegação ao Caio; `helena--grupo` como perfil padrão do Hermes.
   - FEITO no repositório (07/10): ferramenta `registrar_lancamento` no Gateway (`src/finance-ledger.mjs`), exclusiva do Caio em job próprio RUNNING; empresa vem do job; idempotency_key; DUPLICATE_SUSPECT sem gravar; evento FINANCE_RECORDED; regras finais continuam no gatilho `helena_financeiro_antes`. Skill do Caio atualizada. 7 testes novos; suíte Node 376/376.
   - Falta: publicar o Gateway (deploy no EasyPanel, com OK do Fundador), sincronizar a skill do Caio no VPS, ajustar Helena (perguntas de controle + `helena--grupo` como perfil padrão), cadastrar contas em `contas_financeiras` (hoje `financeiro` está vazio) e conciliação semanal com Daniel.

6. **App com ação e acompanhamento nos cards** — PARCIAL
   - Já existe: componentes `MissionTimeline`, `MissionReview`, `MissionAdoption`, `ContinuityPanel` no pacote V4.
   - Falta: portar após o passo 3 (dependem das tabelas de missão) e unificar estados (BLOQUEADA → EM_RESOLUÇÃO).

7. **Manutenção do VPS e cadastros** — AUSENTE
   - Fechar porta pública 9119; backup diário do volume do Hermes; remover volume `helena-automation_hermes-agent_data` (se vazio); atualizar `agent_connections` (hoje GROK/NOT_CONNECTED) para refletir o Hermes; publicar Checkpoint Mestre V036 sincronizado; push da branch.

8. **Ferramentas de código para Caio, Daniel e Theo** — AUSENTE (depois)
   - Só com execução isolada (sem acesso aos tokens dos perfis).

## Regras de custo

- Agentes: Helena gpt-6.1-sol; demais gpt-6-luna (assinatura ChatGPT Plus, cota semanal ~32%).
- Subagentes de desenvolvimento (Claude): Sonnet para análise/implementação, Haiku para tarefas simples.
- Nenhuma execução paga repetida sem diagnóstico.
