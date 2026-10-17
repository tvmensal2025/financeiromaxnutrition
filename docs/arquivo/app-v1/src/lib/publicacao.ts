export type Publication = { title: string; caption: string; strategy: string; instructions: string; alt_text: string };
export type ProfessionalDelivery = {schema_version: 1; title: string; content: string; next_steps: string; limitations: string; acceptance_checks: {criterion: string; evidence_ref: string; finding: string}[]};
const internalText = /storage:\/\/|JOB-HR-|MEM-HR-|SHA-?256|verified\s*=|```/i;
export function deliveryFor(payload: unknown): ProfessionalDelivery | null {
  const value = (payload as {delivery?: ProfessionalDelivery} | null)?.delivery;
  if (!value || value.schema_version !== 1 || !['title','content','next_steps','limitations'].every(key => typeof value[key as keyof ProfessionalDelivery] === 'string' && String(value[key as keyof ProfessionalDelivery]).trim()) || !Array.isArray(value.acceptance_checks) || !value.acceptance_checks.length) return null;
  if (internalText.test(`${value.title}\n${value.content}`)) return null;
  return value;
}
export function publicationFor(payload: unknown): Publication | null {
  if (!payload || typeof payload !== 'object') return null;
  const value = (payload as { publication?: unknown }).publication;
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  if (!['title', 'caption', 'strategy', 'instructions', 'alt_text'].every(key => typeof item[key] === 'string' && item[key].trim())) return null;
  if (internalText.test(`${item.title}\n${item.caption}`) || /gateway/i.test(String(item.caption))) return null;
  return item as Publication;
}

export function hasVisualApproval(payload: unknown, references: string[]) {
  const review = (payload as {visual_review?: Record<string, unknown>} | null)?.visual_review;
  if (!review || !publicationFor(payload) || !references.length) return false;
  const inspected = review.inspected_references;
  return Array.isArray(inspected) && new Set(inspected).size === references.length && references.every(ref => inspected.includes(ref))
    && typeof review.findings === 'string' && review.findings.trim().length >= 80
    && ['text_readable','brand_matches','copy_matches','composition_approved'].every(key => review[key] === true);
}

// Approval of an intermediate report does not make a customer deliverable.
export function isFounderDecision(job: {status: string; result_payload?: unknown}) {
  const payload = job.result_payload as Record<string, unknown> | null;
  return job.status === 'WAITING_HELENA' && payload?.review_pending === true && payload.reviewer_agent_id === 'FOUNDER';
}
export function isFinalDelivery(job: {status: string; result_payload?: unknown}, references: string[]) {
  if (job.status !== 'COMPLETED' || !job.result_payload || typeof job.result_payload !== 'object') return false;
  const payload = job.result_payload as Record<string, unknown>;
  if (payload.review_pending !== false || typeof payload.reviewed_by !== 'string' || !payload.reviewed_by.trim()) return false;
  if (payload.delivery_audience === 'INTERNAL') return false;
  if (publicationFor(payload)) return hasVisualApproval(payload, references);
  return payload.delivery_audience === 'FOUNDER' && payload.delivery_stage === 'FINAL' && Boolean(deliveryFor(payload));
}
