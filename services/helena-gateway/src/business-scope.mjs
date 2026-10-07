// Um perfil Hermes por agente atende varias empresas (Fundador, 2026-10-07).
// Fonte: vinculo original + agent_business_scopes AUTHORIZED/CONFIRMED, a mesma regra
// de public.helena_agent_serves no banco. A empresa da entrega e sempre a do job.
const enc = encodeURIComponent;

export function isGroupHelena(binding) {
  return binding?.agent_id === 'AGT-01' && binding?.scope_type === 'GROUP';
}

export async function servedBusinesses(read, binding) {
  const served = new Set();
  if (!binding || binding.scope_type !== 'BUSINESS') return served;
  if (binding.business_id) served.add(binding.business_id);
  let rows = [];
  // Leitura falha nunca amplia escopo: fica so o vinculo original.
  try { rows = await read(`/rest/v1/agent_business_scopes?select=business_id&agent_id=eq.${enc(binding.agent_id)}&authorization_status=eq.AUTHORIZED&runtime_status=eq.CONFIRMED&limit=50`); } catch { rows = []; }
  for (const row of Array.isArray(rows) ? rows : []) if (typeof row?.business_id === 'string') served.add(row.business_id);
  return served;
}

// Apresenta o vinculo na empresa do job quando o agente a atende; senao null.
export function bindingForBusiness(binding, businessId, served) {
  if (!binding || !businessId) return null;
  if (isGroupHelena(binding)) return binding;
  if (binding.scope_type !== 'BUSINESS' || !served?.has(businessId)) return null;
  return binding.business_id === businessId ? binding
    : { ...binding, business_id: businessId, home_business_id: binding.business_id };
}

// Mapa agente -> empresas atendidas, para leituras em lote (fila, quadro).
export async function servedByAgent(read, bindings) {
  const map = new Map();
  for (const binding of bindings || []) {
    if (binding?.scope_type === 'BUSINESS' && binding.business_id) map.set(binding.agent_id, new Set([binding.business_id]));
  }
  let rows = [];
  try { rows = await read('/rest/v1/agent_business_scopes?select=agent_id,business_id&authorization_status=eq.AUTHORIZED&runtime_status=eq.CONFIRMED&limit=500'); } catch { rows = []; }
  for (const row of Array.isArray(rows) ? rows : []) {
    if (map.has(row?.agent_id) && typeof row.business_id === 'string') map.get(row.agent_id).add(row.business_id);
  }
  return map;
}
