import { readFileSync } from 'node:fs';
import { z } from 'zod';

export const QUALITY_VERSION = 'helena-delivery-quality-v1';
const registry = JSON.parse(readFileSync(new URL('./agent-quality-contracts.json', import.meta.url), 'utf8'));
export function agentQualityContract(agentId) {
  return registry.agents.find(agent => agent.agent_id === agentId) || null;
}

export const professionalDeliverySchema = z.object({
  schema_version: z.literal(1),
  title: z.string().trim().min(5).max(140),
  content: z.string().trim().min(40).max(12000),
  next_steps: z.string().trim().min(20).max(1500),
  limitations: z.string().trim().min(20).max(1500),
  acceptance_checks: z.array(z.object({
    criterion: z.string().trim().min(15).max(300),
    evidence_ref: z.string().trim().min(1).max(500),
    finding: z.string().trim().min(30).max(1200)
  }).strict()).min(1).max(8)
}).strict();

export const qualityReviewSchema = z.object({
  inspected_evidence_refs: z.array(z.string().min(1).max(500)).min(1).max(10),
  verified_criteria: z.array(z.string().min(15).max(300)).min(1).max(8),
  findings: z.string().trim().min(80).max(2000),
  requirements_met: z.literal(true)
}).strict();

export function validateProfessionalDelivery(delivery, refs) {
  if (!delivery) throw new Error('Entrega exige delivery: material utilizavel, proximos passos, limites e criterios com evidencias');
  const parsed = professionalDeliverySchema.parse(delivery);
  if (/storage:\/\/|JOB-HR-|MEM-HR-|SHA-?256|verified\s*=|```/i.test(`${parsed.title}\n${parsed.content}`))
    throw new Error('Material para o fundador contem dados internos; separe o conteudo utilizavel do resumo tecnico');
  const criteria = parsed.acceptance_checks.map(check => check.criterion);
  if (new Set(criteria).size !== criteria.length || parsed.acceptance_checks.some(check => !refs?.includes(check.evidence_ref)))
    throw new Error('Cada criterio deve ser unico e apontar para uma evidencia desta entrega');
  return parsed;
}

export function validateQualityReview(review, delivery, refs) {
  if (!review) throw new Error('Aprovacao exige quality_review com evidencias abertas e criterios conferidos');
  const parsed = qualityReviewSchema.parse(review);
  const sameSet = (actual, expected) => actual.length === new Set(actual).size && actual.length === expected.length && expected.every(item => actual.includes(item));
  if (!sameSet(parsed.inspected_evidence_refs, refs) || !sameSet(parsed.verified_criteria, delivery.acceptance_checks.map(check => check.criterion)))
    throw new Error('Revisor deve conferir exatamente as evidencias e todos os criterios da versao entregue');
  return parsed;
}
