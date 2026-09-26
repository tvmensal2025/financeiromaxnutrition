# Helena Gateway — Backend Operacional & MCP Hub

O **Helena Gateway** é o serviço backend independente do Sistema Helena, projetado para operar como canal operacional contínuo e hub de ferramentas Model Context Protocol (MCP) entre:
- **Helena (CEO Virtual)** operando no ChatGPT oficial;
- **Marina (PMO / Despachante)** e os **20 Bots Especialistas** operando no Grok;
- **Supabase** como a fonte canônica e operacional de verdade (Project: `wxkgrykduqtsgmjkzlou`);
- **EasyPanel / VPS** como ambiente de hospedagem autônomo e de alta disponibilidade;
- **Evolution API** como canal assíncrono de notificações transacionais via WhatsApp.

Este serviço foi construído de forma desacoplada, **sem alterar o aplicativo financeiro principal**, sem utilizar APIs pagas como executores automáticos e sem expor credenciais sensíveis no repositório.

---

## 1. Arquitetura do Sistema

```
                    ┌────────────────────────────────────────┐
                    │      Helena (CEO Virtual / ChatGPT)     │
                    └───────────────────┬────────────────────┘
                                        │ (Decisões Estratégicas / Handoffs)
                                        ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      Supabase (Fonte Canônica)                         │
│  - public.agent_jobs (Fila de Tarefas / Status Machine)                │
│  - public.agent_job_events (Histórico Append-Only de Eventos)          │
│  - public.agent_connections (21 Agentes: Provedor & Status)            │
│  - public.notification_outbox (Fila Assíncrona de Mensagens)           │
│  - RPCs Atômicas de Governança (Claim, Start, Complete, Fail, etc.)    │
└───────────────▲───────────────────────────────────────▲────────────────┘
                │ Database Webhook (WAKE_SIGNAL)        │ RPCs & REST
                ▼                                       ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Helena Gateway (Node 22 / Express)                   │
│                                                                        │
│  [GET /health]                                                         │
│  - Verifica integridade técnica com o Supabase                         │
│                                                                        │
│  [POST /webhooks/supabase/agent-job]                                   │
│  - Recebe sinalização assíncrona e registra WAKE_SIGNAL                │
│                                                                        │
│  [POST /mcp] (Bearer Auth)                                             │
│  - Hub MCP (JSON-RPC 2.0 / Streamable HTTP)                            │
│  - 10 Ferramentas Oficiais com Governança V9                           │
│                                                                        │
│  [Rotinas Periódicas de Background]                                    │
│  - gateway_release_scheduled_jobs (Liberação de jobs agendados)        │
│  - outbox_processor (Envio assíncrono para Evolution API com retry)    │
└───────────────▲────────────────────────────────────────────────────────┘
                │
                │ MCP Tools / JSON-RPC 2.0 (Authorization: Bearer)
                │
┌───────────────┴────────────────────────────────────────────────────────┐
│                       Grok Bots / Especialistas                        │
│                                                                        │
│  - AGT-17 Marina (PMO): list_ready_jobs, record_dispatch               │
│  - Especialistas (AGT-02 a AGT-21):                                    │
│      claim_job -> start_job -> executar -> complete_job (com evidência)│
│  - Handoffs automáticos entre agentes: enqueue_job                     │
│  - Impasses executivos: waiting_helena                                 │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Governança e Protocolo Operacional V9

O Gateway implementa estritamente os princípios do **Protocolo V9 (PAG-V9-001 ao PAG-V9-017)**:

1. **Supabase como Fonte Única da Verdade:** Nenhuma ação é considerada concluída se não estiver gravada com chave e timestamp no Supabase. O fundador não atua como mensageiro de dados.
2. **Marina Despachante (`record_dispatch`):** A Marina despacha o job identificando o especialista de destino, criando o evento `DISPATCHED`. O job **permanece com status `READY`** até que o especialista assuma a titularidade via `claim_job`. O despacho possui cooldown de 180 segundos para evitar redundância.
3. **Reivindicação Atômica (`claim_job`):** Apenas o especialista de destino pode reivindicar o job (`READY` → `CLAIMED`), impedindo condições de corrida.
4. **Execução Oficial (`start_job`):** Transição auditada (`CLAIMED` → `RUNNING`).
5. **Conclusão Obrigatória com Evidências (`complete_job`):** É **terminantemente proibido** concluir um job sem preencher `result_summary` e informar pelo menos 1 registro em `evidence_refs` (IDs de tabelas, links, hashes ou logs). Tentativas sem evidência são bloqueadas pelo Gateway antes mesmo da gravação.
6. **Reporte Transparente de Falhas (`fail_job`):** Se houver bloqueio técnico, a falha é registrada com `error_code` e `error_message`, sem camuflagem.
7. **Escalonamento para a CEO (`waiting_helena`):** Em decisões fora da alçada do especialista, o job transiciona para `WAITING_HELENA` contendo `contexto`, `impacto`, `decisao_necessaria` e `recomendacao`. Helena consome isso diretamente pelo Supabase.
8. **Handoff Direto (`enqueue_job`):** O especialista enfileira o próximo job da cadeia técnica automaticamente.

---

## 3. Endpoints HTTP do Gateway

| Método | Endpoint | Autenticação | Descrição |
|---|---|---|---|
| `GET` | `/.well-known/oauth-protected-resource` | Pública | RFC 9728 Protected Resource Metadata. Anuncia o Supabase Auth como Authorization Server oficial para clientes MCP (ex: Grok). |
| `GET` | `/.well-known/oauth-protected-resource/mcp` | Pública | Endpoint canônico de metadata anunciado no header `WWW-Authenticate` quando `/mcp` é chamado sem token. |
| `GET` | `/health` | Pública | Teste de conectividade com o Supabase e Supabase JWKS. Retorna `{ "ok": true, "supabase": true, "oauth": true, "mcp": true }`. |
| `POST` | `/webhooks/supabase/agent-job` | Header `x-helena-webhook-secret` | Recebe webhook de novos jobs cadastrados no Supabase e registra evento `WAKE_SIGNAL`. |
| `POST` | `/webhooks/evolution` | Segredo `EVOLUTION_WEBHOOK_SECRET` (header `x-evolution-webhook-secret` e/ou query `secret`) | Recebe eventos da Evolution API. Sem segredo ou segredo errado: HTTP 401, sem gravar, sem job, sem WhatsApp. |
| `POST` | `/api/integrations/evolution/connect` | Bearer OAuth 2.1 / Fallback | Inicia conexão WhatsApp (QR). Sem auth: 401. |
| `POST` | `/api/integrations/evolution/pair` | Bearer OAuth 2.1 / Fallback | Pareamento por telefone. Sem auth: 401. |
| `POST` | `/api/integrations/evolution/webhook/setup` | Bearer OAuth 2.1 / Fallback | Re-registra o webhook na Evolution já incluindo o segredo. |
| `POST` | `/api/integrations/meowcaller/connect` | Bearer OAuth 2.1 / Fallback | Inicia sessão de ligações WhatsApp. Sem auth: 401. |
| `POST` | `/api/integrations/meowcaller/pair-phone` | Bearer OAuth 2.1 / Fallback | Código de pareamento de 8 dígitos. Sem auth: 401. |
| `GET` | `/api/integrations/evolution/status` | Opcional | Status de leitura; dashboard pode consultar sem login. |
| `GET` | `/api/integrations/meowcaller/status` | Opcional | Status de leitura; dashboard pode consultar sem login. |
| `GET` | `/mcp` | Bearer OAuth 2.1 / Fallback | Metadados do servidor MCP e lista de ferramentas disponíveis. |
| `POST` | `/mcp` | Bearer OAuth 2.1 / Fallback | Canal JSON-RPC 2.0 para execução (`tools/call`), listagem (`tools/list`) e handshake (`initialize`). Sem token retorna 401 com `WWW-Authenticate`. |
| `POST` | `/api/tools/:toolName` | Bearer OAuth 2.1 / Fallback | Endpoint REST alternativo para chamada direta de qualquer uma das 10 ferramentas. |

---

## 3.1 Arquitetura OAuth 2.1 com Supabase Auth

O Gateway opera como um **Resource Server OAuth 2.1**, delegando a autenticação ao Supabase Auth:

1. **Authorization Server / Issuer:** `https://wxkgrykduqtsgmjkzlou.supabase.co/auth/v1`
2. **Discovery Endpoint:** `https://wxkgrykduqtsgmjkzlou.supabase.co/.well-known/oauth-authorization-server/auth/v1`
3. **Dynamic Client Registration (DCR):** `https://wxkgrykduqtsgmjkzlou.supabase.co/auth/v1/oauth/clients/register`
4. **JWKS Remoto para Validação de Tokens:** `https://wxkgrykduqtsgmjkzlou.supabase.co/auth/v1/.well-known/jwks.json`
5. **Fluxo do Grok / Cliente MCP:**
   - Grok chama `/mcp` sem token.
   - Gateway responde com `HTTP 401` e header `WWW-Authenticate: Bearer resource_metadata="https://.../.well-known/oauth-protected-resource/mcp"`.
   - Grok lê o metadata, descobre o endpoint DCR do Supabase e registra-se dinamicamente (cliente público com PKCE).
   - Usuário autoriza no Supabase Auth e o Grok obtém o Access Token JWT.
   - Grok envia requisição ao `/mcp` com `Authorization: Bearer <token>`.
   - Gateway valida a assinatura via JWKS (`jose`), confere `iss`, `sub`, `exp` e expõe a identidade (`user_id`, `client_id`, `scopes`) nas ferramentas MCP.

---

## 4. Catálogo das 10 Ferramentas MCP

### 1. `list_ready_jobs`
- **Finalidade:** Lista jobs prontos (`status = 'READY'` e `available_at <= now()`), ordenados por prioridade (`CRITICA`, `ALTA`, `MEDIA`, `BAIXA`) e `created_at`.
- **Enriquecimento:** Cruza dados com `agent_connections` e `agentes`.
- **Saída:** Retorna dados completos e a `dispatch_message` formatada com instruções operacionais.
- **Parâmetros:**
  - `limit` (opcional, padrão 10, máx 25)
  - `agent_id` (opcional, filtro específico)

### 2. `record_dispatch`
- **Finalidade:** Marina registra o despacho do job para o especialista.
- **Regra:** O job permanece `READY`. Cria evento `DISPATCHED` em `public.agent_job_events`.
- **Cooldown:** Bloqueia despachos repetidos para o mesmo job em um intervalo de 180 segundos.
- **Parâmetros:**
  - `job_id` (obrigatório)
  - `dispatcher_agent_id` (opcional, padrão `AGT-17`)
  - `target_agent_id` (opcional)
  - `target_external_agent_id` (opcional)
  - `notes` (opcional)

### 3. `get_job`
- **Finalidade:** Recupera os dados completos de um job, histórico recente de eventos e metadados de conexão do agente.
- **Parâmetros:**
  - `job_id` (obrigatório)

### 4. `claim_job`
- **Finalidade:** Reivindicação atômica do job pelo especialista via RPC `gateway_claim_agent_job`. Transição: `READY` → `CLAIMED`.
- **Parâmetros:**
  - `job_id` (obrigatório)
  - `agent_id` (obrigatório)

### 5. `start_job`
- **Finalidade:** Iniciação da execução técnica via RPC `gateway_start_agent_job`. Transição: `CLAIMED` → `RUNNING`.
- **Parâmetros:**
  - `job_id` (obrigatório)
  - `agent_id` (obrigatório)

### 6. `complete_job`
- **Finalidade:** Conclusão da tarefa via RPC `gateway_complete_agent_job`. Transição: `RUNNING`/`CLAIMED` → `COMPLETED`.
- **Regra Estrita V9:** Exige `result_summary` e pelo menos 1 evidência em `evidence_refs`.
- **Parâmetros:**
  - `job_id` (obrigatório)
  - `agent_id` (obrigatório)
  - `result_summary` (obrigatório)
  - `evidence_refs` (array obrigatório com ≥ 1 item)
  - `result_payload` (objeto opcional)

### 7. `fail_job`
- **Finalidade:** Registro transparente de falha técnica ou operacional via RPC `gateway_fail_agent_job`. Transição: → `FAILED`.
- **Parâmetros:**
  - `job_id` (obrigatório)
  - `agent_id` (obrigatório)
  - `error_code` (obrigatório)
  - `error_message` (obrigatório)
  - `payload` (objeto opcional)

### 8. `waiting_helena`
- **Finalidade:** Encaminha impasse ou decisão de alçada para a CEO Virtual Helena via RPC `gateway_waiting_helena`. Transição: → `WAITING_HELENA`.
- **Parâmetros:**
  - `job_id` (obrigatório)
  - `agent_id` (obrigatório)
  - `contexto` (obrigatório)
  - `impacto` (obrigatório)
  - `decisao_necessaria` (obrigatório)
  - `recomendacao` (obrigatório)

### 9. `enqueue_job`
- **Finalidade:** Enfileiramento de novo job via RPC `gateway_enqueue_agent_job` para agendamento futuro ou handoff imediato entre agentes.
- **Parâmetros:**
  - `agent_id` (obrigatório)
  - `objective` (obrigatório)
  - `instruction` (opcional)
  - `business_id` (opcional)
  - `task_id` (opcional)
  - `priority` (opcional: `CRITICA`, `ALTA`, `MEDIA`, `BAIXA`)
  - `scheduled_at` (opcional ISO timestamp)
  - `available_at` (opcional ISO timestamp)
  - `approval_required` (opcional boolean)
  - `idempotency_key` (opcional)
  - `correlation_id` (opcional)

### 10. `queue_summary`
- **Finalidade:** Resumo analítico da fila por status, prioridade e agente para acompanhamento da Marina (PMO) e Daniel (BI).
- **Parâmetros:**
  - `business_id` (opcional)

---

## 5. Variáveis de Ambiente (Configuração EasyPanel)

As credenciais e parâmetros operacionais **NÃO devem ser commitados no repositório**. Todas as variáveis sensíveis são configuradas exclusivamente no painel do EasyPanel ou em arquivo `.env` seguro na VPS:

```env
# Porta e Host
PORT=3000
PUBLIC_HOST=DADO A CONFIGURAR (ex: gateway.seudominio.com)

# Supabase (Banco de Produção)
SUPABASE_URL=https://wxkgrykduqtsgmjkzlou.supabase.co
SUPABASE_SERVICE_ROLE_KEY=CONFIGURAR_SOMENTE_NO_EASYPANEL

# Autenticação de Entrada
GATEWAY_WEBHOOK_SECRET=CONFIGURAR_SOMENTE_NO_EASYPANEL
MCP_BEARER_TOKEN=CONFIGURAR_SOMENTE_NO_EASYPANEL

# Intervalos Operacionais
DISPATCH_COOLDOWN_SECONDS=180
SCHEDULE_TICK_MS=15000
OUTBOX_TICK_MS=15000

# Evolution API (WhatsApp) — Opcional (ativado somente se as 3 forem preenchidas)
EVOLUTION_BASE_URL=
EVOLUTION_API_KEY=
EVOLUTION_INSTANCE=

# Segredo compartilhado do webhook Evolution (obrigatório em produção; fail-closed se vazio)
# Preencher somente no EasyPanel. Sem valor no repositório.
EVOLUTION_WEBHOOK_SECRET=
```

### 5.1 Webhook Evolution — fail-closed e ordem segura de publicação

`POST /webhooks/evolution` exige `EVOLUTION_WEBHOOK_SECRET` **antes** de gravar comunicação, criar job ou enviar WhatsApp.

- **Header:** `x-evolution-webhook-secret` (aliases aceitos: `x-webhook-secret`, `x-helena-webhook-secret`)
- **Query:** `?secret=`
- Comparação em tempo constante. O valor nunca é logado.
- **Se a variável NÃO estiver definida:** o gateway responde **401** (fail-closed). Mensagens reais da Evolution deixam de ser processadas até o segredo existir e o webhook ser re-registrado.
- `setEvolutionWebhook` / `POST /api/integrations/evolution/webhook/setup` recusam registrar URL sem o segredo. Com o segredo definido, a Evolution API v2 é configurada com:
  1. query param `secret` na URL (funciona mesmo se a instância não enviar headers customizados);
  2. header `x-evolution-webhook-secret` no campo `webhook.headers` da Evolution v2.

**Ordem segura de publicação (não inverter):**

1. Definir `EVOLUTION_WEBHOOK_SECRET` no EasyPanel (ainda sem merge desta mudança, se possível).
2. Publicar / fazer merge em `main` (o EasyPanel pode publicar sozinho).
3. Re-registrar o webhook pela rota autenticada `POST /api/integrations/evolution/webhook/setup` (Bearer válido).
4. Enviar uma mensagem de teste no WhatsApp e confirmar auto-resposta + registro em `comunicacoes`.

Há uma janela entre os passos 2 e 3 em que a Evolution ainda aponta para a URL antiga (sem segredo) e o gateway já recusa com 401. Minimize essa janela executando o passo 3 imediatamente após o deploy.

Rotas de **conectar/parear** WhatsApp (`/api/integrations/evolution/connect`, `/api/integrations/evolution/pair`, `/api/integrations/meowcaller/connect`, `/api/integrations/meowcaller/pair-phone`) passam a exigir o mesmo `authenticateUser` já usado no MCP. Rotas só de leitura de status continuam com auth opcional.

---

## 6. Procedimento de Deploy no EasyPanel (STATUS: IMPLANTADO & ATIVO)

O serviço está **100% implantado e ativo na VPS** através do EasyPanel:

* **Ambiente EasyPanel:** `http://72.60.159.48:3000`
* **Projeto:** `helena-automation`
* **Aplicativo:** `helena-gateway`
* **Domínio Público com SSL Ativo:** `https://helena-automation-helena-gateway.d9v63q.easypanel.host`
* **Endpoint MCP:** `https://helena-automation-helena-gateway.d9v63q.easypanel.host/mcp`
* **Endpoint Health:** `https://helena-automation-helena-gateway.d9v63q.easypanel.host/health`
* **Endpoint Webhook:** `https://helena-automation-helena-gateway.d9v63q.easypanel.host/webhooks/supabase/agent-job`

### Configuração Aplicada no EasyPanel:

* **Source Type:** GitHub
* **Repository:** `tvmensal2025/financeiromaxnutrition`
* **Branch:** `main`
* **Build Context:** `services/helena-gateway`
* **Build Type:** Dockerfile
* **Porta:** `3000`
* **Primary Domain:** `helena-automation-helena-gateway.d9v63q.easypanel.host` (HTTPS automático via Traefik / Let's Encrypt)
* **Tokens de autenticação:** `MCP_BEARER_TOKEN`, `GATEWAY_WEBHOOK_SECRET` e `EVOLUTION_WEBHOOK_SECRET` devem ser gerados e gravados **somente no EasyPanel**. Nunca versionar os valores.


---

## 7. Homologação e Critérios de Ativação

> **IMPORTANTE:** Conforme a governança do Sistema Helena, a integração `INT-0005 Helena Gateway` **não deve ser marcada como OPERACIONAL** apenas pela criação do código.

O status transiciona de `PLANEJADA` para `OPERACIONAL` apenas após o cumprimento do seguinte checklist em produção:

- [ ] Deploy concluído no EasyPanel.
- [ ] Endpoint `/health` retornando HTTP 200 `{ "ok": true, "supabase": true }`.
- [ ] Database Webhook do Supabase enviando evento para `/webhooks/supabase/agent-job` e gerando `WAKE_SIGNAL`.
- [ ] Chamada MCP autenticada com Bearer Token via `/mcp` executando `list_ready_jobs`.
- [ ] Marina despachando tarefa via `record_dispatch` respeitando cooldown.
- [ ] Bot Especialista executando `claim_job` com sucesso no Supabase.
- [ ] Bot Especialista concluindo com `complete_job` anexando evidência formal.
- [ ] Handoff automático executado com `enqueue_job`.
