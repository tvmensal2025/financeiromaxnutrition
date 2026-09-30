import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';
import { readVisualAsset, toolResultContent } from '../src/visual-assets.mjs';
import { authorizeGatewayTool } from '../src/runtime-access.mjs';

const job = { job_id: 'JOB-HR-' + 'a'.repeat(32), business_id: 'BIZ-003', agent_id: 'AGT-12', task_id: 'T-1', result_payload: { reviewer_agent_id: 'AGT-10' } };
const path = `${job.business_id}/${job.job_id}/post-v1.png`; const reference = `storage://helena-deliveries/${path}`;
const png = PNG.sync.write(new PNG({ width: 2, height: 2 }));
const sha256 = createHash('sha256').update(png).digest('hex');
const options = { job, reference, verified: [{ path, reference, sha256 }], serviceUrl: 'https://project.supabase.co', serviceKey: 'private', fetchImpl: async () => new Response(png) };

test('verified bytes become image content instead of encoded text for the model', async () => {
  const image = await readVisualAsset(options); assert.equal(image.sha256, sha256);
  const content = toolResultContent('get_visual_asset', image);
  assert.equal(content[1].type, 'image'); assert.equal(content[1].data, png.toString('base64'));
  assert.ok(!content[0].text.includes(png.toString('base64')));
});
test('cross-company, arbitrary URLs and unverified or changed image bytes are refused', async () => {
  for (const ref of [reference.replace('BIZ-003','BIZ-002'), 'https://untrusted.test/image.png', 'file:///etc/passwd'])
    await assert.rejects(readVisualAsset({ ...options, reference: ref }), /nao vinculada/);
  await assert.rejects(readVisualAsset({ ...options, verified: [] }), /nao vinculada/);
  await assert.rejects(readVisualAsset({ ...options, verified: [{ path, reference, sha256: 'different' }] }), /mudou/);
});
test('logo uses only the current approved private brand asset of the job company', async () => {
  const brand = { status: 'APPROVED', logo_approved: true, business_id: 'BIZ-003', logo_url: 'storage://helena-brand-assets/BIZ-003/logo.png' };
  let url; const image = await readVisualAsset({ ...options, reference: 'brand-logo', brand,
    fetchImpl: async target => { url = target; return new Response(png); } });
  assert.equal(image.reference, brand.logo_url); assert.match(url, /authenticated\/helena-brand-assets\/BIZ-003\/logo.png$/);
  await assert.rejects(readVisualAsset({ ...options, reference: 'brand-logo', brand: { ...brand, logo_approved: false } }), /nao aprovado/);
});
test('pixels retain existing per-job read scope: owner, designated reviewer and coordinators', async () => {
  for (const id of ['AGT-01','AGT-04','AGT-10','AGT-12','AGT-18','AGT-02']) {
    const binding = { agent_id: id, provider: 'HERMES', status: 'ACTIVE', scope_type: id === 'AGT-01' ? 'GROUP' : id === 'AGT-02' ? 'PERSONAL' : 'BUSINESS', business_id: id === 'AGT-01' ? null : 'BIZ-003' };
    const read = async url => url.includes('agent_runtime_bindings?') ? [binding] : [job];
    const action = authorizeGatewayTool('get_visual_asset', { job_id: job.job_id, reference }, { type: 'hermes_profile', profileSlug: id }, read);
    if (['AGT-18','AGT-02'].includes(id)) await assert.rejects(action);
    else await action;
  }
});
