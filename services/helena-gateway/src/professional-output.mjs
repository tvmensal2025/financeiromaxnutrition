import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { z } from 'zod';

export const QUALITY_VERSION = 'helena-delivery-quality-v1';
export const REVIEW_CONTRACT_VERSION = 'review-contract-v2';
const registry = JSON.parse(readFileSync(new URL('./agent-quality-contracts.json', import.meta.url), 'utf8'));
export function agentQualityContract(agentId) {
  return registry.agents.find(agent => agent.agent_id === agentId) || null;
}

export const professionalDeliverySchema = z.object({
  schema_version: z.literal(1),
  stage: z.enum(['INTERMEDIATE', 'FINAL']).optional().describe('INTERMEDIATE quando outra etapa de producao esta prevista. FINAL somente para o pacote completo destinado ao fundador, sem producao pendente no pedido. Continua exigindo revisao independente; nao publica nem aprova.'),
  title: z.string().trim().min(5).max(140),
  content: z.string().trim().min(40).max(12000),
  next_steps: z.string().trim().min(20).max(1500),
  limitations: z.string().trim().min(20).max(1500),
  acceptance_checks: z.array(z.object({
    criterion: z.string().trim().min(15).max(300),
    evidence_ref: z.string().trim().min(1).max(500).describe('Copie literalmente UM item de evidence_refs. Para uma entrega textual, use o memory_id devolvido por record_memory. Nunca invente delivery:..., combine IDs ou use o ID da tarefa como referencia. O trecho que comprova o criterio pertence a finding.'),
    finding: z.string().trim().min(30).max(1200).describe('Explique o trecho ou fato concreto que comprova este criterio na evidencia referenciada. Nao substitui evidence_ref.')
  }).strict()).min(1).max(8)
}).strict();

const qualityReviewFields = {
  inspected_evidence_refs: z.array(z.string().min(1).max(500)).min(1).max(10),
  findings: z.string().trim().min(80).max(2000),
  requirements_met: z.literal(true)
};
export const qualityReviewSchema = z.union([
  z.object({ ...qualityReviewFields,
    verified_check_ids: z.array(z.string().length(18, 'REVIEW_CONTRACT_MISMATCH: copie o check_id completo de review_contract.criteria.')
      .regex(/^C-[a-f0-9]{16}$/, 'REVIEW_CONTRACT_MISMATCH: use o check_id exato C-<16hex> de review_contract.criteria.')).min(1).max(8)
  }).strict('REVIEW_CONTRACT_MISMATCH: use somente verified_check_ids OU verified_criteria, sem campos extras; releia get_job.review_contract.'),
  z.object({ ...qualityReviewFields,
    verified_criteria: z.array(z.string().min(15).max(300,
      'REVIEW_CONTRACT_MISMATCH: criterion excede 300 caracteres. Copie o texto canonico ou use verified_check_ids de review_contract; nao parafraseie.')).min(1).max(8)
  }).strict('REVIEW_CONTRACT_MISMATCH: use somente verified_check_ids OU verified_criteria, sem campos extras; releia get_job.review_contract.')
], { errorMap: () => ({ message: 'REVIEW_CONTRACT_MISMATCH: use exatamente um modo, verified_check_ids OU verified_criteria. Copie o approval_fields_seed do get_job.review_contract vigente e adicione seu parecer apos inspecao.' }) });

export function qualityCheckId(criterion) {
  return 'C-' + createHash('sha256').update(criterion, 'utf8').digest('hex').slice(0, 16);
}

// Only mechanical fields are supplied. A contract is never an approval or proof of inspection.
export function buildReviewContract(detail) {
  const version = detail?.task?.row_version;
  const refs = detail?.job?.evidence_refs;
  if (!Number.isSafeInteger(version) || version <= 0 || !Array.isArray(refs)
    || refs.length < 1 || refs.length > 10 || new Set(refs).size !== refs.length
    || refs.some(ref => typeof ref !== 'string' || ref.length < 1 || ref.length > 500)) return null;
  let delivery;
  try { delivery = validateProfessionalDelivery(detail.job.result_payload?.delivery, refs); }
  catch { return null; } // Legacy or invalid deliveries remain readable; they cannot acquire an approval seed.
  const criteria = delivery.acceptance_checks.map(check => ({
    check_id: qualityCheckId(check.criterion), criterion: check.criterion, evidence_ref: check.evidence_ref
  }));
  return { version: REVIEW_CONTRACT_VERSION, schema_version: 1, expected_task_version: version, criteria, evidence_refs: [...refs],
    approval_fields_seed: { expected_task_version: version, quality_review: {
      inspected_evidence_refs: [...refs], verified_check_ids: criteria.map(check => check.check_id)
    } }
  };
}

export function validateProfessionalDelivery(delivery, refs) {
  if (!delivery) throw new Error('Entrega exige delivery: material utilizavel, proximos passos, limites e criterios com evidencias');
  const parsed = professionalDeliverySchema.parse(delivery);
  if (/storage:\/\/|JOB-HR-|MEM-HR-|SHA-?256|verified\s*=|```/i.test(`${parsed.title}\n${parsed.content}`))
    throw new Error('Material para o fundador contem dados internos; separe o conteudo utilizavel do resumo tecnico');
  const criteria = parsed.acceptance_checks.map(check => check.criterion);
  if (new Set(criteria).size !== criteria.length)
    throw new Error('ACCEPTANCE_CRITERIA_DUPLICATED: cada criterion deve ser unico; combine criterios repetidos antes de reenviar.');
  const invalid = parsed.acceptance_checks.filter(check => !refs?.includes(check.evidence_ref));
  if (invalid.length)
    throw new Error('EVIDENCE_REFERENCE_MISMATCH: acceptance_checks[].evidence_ref deve copiar literalmente UM item de evidence_refs. '
      + 'Nao use IDs de tarefas, varios IDs juntos ou ancoras delivery:... . Descreva o trecho comprobatório em finding. '
      + 'Referencias enviadas em evidence_refs: ' + JSON.stringify(refs || [])
      + '. Valores invalidos: ' + JSON.stringify([...new Set(invalid.map(check => check.evidence_ref))]));
  return parsed;
}

export function validateQualityReview(review, delivery, refs) {
  if (!review) throw new Error('REVIEW_CONTRACT_MISMATCH: aprovacao exige quality_review com evidencias abertas e criterios conferidos; releia get_job.review_contract e acrescente seu parecer.');
  const idsMode = Object.hasOwn(review, 'verified_check_ids');
  const legacyMode = Object.hasOwn(review, 'verified_criteria');
  if (idsMode === legacyMode)
    throw new Error('REVIEW_CONTRACT_MISMATCH: QUALITY_REVIEW_MODE: envie exatamente um modo: verified_check_ids OU verified_criteria; remova o outro campo. Releia get_job.review_contract.');
  const parsed = qualityReviewSchema.safeParse(review);
  if (!parsed.success)
    throw new Error('REVIEW_CONTRACT_MISMATCH: QUALITY_REVIEW_SHAPE: ' + parsed.error.message
      + '. Releia get_job.review_contract.approval_fields_seed; copie IDs completos e refs exatas. Adicione findings de 80 a 2000 caracteres e requirements_met=true somente apos inspecao real.');
  const compare = (field, actual, expected) => {
    const missing = expected.filter(item => !actual.includes(item));
    const unexpected = [...new Set(actual.filter(item => !expected.includes(item)))];
    const duplicates = [...new Set(actual.filter((item, index) => actual.indexOf(item) !== index))];
    if (missing.length || unexpected.length || duplicates.length || actual.length !== expected.length)
      throw new Error('REVIEW_CONTRACT_MISMATCH: QUALITY_REVIEW_MISMATCH: ' + field + ' deve corresponder exatamente a versao entregue. '
        + JSON.stringify({ missing, unexpected, duplicates, expected_count: expected.length, received_count: actual.length })
        + '. Releia get_job.review_contract e copie approval_fields_seed sem alterar refs ou IDs. No modo legado, copie cada criterion literalmente; nao parafraseie. Mantenha findings baseado na inspecao e confira a versao antes de reenviar.');
  };
  const criteria = delivery.acceptance_checks.map(check => check.criterion);
  compare('inspected_evidence_refs', parsed.data.inspected_evidence_refs, refs);
  compare(idsMode ? 'verified_check_ids' : 'verified_criteria',
    idsMode ? parsed.data.verified_check_ids : parsed.data.verified_criteria,
    idsMode ? criteria.map(qualityCheckId) : criteria);
  // The SQL contract remains canonical text; IDs are an input aid, never persisted as criteria.
  return { inspected_evidence_refs: [...refs], verified_criteria: criteria,
    findings: parsed.data.findings, requirements_met: parsed.data.requirements_met };
}
