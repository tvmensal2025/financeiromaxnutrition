# Legado em observação de 7 dias

PRODUCTION COMMIT: `1f6e5177f63a25b980548156fc0e28a65bd87e16`

DEPLOY COMMIT pretendido: `d66a39397150c6de77aa8c9ede1ef32150c60fe9`

PUSH: 22 de setembro de 2026, 18:09 (America/Sao_Paulo). `origin/main` recebeu `0d814829..d66a3939`.

HOST: às 18:20 o site `https://app.oficialmaxnutrition.com.br` ainda servia o deployment `07d01fa6-0d15-4859-b093-8eb6841981ed` e o asset `/assets/index-fb2f96f6.js`. A observação não começou.

OBSERVATION_START: não registrado. O relógio só conta depois do smoke do deployment novo.

DAY 0 previsto: só depois que o host publicar `d66a3939` e o smoke passar.

Status de todos: `PENDING_7_DAY_OBSERVATION`.

Durante os 7 dias não há limpeza estrutural. Correção permitida: P0, P1 ou bug real de produção. Cada correção entra em commit novo e fica registrada aqui, com a versão nova. Nada de mudança escondida.

Nenhum item foi apagado. Nenhum tem conflito ativo com o dono canônico.

| Item | Conflito ativo | Por que fica |
| --- | --- | --- |
| `src/pages/GoalsPage.tsx` | NO | A rota de metas é `GoalsPageV2`. Este arquivo não tem import. |
| `src/pages/GoogleFitPage.tsx` | NO | `/google-fit` vai para `/wearable-connect`. A página antiga continua no disco. |
| `AlexAthleteHub` | NO | A home do Alex não monta este hub. |
| `AlexActionsSection` | NO | Sem caller de produto. |
| `AlexDailyPriorityCard` | NO | Sem caller de produto. |
| Família `unified-timer` | NO | Sem caller de produto. Há teste. O descanso do treino é outro componente. |
| `AIEnhancedTimer` | NO | Só o barrel. |
| `RestTimer` e `InlineRestTimer` | NO | Aliases do timer antigo. |
| `supabase/functions/stripe-checkout` | NO | O app chama `create-checkout`. |
| Stubs 410 do Asaas | NO | Não há UI nem chamada de pagamento. O histórico do banco fica. |
| Assinatura `add_user_xp` | NO | Nenhum caller. O writer é `award_user_points`. |
| `get_next_job` no arquivo de migrations | NO | Não há caller. O claim é o worker da VPS. |

Fora desta lista, de propósito: GPS, `AlexTracking2DMap`, `MapBoxStyleMap`, `CityCharactersLayer` e `camera_workout_sessions`.

Revisão só depois dos 7 dias. Esta observação não autoriza delete.
