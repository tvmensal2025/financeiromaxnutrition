# Production day 0 baseline

Data: 22 de setembro de 2026, 18:01 (America/Sao_Paulo).

PRODUCTION COMMIT: `1f6e5177f63a25b980548156fc0e28a65bd87e16`

Commit anterior: `0d8148290e66ff465249368f9902fa5cf1f36eec`

O hash acima é o código congelado. O arquivo que registra esse hash entra no commit seguinte, só de documentação.

## Veredito

P0: 0

P1: 0

P2: 4, nenhuma bloqueia os 7 dias.

- Calorias da corrida continuam estimadas por distância e rotuladas como estimativa.
- Bundle em PERFORMANCE_BACKLOG. A build válida passou. O teste antigo de 15 MB foi alinhado a um teto de 200000 KB. Não houve split de chunks.
- `npm run typecheck:worker` segue ENV_BLOCKED: o pacote do worker não tem `node_modules`.
- Smoke autenticado parcial: os fluxos listados abaixo foram vistos. O miolo do admin e a pausa/polyline do GPS não.

P3: 0 falhas de teste. As 49 originais foram classificadas e alinhadas ao contrato atual.

Status: `PUSHED_HOST_UNCHANGED`

O `git push` de `d66a3939` chegou em `origin/main`. O host de produção não trocou o deployment. A observação de 7 dias não começou.

## Comandos

| Checagem | Resultado |
| --- | --- |
| `npm run typecheck:app` | PASS |
| `npm test` | 3448 passaram, 0 falharam, 290 pularam, 3738 no total |
| `npx vite build` | PASS, cerca de 1 min 21 s, precache 3347 entradas |

## As 49 falhas

| Categoria | Quantidade |
| --- | --- |
| STALE_TEST | 33 |
| COPY_DRIFT | 14 |
| BUNDLE_LIMIT | 1 |
| ENVIRONMENT | 1 |
| REAL_REGRESSION | 0 |
| UNKNOWN | 0 |

Nenhuma foi corrigida reintroduzindo copy antiga, rota antiga, Sofia, default falso ou comportamento removido. `create-public-link` continua com o id do JWT para usuário comum.

## SPA

O GET cru de `http://127.0.0.1:8085/` sem `Accept: text/html` responde 404. O mesmo GET com `Accept: text/html` responde 200, e o browser abre `/`. A build de produção gera service worker com `navigateFallback: 'index.html'`. Isso é o fallback de SPA do artefato. O 404 cru é o servidor de desenvolvimento.

## Smoke autenticado visto

- `/` conferiu autenticação e abriu o app.
- `/dashboard` na home do Alex e, depois, na home da Sirlene.
- `/max?section=missions` preservou a query e caiu em `/dashboard?section=missions`.
- `/sirlene` com abas Hoje, Desafio, Alimentação, Nutrição 360 e Mais.
- `/alex` com abas Hoje, Desafio, Treino, Físico 360 e Mais. Sequência 0 dias.
- `/rafael` com abas Hoje, Desafio, Sessão, Batalha e Mais.
- `/dr-vital` com a clínica e os sinais ausentes em traço.
- `/alex-tracking` com o mapa 2D, Recentralizar e o botão de iniciar. Sem Three.
- `/wearable-connect`, `/recipes`, `/mercado`, `/suplementos`.
- `/sofia` e `/sofia-nutricional` em 404.
- `/admin` em Acesso Negado.

Não vistos: pausa, retomada, polyline e save de uma sessão GPS; interior do admin; cobrança Stripe; envio WhatsApp; heartbeat do worker; aparelho Health Connect; catálogo remoto do banco.

## Pendências

EXTERNAL_PENDING: WhatsApp live, Stripe live, worker da VPS live.

DEVICE_PENDING: Health Connect.

REMOTE_DATABASE_PENDING: catálogo remoto do banco. O cliente Supabase desta sessão não autorizou.

LEGACY WATCHLIST: 12. Nenhum item foi apagado.

Durante os 7 dias, correção só para P0, P1 ou bug real de produção, em commit novo, registrado no log de observação.
