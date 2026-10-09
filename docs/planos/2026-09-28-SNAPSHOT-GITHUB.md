# Snapshot de trabalho enviado ao GitHub em 2026-09-28

Repositório: `tvmensal2025/financeiromaxnutrition`.

Este snapshot preserva o trabalho local em três branches, sem substituir `main` e sem acionar os agentes:

- `codex/helena-local-complete-20260928`: interface, página de entregas, Gateway, testes, migrações, documentação, auditoria inicial e scripts locais arquivados. Commits `5357861` e `55de3e8`.
- `codex/helena-dispatch-local-20260928`: despachante Hermes com confirmação de pedido da Marina e entrada de polling. Commit `e454ac1`.
- `codex/helena-runtime-local-20260928`: ajustes da Central de Execução e registro de validação do piloto. Commit `0c2f64e`.

O trabalho visual de entregas do commit `7ae9a27` também já está na branch remota `codex/hermes-runtime-preparation`. As branches acima são cópias separadas de trabalho; não representam uma versão integrada nem implantação em produção.

Validação deste envio: interface principal compilou e passou 126 testes; Gateway passou sua suíte; despachante passou 27 testes Python; Central de Execução compilou e passou 8 testes direcionados. Não houve teste de operação real dos 21 agentes neste envio.

Arquivos com credenciais, caches, logs, builds e cópias temporárias permanecem somente no computador. Dois relatórios de vínculos Hermes foram enviados com chaves removidas; as versões originais estão em `work/github-private-backup-20260928`, ignorada pelo Git.
