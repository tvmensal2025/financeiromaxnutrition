# 14 — Design handoff

Code Surgeon não alterou layout, cor ou hierarquia das homes. Itens visuais ficam para o MAX Design Director.

| Screen | Component | Issue | Source | Severity |
|---|---|---|---|---|
| Alex academia | `AlexDashboardHub` | A linha local de Voltar da aba Treinos saiu porque a academia não fica mais dentro do hub. O voltar é o `MobileHeader` da seção `exercicios` | `AlexDashboardHub.tsx` | baixa, consequência da canonicalização |
| Menu Mais Alex | item cronômetro | Texto passou de “Cronômetro & Academia Pro / Web Audio” para “Cronômetro de descanso / Intervalo entre séries” para não prometer a página de verificação | `MoreMenuSheet.tsx` | copy mínima, necessária para a função |
| Dr. Vital 360 | `DrVital360Page` | Calorias podem aparecer como 2000 sem meta real | fallback `\|\| 2000` | P2 data truth, não redesign |
| Verificação academia | `GymVerificationPage` | Visual de auditoria (programa demo) | rota direta | não promover no produto |

Homes Sirlene, Alex, Vital e Rafael não foram redesenhadas.
