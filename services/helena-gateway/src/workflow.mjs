import { z } from 'zod';

const text = (max = 4000) => z.string().trim().min(1).max(max);
const key = text(120);
const job = { job_id: text(120), idempotency_key: key };
const version = { expected_task_version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) };
const task = { target_agent_id: text(80), objective: text(400), definition_of_done: text(), instruction: text(8000).optional() };
const contracts = {
  get_work_context: ['context', {}, 'Carrega o checkpoint atual, papel, tarefas e encaminhamentos do perfil autenticado.'],
  create_task_job: ['create_task', { ...task, business_id: text(80), idempotency_key: key }, 'Helena ou Marina cria tarefa visivel e job DRAFT na empresa; nao inicia modelo.'],
  submit_delivery: ['submit_delivery', { ...job, ...version, summary: text(8000), evidence_refs: z.array(text(500)).min(1).max(10) }, 'Registra entrega com evidencia e aguarda o revisor da funcao. Nao declara conclusao.'],
  review_delivery: ['review_delivery', { ...job, ...version, decision: z.enum(['APPROVE', 'REQUEST_CHANGES']), reason: text() }, 'Revisor designado ou Helena aprova ou solicita ajustes; proibida autoaprovacao.'],
  handoff_task: ['handoff', { ...job, ...version, ...task }, 'Depois da revisao aprovada, cria a proxima tarefa, com fonte, evidencia e responsavel; permanece DRAFT.'],
  release_job: ['release_job', { ...job, ...version }, 'Helena ou Marina libera um DRAFT. Exige executor ativo, limite de tentativas e WIP global 1. Nao inicia o modelo.'],
  record_memory: ['record_memory', { ...job, summary: text(8000), source: text(1000), next_step: text(1000) }, 'Persiste memoria operacional da propria tarefa e empresa, com fonte e proximo passo. Nao altera fatos de outras tabelas.']
};

export const WORKFLOW_TOOLS = new Set(Object.keys(contracts));

function property(field) {
  if (field instanceof z.ZodOptional) return property(field.unwrap());
  if (field instanceof z.ZodNumber) return { type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER };
  if (field instanceof z.ZodEnum) return { type: 'string', enum: field.options };
  if (field instanceof z.ZodArray) return { type: 'array', items: property(field.element), minItems: 1, maxItems: 10 };
  return { type: 'string', minLength: 1 };
}

export function workflowTools(rpc) {
  return Object.fromEntries(Object.entries(contracts).map(([name, [action, shape, description]]) => [name, {
    description,
    schema: z.object(shape).strict(),
    inputSchema: { type: 'object', properties: Object.fromEntries(Object.entries(shape).map(([k,v]) => [k,property(v)])), required: Object.entries(shape).filter(([,v]) => !v.isOptional()).map(([k]) => k), additionalProperties: false },
    handler: async (args, { identity } = {}) => {
      if (identity?.type !== 'hermes_profile' || !identity.bindingVerified || !identity.profileSlug) throw new Error('Workflow exige identidade individual Hermes verificada');
      const result = await rpc('gateway_workflow', { p_profile_slug: identity.profileSlug, p_action: action, p_payload: args });
      if (!result || (action !== 'context' && result.success !== true)) throw new Error('Supabase nao confirmou a operacao');
      return result;
    }
  }]));
}
