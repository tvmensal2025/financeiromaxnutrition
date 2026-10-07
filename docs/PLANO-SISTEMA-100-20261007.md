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

1. **Ferramentas por função para os agentes** — FEITO (07/10, commit 2917ac7)
   - `toolsets_for()` ligado no despachante e no ciclo de revisão (repo e VPS, backups `.bak-toolsets-20261007`); política `bounded-autonomy` 20261007-v2.
   - Testado no VPS: Ravi com pesquisa web (URL real) e Bruno com visão (descreveu a imagem).
   - Lição: reabertura manual deve passar pelo Gateway (release_job valida as fontes); a de 07/10 chamou o RPC direto e liberou um briefing com fonte de tentativa FAILED, corrigido às 09:20.

2. **Agentes atendendo todas as empresas** — FEITO no banco e no runtime; Gateway aguarda publicação (07/10)
   - Banco: `helena_agent_serves(agente, empresa)` + 12 funções trocando só a comparação de empresa; `agent_business_scopes` com 19 agentes × 4 empresas CONFIRMED (REVOKED nunca reativado); `gateway_context` informa `served_business_ids`. Testado em transação revertida (Ravi em BIZ-001 passa; Laura e agente sem escopo barrados).
   - Gateway: `src/business-scope.mjs` (autorização, fila, get_job, despacho, quadro); falha de leitura de escopo nunca amplia acesso. 381/381 testes.
   - VPS: `hermes_workflow_tick.py` aceita empresas atendidas (backup `.bak-multiempresa-20261007`).
   - Até publicar o Gateway, missões de outra empresa param com segurança no despachante (sem IA).
   - Não verificado: se o SOUL de cada perfil cita uma empresa fixa (leitura remota bloqueada); a empresa de cada entrega vem do job.

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
