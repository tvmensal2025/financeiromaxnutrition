# Plano para destravar a frota da Helena — 06/10/2026

Estado lido em somente leitura no Supabase `ecosistemadossonhos` (wxkgrykduqtsgmjkzlou):
último evento de agente em 03/10 18:02 UTC; 0 jobs READY/CLAIMED/RUNNING; 32 WAITING_HELENA,
9 DRAFT, 14 FAILED (2/2 tentativas), 31 tarefas BLOQUEADA, 77 handoffs ABERTOS.
Gateway `/health` = 200. Nenhum passo abaixo foi executado; cada um exige autorização do Fundador.

## Etapa 1 — Infraestrutura do Hermes (VPS Hostinger) · altera servidor
1. Aumentar RAM ou ativar swap no VPS (painel mostra "running low on memory"; UNKNOWN/TIMEOUT compatíveis com OOM).
2. Conferir o timeout do runner do cron `helena-gateway-poll` contra o pior caso do pipeline; reduzir `--max-actions` para 2.
3. Subir o tempo de execução de texto de 300 s para 600 s (`scripts/execution_policy.py`).
Validação: um job interno de teste conclui sem TIMEOUT; nenhum exit sem diagnóstico.

## Etapa 2 — Falha de infraestrutura não consome tentativa · altera código do Gateway + RPC
1. Mapear exit -9/137 para `OOM_KILLED`, 429 para `RATE_LIMIT`, SIGTERM para `TRANSPORT_INTERRUPTED`.
2. Nesses casos, devolver o job a READY com `available_at` futuro, sem incrementar `attempt_count`.
3. Barrar despacho a partir de 80% da cota openai-codex (hoje 95%).

## Etapa 3 — Camada "missão nunca morre" · aplica SQL (primeiro em banco local/staging)
1. Testar em PostgreSQL local, nesta ordem: `supabase/patches/helena_reliability_v1.sql`,
   `helena_mission_v2.sql`, `helena_outcome_v1.sql` (vieram do pacote V4; usam `private.is_founder`).
2. Só depois, com autorização explícita, aplicar no Supabase real e registrar no histórico de migrations.
3. Ligar no Gateway: `gateway_fail_agent_job` na última tentativa abre `helena_open_resolution`
   (dono: Theo para técnico, Helena para orquestração) em vez de FAILED terminal.

## Etapa 4 — Watchdog que age · altera scripts Hermes
1. `hermes_queue_watchdog.py`: além de QUEUE_ATTENTION, relançar de forma idempotente quando não houve efeito canônico.
2. Incluir READY órfão em `gateway_list_recovery_candidates`; reconciliar CLAIMED/RUNNING vencidos.
3. Generalizar a receita de autocorreção (hoje só AGT-17) para todos os perfis.

## Etapa 5 — Revisão sem gargalo · altera RPC + app
1. Redistribuir revisores: Bruno (QA geral), Clara (jurídico), Nina (produto/design).
2. Correção pedida pelo revisor (REQUEST_CHANGES) não conta como tentativa.
3. Botão de aprovar/devolver para o Fundador no app (entregas da Helena hoje ficam paradas).

## Etapa 6 — Triagem do legado · altera dados
Script único, revisado antes: para cada um dos 14 FAILED e 31 BLOQUEADA, decidir reabrir com
nova tentativa, abrir resolução ou cancelar por ordem do Fundador; fechar handoffs órfãos.

## Etapa 7 — Capacidade dos 21 · altera perfis Hermes
Toolsets de domínio por perfil (leitura de dados para Caio/Daniel, web para Ravi/Clara,
repositório e testes para Theo), reinstalar `helena-role-agt-13` corrigida (Bruno = QA),
criar perfis para BIZ-004, BIZ-001 e BIZ-002 e testar cada agente com uma tarefa real da área.

Ordem recomendada: 1 → 2 → 3 → 4 → 5 → 6 → 7. Etapas 1 e 2 já devem tirar a frota da parada.
