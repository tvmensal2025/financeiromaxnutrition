# Verification of 17 documentation claims (read-only, public pages only)

Checked on 2026-10-09 with WebFetch/WebSearch only. Method note: WebFetch returns a model-condensed view of each page and caps quoted fragments at about 125 characters, so long sentences below are given as consecutive fragments. Every quote marked as verbatim was returned identically by at least two independent fetches, unless stated otherwise.

---

## 1. Supabase API keys (sb_sec_, per-component keys, reversible deactivation) - TRUE

- Prefix: "Use the publishable (`sb_publishable_xxx`) and secret (`sb_sec_xxx`) keys instead." The Key types table lists the format as "`sb_sec_...`".
- Per component: "Use a separate secret key for each backend component." (page: Security reference > Handling secret keys safely > Limiting the damage of a leak). The page states no maximum number of secret keys.
- Reversible: "For a legacy `anon` or `svc_role` key, deactivate the legacy keys in the same Dashboard section instead." followed by "Deactivation is reversible, so you can re-enable them if you find a client you missed."
- Extra: "Creating publishable and secret keys doesn't revoke your legacy keys." Deleting a secret key is not reversible: "Delete a secret key, which can't be undone".
- URL: https://supabase.com/docs/guides/api/api-keys

## 2. Supabase Free plan 500 MB read-only mode - TRUE

- "Free Plan projects enter read-only mode when your database size exceeds 500 MB."
- "While in read-only mode, all write operations are blocked" ... "including background jobs, scheduled tasks, and internal monitoring writes." (the dash-separated sentence, returned as two fragments)
- Also: "Background jobs and scheduled tasks resume writes automatically once the platform exits read-only mode." The page does not mention "cron" by name. The 500 MB limit is database size, not the 1 GB disk.
- URL: https://supabase.com/docs/guides/platform/database-size

## 3. Supabase changelog: new public tables no longer auto-exposed - TRUE (functions are a grey area)

- Entry title: "Breaking Change: Tables not exposed to Data and GraphQL API automatically" (posted 2026-04-28; changelog id 45329 = GitHub discussion #45329).
- Effective date for existing projects: 2026-10-30. Summary line on https://supabase.com/changelog.md: "Opt-in today, default for new projects on 2026-05-30, enforced on all projects on 2026-10-30." Discussion post: "October 30, 2026, when the new behavior is enforced on all existing projects." Today (2026-10-09) that date is still about 3 weeks away. New projects: default since 2026-05-30 (opt-out at project creation from 2026-04-28).
- Substance: "New tables in the public schema will no longer be exposed to the Supabase Data API by default." and "Existing tables are not affected in your project, they keep their current grants and stay reachable." GraphQL is covered by the title and "Data API, Supabase's auto-generated REST and GraphQL layer". Direct Postgres connections are unaffected.
- Functions: the changelog/discussion body does NOT describe any function change. Its SQL blocks cover tables and sequences only (no `EXECUTE`). The word "functions" appears only in the project-creation setting name: "Automatically expose new tables and functions". Maintainer steve-chavez (2026-08-08) on PUBLIC EXECUTE for functions: "`1` is not handled on purpose as that is the PostgreSQL default." and "so this needs further discussion and handling." But Supabase docs say: "New tables, functions, and sequences now require explicit grants before Data API roles can access them." and "Functions receive `EXECUTE`." (https://supabase.com/docs/guides/api/hardening-data-api, which also says "Supabase is changing the platform default to revoke these automatic grants"). So treat function exposure as unsettled and test it; do not assume functions are covered.
- URLs: https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically ; https://supabase.com/changelog.md ; https://github.com/orgs/supabase/discussions/45329

## 4. Supabase functions: any role (incl. anon) can execute; SECURITY DEFINER can return unreadable rows - TRUE

- Section "Function privileges": "By default, any role can run a database function."
- Section "Security definer vs invoker": "Any role can call it by default, including `anon`, the role that serves requests carrying no user session." and "A `security definer` function can return rows the caller isn't allowed to read."
- Also: "It runs with its creator's privileges." and "A function created in the Dashboard or by a migration is owned by `postgres`, which bypasses Row Level Security." Advice: "Revoke execute for the functions you want to protect, from both `public` and the role you're restricting".
- URL: https://supabase.com/docs/guides/database/functions

## 5. Supabase pg_net: async, no documented retry, responses kept about 6 hours - TRUE

- "pg_net enables Postgres to make asynchronous HTTP/HTTPS requests in SQL." and "It differs from the http extension in that it is asynchronous by default." (The docs never use the phrase "fire-and-forget"; it also says "HTTP requests are not started until the transaction is committed.")
- Retention: "Once a response is returned, by default, it is stored for 6 hours in the `net._http_response` table." Configurable: "The response messages are stored for only 6 hours to prevent needless buildup." (example sets `pg_net.ttl` to '24 hours').
- No retry: the Supabase page has no sentence about retries or delivery guarantees. The pg_net README (https://github.com/supabase/pg_net) says only that a user-built function "can be called using cron jobs or manually to retry failed requests", and that the tables do not store "all the necessary information to retry failed requests".
- Other facts: default `timeout_milliseconds` is 2000; "Intended to handle at most 200 requests per second."; tables are unlogged ("not preserved during a crash or unclean shutdown").
- URL: https://supabase.com/docs/guides/database/extensions/pg_net

## 6. Supabase backups / clone - TRUE

- Free has no daily backups: backups page "We automatically back up all Pro, Team, and Enterprise Plan projects on a daily basis." and "We recommend that free tier plan projects regularly export their data". The phrase "Free Plan" itself is not on the backups page. Pricing page, Free column: Automatic backups "Not included in free"; Point in time recovery "Not included in free". Pro: "Daily backups stored for 7 days."
- Storage objects: "Database backups do not include objects you store via the Storage API."
- Clone: page "Restore to a new project": "Access to this feature is exclusive to users on paid plans" (also requires physical backups enabled). It also says "Your S3/storage files and bucket configurations are NOT copied". The backups page only says "See the Duplicate Project docs." for restore-to-new-project.
- URLs: https://supabase.com/docs/guides/platform/backups ; https://supabase.com/docs/guides/platform/clone-project ; https://supabase.com/pricing

## 7. DBOS Python configuration - TRUE

- SQLite default: "If no connection string is provided, DBOS uses a SQLite database" (default path `sqlite:///[application_name].sqlite`, dashes in the app name become underscores). Field is `system_database_url`.
- Disable automatic migrations: yes, `run_migrations` (bool, default True): "Whether to create and migrate the system database on launch. Defaults to `True`." and "Set to `False` for a process that must not alter the schema, such as one whose database role cannot run DDL," "or a deployment that migrates out of band with `dbos migrate` or `DBOS.migrate`." With it off, launch only verifies the schema.
- `run_admin_server` / `admin_port`: do not appear anywhere on the page (not DBOSConfig fields in the current reference).
- System DB pool size: `sys_db_pool_size` (default 20): "The size of the connection pool used for the DBOS system database. Defaults to 20." (`db_engine_kwargs` and `sys_db_polling_concurrency` also exist.)
- URL: https://docs.dbos.dev/python/reference/configuration

## 8. DBOS Python: delete / garbage collection / retention - TRUE (nuance: deletion is manual in the OSS library)

- Methods that exist (reference page "Workflow Management Methods", all with `_async` variants): `DBOS.delete_workflow(workflow_id, *, delete_children=False)` and `DBOS.delete_workflows(workflow_ids, *, delete_children=False)`; also `list_workflows`, `list_queued_workflows`, `list_workflow_steps`, `cancel_workflow`, `cancel_workflows`, `resume_workflow`, `resume_workflows`, `fork_workflow`, `rewind_workflow`, `set_workflow_delay`, `update_workflow_attributes`.
- "Delete a workflow and all its associated data (inputs, outputs, step results, etc.) from the system database." and "This operation is irreversible. Once a workflow is deleted, it cannot be recovered, resumed, or forked."
- No OSS garbage-collect or retention method is documented: the words "garbage" and "retention" do not appear on the reference page; the CLI reference has no `dbos workflow delete` (subcommands: list, get, steps, cancel, resume, fork, queue list). So "and/or garbage-collect" is not supported; manual deletion is.
- Retention is a Conductor feature: "If you are using Conductor, you can configure workflow history retention policies for your application" "from the Retention Policy page of the DBOS Console." FAQ: "Conductor offers data retention, observability, cluster-wide metrics, alerts, and organization" "management with RBAC." Also from the FAQ: "Conductor is required for correct workflow recovery in applications that use more than one process."
- URLs: https://docs.dbos.dev/python/reference/contexts ; https://docs.dbos.dev/conductor/retention (also reachable as /production/retention) ; https://docs.dbos.dev/faq ; https://docs.dbos.dev/python/reference/cli . (The cited https://docs.dbos.dev/production/self-hosting/workflow-management could not be fetched (fetch error). https://docs.dbos.dev/production/workflow-management returned only front matter with "canonical: /conductor/workflow-management"; that Conductor page documents cancel, resume and fork in the DBOS Console, says nothing about deleting workflows, and links to a separate "Workflow Retention Policies" page. Similarly /production/retention and /production/conductor carry canonical paths /conductor/retention and /conductor/overview.)

## 9. DBOS queues / versions / cancel / fork - TRUE

- Queue tutorial, "Global Concurrency" warning: "Take care when using a global concurrency limit" "as any `PENDING` workflow on the queue counts toward the limit," "including workflows from previous application versions".
- Upgrading workflows, "Versioning": "All workflows are tagged with the application version on which they started." / "When DBOS tries to recover workflows, it only recovers workflows" "whose version matches the current application version." / "This prevents unsafe recovery of workflows that depend on different code."
- `DBOS.cancel_workflow(workflow_id, *, cancel_children=False)` exists: sets status to `CANCELLED` and removes it from its queue if enqueued.
- `DBOS.fork_workflow(workflow_id, start_step, *, application_version: Optional[str] = None, queue_name=None, queue_partition_key=None, replacement_children=None, timeout_seconds=None)` exists and does accept `application_version` ("It is possible to specify the application version on which the forked workflow will run").
- URLs: https://docs.dbos.dev/python/tutorials/queue-tutorial ; https://docs.dbos.dev/python/tutorials/upgrading-workflows ; https://docs.dbos.dev/python/reference/contexts ; https://docs.dbos.dev/python/tutorials/workflow-management

## 10. EasyPanel App service / builders - TRUE (no rollback feature is documented)

- Auto Deploy: "GitHub sources can also use auto deploy," "which triggers a deployment when the configured repository webhook receives a push." Overview has "Enable Auto Deploy" / "Disable Auto Deploy" which controls the GitHub webhook.
- Trigger URL (Deployments tab): "Sending a request to that URL starts a deployment" ... "The URL contains a secret token." Refreshing the token "immediately invalidates the previous URL".
- History: "The Deployments tab contains the recent deployment history".
- Rollback: not described. The words rollback, roll back, revert, "previous deployment", "previous version" do not appear on the App service page; the docs nav, Guides list and an easypanel.io search show no rollback page. Only "Restart recreates the running service from the current deployment."
- Resource limits for services (App page): "Configure memory reservations and limits in MB, and CPU reservations and limits in cores." and "Set a value to `0` for no limit."
- Builders page, resource limits for builds: in "Docker Buildx builders" you can "create and select a builder with CPU, memory, and swap limits;" "A resource-limited builder can protect application workloads from build spikes," "but a limit that is too low can terminate dependency installation or compilation." The page states no default CPU/memory limit for builds (builds use the currently selected Buildx builder), and troubleshooting says for out-of-memory builds "Increase the builder memory or swap, reduce parallel compilation, or use a remote builder." Builders offered: "Dockerfile, Cloud Native Buildpacks, Nixpacks, or Railpack."
- URLs: https://easypanel.io/docs/services/app ; https://easypanel.io/docs/builders ; https://easypanel.io/docs/guides/remote-docker-builder

## 11. Evolution API webhooks - TRUE (read the caveats)

- Source used: https://mintlify.wiki/EvolutionAPI/evolution-api/events/webhooks, a third-party auto-generated wiki, not the official docs. The official doc.evolution-api.com webhook pages do not mention headers, retries or timeouts, and the official `POST /webhook/set` reference lists only enabled, url, webhookByEvents, webhookBase64, events. The retry settings are confirmed in the official repo (`.env.example` on main) and in `webhook.controller.ts` (read through the GitHub web UI).
- Custom headers: "Custom HTTP headers to include in webhook requests. Useful for authentication." Example: `"headers": { "x-custom-header": "value" }`. A `jwt_key` entry under headers makes Evolution add `Authorization: Bearer <token>` (HS256 token, 10 minute expiry). Per source code, headers are applied only to per-instance webhooks; the global webhook (`WEBHOOK_GLOBAL_URL`) `axios.create` call sets only `baseURL` and `timeout`, so no custom headers are sent there.
- Retries (env defaults in `.env.example`): `WEBHOOK_RETRY_MAX_ATTEMPTS=10`, `WEBHOOK_RETRY_INITIAL_DELAY_SECONDS=5`, `WEBHOOK_RETRY_USE_EXPONENTIAL_BACKOFF=true`, `WEBHOOK_RETRY_MAX_DELAY_SECONDS=300`, `WEBHOOK_RETRY_JITTER_FACTOR=0.2`. Code: delay = min(initial x 2^(attempt-1), max) with +/-20% jitter; the 10 is total attempts including the first; network errors and timeouts are retried; after the last failure the error is only logged ("Todas as tentativas falharam."), with no dead-letter queue. Applies to instance and global webhooks.
- Timeout: `WEBHOOK_REQUEST_TIMEOUT_MS=60000` in `.env.example` ("Request timeout in milliseconds"); code fallback is 30000 ms if the variable is unset.
- Not retried: "# Comma separated list of HTTP status codes that should not trigger retries" `WEBHOOK_RETRY_NON_RETRYABLE_STATUS_CODES=400,401,403,404,422`. Success is "HTTP 200-299"; other failures (5xx, 408, 429, network) are retried.
- URLs: https://mintlify.wiki/EvolutionAPI/evolution-api/events/webhooks ; https://github.com/EvolutionAPI/evolution-api/blob/main/.env.example ; https://github.com/EvolutionAPI/evolution-api/blob/main/src/api/integrations/event/webhook/webhook.controller.ts ; https://doc.evolution-api.com/v2/en/configuration/webhooks

## 12. GitHub fine-grained PAT permissions - TRUE

- Workflow dispatch: for "Create a workflow dispatch event" the docs list "Fine-grained personal access tokens" among supported token types and state the required permission as "Actions" repository permissions (write). (OAuth/classic PAT: "need the `repo` scope".) The GitHub Apps permissions page also lists `POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches` as write under Actions.
- Workflow files: the fine-grained permission "Workflows" exists. REST docs for "Create or update file contents" and "Create a reference" say "The fine-grained token must have at least one of the following permission sets:" `"Contents" repository permissions (write)` / `"Contents" repository permissions (write) and "Workflows" repository permissions (write)`. The explicit `.github/workflows` sentence in the docs is for classic tokens: "The `workflow` scope is also required in order to modify files in the `.github/workflows` directory." For GitHub Apps: "If your app specifically needs to access or edit Actions files in the .github/workflows directory," "request the 'Workflows' repository permission." Limitation: the fetch tool truncates the big fine-grained-PAT permissions page before its repository tables, so the "Workflows" row there was not read directly.
- URLs: https://docs.github.com/en/rest/actions/workflows ; https://docs.github.com/en/rest/repos/contents ; https://docs.github.com/en/rest/git/refs ; https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens ; https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app

## 13. GitHub Free, private repos: environment reviewers, branch protection, rulesets - TRUE

- Required reviewers (reference page, Deployment protection rules > Required reviewers): "If you are on a GitHub Free, GitHub Pro, or GitHub Team plan," "required reviewers are only available for public repositories." Managing-environments page: "Users with GitHub Free plans can only configure environments for public repositories."
- Branch protection (About protected branches, "Who can use this feature?"): "Protected branches are available in public repositories with GitHub Free and GitHub Free for organizations." Private repos need "GitHub Pro, GitHub Team, GitHub Enterprise Cloud, and GitHub Enterprise Server."
- Rulesets (About rulesets): "Rulesets are available in public repositories with GitHub Free and GitHub Free for organizations," "and in public and private repositories with GitHub Pro, GitHub Team, and GitHub Enterprise Cloud."
- URLs: https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments ; https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-deployments/managing-environments-for-deployment ; https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches ; https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets

## 14. GitHub Mobile: run a workflow_dispatch workflow - TRUE

- GitHub Changelog 2024-07-30: "Developers can now manually run workflows set with `workflow_dispatch` directly from the Workflow view (Repository -> Actions -> Workflows) on GitHub Mobile." Also "enabling them to trigger workflows manually while on the go using GitHub Mobile." The 2024-08-07 mobile update lists it as "Workflow Dispatching!": "Kick off new Actions on the go from the list of workflow runs for a given workflow." The changelog does not say iOS vs Android.
- Caveats: the docs page "Manually running a workflow" does not mention GitHub Mobile (it lists Web browser, GitHub CLI, REST API), and the GitHub Mobile docs page does not mention Actions. The same page requires "Write access to the repository" and the `workflow_dispatch` trigger on the default branch. The mobile-browser path on github.com is not explicitly documented, but the web "Run workflow" button path is.
- URLs: https://github.blog/changelog/2024-07-30-run-workflows-set-as-workflow_dispatch-manually ; https://github.blog/changelog/2024-08-07-whats-new-in-mobile-july-update ; https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow

## 15. healthchecks.io - TRUE

- Docs (configuring checks): "Period is the expected time between pings." and "Grace Time is the additional time to wait before sending an alert when a check is late."
- Free plan: pricing page Hobbyist "$0 / month", "Monitor 20 jobs" (the page says "jobs", not "checks"), "100 log entries per job"; home page: "Monitor 20 cron jobs for free. No credit card required." Also "The "Hobbyist" and "Supporter" plans have the same limits".
- Integrations: home page integration list includes Email and "Telegram Chat" (along with Slack, Discord, ntfy, Signal, webhooks, etc.). Docs: "Healthchecks.io supports many types of integrations: email, webhooks, SMS, Slack, PagerDuty, etc." The docs text does not name Telegram, and the pricing page does not say which integrations are on which plan (SMS, WhatsApp and phone calls are paid credits).
- URLs: https://healthchecks.io/docs/configuring_checks/ ; https://healthchecks.io/docs/ ; https://healthchecks.io/pricing/ ; https://healthchecks.io/

## 16. ntfy.sh - TRUE

- FAQ ("If topic names are public, could I not just brute force them?"): "the topic name is your password, it says so everywhere" and "If you choose a randomly generated topic name, the topic is as good as a good password."
- Publish page: "Because there is no sign-up, the topic is essentially a password, so pick something that's not easily guessable". Landing page: "Note that topic names are public, so it's wise to choose something that cannot be guessed easily." Config docs: "By default, the ntfy server is open for everyone, meaning everyone can read and write to any topic"; ACLs / `deny-all` are the fix.
- Rate limits and bans: FAQ "For ntfy.sh, there are additional protections in place which will ban your IP pretty quickly." and "In the default configuration, you'll be able to do 60 requests as a burst, and then 1 request per 10 seconds." Config page (request limits): "Each visitor has a bucket of 60 requests" ... "After the 60, new requests will encounter a `429 Too Many Requests` response." refilled "one request every 5s". The /publish/ page itself shows no rate-limit text in the part the fetch could read; the FAQ and config page carry it. (Minor inconsistency: FAQ says 1 request per 10 s, config says per 5 s.)
- URLs: https://docs.ntfy.sh/faq/ ; https://docs.ntfy.sh/publish/ ; https://docs.ntfy.sh/config/ ; https://docs.ntfy.sh/

## 17. Docker published ports bypass ufw - TRUE

- Section "Docker and ufw": "Docker and ufw use firewall rules in ways that make them incompatible with each other." / "When you publish a container's ports using Docker, traffic to and from that container gets diverted" (continues: "before it goes through the ufw firewall settings.") / "Packets are routed before the firewall rules can be applied, effectively ignoring your firewall configuration."
- The packet-filtering page speaks of "publish a container's ports" and does not use the literal `-p`; the port-publishing page says "Use the `--publish` or `-p` flag to make a port available outside the host," and "Publishing container ports is insecure by default." Binding to localhost: "only the Docker host can access the published container port."
- URLs: https://docs.docker.com/engine/network/packet-filtering-firewalls/ ; https://docs.docker.com/engine/network/port-publishing/
