# DEC-026 — Motor da v2: DBOS

- **Data:** 10/10/2026
- **Número:** PROVISÓRIO. O Supabase é a fonte dos números; antes de usar este número, conferir lá (só leitura) que ele está livre.
- **Quem decidiu:** o fundador, respondendo na sessão do Claude Code de 10/10/2026.

## O que foi decidido
O motor da v2 é o **DBOS Transact** (biblioteca Python, licença MIT), como está no plano `docs/plano/PLANO-HELENA-V3.md`.

## Por quê
É o que o plano já previa. A alternativa (um motor próprio no Postgres) foi avaliada na análise de 10/10 e considerada uma reversão sem motivo forte. O estado do card fica em tabelas nossas, então trocar de motor um dia não mexe em nenhum card.

## O que muda
- A tabela de passagens (`helena-v2/maquina/`) continua neutra quanto ao motor.
- "A trava única do motor é liberada quando ele cai" vira um teste que bloqueia a fase 2.

## Fonte
`docs/arquivo/sessao-20261010/DECISOES-DO-FUNDADOR-20261010.md`
