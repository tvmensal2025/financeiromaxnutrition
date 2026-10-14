# Brief for round 3: attack the corrected "Sistema Helena v2" plan

## Who and why
- A solo founder in Brazil. He writes pt-BR and is not a programmer; everything is built and maintained by AI sessions. He runs four small companies: iGreen, Saúde, Humano Digital and eLiving.
- He wants AI agents that work like trained employees. His model:
  1. He talks to Helena, the coordinator agent.
  2. The request is saved in Supabase as a CARD.
  3. The card is picked up automatically, and the responsible agent works on it and passes it on.
  4. The final result comes back to the card, organized and readable.
- In his words: "Não pode ter erro de forma alguma. A lógica tem que ser exata." Maintenance must be quick. Things must stay organized when he swaps models or adds functions.
- His latest message: the second analysis "reduced the plan to 3 holes"; he wants "um plano onde não tenha furo nenhum" and asks to "refazer o melhor plano até agora".
  - Note: he misread. The 3 holes were in the PREVIOUS plan and the corrected plan addresses them.
  - Your job: find what is STILL open in the corrected plan.
- First real goal: research and plan how to recruit the first 10 people for a Humano Digital program (platforms like Mimix and Hub). Playbook steps:
  - E1 Caio: revenue math (10 people × hours × US$0.50, 3 scenarios)
  - E2 Isabela: training script
  - E3 Isabela: invitation text (no income promise)
  - E4 Clara: legal check on image, voice and LGPD
  - E5 Helena: final report with a checklist of what only the founder does
- Agents NEVER sign up, contact outsiders, spend, sign, commit or publish.

## The plan under attack
- Full text (pt-BR): `plano-rev80.md` in this folder. Read it completely.
- The top section, "Segunda análise", is the current decision. The rest of the doc is the detailed plan, already partly updated to match it.
- The appendix at the end has the evidence.

## Stack today (v1, running)
- **Supabase:** hosted Postgres, project "ecosistemadossonhos", with 61 tables and about 38 SQL guard functions (gateway_*, helena_*). The plan tier (Free or Pro) is UNKNOWN. Cloud AI sessions cannot reach *.supabase.co. Today DB access goes only through an AI session on the founder's Windows PC (Supabase CLI), which goes offline when idle.
- **App:** React/Vite. It runs on his PC (localhost:8080) and is also deployed as "ids-app".
  - Known security debts: a ".env.local" test mode opens the app without login, so anyone on his Wi-Fi gets the founder role. The user "helenasistema.publico" still holds an active founder role.
- **helena-gateway:** Node MCP server deployed on EasyPanel by zip upload (no GitHub deploy yet).
- **Hermes Agent:** Nous Research, Python. It runs 21 agent profiles in ONE container on a 4 shared-vCPU / 15.6 GB VPS. The same VPS also runs the app, the gateway and WhatsApp (Evolution API).
  - A Hermes cron dispatcher runs every 2 minutes.
  - Ports 9119 (dashboard) and 8642 (API server) are published to the internet.
- **Models:** the founder's ChatGPT subscription via Hermes' openai-codex OAuth provider (auth.json with refresh-token rotation). Decision DEC-014: no paid OpenAI API in this phase. HTTP 429 quota errors already happened.
- **Exposed secrets:** keys were pasted in chat (Supabase service role, OpenAI and others). Rotation was agreed "after the tests".
- **v1 failure history:** seven hand-written SQL/dispatcher guards interacted badly ("seven locks in a row"). Deliveries were good; the plumbing failed.

## Verified facts (do not re-verify; cite them if useful)
- **DBOS Transact (Python, MIT):**
  - Stores checkpoints in the Postgres "dbos" schema. With Supabase, use the direct connection or the session pooler.
  - Steps run at least once and are never re-executed after they complete. The workflow ID is an idempotency key.
  - Queues support worker/global concurrency, rate limits, priority, deduplication_id and partitioned queues (per-key concurrency).
  - Workflow timeouts cancel at the next step. Python sync steps cannot be preempted; only async steps marked preemptible can be.
  - On restart, a single server recovers its PENDING workflows. DBOS only recovers workflows whose application_version matches the running code; a patching API exists.
  - Without the paid Conductor, a dead executor's workflows are not reassigned automatically.
  - It can enqueue from SQL functions and triggers, has durable sleep and cron schedules, and its default pool is 20.
- **Hermes (source at ../analise2/src/hermes-agent):**
  - `hermes -z <prompt>` is a one-shot mode: final text out, nothing else.
  - The legacy `hermes-agent` runner has `--max-turns`, `--enabled-toolsets`, `--disabled-toolsets` and `--list-tools`.
  - In config: memory_enabled, user_profile_enabled, background_review and curator are ON by default and can be turned off.
  - run_budget_seconds only injects a wrap-up notice at 80% of the budget; it does not kill the process.
  - Since v2026.9.14 (commit 66ddd5f83c), Codex token refresh is serialized with a cross-process flock on the auth store. Concurrent refresh with the same refresh token makes OpenAI revoke the whole token family.
- **Codex CLI:** `codex exec` runs read-only by default and supports `--output-schema`, `--ephemeral` and `--json`. It needs its own ChatGPT login.
- **ChatGPT:**
  - Hermes is one of 16 official ChatGPT plan-usage partners (announced 2026-09-29). Usage counts against plan limits and stops at the limit; always-on automation is not addressed.
  - Plus estimates per 5 hours: GPT-6.1 Sol 15–160 messages, GPT-6 Luna 350–3,000. Pro has no 5-hour limit, but weekly limits may apply.
- **Supabase Free plan:** 500 MB database, no daily backups, no PITR, and projects pause after 1 week of inactivity.

## What counts as a HOLE
A concrete scenario that is realistic for THIS setup and that the plan does not (a) prevent, (b) detect and make visible, or (c) recover from, with a test that proves it. It must lead to at least one of these:
- a wrong result reaching the founder unflagged
- a card lost, duplicated, stuck with no owner or deadline, or silently waiting
- a security breach or abuse path
- an unrecoverable state
- maintenance becoming impossible or slow
- a quota or cost blowout
- the founder being misled by the doc itself (false or unverifiable claims)
