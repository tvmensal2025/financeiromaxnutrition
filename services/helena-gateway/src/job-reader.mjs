import { createHash } from 'node:crypto';
import { buildReviewContract } from './professional-output.mjs';

export const JOB_SECTIONS = ['job', 'task', 'company_identity', 'founder_decisions', 'agent_quality_contract', 'review_contract',
  'evidence_records', 'input_evidence_records', 'revision_evidence_records', 'source_evidence_records', 'artifact_records',
  'source_job', 'events', 'runtime_binding'];

// Read the same authorized result in bounded, lossless pages. No extra data access.
export function jobView(detail, { view = 'full', section, offset = 0, limit = 4000, revision } = {}) {
  const enriched = { ...detail, review_contract: buildReviewContract(detail) };
  if (view === 'full') return enriched;
  if (!['manifest', 'page'].includes(view)) throw new Error('Invalid job view');
  const snapshot = createHash('sha256').update(JSON.stringify(enriched)).digest('hex');
  if (revision && revision !== snapshot) throw new Error('JOB_SNAPSHOT_CHANGED: reread manifest before reviewing');
  const j = detail.job;
  if (view === 'manifest') return {
    reader_version: 'job-pages-v1', job_id: j.job_id, business_id: j.business_id,
    agent_id: j.agent_id, status: j.status, approval_status: j.approval_status,
    updated_at: j.updated_at, expected_task_version: detail.task?.row_version,
    review_contract: enriched.review_contract,
    revision: snapshot, evidence_missing: detail.evidence_missing,
    input_evidence_missing: detail.input_evidence_missing,
    sections: JOB_SECTIONS.map(name => ({ name, characters: JSON.stringify(enriched[name] ?? null).length })),
    read_instructions: 'Use view=page, section, offset=0, limit=4000 and this revision. Read each needed section until next_offset=null. Concatenate content as JSON text. Approval requires complete briefing and evidence; a manifest alone is not evidence.'
  };
  if (!JOB_SECTIONS.includes(section)) throw new Error('Invalid job section');
  if (!revision) throw new Error('revision from manifest is required for pages');
  if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 256 || limit > 4000)
    throw new Error('Invalid page bounds');
  const text = JSON.stringify(enriched[section] ?? null);
  if (offset > text.length) throw new Error('Offset outside section');
  const end = Math.min(offset + limit, text.length);
  return { reader_version: 'job-pages-v1', job_id: j.job_id, revision: snapshot, section,
    offset, total_characters: text.length, next_offset: end < text.length ? end : null,
    content: text.slice(offset, end) };
}
