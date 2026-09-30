import { createProfileStore } from './integrations/profile-store.mjs';
import { createVoiceAgentStore } from './integrations/voice-agent-store.mjs';
import { configureVoiceAgentStore } from './integrations/voice-agent.mjs';
import { createVoiceAdminAuth } from './voice-admin-auth.mjs';
/**
 * Helena Gateway — Backend Operacional do Sistema Helena
 * Conecta o ecossistema Helena (GPT via Hermes / Supabase / Evolution API)
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
import { authorizeGatewayTool, resolveHermesToken } from './runtime-access.mjs';
import { workflowTools } from './workflow.mjs';
import { readVisualAsset, toolResultContent } from './visual-assets.mjs';
import { artifactEventId, createArtifactUpload, parseArtifactReference, renderArtifactSvg, uploadRenderedArtifact, verifyArtifact } from './artifact-storage.mjs';
import { validateProfessionalBrief } from './brief-contract.mjs';
import { agentQualityContract, QUALITY_VERSION } from './professional-output.mjs';
import { createTypeSafe } from './integrations/typesafe.mjs';
import { jobView, JOB_SECTIONS } from './job-reader.mjs';

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
const HERMES_PROFILE_TOKEN_HASHES = process.env.HERMES_PROFILE_TOKEN_HASHES || '[]';

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
async function handleListReadyJobs({ limit = 10, agent_id, business_id } = {}) {
  const boundedLimit = Math.min(Math.max(limit, 1), 25);
  const nowIso = new Date().toISOString();

  // Consulta agent_jobs no Supabase com status READY
  let url = `/rest/v1/agent_jobs?status=eq.READY&order=created_at.asc&limit=50`;
  if (agent_id) {
    url += `&agent_id=eq.${encodeURIComponent(agent_id)}`;
  }
  if (business_id) url += `&business_id=eq.${encodeURIComponent(business_id)}`;

  const rawJobs = await supabaseFetch(url);
  if (!Array.isArray(rawJobs)) {
    return { jobs: [], total: 0 };
  }

  // Filtra available_at <= now (ou null)
  const readyJobs = rawJobs.filter(job => {
    if (!job.available_at) return true;
    return new Date(job.available_at) <= new Date(nowIso);
  });

  // O runtime Hermes e vinculado ao par agente/empresa, sem reutilizar a
  // conexao historica e unica do Grok.
  let bindings = [];
  let agentes = [];
  try {
    bindings = await supabaseFetch('/rest/v1/agent_runtime_bindings?select=agent_id,business_id,scope_type,provider,profile_slug,status').catch(() => []);
    agentes = await supabaseFetch('/rest/v1/agentes?select=*').catch(() => []);
  } catch {
    // degradação suave se tabelas auxiliares sofrerem lentidão
  }

  const activeBindings = Array.isArray(bindings) ? bindings.filter(b => b.provider === 'HERMES' && b.status === 'ACTIVE') : [];
  const bindingFor = job => activeBindings.find(b => b.agent_id === job.agent_id && (
    b.business_id === job.business_id || (job.agent_id === 'AGT-01' && b.scope_type === 'GROUP')
  ));
  const agenteMap = new Map((Array.isArray(agentes) ? agentes : []).map(a => [a.id || a.agent_id, a]));

  // Falha fechada: sem conexao ativa, tarefa e empresa, nao ha despacho.
  const eligibleJobs = readyJobs.filter(job => {
    return Boolean(bindingFor(job))
      && Boolean(job.task_id && job.business_id);
  });

  eligibleJobs.sort((a, b) => {
    const pA = PRIORITY_ORDER[a.priority] || 99;
    const pB = PRIORITY_ORDER[b.priority] || 99;
    if (pA !== pB) return pA - pB;
    return new Date(a.created_at || 0) - new Date(b.created_at || 0);
  });

  const slicedJobs = eligibleJobs.slice(0, boundedLimit);

  const enrichedJobs = slicedJobs.map(job => {
    const binding = bindingFor(job);
    const ag = agenteMap.get(job.agent_id) || {};
    const agentName = ag.agente || ag.nome || ag.name || job.agent_id;
    const agentFuncao = ag.cargo_funcao || ag.funcao || ag.papel || ag.role || 'Especialista Operacional';
    const provider = binding.provider;
    const externalAgentId = binding.profile_slug;
    const connectionStatus = 'CONNECTED';

    const dispatchMessage = `[SISTEMA HELENA | ${job.job_id}]
Destino: ${agentName} (${job.agent_id}) - ${agentFuncao}
Prioridade: ${job.priority || 'MEDIA'}
Empresa: ${job.business_id || 'Não especificada'}
Tarefa: ${job.task_id || 'Não vinculada'}
Objetivo: ${job.objective}
Instrução: ${job.instruction || 'Seguir protocolo padrão da função.'}

PROTOCOLO OPERACIONAL HERMES V2:
1. Consulte get_work_context e get_job para confirmar perfil, empresa, tarefa e estado atual.
2. Se o job ainda estiver READY, use claim_job e start_job; confirme RUNNING antes de trabalhar. Se um despachante já fez essas chamadas, não as repita.
3. Execute só no seu escopo e registre marcos reais em record_progress: ação, motivo, fonte e próximo passo.
4. Registre a entrega com submit_work: source, summary, delivery completo e criterios com criterion e finding. O Gateway cria a memoria duravel e vincula suas referencias automaticamente.
5. Inclua expected_task_version lida em get_job; imagens exigem artifact_refs verificados e publication. Aguarde review_delivery do revisor; o executor não se autoaprova.
6. Somente após aprovação, handoff_task pode criar a tarefa do próximo responsável em DRAFT; a coordenação a libera separadamente.
7. Se houver bloqueio, use waiting_helena ou fail_job. Não reinicie o modelo automaticamente.
8. Não use complete_job no fluxo Hermes. Não afirme conclusão sem gravação, revisão e leitura confirmadas no Supabase.`;

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
    total_ready: eligibleJobs.length,
    returned_count: enrichedJobs.length,
    jobs: enrichedJobs
  };
}

/**
 * 2. record_dispatch
 */
async function handleRecordDispatch({
  job_id,
  dispatcher_agent_id,
  target_agent_id,
  target_external_agent_id,
  notes
}) {
  if (!dispatcher_agent_id) {
    throw new Error('dispatcher_agent_id é obrigatório para record_dispatch');
  }

  if (dispatcher_agent_id !== 'AGT-04') {
    throw new Error('record_dispatch permitido somente para Marina / AGT-04');
  }

  if (!job_id) {
    throw new Error('job_id é obrigatório para record_dispatch');
  }

  // Verifica se o job existe
  const jobs = await supabaseFetch(`/rest/v1/agent_jobs?job_id=eq.${encodeURIComponent(job_id)}&limit=1`);
  if (!Array.isArray(jobs) || jobs.length === 0) {
    throw new Error(`Job ${job_id} não encontrado`);
  }
  const job = jobs[0];
  if (job.status !== 'READY' || !job.task_id || !job.business_id) {
    throw new Error(`Job ${job_id} nao esta pronto, vinculado a tarefa e empresa`);
  }

  const finalTargetAgent = target_agent_id || job.agent_id;
  if (finalTargetAgent !== job.agent_id) {
    throw new Error('O agente de destino deve corresponder ao responsavel do job');
  }

  const bindings = await supabaseFetch(
    `/rest/v1/agent_runtime_bindings?agent_id=eq.${encodeURIComponent(finalTargetAgent)}&status=eq.ACTIVE`
  );
  const binding = Array.isArray(bindings) ? bindings.find(b => b.provider === 'HERMES' && (
    b.business_id === job.business_id || (finalTargetAgent === 'AGT-01' && b.scope_type === 'GROUP')
  )) : null;
  if (!binding) {
    throw new Error(`Agente ${finalTargetAgent} sem runtime ativo permitido`);
  }
  if (target_external_agent_id && target_external_agent_id !== binding.profile_slug) {
    throw new Error('Perfil Hermes de destino nao corresponde ao vinculo ativo');
  }

  // Verifica cooldown de despacho
  const events = await supabaseFetch(
    `/rest/v1/agent_job_events?job_id=eq.${encodeURIComponent(job_id)}&event_type=eq.DISPATCH_REQUESTED&order=created_at.desc&limit=1`
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
        message: `Pedido de despacho para ${job_id} registrado recentemente. Cooldown de ${remainingSeconds}s restantes.`
      };
    }
  }

  // A API registra apenas a solicitação. A execução real ocorre no host Hermes
  // pelo dispatcher, que confirma claim_job e start_job com o perfil individual.
  await supabaseFetch('/rest/v1/agent_job_events', {
    method: 'POST',
    body: JSON.stringify({
      job_id,
      agent_id: finalTargetAgent,
      business_id: job.business_id,
      event_type: 'DISPATCH_REQUESTED',
      status: 'READY',
      message: `Despacho solicitado por ${dispatcher_agent_id} para ${finalTargetAgent}; execução ainda não confirmada`,
      payload: {
        dispatcher_agent_id,
        target_agent_id: finalTargetAgent,
        target_external_agent_id: binding.profile_slug,
        notes: notes || null,
        dispatched_at: new Date().toISOString()
      }
    })
  });

  return {
    success: true,
    dispatched: false,
    local_runner_required: true,
    job_id,
    target_agent_id: finalTargetAgent,
    cooldown_seconds: DISPATCH_COOLDOWN_SECONDS,
    message: `Pedido registrado para ${job_id}. A execução depende do dispatcher no host Hermes.`
  };
}

/**
 * 3. get_job
 */
async function handleGetJob({ job_id, ...readOptions }) {
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

  const bindings = await supabaseFetch(
    `/rest/v1/agent_runtime_bindings?select=agent_id,business_id,scope_type,profile_slug,provider,status&agent_id=eq.${encodeURIComponent(job.agent_id)}`
  ).catch(() => []);
  const runtimeBinding = Array.isArray(bindings) ? bindings.find(b =>
    b.provider === 'HERMES' && (b.business_id === job.business_id || (job.agent_id === 'AGT-01' && b.scope_type === 'GROUP'))
  ) : null;

  // A verified handoff carries the approved predecessor's evidence into the new task.
  // Same-company membership alone never grants access to another job's memory.
  let sourceJob = null;
  if (job.correlation_id && job.correlation_id !== job.job_id) {
    const links = await supabaseFetch(`/rest/v1/agent_job_events?event_type=eq.WORKFLOW_handoff&business_id=eq.${encodeURIComponent(job.business_id)}&payload->response->>job_id=eq.${encodeURIComponent(job_id)}&limit=2`);
    if (Array.isArray(links) && links.length === 1 && links[0].payload?.response?.job_id === job_id && links[0].business_id === job.business_id) {
      const parents = await supabaseFetch(`/rest/v1/agent_jobs?job_id=eq.${encodeURIComponent(links[0].job_id)}&business_id=eq.${encodeURIComponent(job.business_id)}&limit=1`);
      const parent = Array.isArray(parents) ? parents[0] : null;
      if (parent?.business_id === job.business_id && parent.status === 'COMPLETED' && parent.approval_status === 'APPROVED' && (parent.correlation_id || parent.job_id) === job.correlation_id && parent.result_payload?.reviewed_by) sourceJob = parent;
    }
  }
  const memoryIds = [...new Set((Array.isArray(job.evidence_refs) ? job.evidence_refs : [])
    .filter(ref => typeof ref === 'string' && /^MEM-HR-[a-f0-9]{32}$/i.test(ref)))];
  const sourceIds = (sourceJob?.evidence_refs || []).filter(ref => typeof ref === 'string' && /^MEM-HR-[a-f0-9]{32}$/i.test(ref)).slice(0, 10);
  const requestedMemoryIds = [...new Set([...memoryIds, ...sourceIds])].slice(0, 20);
  const allowedJobs = sourceJob ? `in.(${job_id},${sourceJob.job_id})` : `eq.${encodeURIComponent(job_id)}`;
  let evidenceRecords = [];
  if (requestedMemoryIds.length > 0) {
    const records = await supabaseFetch(
      `/rest/v1/memoria_mestre?select=id,assunto,registro,evidencia_origem,proxima_acao,status,confianca,business_id_area,related_object_id&related_object_id=${allowedJobs}&business_id_area=eq.${encodeURIComponent(job.business_id)}&id=in.(${requestedMemoryIds.join(',')})&limit=20`
    );
    if (!Array.isArray(records)) throw new Error('Consulta de evidencias retornou formato invalido');
    evidenceRecords = records.filter(record => requestedMemoryIds.includes(record.id)
      && record.business_id_area === job.business_id && (record.related_object_id === job_id || (record.related_object_id === sourceJob?.job_id && sourceIds.includes(record.id))));
  }

  // Manager-authored briefing references are inputs, never proof of this job's delivery.
  // Only the explicitly named, reviewed output of a completed same-company job is returned.
  const inputIds = [...new Set(String(job.instruction || '').match(/\bMEM-HR-[a-f0-9]{32}\b/gi) || [])].slice(0, 10);
  let inputRecords = [];
  if (inputIds.length) {
    const candidates = await supabaseFetch(`/rest/v1/memoria_mestre?select=id,assunto,registro,evidencia_origem,proxima_acao,status,confianca,business_id_area,related_object_id&business_id_area=eq.${encodeURIComponent(job.business_id)}&id=in.(${inputIds.join(',')})&limit=10`);
    if (!Array.isArray(candidates)) throw new Error('Consulta de fontes retornou formato invalido');
    const scoped = candidates.filter(record => inputIds.includes(record.id) && record.business_id_area === job.business_id
      && typeof record.related_object_id === 'string' && record.related_object_id !== job_id);
    const ownerIds = [...new Set(scoped.map(record => record.related_object_id))];
    if (ownerIds.length) {
      const owners = await supabaseFetch(`/rest/v1/agent_jobs?job_id=in.(${ownerIds.map(encodeURIComponent).join(',')})&business_id=eq.${encodeURIComponent(job.business_id)}&status=eq.COMPLETED&approval_status=eq.APPROVED&limit=10`);
      if (!Array.isArray(owners)) throw new Error('Consulta de revisoes retornou formato invalido');
      inputRecords = scoped.filter(record => owners.some(owner => owner.job_id === record.related_object_id
        && owner.business_id === job.business_id && owner.status === 'COMPLETED' && owner.approval_status === 'APPROVED'
        && owner.result_payload?.reviewed_by && Array.isArray(owner.evidence_refs) && owner.evidence_refs.includes(record.id)))
        .map(record => {
          const owner = owners.find(item => item.job_id === record.related_object_id);
          return { ...record, approved_output: {
            job_id: owner.job_id, reviewed_by: owner.result_payload.reviewed_by,
            summary: owner.result_summary || null,
            delivery: owner.result_payload.delivery || null,
            publication: owner.result_payload.publication || null
          } };
        });
    }
  }

  // Deliveries may cite both their own output and approved briefing inputs.
  // Approval still requires a record owned by this job in workflow.mjs.
  evidenceRecords = [...evidenceRecords, ...inputRecords.filter(record => memoryIds.includes(record.id)
    && !evidenceRecords.some(existing => existing.id === record.id))];
  const artifactRefs = (Array.isArray(job.evidence_refs) ? job.evidence_refs : []).filter(ref => typeof ref === 'string' && ref.startsWith('storage://'));
  const artifactEvents = artifactRefs.length ? await supabaseFetch(
    `/rest/v1/agent_job_events?job_id=eq.${encodeURIComponent(job_id)}&event_type=eq.ARTIFACT_VERIFIED&select=event_id,payload,created_at&limit=20`
  ) : [];
  const artifactRecords = artifactRefs.flatMap(ref => {
    const parsed = parseArtifactReference(ref, job);
    const event = Array.isArray(artifactEvents) && artifactEvents.find(item => item.payload?.reference === ref && item.payload?.path === parsed?.path);
    return parsed && event ? [{ ...parsed, width: event.payload.width, height: event.payload.height, bytes: event.payload.bytes, sha256: event.payload.sha256, verified_at: event.created_at }] : [];
  });
  const evidenceMissing = [
    ...memoryIds.filter(id => !evidenceRecords.some(record => record.id === id)),
    ...artifactRefs.filter(ref => !artifactRecords.some(record => record.reference === ref))
  ];

  return jobView({
    job,
    quality_version: QUALITY_VERSION,
    agent_quality_contract: agentQualityContract(job.agent_id),
    company_identity: (await supabaseFetch(`/rest/v1/portfolio?business_id=eq.${encodeURIComponent(job.business_id)}&limit=1`)).map(company => ({ business_id: company.business_id, row_version: company.row_version, brand_identity: company.brand_identity || null }))[0] || null,
    task: job.task_id ? (await supabaseFetch(`/rest/v1/tarefas?task_id=eq.${encodeURIComponent(job.task_id)}&business_id=eq.${encodeURIComponent(job.business_id)}&limit=1`))[0] || null : null,
    runtime_binding: runtimeBinding || null,
    connection: runtimeBinding ? {
      agent_id: runtimeBinding.agent_id,
      provider: runtimeBinding.provider,
      external_agent_id: runtimeBinding.profile_slug,
      connection_status: runtimeBinding.status === 'ACTIVE' ? 'CONNECTED' : 'NOT_CONNECTED'
    } : null,
    events: Array.isArray(events) ? events : [],
    source_job: sourceJob ? { job_id: sourceJob.job_id, result_summary: sourceJob.result_summary, review: sourceJob.result_payload } : null,
    source_evidence_records: evidenceRecords.filter(record => record.related_object_id === sourceJob?.job_id),
    input_evidence_records: inputRecords,
    input_evidence_missing: inputIds.filter(id => !inputRecords.some(record => record.id === id)),
    evidence_records: evidenceRecords,
    artifact_records: artifactRecords,
    evidence_missing: evidenceMissing
  }, readOptions);
}

/**
 * 4. claim_job (RPC gateway_claim_agent_job)
 */
async function handleClaimJob({ job_id, agent_id }) {
  if (!job_id || !agent_id) {
    throw new Error('job_id e agent_id são obrigatórios para claim_job');
  }

  const detail = await handleGetJob({ job_id });
  validateProfessionalBrief(detail);
  if (detail.job.agent_id !== agent_id || detail.job.status !== 'READY') {
    throw new Error('Job ainda não está liberado para este agente');
  }

  const result = await callSupabaseRpc('gateway_claim_agent_job', {
    job_id,
    agent_id
  });

  return {
    success: Boolean(result && (!Array.isArray(result) || result.length > 0)),
    claimed: Boolean(result && (!Array.isArray(result) || result.length > 0)),
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
    success: Boolean(result && (!Array.isArray(result) || result.length > 0)),
    running: Boolean(result && (!Array.isArray(result) || result.length > 0)),
    job_id,
    agent_id,
    result
  };
}

/**
 * Registra um marco operacional sem nova chamada de IA. O banco valida
 * estado e vínculo do job e evita duplicação por step_key.
 */
async function handleRecordProgress({ job_id, agent_id, step_key, action, reason, next_step, evidence_refs = [] }, context = {}) {
  const identity = context.identity || {};
  if (!(identity.type === 'hermes_profile' && identity.bindingVerified)
      && (identity.type !== 'static_fallback' || identity.role !== 'service-admin')) {
    if (identity.type !== 'oauth2' || !identity.userId) {
      throw new Error('Identidade autenticada obrigatória para registrar progresso');
    }
    const jobs = await supabaseFetch(`/rest/v1/agent_jobs?select=agent_id,business_id&job_id=eq.${encodeURIComponent(job_id)}&limit=1`);
    const job = Array.isArray(jobs) ? jobs[0] : null;
    if (!job || job.agent_id !== agent_id) {
      throw new Error('Job ou agente incompatível');
    }
    const access = await supabaseFetch(`/rest/v1/app_access?select=role&user_id=eq.${encodeURIComponent(identity.userId)}&active=eq.true&limit=1`);
    const role = Array.isArray(access) ? access[0]?.role : null;
    if (role !== 'founder') {
      if (!role || !job.business_id) {
        throw new Error('Acesso à empresa do job não autorizado');
      }
      const membership = await supabaseFetch(`/rest/v1/user_business_access?select=business_id&user_id=eq.${encodeURIComponent(identity.userId)}&business_id=eq.${encodeURIComponent(job.business_id)}&active=eq.true&limit=1`);
      if (!Array.isArray(membership) || membership.length === 0) {
        throw new Error('Acesso à empresa do job não autorizado');
      }
    }
  }
  const result = await callSupabaseRpc('gateway_record_agent_progress', {
    job_id,
    agent_id,
    step_key,
    action: action.trim(),
    reason: reason.trim(),
    next_step: next_step.trim(),
    evidence_refs,
    actor: {
      type: identity.type || 'unattributed',
      user_id: identity.userId || null,
      client_id: identity.clientId || null,
      ...(identity.profileSlug ? { profile_slug: identity.profileSlug, agent_id: identity.agentId } : {})
    }
  });
  if (!result?.event_id) {
    throw new Error('Supabase não confirmou o registro do marco');
  }

  return {
    success: true,
    recorded: true,
    job_id,
    agent_id,
    event_id: result?.event_id || null
  };
}

/**
 * complete_job (RPC gateway_complete_agent_job)
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
    success: Boolean(result),
    completed: Boolean(result),
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
    success: Boolean(result),
    failed: Boolean(result),
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
}, context = {}) {
  if (!job_id || !agent_id) {
    throw new Error('job_id e agent_id são obrigatórios para waiting_helena');
  }
  if (!contexto || !impacto || !decisao_necessaria || !recomendacao) {
    throw new Error('contexto, impacto, decisao_necessaria e recomendacao são obrigatórios para waiting_helena');
  }

  const jobs = await supabaseFetch(
    `/rest/v1/agent_jobs?select=agent_id,business_id,status&job_id=eq.${encodeURIComponent(job_id)}&limit=1`
  );
  const job = Array.isArray(jobs) ? jobs[0] : null;
  if (!job || job.agent_id !== agent_id) {
    throw new Error('Job ou agente incompatível');
  }
  if (!['CLAIMED', 'RUNNING'].includes(job.status)) {
    throw new Error('Job não está em execução para solicitar revisão da Helena');
  }

  const identity = context.identity || {};
  if (!(identity.type === 'hermes_profile' && identity.bindingVerified)
      && (identity.type !== 'static_fallback' || identity.role !== 'service-admin')) {
    if (identity.type !== 'oauth2' || !identity.userId) {
      throw new Error('Identidade autenticada obrigatória para solicitar revisão');
    }
    const access = await supabaseFetch(
      `/rest/v1/app_access?select=role&user_id=eq.${encodeURIComponent(identity.userId)}&active=eq.true&limit=1`
    );
    const role = Array.isArray(access) ? access[0]?.role : null;
    if (role !== 'founder') {
      if (!role || !job.business_id) {
        throw new Error('Acesso à empresa do job não autorizado');
      }
      const membership = await supabaseFetch(
        `/rest/v1/user_business_access?select=business_id&user_id=eq.${encodeURIComponent(identity.userId)}&business_id=eq.${encodeURIComponent(job.business_id)}&active=eq.true&limit=1`
      );
      if (!Array.isArray(membership) || membership.length === 0) {
        throw new Error('Acesso à empresa do job não autorizado');
      }
    }
  }

  const result = await callSupabaseRpc('gateway_waiting_helena', {
    p_job_id: job_id,
    p_agent_id: agent_id,
    p_message: `Revisão solicitada à Helena: ${decisao_necessaria.trim()}`,
    p_payload: {
      contexto: contexto.trim(),
      impacto: impacto.trim(),
      decisao_necessaria: decisao_necessaria.trim(),
      recomendacao: recomendacao.trim(),
      motivo: 'Decisão exclusiva da Helena necessária para continuar o job',
      proximo_passo: 'Helena revisar e registrar a decisão',
      solicitante: {
        type: identity.type || 'unattributed',
        user_id: identity.userId || null,
        client_id: identity.clientId || null
      }
    }
  });
  if (!result || result.job_id !== job_id || result.status !== 'WAITING_HELENA') {
    throw new Error('Supabase não confirmou a revisão pendente da Helena');
  }

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
async function handleQueueSummary({ business_id, agent_id } = {}) {
  let url = '/rest/v1/agent_jobs?select=status,priority,agent_id,business_id';
  if (business_id) {
    url += `&business_id=eq.${encodeURIComponent(business_id)}`;
  }
  if (agent_id) url += `&agent_id=eq.${encodeURIComponent(agent_id)}`;

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

const typeSafe = createTypeSafe({ read: supabaseFetch, readJob: handleGetJob });
const TOOLS_CONFIG = {
  ...workflowTools(callSupabaseRpc, handleGetJob, typeSafe.evaluate, typeSafe.recordReleaseRoute),
  get_visual_asset: {
    description: 'Abre os pixels reais de um PNG verificado desta tarefa ou seu brand-logo aprovado. Acesso restrito ao executor, coordenacao ou revisor designado. Inspecione texto, logo, cores, personagem e composicao antes de aprovar; metadados nao comprovam qualidade.',
    schema: z.object({ job_id: z.string().min(1).max(120), reference: z.string().min(1).max(500) }).strict(),
    handler: async ({ job_id, reference }, { identity } = {}) => {
      const jobs = await supabaseFetch(`/rest/v1/agent_jobs?job_id=eq.${encodeURIComponent(job_id)}&limit=1`);
      const job = jobs?.[0]; if (!job) throw new Error('Job inexistente');
      const companies = reference === 'brand-logo' ? await supabaseFetch(`/rest/v1/portfolio?business_id=eq.${encodeURIComponent(job.business_id)}&select=brand_identity&limit=1`) : [];
      const events = reference !== 'brand-logo' ? await supabaseFetch(`/rest/v1/agent_job_events?job_id=eq.${encodeURIComponent(job_id)}&event_type=eq.ARTIFACT_VERIFIED&select=payload&limit=20`) : [];
      const result = await readVisualAsset({ job, reference, brand: companies?.[0]?.brand_identity,
        verified: events.map(event => event.payload), serviceUrl: SUPABASE_URL, serviceKey: SUPABASE_SERVICE_ROLE_KEY });
      if (identity?.agentId && reference !== 'brand-logo') {
        const eventHash = crypto.createHash('sha256').update(`${job_id}:${identity.agentId}:${result.sha256}`).digest('hex').slice(0, 32);
        const eventId = [eventHash.slice(0,8), eventHash.slice(8,12), eventHash.slice(12,16), eventHash.slice(16,20), eventHash.slice(20)].join('-');
        await supabaseFetch('/rest/v1/agent_job_events?on_conflict=event_id', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates' }, body: JSON.stringify({
          event_id: eventId, job_id, agent_id: identity.agentId, business_id: job.business_id,
          event_type: 'VISUAL_ASSET_OPENED', status: job.status, message: 'Pixels disponibilizados para inspecao visual; nao representa aprovacao',
          payload: { reference, sha256: result.sha256, width: result.width, height: result.height }
        }) });
      }
      return result;
    }
  },
  create_artifact_upload: {
    description: 'Maya: com job_id, slot e version prepara URL privada de upload legado; se enviar tambem svg (ate 35 KB), converte em PNG 1080x1350/1080x1920, envia ao bucket privado sem sobrescrever, relê bytes e registra ARTIFACT_VERIFIED. SVG ativo/externo é recusado. Nunca publica a arte.',
    schema: z.object({ job_id: z.string().min(1), slot: z.enum(['post','story-1','story-2','story-3']), version: z.number().int().min(1).max(5), svg: z.string().min(1).max(35_000).optional() }).strict(),
    handler: async ({ job_id, slot, version, svg, agent_id, business_id }) => {
      const jobs = await supabaseFetch(`/rest/v1/agent_jobs?job_id=eq.${encodeURIComponent(job_id)}&limit=1`);
      const job = Array.isArray(jobs) ? jobs[0] : null;
      if (!job || job.agent_id !== agent_id || job.business_id !== business_id || job.status !== 'RUNNING') throw new Error('Job nao autorizado para arquivo');
      if (svg !== undefined) {
        const rendered = renderArtifactSvg(svg, slot);
        const uploaded = await uploadRenderedArtifact({ job, slot, version, bytes: rendered.png, serviceUrl: SUPABASE_URL, serviceKey: SUPABASE_SERVICE_ROLE_KEY });
        const verified = await verifyArtifact({ job, slot, version, serviceUrl: SUPABASE_URL, serviceKey: SUPABASE_SERVICE_ROLE_KEY });
        if (verified.sha256 !== uploaded.sha256 || verified.bytes !== uploaded.bytes) throw new Error('PNG armazenado difere dos bytes gerados');
        await supabaseFetch('/rest/v1/agent_job_events?on_conflict=event_id', {
          method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
          body: JSON.stringify({ event_id: artifactEventId(verified.reference), job_id, agent_id, business_id,
            event_type: 'ARTIFACT_VERIFIED', status: 'RUNNING', message: `${slot} v${version} renderizado e validado no Storage`, payload: verified })
        });
        return { reference: verified.reference, slot, version, width: verified.width, height: verified.height, bytes: verified.bytes, sha256: verified.sha256, verified: true };
      }
      return createArtifactUpload({ job, slot, version, serviceUrl: SUPABASE_URL, serviceKey: SUPABASE_SERVICE_ROLE_KEY });
    }
  },
  verify_artifact_upload: {
    description: 'Confere no Supabase arquivo PNG enviado, tamanho e dimensoes; registra evidência real antes de submit_delivery.',
    schema: z.object({ job_id: z.string().min(1), slot: z.enum(['post','story-1','story-2','story-3']), version: z.number().int().min(1).max(5) }).strict(),
    handler: async ({ job_id, slot, version, agent_id, business_id }) => {
      const jobs = await supabaseFetch(`/rest/v1/agent_jobs?job_id=eq.${encodeURIComponent(job_id)}&limit=1`);
      const job = Array.isArray(jobs) ? jobs[0] : null;
      if (!job || job.agent_id !== agent_id || job.business_id !== business_id || job.status !== 'RUNNING') throw new Error('Job nao autorizado para arquivo');
      const verified = await verifyArtifact({ job, slot, version, serviceUrl: SUPABASE_URL, serviceKey: SUPABASE_SERVICE_ROLE_KEY });
      await supabaseFetch('/rest/v1/agent_job_events?on_conflict=event_id', {
        method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
        body: JSON.stringify({ event_id: artifactEventId(verified.reference), job_id, agent_id, business_id,
          event_type: 'ARTIFACT_VERIFIED', status: 'RUNNING', message: `${slot} v${version} validado no Storage`, payload: verified })
      });
      return { reference: verified.reference, slot, version, width: verified.width, height: verified.height, bytes: verified.bytes, verified: true };
    }
  },
  list_ready_jobs: {
    description: 'Consulta fila de agent_jobs no Supabase com status READY e available_at <= now, ordenados por prioridade e com dispatch_message estruturada para bots.',
    schema: z.object({
      limit: z.number().int().min(1).max(25).optional().default(10),
      agent_id: z.string().optional(),
      business_id: z.string().optional()
    }),
    handler: handleListReadyJobs
  },
  record_dispatch: {
    description: 'Registra pedido de despacho da Marina com cooldown de 180s. Não inicia o Hermes nem afirma execução; o job continua READY até o claim pelo perfil no host Hermes.',
    schema: z.object({
      job_id: z.string().describe('ID do job a ser despachado'),
      dispatcher_agent_id: z.string().min(1).describe('ID do agente despachante. Marina = AGT-04'),
      target_agent_id: z.string().optional().describe('ID do especialista de destino'),
      target_external_agent_id: z.string().optional().describe('ID externo do runtime autorizado'),
      notes: z.string().optional().describe('Notas adicionais de despacho')
    }),
    handler: handleRecordDispatch
  },
  get_job: {
    description: 'Leitura autorizada da tarefa. Para evitar corte do Hermes, comece com view=manifest; depois view=page, section, revision e offset ate next_offset=null. Leia job, task, company_identity e todas as evidencias pertinentes antes de executar/revisar. Nao decida a partir de resposta truncada. Sem view retorna formato integral legado.',
    schema: z.object({
      job_id: z.string().describe('ID do agent_job'),
      view: z.enum(['full', 'manifest', 'page']).optional(),
      section: z.enum(JOB_SECTIONS).optional(),
      offset: z.number().int().min(0).optional(),
      limit: z.number().int().min(256).max(4000).optional(),
      revision: z.string().length(64).optional()
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
  record_progress: {
    description: 'Registra somente marcos relevantes do job no Supabase: ação, motivo de negócio, próximo passo e evidência disponível. Não chama IA nem altera o status.',
    inputSchema: {
      type: 'object',
      properties: {
        job_id: { type: 'string', description: 'ID do job em execução' },
        agent_id: { type: 'string', description: 'ID do especialista responsável pelo job' },
        step_key: { type: 'string', description: 'Chave estável deste marco para não duplicar em tentativas' },
        action: { type: 'string', description: 'O que foi feito, em resumo objetivo' },
        reason: { type: 'string', description: 'Por que isso foi feito para a entrega ou empresa; sem pensamento interno' },
        next_step: { type: 'string', description: 'O que falta ou quem assume a próxima etapa' },
        evidence_refs: { type: 'array', items: { type: 'string' }, description: 'IDs ou links de evidência disponíveis' }
      },
      required: ['job_id', 'agent_id', 'step_key', 'action', 'reason', 'next_step'],
      additionalProperties: false
    },
    schema: z.object({
      job_id: z.string().min(1).max(120),
      agent_id: z.string().min(1).max(80),
      step_key: z.string().min(1).max(80).regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/).describe('Identificador estável do marco para evitar duplicação em tentativas'),
      action: z.string().trim().min(1).max(400).describe('O que foi feito, sem dados sensíveis'),
      reason: z.string().trim().min(1).max(600).describe('Motivo objetivo de negócio; não incluir raciocínio interno'),
      next_step: z.string().trim().min(1).max(400).describe('Próxima ação ou dependência'),
      evidence_refs: z.array(z.string().min(1).max(500)).max(10).optional().default([])
    }),
    handler: handleRecordProgress
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
      business_id: z.string().optional().describe('Filtro opcional por empresa'),
      agent_id: z.string().optional().describe('Filtro opcional por agente')
    }),
    handler: handleQueueSummary
  }
};

// Contrato JSON explicito para clientes remotos. Sem propriedades, o cliente
// nao consegue descobrir job_id/agent_id e demais argumentos obrigatorios.
const textFields = names => Object.fromEntries(names.split(' ').map(name => [name, { type: 'string' }]));
const inputObject = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const jobFields = textFields('job_id agent_id');
const jobRequired = ['job_id', 'agent_id'];
const mcpInputs = {
  revise_task_brief: inputObject({
    job_id: { type: 'string', minLength: 1, maxLength: 120 },
    idempotency_key: { type: 'string', minLength: 1, maxLength: 120 },
    expected_task_version: { type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER },
    expected_job_updated_at: { type: 'string', format: 'date-time' },
    instruction: { type: 'string', minLength: 700, maxLength: 8000 },
    definition_of_done: { type: 'string', minLength: 80, maxLength: 4000 },
    revision_summary: { type: 'string', minLength: 20, maxLength: 1200 }
  }, ['job_id', 'idempotency_key', 'expected_task_version', 'expected_job_updated_at', 'instruction', 'definition_of_done', 'revision_summary']),
  create_artifact_upload: inputObject({ ...textFields('job_id slot'), version: { type: 'integer', minimum: 1, maximum: 5 }, svg: { type: 'string', minLength: 1, maxLength: 35000 } }, ['job_id','slot','version']),
  verify_artifact_upload: inputObject({ ...textFields('job_id slot'), version: { type: 'integer', minimum: 1, maximum: 5 } }, ['job_id','slot','version']),
  get_visual_asset: inputObject(textFields('job_id reference'), ['job_id', 'reference']),
  list_ready_jobs: inputObject({ ...textFields('agent_id business_id'), limit: { type: 'integer', minimum: 1, maximum: 25 } }),
  record_dispatch: inputObject(textFields('job_id dispatcher_agent_id target_agent_id target_external_agent_id notes'), ['job_id', 'dispatcher_agent_id']),
  get_job: inputObject({ ...textFields('job_id'), view: { type: 'string', enum: ['full', 'manifest', 'page'] }, section: { type: 'string', enum: JOB_SECTIONS }, offset: { type: 'integer', minimum: 0 }, limit: { type: 'integer', minimum: 256, maximum: 4000 }, revision: { type: 'string', minLength: 64, maxLength: 64 } }, ['job_id']),
  claim_job: inputObject(jobFields, jobRequired),
  start_job: inputObject(jobFields, jobRequired),
  complete_job: inputObject({ ...jobFields, ...textFields('result_summary'), evidence_refs: { type: 'array', items: {}, minItems: 1 }, result_payload: { type: 'object', additionalProperties: true } }, [...jobRequired, 'result_summary', 'evidence_refs']),
  fail_job: inputObject({ ...jobFields, ...textFields('error_code error_message'), payload: { type: 'object', additionalProperties: true } }, [...jobRequired, 'error_code', 'error_message']),
  waiting_helena: inputObject({ ...jobFields, ...textFields('contexto impacto decisao_necessaria recomendacao') }, [...jobRequired, 'contexto', 'impacto', 'decisao_necessaria', 'recomendacao']),
  enqueue_job: inputObject({ ...textFields('agent_id objective instruction business_id task_id scheduled_at available_at idempotency_key correlation_id'), priority: { type: 'string', enum: ['CRITICA', 'ALTA', 'MEDIA', 'BAIXA'] }, approval_required: { type: 'boolean' } }, ['agent_id', 'objective']),
  queue_summary: inputObject(textFields('business_id agent_id'))
};
for (const [name, inputSchema] of Object.entries(mcpInputs)) TOOLS_CONFIG[name].inputSchema = inputSchema;

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
      const result = await executeAuthorizedTool(name, args, null);
      return {
        content: toolResultContent(name, result)
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Erro ao executar ${name}: ${err.message}` }]
      };
    }
  });
}

async function executeAuthorizedTool(name, args, identity) {
  const authorized = await authorizeGatewayTool(name, args, identity, supabaseFetch);
  if (name === 'submit_delivery' || name === 'submit_work') {
    const artifactRefs = (name === 'submit_work' ? args.artifact_refs || [] : args.evidence_refs).filter(ref => ref.startsWith('storage://'));
    if (artifactRefs.length) {
      const jobs = await supabaseFetch(`/rest/v1/agent_jobs?job_id=eq.${encodeURIComponent(args.job_id)}&limit=1`);
      const job = Array.isArray(jobs) ? jobs[0] : null;
      if (!job) throw new Error('Job nao encontrado para conferir arquivos');
      const events = await supabaseFetch(`/rest/v1/agent_job_events?job_id=eq.${encodeURIComponent(args.job_id)}&event_type=eq.ARTIFACT_VERIFIED&select=payload&limit=20`);
      for (const ref of artifactRefs) {
        const artifact = parseArtifactReference(ref, job);
        if (!artifact || !Array.isArray(events) || !events.some(event => event.payload?.reference === ref && event.payload?.path === artifact.path)) throw new Error('Arquivo citado sem verificacao no Supabase');
      }
    }
  }
  return TOOLS_CONFIG[name].handler(authorized.args, { identity: authorized.identity });
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

// Limite expandido para suportar áudios de voz WAV base64 do VoIP
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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
configureVoiceAgentStore(
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY ? createVoiceAgentStore(supabaseFetch) : null
);
app.use(createIntegrationsRouter({ supabaseFetch,
  profileStore: SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY ? createProfileStore(supabaseFetch) : null,
  authenticateUser: createVoiceAdminAuth({ fallback: authenticateMcp }) }));

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

  const hermesIdentity = await resolveHermesToken(token, supabaseFetch, HERMES_PROFILE_TOKEN_HASHES);
  if (hermesIdentity) {
    req.identity = hermesIdentity;
    return next();
  }

  if (token.startsWith('hhs_')) return res.status(401).json({ error: 'invalid_token' });

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
    runtime_access: 'hermes-scoped-v1',
    workflow_version: 'hermes-workflow-v2',
    quality_version: QUALITY_VERSION,
    design_generation: 'HERMES_CODEX_IMAGE_WITH_PREFLIGHT',
    delivery_submission: 'submit-work-v1',
    visual_inspection: 'scoped-pixels-v1',
    typesafe: typeSafe.publicStatus(),
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
        inputSchema: def.inputSchema || { type: 'object' }
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
      const executionResult = await executeAuthorizedTool(toolName, validatedArgs, req.identity);

      return res.json({
        jsonrpc: '2.0',
        id,
        result: {
          content: toolResultContent(toolName, executionResult)
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
      const executionResult = await executeAuthorizedTool(method, validatedArgs, req.identity);

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
    const result = await executeAuthorizedTool(toolName, validatedArgs, req.identity);
    return res.json({ ok: true, result });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

// ======================================================================
// INICIALIZAÇÃO DO SERVIDOR E AGENDAMENTOS
// ======================================================================

const disableListen = process.env.HELENA_GATEWAY_DISABLE_LISTEN === '1';

const server = disableListen
  ? null
  : app.listen(PORT, '0.0.0.0', () => {
      console.log(`[HELENA_GATEWAY] Servidor ativo na porta ${PORT}`);
      console.log(`[HELENA_GATEWAY] Host público configurado: ${PUBLIC_HOST}`);
      console.log(`[HELENA_GATEWAY] Supabase: ${SUPABASE_URL}`);
      console.log(`[HELENA_GATEWAY] Evolution API: ${EVOLUTION_BASE_URL ? 'CONFIGURADA' : 'DESATIVADA'}`);
      console.log(`[HELENA_GATEWAY] Voice Streaming: ${((process.env.CALL_VOICE_STREAMING_ENABLED ?? 'true') !== 'false') ? 'ATIVADO' : 'DESATIVADO'}`);

      // Inicia loops periódicos
      const scheduleTimer = setInterval(tickScheduledJobs, SCHEDULE_TICK_MS);
      const outboxTimer = setInterval(tickNotificationOutbox, OUTBOX_TICK_MS);
      server.once('close', () => {
        clearInterval(scheduleTimer);
        clearInterval(outboxTimer);
      });
    });

if (!disableListen) {
  // Encerramento gracioso
  process.on('SIGTERM', () => {
    console.log('[HELENA_GATEWAY] Encerrando servidor graciosamente...');
    server.close(() => process.exit(0));
  });

  process.on('SIGINT', () => {
    console.log('[HELENA_GATEWAY] Encerrando servidor...');
    server.close(() => process.exit(0));
  });
}

export { app, server, TOOLS_CONFIG, handleRecordDispatch, handleRecordProgress, handleWaitingHelena };
