# Telegram → Helena v2: o que falta e como virar (auditoria de 17/10/2026)

O que é: fotografia datada (leitura do código, sem consultar Supabase, VPS ou Telegram) do que falta para o fundador
falar com a Helena v2 pelo bot `@hermes_helena_oficial_bot` e o pedido virar card real. Não substitui a consulta atual
ao banco; tudo que depende de produção está NÃO CONFIRMADO.
Como mudar: refaça a auditoria quando o pacote de virada existir e atualize os status; nunca escreva valores de segredo aqui.

## Estado por item

| # | Item | Estado | Evidência |
|---|------|--------|-----------|
| 1 | Estado atual do banco (0020–0026, checkpoint único, decisões ≤ 30, configuração ativa) | NÃO CONFIRMADO | consultar `public.checkpoint_mestre_atual` em transação READ ONLY |
| 2 | Site publicado com pareamento e confirmação da proposta | AUSENTE até a publicação | `src/pages/PareamentoTelegramV2.tsx`, `IntegracoesV2Page.tsx` |
| 3 | Edge `helena-v2-telegram` e segredos | PARCIAL (código existe; deploy foi feito, segredos não confirmados) | `supabase/functions/helena-v2-telegram/`, `config.toml` (`verify_jwt=false`) |
| 4 | Autenticação por cabeçalho secreto | JÁ EXISTE | `core.ts` (SHA-256 em tempo constante; sem segredo = 503; cabeçalho errado = 401) |
| 5 | Pareamento do chat do fundador | JÁ EXISTE no banco | migration 0022 (código de 10 min, só hash guardado, chat privado, 1 vínculo ativo) |
| 6 | Parar o poller do Hermes 0.15.1 antes do webhook | só documentação | `motor/hermes-vps/telegram-v2/LEIA-ME.md` |
| 7 | Adapter inbox-worker no Hermes 0.15.1 | PARCIAL (código e testes; instalação real AUSENTE) | `helena_v2_inbox.py`, `patch-hermes-telegram.py` recusa `--apply` fora de /tmp e /workspace |
| 8 | Caixa de entrada com idempotência por `update_id` | JÁ EXISTE | migration 0025 |
| 9 | Avisos de volta | JÁ EXISTE; quem envia é a Edge, não o motor | migration 0026, `core.ts`, `transport.ts` |
| 10 | Pedido em texto livre | PARCIAL | só `/pedido <texto>` vira pedido; mensagem comum continua conversa do Hermes antigo |
| 11 | Segunda confirmação removida | decisão deliberada da 0024 | `0024:528` (`pedido_grande=false`); sobra a confirmação da proposta no site |
| 12 | Limites e cota | PARCIAL | sem teto diário nem por pedido; sem limite para updates de desconhecidos |
| 13 | Motor desligado | deduzido | pedido fica RECEBIDO, sem aviso ao fundador; ao religar, backlog gasta uma chamada por pedido |

## Quatro bloqueios para a ponta a ponta

1. Não existe o pacote de virada da instalação real do Hermes 0.15.1 (o adapter só se instala em cópia isolada).
2. O site com pareamento e confirmação precisa estar publicado.
3. O motor novo (triagem e consumo do plano) precisa estar na VPS.
4. Os serviços em ESTÁGIO (Relatório final, Cálculo, Parecer, Copy, Roteiro) limitam o que vira card: Parecer exige fonte de leis e Copy/Roteiro dependem de Parecer. Hoje só um pedido de Cálculo com insumos rastreáveis tem chance de virar card.

## Roteiro de virada (um passo por vez; cada efeito remoto precisa de autorização explícita do fundador)

0. Leitura do banco em `begin read only` (checkpoint ativo único, funções 0024/0025/0026 existem, decisões vigentes ≤ 30, configuração ativa).
1. Variáveis locais: token do bot lido sem eco; dois segredos distintos gerados com `openssl rand -hex 32`.
2. `getWebhookInfo`: esperado `url` vazia (hoje o poller usa `getUpdates`).
3. `supabase functions deploy helena-v2-telegram --no-verify-jwt` e gravar os três segredos por arquivo temporário apagado em seguida.
4. Testar a Edge sem tocar no Telegram: sem cabeçalho 401, cabeçalho errado 401, `/worker/claim` com o segredo do worker devolve `job: null`.
5. Entregar o segredo do worker à VPS por `ssh` com `umask 077`, nunca por argumento ou chat.
6. Inventário e backup do `/root/.hermes` na VPS, sem parar nada (`motor/hermes-vps/inventario.sh`).
7. BLOQUEADO: instalar o adapter na instalação real, sem `TELEGRAM_BOT_TOKEN` no ambiente.
8. Parar o poller, conferir que não sobrou processo, subir o Hermes no modo novo e ler o log (sem 409).
9. `setWebhook` com `secret_token` e `drop_pending_updates=false`; conferir `getWebhookInfo` sem erro.
10. Parear: gerar o código no site (vale 10 min), enviar `/vincular <código>` no chat privado, apagar a mensagem.
11. Prova: `/pedido` curto e inofensivo → recibo → proposta → confirmar no site → aviso de card; mensagem comum não pode virar pedido; revogar o vínculo e ver o bot mudo.

## Reversão

- R1: revogar o vínculo no site (corta pedidos e avisos na hora).
- R2: `deleteWebhook` com `drop_pending_updates=false`.
- R3: parar o Hermes novo, restaurar a cópia do passo 6 e religar o poller antigo (conferir `getWebhookInfo` vazio para não dar 409).
- R4: `supabase secrets unset` do segredo do webhook (a Edge passa a responder 503).
- R5: `systemctl stop helena-despachante` se o gasto do motor for o problema.
- R6: rotacionar token do bot e segredos se algum valor tiver sido exposto.

## Decisões que só o fundador pode tomar

1. Autorizar cada efeito remoto (Edge, segredos, VPS, webhook, pareamento).
2. Manter a 0024 sem segunda confirmação, religar a confirmação para pedidos vindos do Telegram, ou impor teto de custo.
3. Teto de gasto: pedidos por dia e custo por pedido (hoje o código não impõe nenhum).
4. Primeiro serviço do primeiro card real e o tratamento de Parecer/leis.
5. Aceitar `/pedido` obrigatório; confirmação e respostas só no site.
6. Aceitar a regressão de anexos (relay de mídia pendente) ou adiar a virada.
7. Aceitar que o Hermes 0.15.1 perde o token do Telegram (envio proativo e cron para o Telegram param).
8. Aceitar riscos residuais: saída pode duplicar, a capability do worker é legível pelo mesmo usuário, corrida entre revogação e envio.
9. Alarme: como saber que o motor ou o worker caiu (hoje só arquivo local na VPS).
10. Ordem em relação à rotação de credenciais.
