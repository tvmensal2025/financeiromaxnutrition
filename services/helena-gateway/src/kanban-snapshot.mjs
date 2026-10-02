// A bounded, read-only projection of the authoritative queue for the Hermes board.
// No instructions, results, evidence, or personal jobs leave this endpoint.
const MAX_PAGE = 100;

export async function kanbanSnapshot(read, { business_id, offset = 0, limit = MAX_PAGE } = {}) {
  if (business_id && !/^[A-Za-z0-9_-]{2,80}$/.test(business_id)) throw new Error('Empresa invalida');
  if (!Number.isInteger(offset) || offset < 0 || offset > 10000) throw new Error('Offset invalido');
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE) throw new Error('Limite invalido');

  const query = new URLSearchParams({
    select: 'job_id,task_id,agent_id,business_id,objective,priority,status,approval_status,created_at,updated_at',
    order: 'created_at.asc,job_id.asc',
    offset: String(offset), limit: String(limit)
  });
  if (business_id) query.set('business_id', `eq.${business_id}`);
  else query.set('business_id', 'not.is.null');
  const [jobs, bindings] = await Promise.all([
    read(`/rest/v1/agent_jobs?${query}`),
    read('/rest/v1/agent_runtime_bindings?select=agent_id,profile_slug,scope_type,business_id,status&status=eq.ACTIVE&limit=100')
  ]);
  if (!Array.isArray(jobs) || !Array.isArray(bindings)) throw new Error('Fila indisponivel');
  const profiles = new Map();
  const ambiguous = new Set();
  for (const binding of bindings) {
    if (!/^AGT-\d{2}$/.test(binding.agent_id || '') || !/^[a-z][a-z0-9-]+$/.test(binding.profile_slug || '')) continue;
    const key = `${binding.agent_id}:${binding.scope_type === 'GROUP' ? 'GROUP' : binding.business_id}`;
    if (profiles.has(key)) ambiguous.add(key);
    else profiles.set(key, binding);
  }
  return {
    source: 'supabase.agent_jobs',
    execution_owner: 'helena-gateway',
    offset,
    next_offset: jobs.length === limit ? offset + jobs.length : null,
    jobs: jobs.filter(j => j.business_id && j.job_id && j.agent_id).map(j => {
      const key = `${j.agent_id}:${j.agent_id === 'AGT-01' ? 'GROUP' : j.business_id}`;
      const binding = profiles.get(key);
      const valid = binding && !ambiguous.has(key)
        && (binding.scope_type === 'GROUP' && j.agent_id === 'AGT-01'
          || binding.scope_type === 'BUSINESS' && binding.business_id === j.business_id);
      return {
        job_id: j.job_id, task_id: j.task_id, agent_id: j.agent_id,
        business_id: j.business_id, objective: j.objective,
        priority: j.priority, status: j.status, approval_status: j.approval_status,
        created_at: j.created_at, updated_at: j.updated_at,
        profile_slug: valid ? binding.profile_slug : null,
        binding_status: valid ? 'ACTIVE' : 'UNAVAILABLE'
      };
    })
  };
}
