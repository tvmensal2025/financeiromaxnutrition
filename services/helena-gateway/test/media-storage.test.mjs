import test from 'node:test';
import assert from 'node:assert/strict';
import { createMediaStorage, mediaKey, boundedBytes } from '../src/media-storage.mjs';
import { authorizeMedia, createMediaRouter } from '../src/routes/media.mjs';
import express from 'express';

const env = { HELENA_MEDIA_PROVIDER: 'r2', HELENA_R2_ACCOUNT_ID: 'a'.repeat(32), HELENA_R2_BUCKET: 'helena-media', HELENA_R2_ACCESS_KEY_ID: 'test-only', HELENA_R2_SECRET_ACCESS_KEY: 'test-only' };
const job = 'JOB-HR-' + 'b'.repeat(32), path = `BIZ-003/${job}/post-v1.png`, bytes = Buffer.from('test pixels');
const options = { env, serviceUrl: 'https://project.supabase.co', serviceKey: 'test-only' };
const absent = () => { const error = new Error(); error.name = 'NoSuchKey'; error.$metadata = { httpStatusCode: 404 }; return error; };
const body = value => (async function* () { yield value; })();

test('R2 requires complete configuration and refuses path traversal or unrelated buckets', () => {
  assert.throws(() => createMediaStorage({ env: { ...env, HELENA_R2_SECRET_ACCESS_KEY: '' } }), /incompletas/);
  assert.throws(() => createMediaStorage({ env: { HELENA_MEDIA_PROVIDER: 'unknown' } }), /invalido/);
  for (const [bucket, key] of [['ids-media', path], ['helena-deliveries', path.replace('post-v1', '../post-v1')], ['helena-brand-assets', 'GRUPO/logo.png']]) assert.throws(() => mediaKey(bucket, key));
  assert.equal(mediaKey('helena-deliveries', path), `helena-deliveries/${path}`);
});
test('R2 upload is conditional, signed for only one object and five minutes', async () => {
  let command, signing;
  const storage = createMediaStorage({ ...options, client: {}, signer: async (_client, cmd, opts) => { command = cmd.input; signing = opts; return 'https://test-only'; } });
  const upload = await storage.signUpload('helena-deliveries', path);
  assert.equal(command.Key, `helena-deliveries/${path}`); assert.equal(command.Bucket, 'helena-media');
  assert.equal(command.IfNoneMatch, '*'); assert.equal(signing.expiresIn, 300); assert.ok(signing.signableHeaders.has('if-none-match'));
  assert.equal(upload.upload_headers['If-None-Match'], '*'); assert.equal(upload.storage_provider, 'r2');
});
test('official SDK signs the configured path and mandatory no-overwrite header', async () => {
  const storage = createMediaStorage(options);
  const upload = await storage.signUpload('helena-deliveries', path);
  const url = new URL(upload.upload_url);
  assert.equal(url.hostname, `${env.HELENA_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`);
  assert.equal(url.pathname, `/helena-media/helena-deliveries/${path}`);
  assert.equal(url.searchParams.get('X-Amz-Expires'), '300');
  assert.match(url.searchParams.get('X-Amz-SignedHeaders'), /if-none-match/);
  assert.match(url.searchParams.get('X-Amz-SignedHeaders'), /content-type/);
});
test('R2 retries accept identical content and never overwrite different content', async () => {
  let stored = bytes;
  const client = { async send(cmd) {
    if (cmd.constructor.name === 'PutObjectCommand') { assert.equal(cmd.input.IfNoneMatch, '*'); const error = new Error(); error.$metadata = { httpStatusCode: 412 }; throw error; }
    return { Body: body(stored) };
  } };
  const storage = createMediaStorage({ ...options, client });
  assert.equal((await storage.put('helena-deliveries', path, bytes, 'image/png')).provider, 'r2');
  stored = Buffer.from('different'); await assert.rejects(storage.put('helena-deliveries', path, bytes, 'image/png'), /difere/);
});
test('legacy fallback is only for missing objects, never for auth/server failures or verification', async () => {
  let failure = absent(), legacyCalls = 0;
  const storage = createMediaStorage({ ...options, client: { send: async () => { throw failure; } }, fetchImpl: async () => { legacyCalls++; return new Response(bytes); } });
  assert.deepEqual(await storage.read('helena-deliveries', path), bytes); assert.equal(legacyCalls, 1);
  await assert.rejects(storage.read('helena-deliveries', path, { allowLegacy: false }));
  failure = new Error('AccessDenied'); await assert.rejects(storage.read('helena-deliveries', path)); assert.equal(legacyCalls, 1);
});
test('legacy signed URLs use the original logical path without leaking credentials', async () => {
  const storage = createMediaStorage({ env: {}, serviceUrl: options.serviceUrl, serviceKey: 'test-only', fetchImpl: async () => new Response(JSON.stringify({ signedURL: `/object/sign/helena-deliveries/${path}?token=test-only` })) });
  assert.equal((await storage.signRead('helena-deliveries', path)).url, `${options.serviceUrl}/storage/v1/object/sign/helena-deliveries/${path}?token=test-only`);
});
test('streaming reads stop above 5 MB', async () => { await assert.rejects(boundedBytes(body(Buffer.alloc(5 * 1024 * 1024 + 1))), /5 MB/); });
test('human media permissions retain company scope and founder-only logo uploads', async () => {
  const read = async url => url.includes('app_access?') ? [{ role: 'operator' }] : url.includes('user_business_access?') ? [] : [{ business_id: 'BIZ-003' }];
  await assert.rejects(authorizeMedia({ type: 'hermes_profile', userId: 'x' }, 'BIZ-003', read));
  await assert.rejects(authorizeMedia({ type: 'oauth2', userId: 'x' }, 'BIZ-003', read), /fora/);
  await assert.rejects(authorizeMedia({ type: 'oauth2', userId: 'x' }, 'BIZ-003', read, { write: true }), /autorizado/);
  assert.equal((await authorizeMedia({ type: 'oauth2', userId: 'x' }, 'BIZ-003', async url => url.includes('app_access?') ? [{role: 'founder'}] : [{ business_id: 'BIZ-003' }])).business_id, 'BIZ-003');
});
test('frontend signing refuses unlinked and cross-company assets before issuing URLs', async () => {
  let signed = 0;
  const reference = `storage://helena-deliveries/${path}`;
  const app = express(); app.use(express.json());
  app.use(createMediaRouter({ authenticateUser: (req,_res,next) => { req.identity={ type:'oauth2', userId:'owner' }; next(); },
    read: async url => url.includes('app_access?') ? [{role:'founder'}] : url.includes('portfolio?') ? [{business_id:'BIZ-003'}] : [{job_id:job,business_id:'BIZ-003',evidence_refs:[reference]}],
    storage: { signRead: async () => { signed++; return { url:'test-only', provider:'r2' }; } } }));
  const server = app.listen(0); await new Promise(resolve => server.once('listening', resolve));
  try {
    const request = refs => fetch(`http://localhost:${server.address().port}/api/media/sign`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({business_id:'BIZ-003',job_id:job,references:refs})});
    assert.equal((await request([reference.replace('post-v1','story-1-v1')])).status,403);
    assert.equal((await request([reference.replace('BIZ-003','BIZ-002')])).status,403); assert.equal(signed,0);
    assert.equal((await request([reference])).status,200); assert.equal(signed,1);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
