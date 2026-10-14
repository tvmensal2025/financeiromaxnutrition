# Holes already found in round 3 (do NOT re-report; DO report a flaw in a fix, as "fix-of-K#")

## Critical
- K1 Quote check needs the page the agent actually read. Fix: our own per-task MCP tools `buscar` and `ler_pagina` (stdio server added to the per-task Hermes profile). The server saves every page snapshot locally and enforces the 25-search cap; the motor uploads snapshots to Supabase Storage and checks every quote against them.
- K2 DBOS only recovers workflows of the same application_version, so a deploy during a long wait strands work. Fix: short workflows (one step execution each); long state lives in our own tables; founder waits are parked DB states, not sleeping workflows; deadlines fire from a DBOS cron workflow that scans our tables.
- K3 Copying the ChatGPT auth.json between v1 and v2 containers makes two processes refresh the same token family (OpenAI revokes the family). Fix: v2 does its own device login (its own token family); Codex gets its own login too; never copy auth.json.
- K4 Maintenance depends on the founder's PC (only it reaches Supabase). Fix in Fase 0: private GitHub repo, EasyPanel auto-deploy from GitHub, migrations applied by GitHub Actions; approval is still his typed phrase.
- K5 Security debts. Fix in Fase 0: remove the founder role from helenasistema.publico; turn off the .env.local test mode; WhatsApp accepts only his number; risky approvals only in the authenticated app; RLS so the app writes only through the rail functions.
- K6 Motor must not use the service role. Fix: a least-privilege DB role for the motor; rotate the exposed keys before go-live.
- K7 Supabase Free has no backups. Fix: nightly backup outside Supabase plus a restore test.

## High
- K8 Caio's math: the model fills a structured template; code recomputes every number with a safe evaluator and rejects mismatches.
- K9 The validator itself is tested with planted fake quotes, wrong math and invented statutes.
- K10 Migrations are backward-compatible (expand, then contract).
- K11 v1 takes no new missions while v2 runs alongside.
- K12 The vigia self-heals by re-enqueueing with dedup IDs.
- K13 JSON parse failure gets exactly one format-fix retry.
- K14 Helena echoes its classification with an undo, and the app has a deterministic cancel button.

## Medium
- K15 ChatGPT per-app weekly cap plus our own daily budget.
- K16 ChatGPT account suspension is an explicit accepted risk with a trigger and a fallback decision.
- K17 Alert channel outside the VPS (ntfy or Telegram); the daily summary doubles as a heartbeat.
- K18 Statute table scope: LGPD, Código Civil art. 20, Lei 9.610/98, Marco Civil; source planalto.gov.br.
- K19 Test 3 checks the exact tool list the agent sees.
- K20 Test the session pooler with LISTEN/NOTIFY.
- K21 v1 history stays where it is; in-flight v1 work is not migrated.

## Low
- K22 Ravi (research agent) enters only when a playbook needs new research.
- K23 Time zone America/Sao_Paulo everywhere.
