# Referência de Schema — Helena Gateway & Supabase

Este documento serve como referência técnica explicativa sobre as estruturas de banco de dados no Supabase (Project: `wxkgrykduqtsgmjkzlou`) utilizadas pelo Helena Gateway.

> **ATENÇÃO:** O Supabase de produção já possui todas as tabelas e funções aplicadas na migration canônica `gateway_job_engine_core`. **NÃO executar novamente migrations de banco** sem antes verificar o estado real do Supabase.

---

## 1. Tabelas Utilizadas pelo Gateway

### 1.1 `public.agent_jobs`
Fila principal de trabalhos técnicos dos especialistas digitais.
- `job_id`: Identificador único (ex: `JOB-2026-0001`).
- `task_id`: Identificador da tarefa mestre vinculada.
- `agent_id`: Agente responsável (ex: `AGT-02`, `AGT-17`).
- `business_id`: Empresa vinculada (`MAX_NUTRITION`, `TV_MENSAL`).
- `objective`: Descrição concisa do objetivo.
- `instruction`: Instruções detalhadas para o especialista.
- `priority`: `CRITICA`, `ALTA`, `MEDIA`, `BAIXA`.
- `status`: `DRAFT`, `SCHEDULED`, `READY`, `CLAIMED`, `RUNNING`, `WAITING_APPROVAL`, `WAITING_HELENA`, `COMPLETED`, `FAILED`, `CANCELLED`.
- `scheduled_at`, `available_at`, `claimed_at`, `started_at`, `completed_at`.
- `result_summary`: Resumo textual da entrega.
- `result_payload`: JSONB com dados adicionais.
- `evidence_refs`: JSONB array com referências e evidências comprobatórias.
- `attempt_count`, `max_attempts`.
- `idempotency_key`, `correlation_id`.
- `error_code`, `error_message`.

### 1.2 `public.agent_job_events`
Histórico append-only de auditoria e transições de jobs.
- `event_id`: UUID gerado automaticamente.
- `job_id`: ID do job.
- `agent_id`: Agente envolvido.
- `business_id`: Empresa.
- `event_type`: `WAKE_SIGNAL`, `DISPATCHED`, `CLAIMED`, `STARTED`, `COMPLETED`, `FAILED`, `WAITING_HELENA`, etc.
- `status`: Status do job no momento do evento.
- `message`: Descrição amigável do evento.
- `payload`: JSONB com metadados do evento.
- `created_at`: Data e hora do registro.

### 1.3 `public.agent_connections`
Catálogo de conectividade dos 21 agentes.
- `agent_id`: ID canônico (`AGT-01` a `AGT-21`).
- `provider`: `CHATGPT`, `GROK`, `HUMAN`, `OTHER`.
- `external_agent_id`: Identificador do bot na plataforma externa.
- `connection_status`: `CONNECTED`, `PLANNED`, `NOT_CONNECTED`, `ERROR`.
- `capabilities`: JSONB com competências técnicas.

### 1.4 `public.notification_outbox`
Fila assíncrona de notificações via WhatsApp / Evolution API.
- `notification_id`: UUID da notificação.
- `channel`: Padrão `WHATSAPP`.
- `recipient_reference`: Número de telefone do destinatário com DDI/DDD.
- `payload`: JSONB contendo a mensagem ou dados do template.
- `status`: `PENDING`, `SENT`, `FAILED`, `CANCELLED`.
- `scheduled_at`, `sent_at`.
- `attempt_count`: Contador de tentativas (máx 5).
- `error`: Mensagem de erro segura em caso de falha.

---

## 2. RPCs Existentes no Supabase

As seguintes rotinas de banco (Stored Procedures / Functions) são consumidas exclusivamente pelo Helena Gateway via chave de serviço (`service_role`):

1. **`gateway_release_scheduled_jobs()`**: Avalia jobs com status `SCHEDULED` cuja data `scheduled_at` seja menor ou igual a `NOW()` e transiciona atomicamente para `READY`.
2. **`gateway_claim_agent_job(job_id, agent_id)`**: Transiciona o job de `READY` para `CLAIMED` de forma atômica, registrando o agente que assumiu a tarefa.
3. **`gateway_start_agent_job(job_id, agent_id)`**: Transiciona de `CLAIMED` para `RUNNING`, carimbando `started_at`.
4. **`gateway_complete_agent_job(job_id, agent_id, result_summary, evidence_refs, result_payload)`**: Transiciona para `COMPLETED`, registrando sumário e ao menos 1 evidência formal.
5. **`gateway_fail_agent_job(job_id, agent_id, error_code, error_message, payload)`**: Registra erro e transiciona para `FAILED`.
6. **`gateway_waiting_helena(job_id, agent_id, contexto, impacto, decisao_necessaria, recomendacao)`**: Transiciona para `WAITING_HELENA` e registra detalhes da pendência de decisão executiva.
7. **`gateway_enqueue_agent_job(...)`**: Insere novo job com validação de idempotência e regras de governança.
