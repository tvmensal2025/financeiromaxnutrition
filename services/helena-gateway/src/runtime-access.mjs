import crypto from 'node:crypto';

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

const JOB_TOOLS = new Set(['get_job', 'claim_job', 'start_job', 'record_progress', 'complete_job', 'fail_job', 'waiting_helena', 'record_dispatch']);
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
  if (!group && (binding.scope_type !== 'BUSINESS' || !binding.business_id)) fail('Este perfil nao possui escopo empresarial executavel');
  const manager = MANAGEMENT.has(binding.agent_id);
  const args = { ...originalArgs };

  if (JOB_TOOLS.has(name)) {
    const job = first(await read(`/rest/v1/agent_jobs?select=job_id,agent_id,business_id,task_id&job_id=eq.${enc(args.job_id || '')}&limit=1`));
    if (!job?.business_id || !job.task_id) fail('Job exige tarefa e empresa vinculadas');
    if (!group && job.business_id !== binding.business_id) fail('Job pertence a outra empresa');

    if (name === 'record_dispatch') {
      if (binding.agent_id !== 'AGT-04') fail('Somente Marina pode despachar');
      if (args.dispatcher_agent_id && args.dispatcher_agent_id !== binding.agent_id) fail('Despachante difere da identidade autenticada');
      args.dispatcher_agent_id = binding.agent_id;
    } else if (!(name === 'get_job' && manager)) {
      if (job.agent_id !== binding.agent_id) fail('Job pertence a outro agente');
      if (args.agent_id && args.agent_id !== binding.agent_id) fail('Agente difere da identidade autenticada');
      if (name !== 'get_job') args.agent_id = binding.agent_id;
    }
  } else if (name === 'list_ready_jobs' || name === 'queue_summary') {
    if (!group) {
      if (args.business_id && args.business_id !== binding.business_id) fail('Consulta de outra empresa nao autorizada');
      args.business_id = binding.business_id;
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
