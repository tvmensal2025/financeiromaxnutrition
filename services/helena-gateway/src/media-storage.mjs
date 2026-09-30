import { createHash } from 'node:crypto';
import { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const MEDIA_MAX_BYTES = 5 * 1024 * 1024;
const buckets = new Set(['helena-deliveries', 'helena-brand-assets']);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export function mediaKey(bucket, path) {
  if (!buckets.has(bucket) || typeof path !== 'string' || path.includes('..')) throw new Error('Referencia de imagem invalida');
  const valid = bucket === 'helena-deliveries'
    ? /^BIZ-\d{3}\/JOB-HR-[a-f0-9]{32}\/(post|story-[1-3])-v[1-5]\.png$/i.test(path)
    : /^BIZ-\d{3}\/[a-zA-Z0-9_.-]+\.(png|jpg|jpeg|webp)$/i.test(path);
  if (!valid) throw new Error('Caminho de imagem fora do escopo');
  return `${bucket}/${path}`;
}
export async function boundedBytes(body) {
  const chunks = []; let size = 0;
  for await (const chunk of body) {
    size += chunk.length;
    if (size > MEDIA_MAX_BYTES) throw new Error('Imagem excede 5 MB');
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
const missing = error => ['NoSuchKey', 'NotFound'].includes(error?.name) || error?.$metadata?.httpStatusCode === 404;

/** Logical references stay stable; only the binary backend changes. No public URLs or silent write fallback. */
export function createMediaStorage({ env = process.env, serviceUrl, serviceKey, fetchImpl = fetch, client, signer = getSignedUrl } = {}) {
  const provider = env.HELENA_MEDIA_PROVIDER || 'supabase';
  if (!['supabase', 'r2'].includes(provider)) throw new Error('HELENA_MEDIA_PROVIDER invalido');
  const base = (serviceUrl || '').replace(/\/$/, '');
  const headers = () => {
    if (!base || !serviceKey) throw new Error('Armazenamento legado nao configurado');
    return { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  };
  const legacyRead = async (bucket, path) => {
    mediaKey(bucket, path);
    const response = await fetchImpl(`${base}/storage/v1/object/authenticated/${bucket}/${path}`, {
      headers: headers(), redirect: 'error', signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error(`Imagem legada indisponivel (HTTP ${response.status})`);
    if (Number(response.headers.get('content-length')) > MEDIA_MAX_BYTES) throw new Error('Imagem excede 5 MB');
    return boundedBytes(response.body);
  };
  const legacySign = async (bucket, path) => {
    const response = await fetchImpl(`${base}/storage/v1/object/sign/${bucket}/${path}`, {
      method: 'POST', headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: 300 }), redirect: 'error', signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error('Nao foi possivel abrir a imagem legada');
    const data = await response.json(); const value = data.signedURL || data.signedUrl || '';
    const signed = new URL(value.startsWith('/object/sign/') ? `${base}/storage/v1${value}` : value, `${base}/storage/v1/`);
    if (signed.origin !== new URL(base).origin || signed.pathname !== `/storage/v1/object/sign/${bucket}/${path}` || !signed.searchParams.get('token')) throw new Error('URL de imagem legada invalida');
    return { url: signed.href, provider: 'supabase', expires_in_seconds: 300 };
  };
  let s3, physicalBucket;
  if (provider === 'r2') {
    const account = env.HELENA_R2_ACCOUNT_ID;
    physicalBucket = env.HELENA_R2_BUCKET;
    if (!/^[a-f0-9]{32}$/.test(account || '') || !/^[a-z0-9][a-z0-9-]{2,62}$/.test(physicalBucket || '')
      || !env.HELENA_R2_ACCESS_KEY_ID || !env.HELENA_R2_SECRET_ACCESS_KEY) throw new Error('Credenciais do R2 Helena incompletas');
    s3 = client || new S3Client({ region: 'auto', endpoint: `https://${account}.r2.cloudflarestorage.com`, forcePathStyle: true,
      credentials: { accessKeyId: env.HELENA_R2_ACCESS_KEY_ID, secretAccessKey: env.HELENA_R2_SECRET_ACCESS_KEY },
      requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED', maxAttempts: 2 });
  }
  const send = command => s3.send(command, { abortSignal: AbortSignal.timeout(15000) });
  const readR2 = async (bucket, path) => {
    const response = await send(new GetObjectCommand({ Bucket: physicalBucket, Key: mediaKey(bucket, path) }));
    if (response.ContentLength > MEDIA_MAX_BYTES) { response.Body?.destroy?.(); throw new Error('Imagem excede 5 MB'); }
    return boundedBytes(response.Body);
  };
  return {
    provider, status: () => ({ provider, configured: provider === 'r2' ? Boolean(s3) : Boolean(base && serviceKey), private: true, legacy_read_fallback: provider === 'r2' && env.HELENA_MEDIA_LEGACY_READ !== 'false' }),
    legacyRead, readR2,
    async read(bucket, path, { allowLegacy = true } = {}) {
      mediaKey(bucket, path);
      if (provider === 'supabase') return legacyRead(bucket, path);
      try { return await readR2(bucket, path); }
      catch (error) {
        if (!missing(error) || !allowLegacy || env.HELENA_MEDIA_LEGACY_READ === 'false') throw new Error('Imagem indisponivel no R2');
        return legacyRead(bucket, path);
      }
    },
    async signRead(bucket, path) {
      mediaKey(bucket, path);
      if (provider === 'supabase') return legacySign(bucket, path);
      try { await send(new HeadObjectCommand({ Bucket: physicalBucket, Key: mediaKey(bucket, path) })); }
      catch (error) {
        if (!missing(error) || env.HELENA_MEDIA_LEGACY_READ === 'false') throw new Error('Imagem indisponivel no R2');
        return legacySign(bucket, path);
      }
      const url = await signer(s3, new GetObjectCommand({ Bucket: physicalBucket, Key: mediaKey(bucket, path) }), { expiresIn: 300 });
      return { url, provider: 'r2', expires_in_seconds: 300 };
    },
    async signUpload(bucket, path, contentType = 'image/png') {
      if (provider !== 'r2') throw new Error('Upload R2 ainda nao ativado');
      const command = new PutObjectCommand({ Bucket: physicalBucket, Key: mediaKey(bucket, path), ContentType: contentType, IfNoneMatch: '*' });
      const url = await signer(s3, command, { expiresIn: 300, signableHeaders: new Set(['content-type', 'if-none-match']) });
      return { upload_url: url, upload_method: 'PUT', upload_headers: { 'Content-Type': contentType, 'If-None-Match': '*' }, storage_provider: 'r2', expires_in_seconds: 300 };
    },
    async put(bucket, path, bytes, contentType) {
      const key = mediaKey(bucket, path);
      if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > MEDIA_MAX_BYTES) throw new Error('Imagem vazia ou acima de 5 MB');
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(contentType)) throw new Error('Tipo de imagem invalido');
      if (provider === 'r2') {
        try { await send(new PutObjectCommand({ Bucket: physicalBucket, Key: key, Body: bytes, ContentType: contentType, IfNoneMatch: '*' })); }
        catch (error) {
          if (![409, 412].includes(error?.$metadata?.httpStatusCode)) throw new Error('R2 recusou o envio da imagem');
          if (hash(await readR2(bucket, path)) !== hash(bytes)) throw new Error('Arquivo existente difere; nenhuma sobrescrita foi feita');
        }
      } else {
        const response = await fetchImpl(`${base}/storage/v1/object/${bucket}/${path}`, { method: 'POST', headers: { ...headers(), 'Content-Type': contentType, 'x-upsert': 'false' }, body: bytes, redirect: 'error', signal: AbortSignal.timeout(15000) });
        if (!response.ok && (![400, 409].includes(response.status) || hash(await legacyRead(bucket, path)) !== hash(bytes))) throw new Error('Arquivo recusado; nenhuma sobrescrita foi feita');
      }
      return { reference: `storage://${key}`, sha256: hash(bytes), bytes: bytes.length, provider };
    }
  };
}
