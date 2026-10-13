# Helena Gateway — Backend Operacional & MCP Hub

O **Helena Gateway** é o serviço backend independente do Sistema Helena, projetado para operar como canal operacional contínuo e hub de ferramentas Model Context Protocol (MCP) entre:
- **Helena (CEO Virtual)** preparada no Hermes com GPT-6 Sol;
- **20 outros perfis**, incluindo Marina, preparados no Hermes com GPT-6 Luna;
- **Supabase** como a fonte canônica e operacional de verdade (Project: `wxkgrykduqtsgmjkzlou`);
- **EasyPanel / VPS** como ambiente de hospedagem autônomo e de alta disponibilidade;
- **Evolution API** como canal assíncrono de notificações transacionais via WhatsApp.

Este serviço foi construído de forma desacoplada, **sem alterar o aplicativo financeiro principal**, sem utilizar APIs pagas como executores automáticos e sem expor credenciais sensíveis no repositório.

## Migração Hermes — estado de preparação em 27/09/2026

O Grok foi desativado. A arquitetura histórica abaixo não comprova execução atual. Os 21 registros em `agent_runtime_bindings` permanecem `CONFIGURED`; não ativar nem despachar a fila durante a preparação.

A autorização individual e o workflow estão publicados na branch codex/hermes-runtime-preparation (f49c88b), baseada no main 4aff8c3. O health remoto confirma hermes-workflow-v2. O servidor aceita tokens individuais pelo registro de hashes `agent_runtime_credentials` (somente backend), ou pelo formato legado `HERMES_PROFILE_TOKEN_HASHES`; consulta o vínculo ativo no Supabase a cada chamada e impõe empresa e responsável. Nenhuma credencial individual está provisionada. O fluxo no banco foi validado com rollback e 131 testes locais passaram; a execução real pelo Hermes ainda precisa de homologação. Consulte [HERMES-WORKFLOW.md](HERMES-WORKFLOW.md). Checkpoint CP-20260927-V018, regra PAG-V10-011.

Especialistas consultam e atualizam apenas os próprios jobs na empresa vinculada. Marina consulta a equipe e registra despachos dessa empresa, sem concluir por outro agente. Helena consulta o grupo, sem assumir a identidade de um especialista. Laura, de escopo pessoal, não recebe acesso à fila empresarial. Enfileiramento e handoff automáticos não estão liberados por esse adaptador.

Contas OAuth humanas comuns não podem fornecer um `agent_id` arbitrário para operar como bot: é exigido acesso ativo de fundador para administração, ou identidade individual Hermes. O token administrativo legado é exclusivo do servidor/administração; jamais deve ser configurado em um perfil Hermes.

O MCP oficial Supabase da Helena é um acesso separado, somente leitura. Ele não autoriza escrita operacional. Para homologar execução: provisionar credencial individual por canal protegido, ativar apenas um vínculo com referência de homologação e testar uma tarefa controlada antes de ampliar. Não é permitido marcar a operação como pronta apenas por o MCP conectar.

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
│  - 11 Ferramentas Oficiais com Governança V9                           │
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
│  - AGT-04 Marina (PMO): list_ready_jobs, record_dispatch               │
│  - Especialistas (AGT-02 a AGT-21):                                    │
│      claim_job -> start_job -> executar -> complete_job (com evidência)│
│  - Handoffs automáticos entre agentes: enqueue_job                     │
│  - Impasses executivos: waiting_helena                                 │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Governança e Protocolo Operacional V9

O Gateway implementa o **Protocolo V9**. A regra comum PAG-V9-019 descreve como registrar marcos de trabalho sem repetir o texto nos 21 prompts dos agentes:

1. **Supabase como Fonte Única da Verdade:** Nenhuma ação é considerada concluída se não estiver gravada com chave e timestamp no Supabase. O fundador não atua como mensageiro de dados.
2. **Marina Despachante (`record_dispatch`):** A Marina despacha o job identificando o especialista de destino, criando o evento `DISPATCHED`. O job **permanece com status `READY`** até que o especialista assuma a titularidade via `claim_job`. O despacho possui cooldown de 180 segundos para evitar redundância.
3. **Reivindicação Atômica (`claim_job`):** Apenas o especialista de destino pode reivindicar o job (`READY` → `CLAIMED`), impedindo condições de corrida.
4. **Execução Oficial (`start_job`):** Transição auditada (`CLAIMED` → `RUNNING`).
5. **Marcos relevantes (`record_progress`):** O agente registra o que fez, por qual motivo de negócio e o próximo passo, com evidência quando houver. O registro é idempotente por `job_id` e `step_key`, exige job `RUNNING` e não chama modelo de IA.
6. **Conclusão Obrigatória com Evidências (`complete_job`):** É **terminantemente proibido** concluir um job sem preencher `result_summary` e informar pelo menos 1 registro em `evidence_refs` (IDs de tabelas, links, hashes ou logs). Tentativas sem evidência são bloqueadas pelo Gateway antes mesmo da gravação.
7. **Reporte Transparente de Falhas (`fail_job`):** Se houver bloqueio técnico, a falha é registrada com `error_code` e `error_message`, sem camuflagem.
8. **Escalonamento para a CEO (`waiting_helena`):** Em decisões fora da alçada do especialista, o job transiciona para `WAITING_HELENA` contendo `contexto`, `impacto`, `decisao_necessaria` e `recomendacao`. Essa transição registra uma solicitação; a revisão efetiva da Helena exige uma execução e uma decisão comprovadas depois.
9. **Handoff Direto (`enqueue_job`):** O especialista enfileira o próximo job da cadeia técnica automaticamente.

### Rotina de equipe com custo controlado

- O fundador define direção, empresa e critério de sucesso em uma tarefa canônica. Helena verifica prioridades e decisões vigentes; Marina despacha um responsável por vez.
- O especialista assume o job, registra apenas marcos que mudam o estado ou a entrega e deixa explícitos `action`, `reason`, `next_step` e `evidence_refs` quando houver. Bloqueios usam `fail_job` ou `waiting_helena`; handoffs mantêm os IDs da tarefa e empresa.
- Bruno ou o responsável pela validação confere o resultado com a definição de pronto e a evidência. Helena revisa exceções e decisões, sem consulta contínua por IA. A página lê eventos do Supabase para mostrar o processo ao fundador.
- Não criar chamadas de Grok para vigiar outros agentes. Não gravar pensamentos internos, cada clique, consultas repetidas ou payloads de clientes nos eventos. Uma gravação por marco é suficiente; `step_key` impede repetição em novas tentativas.
- Antes de afirmar cobertura operacional, homologar um fluxo real por agente e por empresa. Ainda faltam o vínculo entre identidade OAuth do bot e `agent_id`, a publicação do Gateway externo e a associação dos jobs legados a `task_id` quando houver evidência de origem.

### Supervisão em lote — TSK-0031

O piloto usa uma janela diária de revisão da Helena, com opção de no máximo duas por dia. Tarefas, atividade, jobs e decisões continuam nas fontes operacionais do Supabase. Acúmulo de mudanças e decisões estratégicas priorizam a próxima janela; cada tarefa ou atualização visual não chama IA. Sem mudança relevante, a revisão pode encerrar sem mensagem. Cada janela usa no máximo uma análise compacta; há custo de cota Codex por execução agendada, mas nenhuma chave OpenAI API é exigida para este piloto.

O parecer é um registro `CHECKPOINT_SUPERVISAO_LOTE` em `public.auditoria`, com ID único da janela, resumo estruturado, fontes e ações. A Sala de comando lê a última revisão. Esse registro não substitui nem versiona `checkpoint_mestre_atual`, que segue o protocolo de governança para mudanças materiais.

`waiting_helena` continua sendo um estado explícito de job, não um gatilho de chamada automática ao modelo. O Gateway local valida a sessão do solicitante, o vínculo declarado com o job e o acesso à empresa antes de mudar o estado. A identidade real dos bots, a publicação do Gateway e a transição de resolução desse estado ainda precisam de homologação independente.

WhatsApp segue reservado a casos críticos que exigem decisão do fundador, após validação do destinatário, deduplicação e teste ponta a ponta. `notification_outbox` e Evolution API existem, mas não há envio desse checkpoint homologado. A página de Integrações não recebe chave de análise.

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
| `POST` | `/api/tools/:toolName` | Bearer OAuth 2.1 / Fallback | Endpoint REST alternativo para chamada direta de qualquer uma das 11 ferramentas. |

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

## 4. Catálogo das 11 Ferramentas MCP

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
  - `dispatcher_agent_id` (obrigatório — AGT-04 para Marina/PMO)
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

### 6. `record_progress`
- **Finalidade:** Registra um marco operacional em `agent_job_events`, com ação, motivo objetivo, próximo passo e referências de evidência disponíveis.
- **Regra:** O banco confirma que o job pertence ao agente informado e está em `RUNNING`. `step_key` evita duplicação em tentativas. Registrar apenas mudanças relevantes; falha de gravação deve ser reportada, nunca tratada como entrega comprovada.
- **Acesso:** Para OAuth, o Gateway verifica o acesso ativo do usuário à empresa do job antes de usar a chave de serviço. A identidade do bot ainda precisa ser vinculada a um `agent_id` em etapa posterior; `agent_id` declarado não prova autoria individual.
- **Parâmetros:** `job_id`, `agent_id`, `step_key`, `action`, `reason`, `next_step` obrigatórios; `evidence_refs` opcional.
- **Custo:** Uma gravação por marco, mais leituras curtas de permissão para OAuth; sem agendamento, polling ou chamada adicional de IA. O custo da execução do próprio bot continua dependente do provedor.

### 7. `complete_job`
- **Finalidade:** Conclusão da tarefa via RPC `gateway_complete_agent_job`. Transição: `RUNNING`/`CLAIMED` → `COMPLETED`.
- **Regra Estrita V9:** Exige `result_summary` e pelo menos 1 evidência em `evidence_refs`.
- **Parâmetros:**
  - `job_id` (obrigatório)
  - `agent_id` (obrigatório)
  - `result_summary` (obrigatório)
  - `evidence_refs` (array obrigatório com ≥ 1 item)
  - `result_payload` (objeto opcional)

### 8. `fail_job`
- **Finalidade:** Registro transparente de falha técnica ou operacional via RPC `gateway_fail_agent_job`. Transição: → `FAILED`.
- **Parâmetros:**
  - `job_id` (obrigatório)
  - `agent_id` (obrigatório)
  - `error_code` (obrigatório)
  - `error_message` (obrigatório)
  - `payload` (objeto opcional)

### 9. `waiting_helena`
- **Finalidade:** Encaminha impasse ou decisão de alçada para a CEO Virtual Helena via RPC `gateway_waiting_helena`. Transição: → `WAITING_HELENA`.
- **Confirmação:** Exige job `CLAIMED` ou `RUNNING`, agente correspondente e acesso à empresa. O RPC recebe `p_job_id`, `p_agent_id`, `p_message` e `p_payload`; retorno nulo ou outro status é erro.
- **Parâmetros:**
  - `job_id` (obrigatório)
  - `agent_id` (obrigatório)
  - `contexto` (obrigatório)
  - `impacto` (obrigatório)
  - `decisao_necessaria` (obrigatório)
  - `recomendacao` (obrigatório)

### 10. `enqueue_job`
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

### 11. `queue_summary`
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
SUPABASE_SERVICE_ROLE_KEY=COLOQUE_SUA_CHAVE_AQUI

# Autenticação de Entrada
GATEWAY_WEBHOOK_SECRET=CONFIGURAR_SOMENTE_NO_EASYPANEL
MEOWCALLER_TOKEN=CONFIGURAR_SOMENTE_NO_EASYPANEL
MCP_BEARER_TOKEN=CONFIGURAR_SOMENTE_NO_EASYPANEL

# MEOWCALLER_TOKEN deve ser igual a INTERNAL_API_KEY no meowcaller-service.
# Os callbacks de voz enviam X-API-Key e são rejeitados sem essas duas variáveis.

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

# Identidade do canal WhatsApp (URA + registros). Configurar o PAR completo.
# Sem os dois valores reais, o texto é neutro e o business_id gravado é UNASSIGNED.
# Nunca afirmar uma marca que não corresponda ao business_id.
WHATSAPP_BUSINESS_ID=CONFIGURAR_SOMENTE_NO_EASYPANEL
WHATSAPP_BRAND_NAME=CONFIGURAR_SOMENTE_NO_EASYPANEL

# Não repetir a mesma auto-resposta ao mesmo número nesta janela (ms). Padrão 60000.
WHATSAPP_AUTOREPLY_DEBOUNCE_MS=60000

# Ligação RECEBIDA pelo WhatsApp: quem a IA atende (ver 5.3). Padrão seguro: students.
# students = só aluno conhecido do eLiving | all = qualquer número (comportamento antigo) | none = ninguém
VOICE_INBOUND_CALL_POLICY=students
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

### 5.2 Identidade do canal WhatsApp (empresa × texto da URA)

O webhook `POST /webhooks/evolution` grava `business_id` e monta a auto-resposta a partir da **mesma identidade**. Não há marca hardcoded (o texto antigo "Max Nutrition" com `BIZ-001` misturava MaxNutrition e iGreen).

| Variável | Papel | Valor no repositório |
|---|---|---|
| `WHATSAPP_BUSINESS_ID` | `business_id` de `comunicacoes` e `agent_jobs` | `CONFIGURAR_SOMENTE_NO_EASYPANEL` |
| `WHATSAPP_BRAND_NAME` | Nome de marca no texto da URA | `CONFIGURAR_SOMENTE_NO_EASYPANEL` |
| `WHATSAPP_AUTOREPLY_DEBOUNCE_MS` | Janela para não repetir a mesma auto-resposta ao mesmo número | `60000` (exemplo neutro) |

Regras:

- Só se **os dois** (`WHATSAPP_BUSINESS_ID` e `WHATSAPP_BRAND_NAME`) estiverem preenchidos com valores reais o canal afirma a marca e grava o id correspondente.
- Placeholder `CONFIGURAR_SOMENTE_NO_EASYPANEL` (ou vazio) conta como **não configurado**.
- Padrão seguro: texto genérico ("nosso canal de atendimento") e `business_id = UNASSIGNED`. Nunca se afirma "Max Nutrition", "iGreen" ou outra marca que não bata com o id.
- Decisão do fundador (EasyPanel, sem mudar código): qual empresa este número atende (`BIZ-001` iGreen, `BIZ-002` Ecossistema de Saúde / MaxNutrition, ou outra) e o texto final da marca.

O menu URA (opções 1–4) e o `agent_id` do job vêm da **mesma tabela** em `src/whatsapp-ura.mjs`: Victor AGT-15, Joana AGT-20, Caio AGT-05, Marina AGT-04 (triagem executiva). A opção 4 não cria job para Helena (AGT-01), que opera fora desta fila.

A auto-resposta **não promete prazo** ("em instantes"). Criar o `agent_job` com status `READY` **não aciona** o especialista: no Protocolo V9 os bots só agem após despacho da Marina (`record_dispatch`, AGT-04) e `claim_job`. Não há caminho sanctioned no webhook para disparar o agente sem gravar em `agent_job_events` (proibido neste fluxo).

### 5.3 Ligação recebida pelo WhatsApp: só aluno conhecido (VOICE_INBOUND_CALL_POLICY)

O meowcaller-service atende a chamada VoIP na hora (o WhatsApp exige o aceite imediato), então o filtro fica no
gateway, antes de qualquer gasto (`src/integrations/inbound-call-gate.mjs`):

| Valor | Comportamento |
|---|---|
| `students` (**padrão**; ausente ou inválido também vale `students`) | A IA só conversa com quem tem ficha encontrada pelo telefone na Edge `voice-caller-context` (mesma busca da conversa, `MAX_VOICE_CONTEXT_URL`/`MAX_VOICE_CONTEXT_TOKEN`). Número desconhecido, ambíguo, sem telefone (LID) ou ficha fora do ar: a ligação é encerrada sem abertura, sem STT, sem GPT e sem voz, e o motivo vai para o log (`[VOICE_GATE] ... (caller_unidentified \| caller_ambiguous \| context_unavailable)`), sem telefone. |
| `all` | Atende qualquer número (comportamento anterior a 13/10/2026). |
| `none` | Não conversa com nenhuma ligação recebida. |

- A fala que chega antes do aviso de atendimento espera a decisão por até 8 s; sem decisão, não é transcrita.
- Ligação de **saída** (botão "Me ligar no celular", `call-engine/call-phone`) não passa por este filtro.
- Com `students`, quem ainda não é cliente deixa de ouvir o roteiro de boas-vindas da Sirlene por ligação.
- A variável `ENABLE_AUTO_ANSWER_CONTROLLED_NUMBERS` do meowcaller-service **não tem efeito**: o filtro é este.

### 5.4 Ligação: modo, resposta de reserva e telemetria

- `call-phone` respeita o modo pedido pelo app (`normal`, `firm`, `intense`; aceita `firme`, `intenso`); ausente ou
  inválido abre em Normal. A abertura sai sempre no modo Normal do personagem; as respostas seguem o modo pedido.
- GPT sem resposta numa ligação do eLiving (Sirlene, Alex, Vital, Rafael): o personagem fala uma frase fixa pedindo
  para repetir (no máximo 2 vezes seguidas) e, na falha seguinte, despede-se ("Vou encerrar por aqui. Tente de novo
  em alguns minutos pelo app.") e a ligação é encerrada. O motor local do agente de voz (catálogo configurado no
  painel) só responde fora de ligação do eLiving (`src/integrations/call-fallback.mjs`).
- Telemetria (`/call-engine/history`): `tts.provider` de cada fala e da ligação é o provedor que realmente falou
  (`ELEVENLABS`, `GOOGLE_CHIRP3_HD` ou os dois), com a contagem por provedor em `tts.providers`.

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
* **Tokens de autenticação:** devem ser gerados e gravados **somente no EasyPanel**. Nunca versionar os valores.
  * `MCP_BEARER_TOKEN`: `CONFIGURAR_SOMENTE_NO_EASYPANEL`
  * `GATEWAY_WEBHOOK_SECRET`: `CONFIGURAR_SOMENTE_NO_EASYPANEL`
  * `EVOLUTION_WEBHOOK_SECRET`: `CONFIGURAR_SOMENTE_NO_EASYPANEL`


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
- [ ] Um `waiting_helena` real vinculado a tarefa e empresa aparece no painel, com parecer posterior da Helena e evidência.
- [ ] Um alerta crítico chega uma vez ao destinatário validado; falha e pausa ficam visíveis no painel.
