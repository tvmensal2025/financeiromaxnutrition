import { createHash } from 'node:crypto';
import { z } from 'zod';
import { professionalDeliverySchema, validateProfessionalDelivery } from './professional-output.mjs';
import { publicationSchema, validatePublication } from './publication-contract.mjs';

// The agent supplies findings. Database evidence identifiers belong to the gateway.
export const workDeliverySchema = professionalDeliverySchema.extend({
  content: z.string().trim().min(40).max(8000),
  acceptance_checks: z.array(z.object({
    criterion: z.string().trim().min(15).max(300),
    finding: z.string().trim().min(30).max(1200)
  }).strict()).min(1).max(8)
});

export const workSubmissionShape = {
  job_id: z.string().trim().min(1).max(120),
  idempotency_key: z.string().trim().min(1).max(120),
  expected_task_version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  summary: z.string().trim().min(1).max(8000),
  source: z.string().trim().min(1).max(800),
  delivery: workDeliverySchema,
  artifact_refs: z.array(z.string().trim().min(1).max(500)).max(9).optional(),
  publication: publicationSchema.optional()
};

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])]));
  return value;
}
const hash = (value, algorithm = 'sha256') => createHash(algorithm).update(value).digest('hex');

export async function submitWork(rpc, input, identity) {
  if (identity?.type !== 'hermes_profile' || !identity.bindingVerified || !identity.profileSlug)
    throw new Error('Entrega exige identidade Hermes individual verificada');
  const args = z.object(workSubmissionShape).strict().parse(input);
  const artifacts = args.artifact_refs || [];
  if (new Set(artifacts).size !== artifacts.length || artifacts.some(ref => !ref.startsWith('storage://helena-deliveries/')))
    throw new Error('Informe apenas referencias unicas dos arquivos finais verificados');
  if (artifacts.length && !args.publication) throw new Error('Entrega visual exige publication com legenda, estrategia e instrucoes');
  if (args.publication) validatePublication(args.publication);

  // Include the job in the stage keys, and bind every argument to the memory
  // request. Supabase rejects reuse of either key with a changed payload.
  const base = hash(`${args.job_id}\n${args.idempotency_key}`);
  const memoryKey = `submit-work-memory-${base}`;
  const deliveryKey = `submit-work-delivery-${base}`;
  const pendingRef = 'pending-memory-registration';
  const delivery = validateProfessionalDelivery({
    ...args.delivery,
    acceptance_checks: args.delivery.acceptance_checks.map(check => ({ ...check, evidence_ref: pendingRef }))
  }, [pendingRef, ...artifacts]);
  const fingerprint = hash(JSON.stringify(stable(args)));
  const memory = await rpc('gateway_workflow', {
    p_profile_slug: identity.profileSlug, p_action: 'record_memory', p_payload: {
      job_id: args.job_id, idempotency_key: memoryKey, summary: delivery.content,
      source: `${args.source}\nSubmission digest: ${fingerprint}`,
      next_step: delivery.next_steps.slice(0, 1000)
    }
  });
  if (memory?.success !== true || !/^MEM-HR-[a-f0-9]{32}$/.test(memory.memory_id || '')
    || (memory.job_id && memory.job_id !== args.job_id))
    throw new Error('Memoria nao confirmada; entrega nao enviada. Reenvie o mesmo pedido com a mesma chave.');
  const memoryId = memory.memory_id;
  const refs = [memoryId, ...artifacts];
  delivery.acceptance_checks = delivery.acceptance_checks.map(check => ({ ...check, evidence_ref: memoryId }));

  // Two durable, independently idempotent RPCs. If the second call is interrupted,
  // replay reuses the memory and submission receipts; it never approves the work.
  const result = await rpc('gateway_workflow', {
    p_profile_slug: identity.profileSlug, p_action: 'submit_delivery', p_payload: {
      job_id: args.job_id, idempotency_key: deliveryKey,
      expected_task_version: args.expected_task_version, summary: args.summary,
      evidence_refs: refs, delivery, ...(args.publication ? { publication: args.publication } : {})
    }
  });
  if (result?.success !== true) throw new Error('Envio nao confirmado; reenvie o mesmo pedido com a mesma chave.');
  return { ...result, memory_id: memoryId, evidence_refs: refs };
}
