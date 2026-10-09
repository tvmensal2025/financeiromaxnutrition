# 03 — Funções quebradas

Evidência desta passagem: typecheck, diff e leitura de handlers. Sem Playwright autenticado.

## Corrigidas nesta tarefa

| ID | Sev | O que estava quebrado | Prova | Correção |
|---|---|---|---|---|
| CS-001 | P1 | `GLP1MuscleDefenseCard` chamava `resolveAudioUrl` sem import. `typecheck:app` FAIL | erro TS2304; diff pré-existente removeu o import | import restaurado. Lógica de `resolveMedication` preservada |
| CS-002 | P1 | Menu Alex “Cronômetro & Academia Pro” abria `GymVerificationPage` (painel de auditoria com `MASTER_PROGRAMS[0]`) | `MoreMenuSheet` `route: '/gym-verification'` | rota do menu → `/dashboard?section=exercicios&tool=timer` |
| CS-003 | P1 | Salvar metas em `/nutricao` gravava 2000/150/250/65/25 se o campo viesse vazio ou inválido | `Number(goalCalories) \|\| 2000` | recusa o save e não inventa meta |

## Abertas

| ID | Sev | Função | Evidência | Decisão |
|---|---|---|---|---|
| CS-004 | P2 | Dois `ExerciseDashboard` vivos | hub e `SofiaPage` | **CONSOLIDATED** — só `SofiaPage` monta. Aba Treinos e `tab=treinos` abrem `section=exercicios` |
| CS-005 | P2 | Fallback visual de calorias `\|\| 2000` | `DrVital360Page`, `DailyNutritionWidget`, `MealPlanDisplay` | não reescrever as telas nesta passagem |
| CS-006 | P2 | Três timers ( `AlexRestTimerDialog`, `InlineRestEngine`, `UnifiedTimer` ) | só os dois primeiros têm caller de produto; UnifiedTimer só barrel/teste | não fundir sem escolher o motor de áudio |
| CS-007 | P3 | `GoogleFitPage` sem rota | import removido; `/google-fit` redireciona | arquivo mantido. FUTURE: comparar com wearable, não reconstruir agora |
| CS-008 | P2 | `AlexDailyPriorityCard` | sem mount; continua sessão ativa, o hero só abre a academia | LEGACY_USEFUL. Não apagar |
| CS-009 | P1 | Rafael Metas/Áudios | hub não passava callbacks | **FIXED** |
| CS-010 | P2 | Evolução 360 do Rafael (`?tab=evolucao360`) | sem entrada na home | **FIXED** — anel “Seu dia” e “Últimos 7 dias” abrem `evolucao360`. Exportar/compartilhar não simulam sucesso |
| CS-011 | P1 | Clínica do Vital mostrava Mounjaro 2,5 mg, 4/4 doses e marcadores de exame fixos | `DrVitalClinicaView` | **FIXED** no protocolo e na lista de exames. Gráficos restantes: CS-012 |
| CS-012 | P1 | Sinais 118/76 e cardio 72,5 kg / riscos escritos | `DrVitalClinicaView` | **FIXED**. Pressão, glicemia, HDL, PCR, cintura e riscos fictícios saíram. FC, SpO2 e sono usam `healthToday`. Peso usa medição > 0 ou — |
| CS-013 | P1 | Meta nutricional carregava 2000 kcal e 2000 ml sem registro | `useDailyNutritionTracking` | **FIXED**. Sem meta o diário mostra — . Registrar água não depende da meta |

## P0

Nenhum P0 novo além dos já corrigidos no worktree pré-existente (RT-001 auth, PR-001…PR-007). RLS e guards não foram afrouxados.

## O que não foi chamado de quebrado

`onClick={handler}` sem execução ao vivo permanece `UNRESOLVED`, não `BROKEN`.
