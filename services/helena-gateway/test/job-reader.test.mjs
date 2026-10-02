import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jobView } from '../src/job-reader.mjs';
import { sampleDelivery } from './quality-fixtures.mjs';

const detail = () => ({ job: { job_id: 'JOB-TEST', business_id: 'BIZ-003', status: 'WAITING_HELENA', instruction: 'ação 👩🏽‍⚕️\n'.repeat(3000) }, task: { row_version: 123 }, evidence_records: [{ registro: 'Complete evidence ' + 'x'.repeat(17000) }], evidence_missing: [] });
test('pages reconstruct every character without silently dropping evidence', () => {
  const d = detail(), manifest = jobView(d, { view: 'manifest' });
  for (const section of ['job', 'evidence_records']) {
    let offset = 0, content = '';
    do {
      const page = jobView(d, { view: 'page', section, offset, revision: manifest.revision });
      assert.ok(page.content.length <= 4000);
      content += page.content;
      offset = page.next_offset;
    } while (offset !== null);
    assert.deepEqual(JSON.parse(content), d[section]);
  }
  assert.equal(manifest.expected_task_version, 123);
});
test('changed evidence or version invalidates pagination; missing revision and bounds reject', () => {
  const d = detail(), m = jobView(d, { view: 'manifest' });
  for (const changed of [{ ...d, task: { row_version: 124 } }, { ...d, evidence_records: [] }])
    assert.throws(() => jobView(changed, { view: 'page', section: 'job', revision: m.revision }), /SNAPSHOT_CHANGED/);
  for (const options of [{}, { revision: m.revision, section: '__proto__' }, { revision: m.revision, limit: 50000 }, { revision: m.revision, offset: -1 }])
    assert.throws(() => jobView(d, { view: 'page', section: 'job', ...options }));
  const full = jobView(d);
  assert.notEqual(full, d);
  assert.deepEqual(full, { ...d, review_contract: null });
  assert.equal(Object.hasOwn(d, 'review_contract'), false);
});

test('full e manifest oferecem contrato identico e paginavel sem mutar detalhe original', () => {
  const d = detail();
  d.job.evidence_refs = ['MEM-HR-1'];
  d.job.result_payload = { delivery: sampleDelivery() };
  const original = structuredClone(d);
  Object.freeze(d);
  const full = jobView(d), manifest = jobView(d, { view: 'manifest' });
  assert.equal(full.review_contract.version, 'review-contract-v2');
  assert.equal(full.review_contract.expected_task_version, 123);
  assert.deepEqual(full.review_contract, manifest.review_contract);
  assert.deepEqual(full.review_contract.evidence_refs, d.job.evidence_refs);
  assert.equal(full.review_contract.criteria[0].criterion, d.job.result_payload.delivery.acceptance_checks[0].criterion);
  const section = manifest.sections.find(item => item.name === 'review_contract');
  assert.equal(section.characters, JSON.stringify(full.review_contract).length);
  let offset = 0, content = '';
  do {
    const page = jobView(d, { view: 'page', section: 'review_contract', offset, limit: 256, revision: manifest.revision });
    content += page.content; offset = page.next_offset;
  } while (offset !== null);
  assert.deepEqual(JSON.parse(content), full.review_contract);
  assert.deepEqual(d, original);
  full.review_contract.approval_fields_seed.quality_review.inspected_evidence_refs[0] = 'OUTRA-REF';
  assert.deepEqual(d, original);
  assert.deepEqual(jobView(d, { view: 'manifest' }).review_contract, manifest.review_contract);
});

test('mudanca do criterion invalida paginacao e altera apenas o ID da nova versao', () => {
  const d = detail();
  d.job.evidence_refs = ['MEM-HR-1'];
  d.job.result_payload = { delivery: sampleDelivery() };
  const before = jobView(d, { view: 'manifest' });
  const changed = structuredClone(d);
  changed.job.result_payload.delivery.acceptance_checks[0].criterion += ' e fonte';
  changed.task.row_version++;
  const after = jobView(changed, { view: 'manifest' });
  assert.equal(after.review_contract.expected_task_version, 124);
  assert.notEqual(before.review_contract.criteria[0].check_id, after.review_contract.criteria[0].check_id);
  assert.throws(() => jobView(changed, { view: 'page', section: 'review_contract', revision: before.revision }), /JOB_SNAPSHOT_CHANGED/);
});
