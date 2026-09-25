/**
 * Helena Gateway — Backend Operacional do Sistema Helena
 * Conecta o ecossistema Helena (ChatGPT / Grok Bots / Supabase / Evolution API)
 * 
 * Fonte canônica de dados: Supabase (project: wxkgrykduqtsgmjkzlou)
 * Não utiliza API paga de LLM como executor automático.
 */

import express from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/server';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { createIntegrationsRouter } from './routes/integrations.mjs';

// ======================================================================
// CONFIGURAÇÃO E VARIÁVEIS DE AMBIENTE
// ======================================================================

const PORT = parseInt(process.env.PORT || '3000', 10);
const PUBLIC_HOST = process.env.PUBLIC_HOST || 'helena-automation-helena-gateway.d9v63q.easypanel.host';

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://wxkgrykduqtsgmjkzlou.supabase.co').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const SUPABASE_AUTH_ISSUER = 'https://wxkgrykduqtsgmjkzlou.supabase.co/auth/v1';
const SUPABASE_JWKS_URL = 'https://wxkgrykduqtsgmjkzlou.supabase.co/auth/v1/.well-known/jwks.json';

const jwksClient = createRemoteJWKSet(new URL(SUPABASE_JWKS_URL), {
  cooldownDuration: 30000,
  cacheMaxAge: 600000
});

const GATEWAY_WEBHOOK_SECRET = process.env.GATEWAY_WEBHOOK_SECRET || '';
const MCP_BEARER_TOKEN = process.env.MCP_BEARER_TOKEN || '';

const DISPATCH_COOLDOWN_SECONDS = parseInt(process.env.DISPATCH_COOLDOWN_SECONDS || '180', 10);
const SCHEDULE_TICK_MS = parseInt(process.env.SCHEDULE_TICK_MS || '15000', 10);
const OUTBOX_TICK_MS = parseInt(process.env.OUTBOX_TICK_MS || '15000', 10);

const EVOLUTION_BASE_URL = (process.env.EVOLUTION_BASE_URL || '').replace(/\/$/, '');
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || '';

// ======================================================================
// HELPERS DE SEGURANÇA E SUPABASE
// ======================================================================

/**
 * Comparação em tempo constante para evitar ataques de temporização (Timing Attacks)
 */
function safeCompare(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string') {
    return false;
  }
  if (!provided || !expected) {
    return false;
  }
  const bufA = Buffer.from(provided);
  const bufB = Buffer.from(expected);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Headers padrão para comunicação segura com Supabase REST API
 */
function getSupabaseHeaders() {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada no backend');
  }
  return {
    'apikey': SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
}

/**
 * Executa requisição fetch ao Supabase PostgREST
 */
async function supabaseFetch(pathOrUrl, options = {}) {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${SUPABASE_URL}${pathOrUrl}`;
  const headers = {
    ...getSupabaseHeaders(),
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  const contentType = response.headers.get('content-type') || '';
  let data = null;

  if (contentType.includes('application/json')) {
    data = await response.json().catch(() => null);
  } else {
    data = await response.text().catch(() => null);
  }

  if (!response.ok) {
    const errorMsg = typeof data === 'object' && data?.message ? data.message : (data || response.statusText);
    const error = new Error(`Supabase request error [HTTP ${response.status}]: ${errorMsg}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

/**
 * Invoca RPC do Supabase com fallback inteligente para prefixo p_ caso necessário
 */
async function callSupabaseRpc(rpcName, params = {}) {
  try {
    return await supabaseFetch(`/rest/v1/rpc/${rpcName}`, {
      method: 'POST',
      body: JSON.stringify(params)
    });
  } catch (err) {
    // Se a função esperava parâmetros com prefixo p_, tenta formato alternativo
    if (err.status === 400 || (err.message && err.message.includes('function'))) {
      const prefixedParams = {};
      for (const [key, val] of Object.entries(params)) {
        prefixedParams[`p_${key}`] = val;
      }
      try {
        return await supabaseFetch(`/rest/v1/rpc/${rpcName}`, {
          method: 'POST',
          body: JSON.stringify(prefixedParams)
        });
      } catch (secondErr) {
        throw err; // lança o erro original
      }
    }
    throw err;
  }
}

// ======================================================================
// FERRAMENTAS DO GATEWAY (CORE LOGIC)
// ======================================================================

const PRIORITY_ORDER = {
  'CRITICA': 1,
  'ALTA': 2,
  'MEDIA': 3,
  'BAIXA': 4
};

/**
 * 1. list_ready_jobs
 */
async function handleListReadyJobs({ limit = 10, agent_id } = {}) {
  const boundedLimit = Math.min(Math.max(limit, 1), 25);
  const nowIso = new Date().toISOString();

  // Consulta agent_jobs no Supabase com status READY
  let url = `/rest/v1/agent_jobs?status=eq.READY&order=created_at.asc&limit=50`;
  if (agent_id) {
    url += `&agent_id=eq.${encodeURIComponent(agent_id)}`;
  }

  const rawJobs = await supabaseFetch(url);
  if (!Array.isArray(rawJobs)) {
    return { jobs: [], total: 0 };
  }

  // Filtra available_at <= now (ou null)
  const readyJobs = rawJobs.filter(job => {
    if (!job.available_at) return true;
    return new Date(job.available_at) <= new Date(nowIso);
  });

  // Ordena por prioridade (CRITICA, ALTA, MEDIA, BAIXA) e depois por created_at
  readyJobs.sort((a, b) => {
    const pA = PRIORITY_ORDER[a.priority] || 99;
    const pB = PRIORITY_ORDER[b.priority] || 99;
    if (pA !== pB) return pA - pB;
    return new Date(a.created_at || 0) - new Date(b.created_at || 0);
  });

  const slicedJobs = readyJobs.slice(0, boundedLimit);

  // Busca metadados de conexões e agentes para enriquecimento
  let connections = [];
  let agentes = [];
  try {
    connections = await supabaseFetch('/rest/v1/agent_connections?select=*').catch(() => []);
    agentes = await supabaseFetch('/rest/v1/agentes?select=*').catch(() => []);
  } catch {
    // degradação suave se tabelas auxiliares sofrerem lentidão
  }

  const connMap = new Map((Array.isArray(connections) ? connections : []).map(c => [c.agent_id, c]));
  const agenteMap = new Map((Array.isArray(agentes) ? agentes : []).map(a => [a.id || a.agent_id, a]));

  const enrichedJobs = slicedJobs.map(job => {
    const conn = connMap.get(job.agent_id) || {};
    const ag = agenteMap.get(job.agent_id) || {};
    const agentName = ag.nome || ag.name || job.agent_id;
    const agentFuncao = ag.funcao || ag.papel || ag.role || 'Especialista Operacional';
    const provider = conn.provider || 'GROK';
    const externalAgentId = conn.external_agent_id || null;
    const connectionStatus = conn.connection_status || 'CONNECTED';

    const dispatchMessage = `[SISTEMA HELENA | ${job.job_id}]
Destino: ${agentName} (${job.agent_id}) - ${agentFuncao}
Prioridade: ${job.priority || 'MEDIA'}
Empresa: ${job.business_id || 'Não especificada'}
Tarefa: ${job.task_id || 'Não vinculada'}
Objetivo: ${job.objective}
Instrução: ${job.instruction || 'Seguir protocolo padrão da função.'}

PROTOCOLO OPERACIONAL OBRIGATÓRIO (V9):
1. claim_job - Bloquear o job atomicamente para você.
2. start_job - Iniciar execução oficial.
3. Executar estritamente dentro do seu escopo de especialista.
4. Registrar progresso e dados operacionais no Supabase.
5. Fazer handoff se a próxima etapa exigir outro especialista.
6. complete_job - Concluir com resumo técnico e ao menos 1 evidência formal (evidence_refs).
7. fail_job - Em caso de bloqueio ou erro, reportar detalhadamente sem omitir falha.
8. waiting_helena - Se houver decisão estratégica exclusiva da CEO.
9. NUNCA declarar conclusão sem evidência cadastrada no Supabase.`;

    return {
      job_id: job.job_id,
      agent_id: job.agent_id,
      nome_agente: agentName,
      funcao_agente: agentFuncao,
      provider,
      external_agent_id: externalAgentId,
      connection_status: connectionStatus,
      priority: job.priority,
      business_id: job.business_id,
      task_id: job.task_id,
      objective: job.objective,
      instruction: job.instruction,
      available_at: job.available_at,
      created_at: job.created_at,
      dispatch_message: dispatchMessage
    };
  });

  return {
    total_ready: readyJobs.length,
    returned_count: enrichedJobs.length,
    jobs: enrichedJobs
  };
}

/**
 * 2. record_dispatch
 */
async function handleRecordDispatch({
  job_id,
  dispatcher_agent_id = 'AGT-17',
  target_agent_id,
  target_external_agent_id,
  notes
}) {
  if (!job_id) {
    throw new Error('job_id é obrigatório para record_dispatch');
  }

  // Verifica se o job existe
  const jobs = await supabaseFetch(`/rest/v1/agent_jobs?job_id=eq.${encodeURIComponent(job_id)}&limit=1`);
  if (!Array.isArray(jobs) || jobs.length === 0) {
    throw new Error(`Job ${job_id} não encontrado`);
  }
  const job = jobs[0];

  // Verifica cooldown de despacho
  const events = await supabaseFetch(
    `/rest/v1/agent_job_events?job_id=eq.${encodeURIComponent(job_id)}&event_type=eq.DISPATCHED&order=created_at.desc&limit=1`
  );

  if (Array.isArray(events) && events.length > 0) {
    const lastEvent = events[0];
    const diffMs = Date.now() - new Date(lastEvent.created_at).getTime();
    const cooldownMs = DISPATCH_COOLDOWN_SECONDS * 1000;
    if (diffMs < cooldownMs) {
      const remainingSeconds = Math.ceil((cooldownMs - diffMs) / 1000);
      return {
        success: false,
        cooldown: true,
        remaining_seconds: remainingSeconds,
        message: `Job ${job_id} despachado recentemente. Cooldown ativo de ${remainingSeconds}s restantes.`
      };
    }
  }

  const finalTargetAgent = target_agent_id || job.agent_id;

  // Cria evento append-only DISPATCHED em public.agent_job_events
  // Nota: o job permanece com status READY até o especialista fazer claim_job
  await supabaseFetch('/rest/v1/agent_job_events', {
    method: 'POST',
    body: JSON.stringify({
      job_id,
      agent_id: finalTargetAgent,
      business_id: job.business_id,
      event_type: 'DISPATCHED',
      status: 'READY',
      message: `Despachado por ${dispatcher_agent_id} para ${finalTargetAgent}`,
      payload: {
        dispatcher_agent_id,
        target_agent_id: finalTargetAgent,
        target_external_agent_id: target_external_agent_id || null,
        notes: notes || null,
        dispatched_at: new Date().toISOString()
      }
    })
  });

  return {
    success: true,
    dispatched: true,
    job_id,
    target_agent_id: finalTargetAgent,
    cooldown_seconds: DISPATCH_COOLDOWN_SECONDS,
    message: `Job ${job_id} registrado como despachado. Aguardando claim do especialista.`
  };
}

/**
 * 3. get_job
 */
async function handleGetJob({ job_id }) {
  if (!job_id) {
    throw new Error('job_id é obrigatório para get_job');
  }

  const jobs = await supabaseFetch(`/rest/v1/agent_jobs?job_id=eq.${encodeURIComponent(job_id)}&limit=1`);
  if (!Array.isArray(jobs) || jobs.length === 0) {
    throw new Error(`Job ${job_id} não encontrado`);
  }
  const job = jobs[0];

  const events = await supabaseFetch(
    `/rest/v1/agent_job_events?job_id=eq.${encodeURIComponent(job_id)}&order=created_at.desc&limit=20`
  ).catch(() => []);

  const conn = await supabaseFetch(
    `/rest/v1/agent_connections?agent_id=eq.${encodeURIComponent(job.agent_id)}&limit=1`
  ).catch(() => []);

  return {
    job,
    connection: Array.isArray(conn) && conn.length > 0 ? conn[0] : null,
    events: Array.isArray(events) ? events : []
  };
}

/**
 * 4. claim_job (RPC gateway_claim_agent_job)
 */
async function handleClaimJob({ job_id, agent_id }) {
  if (!job_id || !agent_id) {
    throw new Error('job_id e agent_id são obrigatórios para claim_job');
  }

  const result = await callSupabaseRpc('gateway_claim_agent_job', {
    job_id,
    agent_id
  });

  return {
    success: true,
    claimed: true,
    job_id,
    agent_id,
    result
  };
}

/**
 * 5. start_job (RPC gateway_start_agent_job)
 */
async function handleStartJob({ job_id, agent_id }) {
  if (!job_id || !agent_id) {
    throw new Error('job_id e agent_id são obrigatórios para start_job');
  }

  const result = await callSupabaseRpc('gateway_start_agent_job', {
    job_id,
    agent_id
  });

  return {
    success: true,
    running: true,
    job_id,
    agent_id,
    result
  };
}

/**
 * 6. complete_job (RPC gateway_complete_agent_job)
 */
async function handleCompleteJob({
  job_id,
  agent_id,
  result_summary,
  evidence_refs,
  result_payload = {}
}) {
  if (!job_id || !agent_id) {
    throw new Error('job_id e agent_id são obrigatórios para complete_job');
  }
  if (!result_summary || typeof result_summary !== 'string' || !result_summary.trim()) {
    throw new Error('result_summary é obrigatório para complete_job');
  }
  if (!Array.isArray(evidence_refs) || evidence_refs.length === 0) {
    throw new Error('Protocolo V9 Violação: evidence_refs deve conter ao menos 1 evidência para complete_job');
  }

  const result = await callSupabaseRpc('gateway_complete_agent_job', {
    job_id,
    agent_id,
    result_summary: result_summary.trim(),
    evidence_refs,
    result_payload
  });

  return {
    success: true,
    completed: true,
    job_id,
    agent_id,
    evidence_count: evidence_refs.length,
    result
  };
}

/**
 * 7. fail_job (RPC gateway_fail_agent_job)
 */
async function handleFailJob({
  job_id,
  agent_id,
  error_code,
  error_message,
  payload = {}
}) {
  if (!job_id || !agent_id) {
    throw new Error('job_id e agent_id são obrigatórios para fail_job');
  }
  if (!error_code || !error_message) {
    throw new Error('error_code e error_message são obrigatórios para fail_job');
  }

  const result = await callSupabaseRpc('gateway_fail_agent_job', {
    job_id,
    agent_id,
    error_code,
    error_message,
    payload
  });

  return {
    success: true,
    failed: true,
    job_id,
    agent_id,
    error_code,
    result
  };
}

/**
 * 8. waiting_helena (RPC gateway_waiting_helena)
 */
async function handleWaitingHelena({
  job_id,
  agent_id,
  contexto,
  impacto,
  decisao_necessaria,
  recomendacao
}) {
  if (!job_id || !agent_id) {
    throw new Error('job_id e agent_id são obrigatórios para waiting_helena');
  }
  if (!contexto || !impacto || !decisao_necessaria || !recomendacao) {
    throw new Error('contexto, impacto, decisao_necessaria e recomendacao são obrigatórios para waiting_helena');
  }

  const result = await callSupabaseRpc('gateway_waiting_helena', {
    job_id,
    agent_id,
    contexto,
    impacto,
    decisao_necessaria,
    recomendacao
  });

  return {
    success: true,
    waiting_helena: true,
    job_id,
    agent_id,
    result
  };
}

/**
 * 9. enqueue_job (RPC gateway_enqueue_agent_job)
 */
async function handleEnqueueJob({
  agent_id,
  objective,
  instruction,
  business_id,
  task_id,
  priority = 'MEDIA',
  scheduled_at,
  available_at,
  approval_required = false,
  idempotency_key,
  correlation_id
}) {
  if (!agent_id || !objective) {
    throw new Error('agent_id e objective são obrigatórios para enqueue_job');
  }

  const result = await callSupabaseRpc('gateway_enqueue_agent_job', {
    agent_id,
    objective,
    instruction: instruction || null,
    business_id: business_id || null,
    task_id: task_id || null,
    priority,
    scheduled_at: scheduled_at || null,
    available_at: available_at || null,
    approval_required,
    idempotency_key: idempotency_key || null,
    correlation_id: correlation_id || null
  });

  return {
    success: true,
    enqueued: true,
    agent_id,
    result
  };
}

/**
 * 10. queue_summary
 */
async function handleQueueSummary({ business_id } = {}) {
  let url = '/rest/v1/agent_jobs?select=status,priority,agent_id,business_id';
  if (business_id) {
    url += `&business_id=eq.${encodeURIComponent(business_id)}`;
  }

  const jobs = await supabaseFetch(url);
  if (!Array.isArray(jobs)) {
    return { total_jobs: 0, by_status: {}, by_priority: {}, by_agent: {} };
  }

  const by_status = {};
  const by_priority = {};
  const by_agent = {};

  for (const j of jobs) {
    by_status[j.status] = (by_status[j.status] || 0) + 1;
    by_priority[j.priority] = (by_priority[j.priority] || 0) + 1;
    if (['READY', 'RUNNING', 'CLAIMED', 'WAITING_HELENA'].includes(j.status)) {
      by_agent[j.agent_id] = (by_agent[j.agent_id] || 0) + 1;
    }
  }

  return {
    total_jobs: jobs.length,
    active_jobs: (by_status['READY'] || 0) + (by_status['RUNNING'] || 0) + (by_status['CLAIMED'] || 0) + (by_status['WAITING_HELENA'] || 0),
    by_status,
    by_priority,
    active_by_agent: by_agent
  };
}

// ======================================================================
// DEFINIÇÃO E REGISTRO DAS FERRAMENTAS MCP
// ======================================================================

const TOOLS_CONFIG = {
  list_ready_jobs: {
    description: 'Consulta fila de agent_jobs no Supabase com status READY e available_at <= now, ordenados por prioridade e com dispatch_message estruturada para bots.',
    schema: z.object({
      limit: z.number().int().min(1).max(25).optional().default(10),
      agent_id: z.string().optional()
    }),
    handler: handleListReadyJobs
  },
  record_dispatch: {
    description: 'Registra evento append-only DISPATCHED pela Marina (PMO) com cooldown de 180s. Não altera o status do job (continua READY até o claim pelo especialista).',
    schema: z.object({
      job_id: z.string().describe('ID do job a ser despachado'),
      dispatcher_agent_id: z.string().optional().default('AGT-17').describe('ID do despachante (Marina / PMO)'),
      target_agent_id: z.string().optional().describe('ID do especialista de destino'),
      target_external_agent_id: z.string().optional().describe('ID externo do Grok Bot'),
      notes: z.string().optional().describe('Notas adicionais de despacho')
    }),
    handler: handleRecordDispatch
  },
  get_job: {
    description: 'Recupera detalhes completos de um agent_job pelo job_id, incluindo histórico recente de eventos e metadados de conexão.',
    schema: z.object({
      job_id: z.string().describe('ID do agent_job')
    }),
    handler: handleGetJob
  },
  claim_job: {
    description: 'Reivindica atomicamente o job para o agente especialista via RPC gateway_claim_agent_job. Transição atômica READY -> CLAIMED.',
    schema: z.object({
      job_id: z.string().describe('ID do agent_job'),
      agent_id: z.string().describe('ID do agente especialista que assume o job')
    }),
    handler: handleClaimJob
  },
  start_job: {
    description: 'Inicia oficialmente a execução do job via RPC gateway_start_agent_job. Transição CLAIMED -> RUNNING.',
    schema: z.object({
      job_id: z.string().describe('ID do agent_job'),
      agent_id: z.string().describe('ID do agente especialista')
    }),
    handler: handleStartJob
  },
  complete_job: {
    description: 'Conclui o job no Supabase via RPC gateway_complete_agent_job. Exige result_summary e evidence_refs (mínimo 1 evidência) conforme Protocolo V9.',
    schema: z.object({
      job_id: z.string().describe('ID do agent_job'),
      agent_id: z.string().describe('ID do agente especialista'),
      result_summary: z.string().min(1).describe('Resumo executivo do resultado'),
      evidence_refs: z.array(z.any()).min(1).describe('Ao menos 1 evidência formal do resultado gerado'),
      result_payload: z.record(z.any()).optional().describe('Payload complementar com dados gerados')
    }),
    handler: handleCompleteJob
  },
  fail_job: {
    description: 'Registra falha do job via RPC gateway_fail_agent_job. Reporta error_code e error_message sem ocultar falha.',
    schema: z.object({
      job_id: z.string().describe('ID do agent_job'),
      agent_id: z.string().describe('ID do agente especialista'),
      error_code: z.string().min(1).describe('Código identificador do erro'),
      error_message: z.string().min(1).describe('Mensagem de erro detalhada'),
      payload: z.record(z.any()).optional().describe('Contexto adicional do erro')
    }),
    handler: handleFailJob
  },
  waiting_helena: {
    description: 'Transiciona o job para WAITING_HELENA via RPC gateway_waiting_helena quando houver decisão exclusiva da CEO Helena.',
    schema: z.object({
      job_id: z.string().describe('ID do agent_job'),
      agent_id: z.string().describe('ID do agente especialista'),
      contexto: z.string().min(1).describe('Contexto da decisão'),
      impacto: z.string().min(1).describe('Impacto para a empresa'),
      decisao_necessaria: z.string().min(1).describe('O que precisa ser decidido'),
      recomendacao: z.string().min(1).describe('Recomendação técnica do especialista')
    }),
    handler: handleWaitingHelena
  },
  enqueue_job: {
    description: 'Enfileira um novo job via RPC gateway_enqueue_agent_job. Usado para handoff direto entre especialistas e agendamento de tarefas.',
    schema: z.object({
      agent_id: z.string().describe('ID do agente especialista de destino'),
      objective: z.string().min(1).describe('Objetivo claro do trabalho'),
      instruction: z.string().optional().describe('Instrução detalhada'),
      business_id: z.string().optional().describe('ID da empresa'),
      task_id: z.string().optional().describe('ID da tarefa associada'),
      priority: z.enum(['CRITICA', 'ALTA', 'MEDIA', 'BAIXA']).optional().default('MEDIA'),
      scheduled_at: z.string().optional().describe('Timestamp ISO de agendamento futuro'),
      available_at: z.string().optional().describe('Timestamp ISO de liberação'),
      approval_required: z.boolean().optional().default(false),
      idempotency_key: z.string().optional().describe('Chave única de idempotência'),
      correlation_id: z.string().optional().describe('ID de rastreamento de cadeia operacional')
    }),
    handler: handleEnqueueJob
  },
  queue_summary: {
    description: 'Retorna panorama consolidado da fila de agent_jobs: status, prioridades e carga por agente.',
    schema: z.object({
      business_id: z.string().optional().describe('Filtro opcional por empresa')
    }),
    handler: handleQueueSummary
  }
};

// Instância oficial do McpServer
const mcpServer = new McpServer({
  name: 'helena-gateway',
  version: '0.1.0'
});

for (const [name, def] of Object.entries(TOOLS_CONFIG)) {
  mcpServer.registerTool(name, {
    description: def.description,
    inputSchema: def.schema
  }, async (args) => {
    try {
      const result = await def.handler(args);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Erro ao executar ${name}: ${err.message}` }]
      };
    }
  });
}

// ======================================================================
// ROTINAS ASSÍNCRONAS EM BACKGROUND
// ======================================================================

// 1. Liberação periódica de jobs agendados (gateway_release_scheduled_jobs)
let isReleasingScheduled = false;
async function tickScheduledJobs() {
  if (isReleasingScheduled) return;
  if (!SUPABASE_SERVICE_ROLE_KEY) return;

  isReleasingScheduled = true;
  try {
    const res = await callSupabaseRpc('gateway_release_scheduled_jobs', {});
    if (res && (res.released_count > 0 || res.count > 0)) {
      console.log(`[SCHEDULED_JOBS] Liberados jobs agendados para status READY.`);
    }
  } catch (err) {
    if (process.env.DEBUG_GATEWAY) {
      console.error('[SCHEDULED_JOBS] Tick erro:', err.message);
    }
  } finally {
    isReleasingScheduled = false;
  }
}

// 2. Processamento de outbox assíncrono para Evolution API (public.notification_outbox)
let isProcessingOutbox = false;
async function tickNotificationOutbox() {
  if (isProcessingOutbox) return;
  if (!EVOLUTION_BASE_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE) {
    return; // Evolution API não configurada; gateway continua operando sem ela
  }
  if (!SUPABASE_SERVICE_ROLE_KEY) return;

  isProcessingOutbox = true;
  try {
    const nowIso = new Date().toISOString();
    const url = `/rest/v1/notification_outbox?status=eq.PENDING&scheduled_at=lte.${encodeURIComponent(nowIso)}&order=created_at.asc&limit=10`;
    const pendingList = await supabaseFetch(url);

    if (Array.isArray(pendingList) && pendingList.length > 0) {
      for (const item of pendingList) {
        await processSingleOutboxItem(item);
      }
    }
  } catch (err) {
    if (process.env.DEBUG_GATEWAY) {
      console.error('[OUTBOX] Tick erro:', err.message);
    }
  } finally {
    isProcessingOutbox = false;
  }
}

async function processSingleOutboxItem(item) {
  const recipient = item.recipient_reference;
  const messageText = item.payload?.message || item.payload?.text || item.template || '';

  try {
    const evoUrl = `${EVOLUTION_BASE_URL}/message/sendText/${encodeURIComponent(EVOLUTION_INSTANCE)}`;
    const evoRes = await fetch(evoUrl, {
      method: 'POST',
      headers: {
        'apikey': EVOLUTION_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        number: recipient,
        text: messageText
      })
    });

    if (evoRes.ok) {
      const evoData = await evoRes.json().catch(() => ({}));
      const providerMessageId = evoData?.key?.id || evoData?.messageId || null;
      await supabaseFetch(`/rest/v1/notification_outbox?notification_id=eq.${encodeURIComponent(item.notification_id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'SENT',
          sent_at: new Date().toISOString(),
          provider_message_id: providerMessageId
        })
      });
      console.log(`[OUTBOX] Notificação ${item.notification_id} enviada com sucesso para ${recipient}`);
    } else {
      const errText = await evoRes.text().catch(() => 'Erro Evolution API');
      await handleOutboxFailure(item, `HTTP ${evoRes.status}: ${errText.slice(0, 200)}`);
    }
  } catch (sendErr) {
    await handleOutboxFailure(item, sendErr.message || 'Falha de conexão com Evolution API');
  }
}

async function handleOutboxFailure(item, errorMsg) {
  const currentAttempts = (item.attempt_count || 0) + 1;
  const safeError = errorMsg.slice(0, 500);

  if (currentAttempts >= 5) {
    await supabaseFetch(`/rest/v1/notification_outbox?notification_id=eq.${encodeURIComponent(item.notification_id)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'FAILED',
        attempt_count: currentAttempts,
        error: safeError
      })
    }).catch(() => {});
    console.error(`[OUTBOX] Notificação ${item.notification_id} falhou definitivamente após 5 tentativas.`);
  } else {
    // Retry exponencial: 60s, 120s, 240s, 480s, etc., max 3600s
    const delaySeconds = Math.min(60 * Math.pow(2, currentAttempts - 1), 3600);
    const nextRetry = new Date(Date.now() + delaySeconds * 1000).toISOString();
    await supabaseFetch(`/rest/v1/notification_outbox?notification_id=eq.${encodeURIComponent(item.notification_id)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        attempt_count: currentAttempts,
        scheduled_at: nextRetry,
        error: safeError
      })
    }).catch(() => {});
    console.warn(`[OUTBOX] Notificação ${item.notification_id} reagendada (tentativa ${currentAttempts}) em +${delaySeconds}s.`);
  }
}

// ======================================================================
// EXPRESS APP E MIDDLEWARES
// ======================================================================

const app = express();

// Limite estrito de body para segurança
app.use(express.json({ limit: '1mb' }));

// Desabilita header X-Powered-By
app.disable('x-powered-by');

// CORS seguro com suporte a WWW-Authenticate
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, apikey, x-api-key, x-helena-webhook-secret');
  res.header('Access-Control-Expose-Headers', 'WWW-Authenticate, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Monta Central de Integrações (Evolution, Meowcaller, ElevenLabs, Laya)
app.use(createIntegrationsRouter({ supabaseFetch, authenticateUser: authenticateMcp }));

// Helpers de OAuth 2.1 Protected Resource Metadata
function getResourceHost(req) {
  return process.env.PUBLIC_HOST || req.headers.host || 'helena-automation-helena-gateway.d9v63q.easypanel.host';
}

function getProtectedResourceMetadata(req) {
  const host = getResourceHost(req);
  return {
    resource: `https://${host}/mcp`,
    authorization_servers: [
      SUPABASE_AUTH_ISSUER
    ],
    scopes_supported: [
      'openid',
      'profile',
      'email',
      'offline_access'
    ],
    bearer_methods_supported: ['header']
  };
}

// Publicação do Protected Resource Metadata (RFC 9728)
app.get(['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp'], (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  return res.json(getProtectedResourceMetadata(req));
});

// Middleware de autenticação MCP (OAuth 2.1 via Supabase Auth + Fallback Administrativo)
async function authenticateMcp(req, res, next) {
  const host = getResourceHost(req);
  const resourceMetadataUrl = `https://${host}/.well-known/oauth-protected-resource/mcp`;
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!token) {
    res.setHeader('WWW-Authenticate', `Bearer resource_metadata="${resourceMetadataUrl}"`);
    return res.status(401).json({
      error: 'invalid_token',
      error_description: 'Authorization required'
    });
  }

  // 1. Fallback administrativo temporário (MCP_BEARER_TOKEN estático mantido sem divulgar ao Grok)
  if (MCP_BEARER_TOKEN && safeCompare(token, MCP_BEARER_TOKEN)) {
    req.identity = {
      userId: 'admin',
      role: 'service-admin',
      type: 'static_fallback'
    };
    return next();
  }

  // 2. Validação obrigatória de Access Token OAuth 2.1 emitido pelo Supabase Auth via JWKS
  try {
    const { payload } = await jwtVerify(token, jwksClient, {
      issuer: SUPABASE_AUTH_ISSUER
    });

    if (!payload.sub) {
      throw new Error('Claim sub ausente no token JWT');
    }

    req.identity = {
      userId: payload.sub,
      clientId: payload.client_id || null,
      email: payload.email || null,
      role: payload.role || 'authenticated',
      scopes: typeof payload.scope === 'string' ? payload.scope.split(' ') : (payload.scopes || []),
      type: 'oauth2'
    };

    return next();
  } catch (err) {
    const safeErrorMsg = (err.message || 'Invalid or expired access token').replace(/"/g, "'");
    res.setHeader('WWW-Authenticate', `Bearer resource_metadata="${resourceMetadataUrl}", error="invalid_token", error_description="${safeErrorMsg}"`);
    return res.status(401).json({
      error: 'invalid_token',
      error_description: err.message || 'Invalid or expired access token'
    });
  }
}

// Middleware de autenticação Webhook Supabase
function authenticateWebhook(req, res, next) {
  const secretHeader = req.headers['x-helena-webhook-secret'] || '';

  if (!GATEWAY_WEBHOOK_SECRET || !secretHeader || !safeCompare(secretHeader, GATEWAY_WEBHOOK_SECRET)) {
    return res.status(401).json({
      ok: false,
      error: 'Unauthorized: Invalid webhook secret'
    });
  }
  next();
}

// ======================================================================
// ROTAS HTTP
// ======================================================================

/**
 * 7 — GET /health
 * Testa conectividade real com o Supabase e Supabase OAuth JWKS.
 */
app.get('/health', async (req, res) => {
  let supabaseOk = false;
  let oauthOk = false;

  // 1. Testa conectividade com PostgREST Supabase
  if (SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const pingUrl = `${SUPABASE_URL}/rest/v1/agent_jobs?select=job_id&limit=1`;
      const pingRes = await fetch(pingUrl, {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        },
        signal: AbortSignal.timeout(5000)
      });
      supabaseOk = pingRes.ok;
    } catch {
      supabaseOk = false;
    }
  }

  // 2. Testa conectividade com Supabase OAuth JWKS
  try {
    const jwksRes = await fetch(SUPABASE_JWKS_URL, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });
    oauthOk = jwksRes.ok;
  } catch {
    oauthOk = false;
  }

  const isHealthy = supabaseOk && oauthOk;
  const status = isHealthy ? 200 : 503;

  return res.status(status).json({
    ok: isHealthy,
    service: 'helena-gateway',
    version: '0.1.0',
    supabase: supabaseOk,
    oauth: oauthOk,
    mcp: true
  });
});

/**
 * 8 — POST /webhooks/supabase/agent-job
 * Sinalização assíncrona de novos jobs via Database Webhooks do Supabase.
 * Registra evento WAKE_SIGNAL em public.agent_job_events. Não executa a missão.
 */
app.post('/webhooks/supabase/agent-job', authenticateWebhook, async (req, res) => {
  try {
    const payload = req.body || {};
    const record = payload.record || payload;

    const jobId = record.job_id || payload.job_id;
    const agentId = record.agent_id || payload.agent_id || 'UNKNOWN';
    const businessId = record.business_id || payload.business_id || null;

    if (!jobId) {
      return res.status(400).json({
        ok: false,
        error: 'Payload do webhook não possui job_id'
      });
    }

    // Registra evento WAKE_SIGNAL
    await supabaseFetch('/rest/v1/agent_job_events', {
      method: 'POST',
      body: JSON.stringify({
        job_id: jobId,
        agent_id: agentId,
        business_id: businessId,
        event_type: 'WAKE_SIGNAL',
        status: record.status || 'READY',
        message: 'Wake signal recebido via Supabase Database Webhook',
        payload: {
          webhook_type: payload.type || 'INSERT',
          table: payload.table || 'agent_jobs',
          schema: payload.schema || 'public',
          received_at: new Date().toISOString()
        }
      })
    });

    return res.status(200).json({
      ok: true,
      signaled: true,
      job_id: jobId
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: 'Falha ao registrar wake signal'
    });
  }
});

/**
 * 9 — ENDPOINT MCP (/mcp)
 * Suporte completo ao protocolo MCP sobre HTTP e JSON-RPC 2.0
 */
app.get('/mcp', authenticateMcp, (req, res) => {
  const tools = Object.entries(TOOLS_CONFIG).map(([name, def]) => ({
    name,
    description: def.description
  }));

  return res.json({
    service: 'helena-gateway',
    version: '0.1.0',
    protocol: 'mcp-jsonrpc-2.0',
    tools
  });
});

app.post('/mcp', authenticateMcp, async (req, res) => {
  const body = req.body || {};
  const id = body.id !== undefined ? body.id : null;
  const method = body.method;

  // 1. Handshake MCP: initialize
  if (method === 'initialize') {
    return res.json({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {
            listChanged: false
          }
        },
        serverInfo: {
          name: 'helena-gateway',
          version: '0.1.0'
        }
      }
    });
  }

  // 2. Handshake MCP: notifications/initialized
  if (method === 'notifications/initialized') {
    return res.json({
      jsonrpc: '2.0',
      id,
      result: {}
    });
  }

  // 3. Ping
  if (method === 'ping') {
    return res.json({
      jsonrpc: '2.0',
      id,
      result: {}
    });
  }

  // 4. Listagem de ferramentas: tools/list
  if (method === 'tools/list') {
    const tools = Object.entries(TOOLS_CONFIG).map(([name, def]) => {
      // Gera schema de parâmetros simples para o cliente MCP
      return {
        name,
        description: def.description,
        inputSchema: {
          type: 'object'
        }
      };
    });

    return res.json({
      jsonrpc: '2.0',
      id,
      result: {
        tools
      }
    });
  }

  // 5. Execução de ferramentas: tools/call
  if (method === 'tools/call') {
    const params = body.params || {};
    const toolName = params.name;
    const toolArgs = params.arguments || {};

    const toolDef = TOOLS_CONFIG[toolName];
    if (!toolDef) {
      return res.status(404).json({
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: `Ferramenta '${toolName}' não encontrada`
        }
      });
    }

    try {
      const validatedArgs = toolDef.schema.parse(toolArgs);
      const executionResult = await toolDef.handler(validatedArgs);

      return res.json({
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(executionResult, null, 2)
            }
          ]
        }
      });
    } catch (err) {
      const isZod = err instanceof z.ZodError;
      const errorMessage = isZod
        ? `Parâmetros inválidos: ${err.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')}`
        : err.message;

      return res.json({
        jsonrpc: '2.0',
        id,
        result: {
          isError: true,
          content: [
            {
              type: 'text',
              text: errorMessage
            }
          ]
        }
      });
    }
  }

  // 6. Chamada direta de método com o mesmo nome da ferramenta
  if (TOOLS_CONFIG[method]) {
    const toolDef = TOOLS_CONFIG[method];
    try {
      const validatedArgs = toolDef.schema.parse(body.params || {});
      const executionResult = await toolDef.handler(validatedArgs);

      return res.json({
        jsonrpc: '2.0',
        id,
        result: executionResult
      });
    } catch (err) {
      return res.json({
        jsonrpc: '2.0',
        id,
        error: {
          code: -32602,
          message: err.message
        }
      });
    }
  }

  // Método não suportado
  return res.status(400).json({
    jsonrpc: '2.0',
    id,
    error: {
      code: -32601,
      message: `Método desconhecido: ${method}`
    }
  });
});

// Endpoint REST alternativo para clientes HTTP REST simples
app.post('/api/tools/:toolName', authenticateMcp, async (req, res) => {
  const { toolName } = req.params;
  const toolDef = TOOLS_CONFIG[toolName];

  if (!toolDef) {
    return res.status(404).json({ ok: false, error: `Ferramenta ${toolName} não existe` });
  }

  try {
    const validatedArgs = toolDef.schema.parse(req.body || {});
    const result = await toolDef.handler(validatedArgs);
    return res.json({ ok: true, result });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

// ======================================================================
// INICIALIZAÇÃO DO SERVIDOR E AGENDAMENTOS
// ======================================================================

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[HELENA_GATEWAY] Servidor ativo na porta ${PORT}`);
  console.log(`[HELENA_GATEWAY] Host público configurado: ${PUBLIC_HOST}`);
  console.log(`[HELENA_GATEWAY] Supabase: ${SUPABASE_URL}`);
  console.log(`[HELENA_GATEWAY] Evolution API: ${EVOLUTION_BASE_URL ? 'CONFIGURADA' : 'DESATIVADA'}`);

  // Inicia loops periódicos
  setInterval(tickScheduledJobs, SCHEDULE_TICK_MS);
  setInterval(tickNotificationOutbox, OUTBOX_TICK_MS);
});

// Encerramento gracioso
process.on('SIGTERM', () => {
  console.log('[HELENA_GATEWAY] Encerrando servidor graciosamente...');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('[HELENA_GATEWAY] Encerrando servidor...');
  server.close(() => process.exit(0));
});

export { app, server, TOOLS_CONFIG };
