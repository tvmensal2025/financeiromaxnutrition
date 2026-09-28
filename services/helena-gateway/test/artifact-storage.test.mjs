import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { artifactPath, artifactReference, createArtifactUpload, parseArtifactReference, pngDimensions, verifyArtifact } from '../src/artifact-storage.mjs';

const job = { job_id: `JOB-HR-${'a'.repeat(32)}`, business_id: 'BIZ-003', status: 'RUNNING' };
const base = 'https://example.invalid';
const serviceKey = 'fixture';

test('arquivo fica em caminho da empresa e job, sem aceitar fuga ou outro job', () => {
  assert.equal(artifactPath(job, 'story-2', 1), `BIZ-003/${job.job_id}/story-2-v1.png`);
  assert.deepEqual(parseArtifactReference(artifactReference(job, 'post', 2), job), {
    reference: artifactReference(job, 'post', 2), path: `BIZ-003/${job.job_id}/post-v2.png`, slot: 'post', version: 2
  });
  assert.equal(parseArtifactReference(artifactReference(job, 'post', 2), { ...job, business_id: 'BIZ-001' }), null);
  assert.throws(() => artifactPath(job, '../post', 1), /Slot/);
});

test('upload assinado aponta apenas para caminho privado e RUNNING', async () => {
  const fetchImpl = async (url, options) => {
    assert.equal(url, `${base}/storage/v1/object/upload/sign/helena-deliveries/BIZ-003/${job.job_id}/post-v1.png`);
    assert.equal(options.method, 'POST');
    return new Response(JSON.stringify({ url: `/object/upload/sign/helena-deliveries/BIZ-003/${job.job_id}/post-v1.png?token=fixture-token` }), { headers: { 'content-type': 'application/json' } });
  };
  const signed = await createArtifactUpload({ job, slot: 'post', version: 1, serviceUrl: base, serviceKey, fetchImpl });
  assert.equal(signed.reference, artifactReference(job, 'post', 1));
  assert.ok(signed.upload_url.startsWith(`${base}/storage/v1/object/upload/sign/helena-deliveries/`));
  await assert.rejects(createArtifactUpload({ job: { ...job, status: 'DRAFT' }, slot: 'post', version: 1, serviceUrl: base, serviceKey, fetchImpl }), /execucao/);
});

test('PNG real exige bytes decodificaveis e dimensoes do formato', async () => {
  const image = new PNG({ width: 1080, height: 1350 });
  const bytes = PNG.sync.write(image);
  assert.deepEqual(pngDimensions(bytes), { width: 1080, height: 1350, bytes: bytes.length });
  const fetchImpl = async url => {
    assert.match(url, /\/storage\/v1\/object\/authenticated\/helena-deliveries\/BIZ-003\//);
    return new Response(bytes, { headers: { 'content-type': 'image/png' } });
  };
  const verified = await verifyArtifact({ job, slot: 'post', version: 1, serviceUrl: base, serviceKey, fetchImpl });
  assert.equal(verified.width, 1080);
  assert.equal(verified.height, 1350);
  await assert.rejects(verifyArtifact({ job, slot: 'story-1', version: 1, serviceUrl: base, serviceKey, fetchImpl }), /Dimensoes incorretas/);
  assert.throws(() => pngDimensions(bytes.subarray(0, 24)), /corrompido/);
  const oversizedHeader = Buffer.from(bytes);
  oversizedHeader.writeUInt32BE(50000, 16);
  assert.throws(() => pngDimensions(oversizedHeader), /limite seguro/);
});
