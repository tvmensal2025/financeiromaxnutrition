import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { artifactPath, artifactReference, assertArtifactContent, createArtifactUpload, parseArtifactReference, pngDimensions, renderArtifactSvg, uploadRenderedArtifact, verifyArtifact } from '../src/artifact-storage.mjs';

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
  image.data[0] = 255;
  image.data[3] = 255;
  const bytes = PNG.sync.write(image);
  assert.deepEqual(pngDimensions(bytes), { width: 1080, height: 1350, bytes: bytes.length });
  assert.doesNotThrow(() => assertArtifactContent(bytes));
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

  const blank = PNG.sync.write(new PNG({ width: 1080, height: 1350 }));
  assert.throws(() => assertArtifactContent(blank), /sem conteudo visual/);
  await assert.rejects(verifyArtifact({ job, slot: 'post', version: 1, serviceUrl: base, serviceKey,
    fetchImpl: async () => new Response(blank, { headers: { 'content-length': String(blank.length) } }) }), /sem conteudo visual/);
});

test('SVG seguro e convertido para PNG Story e upload privado sem sobrescrever', async () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920"><rect width="1080" height="1920" fill="#063b35"/><text x="90" y="180" fill="#ffffff" font-size="62">Trabalhe de casa</text></svg>';
  const rendered = renderArtifactSvg(svg, 'story-1');
  assert.deepEqual([rendered.width, rendered.height], [1080, 1920]);
  let saved;
  const uploaded = await uploadRenderedArtifact({ job, slot: 'story-1', version: 1, bytes: rendered.png, serviceUrl: base, serviceKey,
    fetchImpl: async (url, options) => {
      assert.equal(url, `${base}/storage/v1/object/helena-deliveries/${job.business_id}/${job.job_id}/story-1-v1.png`);
      assert.equal(options.method, 'POST');
      assert.equal(options.headers['Content-Type'], 'image/png');
      assert.equal(options.headers['x-upsert'], 'false');
      saved = Buffer.from(options.body);
      return new Response(JSON.stringify({ Key: `${job.business_id}/${job.job_id}/story-1-v1.png` }), { status: 200 });
    } });
  assert.equal(uploaded.sha256, (await import('node:crypto')).createHash('sha256').update(saved).digest('hex'));
  assert.deepEqual(pngDimensions(saved), { width: 1080, height: 1920, bytes: saved.length });
});

test('SVG de arte recusa conteudo ativo, recurso remoto, tamanho ou formato incorreto', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920"><rect width="1080" height="1920" fill="#063b35"/></svg>';
  assert.throws(() => renderArtifactSvg(svg.replace('<rect', '<script>alert(1)</script><rect'), 'story-1'), /ativo ou recurso externo/);
  assert.throws(() => renderArtifactSvg(svg.replace('<rect', '<image href="https://bad.example/a.png"/><rect'), 'story-1'), /ativo ou recurso externo/);
  assert.throws(() => renderArtifactSvg(svg.replace('height="1920"', 'height="1350"'), 'story-1'), /dimensoes/i);
  assert.throws(() => renderArtifactSvg(svg, 'post'), /dimensoes/i);
  assert.throws(() => renderArtifactSvg('x'.repeat(35 * 1024 + 1), 'story-1'), /35 KB/);
});

test('repeticao do mesmo PNG apos resposta perdida e idempotente, divergir o conteudo e recusado', async () => {
  const image = new PNG({ width: 1080, height: 1920 });
  image.data.fill(255);
  image.data[0] = 0;
  const existingBytes = PNG.sync.write(image);
  const same = await uploadRenderedArtifact({ job, slot: 'story-2', version: 1, bytes: existingBytes, serviceUrl: base, serviceKey,
    fetchImpl: async (url, options) => options.method === 'POST'
      ? new Response('already exists', { status: 400 })
      : new Response(existingBytes, { headers: { 'content-length': String(existingBytes.length) } }) });
  assert.equal(same.sha256, (await import('node:crypto')).createHash('sha256').update(existingBytes).digest('hex'));

  const differentImage = new PNG({ width: 1080, height: 1920 });
  differentImage.data.fill(0);
  differentImage.data[0] = 255;
  differentImage.data[3] = 255;
  const differentBytes = PNG.sync.write(differentImage);
  await assert.rejects(uploadRenderedArtifact({ job, slot: 'story-2', version: 1, bytes: differentBytes, serviceUrl: base, serviceKey,
    fetchImpl: async (url, options) => options.method === 'POST'
      ? new Response('already exists', { status: 400 })
      : new Response(existingBytes, { headers: { 'content-length': String(existingBytes.length) } }) }), /difere do PNG/);
});
