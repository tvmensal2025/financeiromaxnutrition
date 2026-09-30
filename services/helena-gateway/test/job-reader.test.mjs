import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jobView } from '../src/job-reader.mjs';

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
  assert.equal(jobView(d), d);
});
