import crypto from 'node:crypto';
import { WORKFLOW_TOOLS } from './workflow.mjs';
import { servedBusinesses } from './business-scope.mjs';

// Hashes de tokens individuais ficam apenas na configuracao do servidor.
// Nenhum token e provisionado ou ativado por este modulo.
export function matchHermesToken(token, configured = '[]') {
  if (typeof token !== 'string' || !/^hhs_[A-Za-z0-9_-]{40,}$/.test(token)) return null;
  let entries;
  try { entries = JSON.parse(configured); } catch { return null; }
  if (!Array.isArray(entries)) return null;
  const digest = crypto.createHash('sha256').update(token).digest();
  const matches = entries.filter(entry => entry && /^[a-f0-9]{64}$/.test(entry.sha256 || '')
    && typeof entry.profile_slug === 'string'
    && crypto.timingSafeEqual(digest, Buffer.from(entry.sha256, 'hex')));
  return matches.length === 1 ? { type: 'hermes_profile', profileSlug: matches[0].profile_slug } : null;
}

export async function resolveHermesToken(token, read, configured = '[]') {
  if (typeof token !== 'string' || !/^hhs_[A-Za-z0-9_-]{40,}$/.test(token)) return null;
  const configuredIdentity = matchHermesToken(token, configured);
  if (configuredIdentity) return configuredIdentity;
  const digest = crypto.createHash('sha256').update(token).digest('hex');
  try {
    const rows = await read(`/rest/v1/agent_runtime_credentials?select=profile_slug&token_sha256=eq.${digest}&revoked_at=is.null&limit=2`);
    return Array.isArray(rows) && rows.length === 1 && typeof rows[0].profile_slug === 'string'
      ? { type: 'hermes_profile', profileSlug: rows[0].profile_slug } : null;
  } catch { return null; } // Database unavailable is never authentication success.
}

const JOB_TOOLS = new Set(['get_job', 'get_visual_asset', 'check_delivery', 'claim_job', 'start_job', 'record_progress', 'complete_job', 'fail_job', 'waiting_helena', 'record_dispatch']);
const RECOVERY_TOOLS = new Set(['queue_attention', 'record_queue_attention', 'workflow_candidates', 'workflow_checkpoint']);
const ARTIFACT_TOOLS = new Set(['create_artifact_upload', 'verify_artifact_upload']);
const MANAGEMENT = new Set(['AGT-01', 'AGT-04']);
const fail = message => { throw new Error(message); };
const first = rows => Array.isArray(rows) ? rows[0] : null;
const enc = encodeURIComponent;

export async function authorizeGatewayTool(name, originalArgs, identity, read) {
  if (!identity) fail('Identidade autenticada obrigatoria');
  if (identity.type === 'static_fallback' && identity.role === 'service-admin') return { args: originalArgs, identity };

  if (identity.type === 'oauth2' && identity.userId) {
    const access = first(await read(`/rest/v1/app_access?select=role&user_id=eq.${enc(identity.userId)}&active=eq.true&limit=1`));
    if (access?.role === 'founder') return { args: originalArgs, identity };
    // Contas humanas comuns nao se tornam bots pelo agent_id enviado no corpo.
    fail('Operacao do Gateway exige fundador ou identidade individual Hermes');
  }
  if (identity.type !== 'hermes_profile' || !identity.profileSlug) fail('Identidade do runtime nao reconhecida');

  const binding = first(await read(`/rest/v1/agent_runtime_bindings?select=agent_id,scope_type,business_id,provider,profile_slug,status&profile_slug=eq.${enc(identity.profileSlug)}&limit=1`));
  if (!binding || binding.status !== 'ACTIVE' || binding.provider !== 'HERMES') fail('Perfil Hermes nao ativo');
  const group = binding.agent_id === 'AGT-01' && binding.scope_type === 'GROUP';
  if (!group && (binding.scope_type !== 'BUSINESS' || !binding.business_id) && name !== 'get_work_context') fail('Este perfil nao possui escopo empresarial executavel');
  const manager = MANAGEMENT.has(binding.agent_id);
  // Empresas atendidas por este perfil (vinculo original + escopos confirmados).
  const served = group ? null : await servedBusinesses(read, binding);
  const outOfScope = businessId => !group && !served.has(businessId);
  const args = { ...originalArgs };

  if (name === 'registrar_lancamento') {
    // Financeiro e funcao do Caio; Helena recebe o pedido e delega por job.
    if (binding.agent_id !== 'AGT-05') fail('Lancamento financeiro e exclusivo do Caio (AGT-05)');
    const job = first(await read(`/rest/v1/agent_jobs?select=job_id,agent_id,business_id,task_id,status&job_id=eq.${enc(args.job_id || '')}&limit=1`));
    if (!job?.business_id || !job.task_id || job.agent_id !== binding.agent_id || job.status !== 'RUNNING') fail('Lancamento exige job em execucao do proprio Caio');
    if (outOfScope(job.business_id)) fail('Job pertence a outra empresa');
    if (args.business_id && args.business_id !== job.business_id) fail('Empresa difere do job');
    return { args: { ...args, business_id: job.business_id }, identity: { ...identity, agentId: binding.agent_id, businessId: job.business_id, bindingVerified: true } };
  } else if (name === 'kanban_snapshot') {
    if (!group) fail('Somente Helena pode consultar o quadro consolidado');
  } else if (RECOVERY_TOOLS.has(name)) {
    if (!manager) fail('Somente Helena ou Marina supervisiona recuperacao');
    if (args.business_id && outOfScope(args.business_id)) fail('Empresa fora do escopo');
  } else if (WORKFLOW_TOOLS.has(name)) {
    // The RPC repeats scope/role checks and locks the authoritative rows.
    // profile_slug comes only from the authenticated token, never the payload.
    if (['create_task_job', 'release_job', 'resolve_job_block', 'revise_task_brief', 'replan_job', 'record_coordination_note', 'revise_draft_brief'].includes(name) && !manager) fail('Somente Helena ou Marina organiza a fila');
    if (args.business_id && outOfScope(args.business_id)) fail('Empresa fora do escopo');
  } else if (ARTIFACT_TOOLS.has(name)) {
    if (binding.agent_id !== 'AGT-12') fail('Ferramentas de arte sao exclusivas da Maya');
    const job = first(await read(`/rest/v1/agent_jobs?select=job_id,agent_id,business_id,task_id,status&job_id=eq.${enc(args.job_id || '')}&limit=1`));
    if (!job?.business_id || !job.task_id || job.agent_id !== binding.agent_id || job.status !== 'RUNNING') fail('Arquivo exige job em execucao do proprio agente');
    if (outOfScope(job.business_id)) fail('Arquivo pertence a outra empresa');
    args.agent_id = binding.agent_id;
    args.business_id = job.business_id;
  } else if (JOB_TOOLS.has(name)) {
    if (name === 'complete_job') fail('Use submit_delivery para revisao; conclusao direta nao liberada para Hermes');
    const job = first(await read(`/rest/v1/agent_jobs?select=job_id,agent_id,business_id,task_id,status,result_payload&job_id=eq.${enc(args.job_id || '')}&limit=1`));
    if (!job?.business_id || !job.task_id) fail('Job exige tarefa e empresa vinculadas');
    if (outOfScope(job.business_id)) fail('Job pertence a outra empresa');

    if (name === 'record_dispatch') {
      if (binding.agent_id !== 'AGT-04') fail('Somente Marina pode despachar');
      if (args.dispatcher_agent_id && args.dispatcher_agent_id !== binding.agent_id) fail('Despachante difere da identidade autenticada');
      args.dispatcher_agent_id = binding.agent_id;
    } else if (!(['get_job', 'get_visual_asset'].includes(name) && (manager || job.result_payload?.reviewer_agent_id === binding.agent_id))) {
      if (job.agent_id !== binding.agent_id) fail('Job pertence a outro agente');
      if (args.agent_id && args.agent_id !== binding.agent_id) fail('Agente difere da identidade autenticada');
      if (!['get_job', 'get_visual_asset'].includes(name)) args.agent_id = binding.agent_id;
    }
  } else if (name === 'list_ready_jobs' || name === 'queue_summary') {
    if (!group) {
      if (args.business_id && outOfScope(args.business_id)) fail('Consulta de outra empresa nao autorizada');
      if (!args.business_id) {
        const ids = [...served].sort();
        if (ids.length === 1) args.business_id = ids[0];
        else args.business_ids = ids;
      }
    }
    if (!manager) {
      if (args.agent_id && args.agent_id !== binding.agent_id) fail('Consulta de outro agente nao autorizada');
      args.agent_id = binding.agent_id;
    }
  } else {
    // Enfileiramento/handoff automatico so sera exposto depois da homologacao
    // de idempotencia, tarefa, empresa e custo. Nunca liberar por nome do perfil.
    fail('Ferramenta ainda nao liberada para perfis Hermes');
  }

  return { args, identity: { ...identity, agentId: binding.agent_id, businessId: binding.business_id, bindingVerified: true } };
}
