import crypto from 'node:crypto';
import { PNG } from 'pngjs';

export const ARTIFACT_BUCKET = 'helena-deliveries';
export const ARTIFACT_SLOTS = ['post', 'story-1', 'story-2', 'story-3'];
const MAX_BYTES = 5 * 1024 * 1024;
const referencePattern = /^storage:\/\/helena-deliveries\/(BIZ-[0-9]{3})\/(JOB-HR-[a-f0-9]{32})\/(post|story-[1-3])-v([1-5])\.png$/i;

export function artifactPath(job, slot, version) {
  if (!/^BIZ-[0-9]{3}$/.test(job?.business_id || '') || !/^JOB-HR-[a-f0-9]{32}$/i.test(job?.job_id || '')) throw new Error('Job sem identificadores validos para arquivo');
  if (!ARTIFACT_SLOTS.includes(slot) || !Number.isInteger(version) || version < 1 || version > 5) throw new Error('Slot ou versao de arquivo invalido');
  return `${job.business_id}/${job.job_id}/${slot}-v${version}.png`;
}

export function artifactReference(job, slot, version) {
  return `storage://${ARTIFACT_BUCKET}/${artifactPath(job, slot, version)}`;
}

export function parseArtifactReference(reference, job) {
  if (typeof reference !== 'string') return null;
  const match = referencePattern.exec(reference);
  if (!match || match[1] !== job.business_id || match[2] !== job.job_id) return null;
  return { reference, path: `${match[1]}/${match[2]}/${match[3]}-v${match[4]}.png`, slot: match[3], version: Number(match[4]) };
}

function serviceHeaders(key) {
  if (!key) throw new Error('Supabase nao configurado para arquivos');
  return { apikey: key, Authorization: `Bearer ${key}` };
}

export async function createArtifactUpload({ job, slot, version, serviceUrl, serviceKey, fetchImpl = fetch }) {
  if (job.status !== 'RUNNING') throw new Error('Arquivo so pode ser enviado por job em execucao');
  const path = artifactPath(job, slot, version);
  const base = serviceUrl.replace(/\/$/, '');
  const response = await fetchImpl(`${base}/storage/v1/object/upload/sign/${ARTIFACT_BUCKET}/${path}`, {
    method: 'POST', headers: { ...serviceHeaders(serviceKey), 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error(`Supabase recusou preparacao do arquivo (HTTP ${response.status})`);
  const data = await response.json();
  if (typeof data?.url !== 'string' || !data.url.startsWith('/object/upload/sign/')) throw new Error('Supabase devolveu URL de upload invalida');
  const signed = new URL(`${base}/storage/v1${data.url}`);
  if (signed.origin !== new URL(base).origin || signed.pathname !== `/storage/v1/object/upload/sign/${ARTIFACT_BUCKET}/${path}` || !signed.searchParams.get('token')) throw new Error('Supabase devolveu URL de upload invalida');
  return { reference: artifactReference(job, slot, version), path, upload_url: signed.toString(), content_type: 'image/png', max_bytes: MAX_BYTES, expires_in_seconds: 7200 };
}

export function pngDimensions(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 24 || bytes.length > MAX_BYTES) throw new Error('PNG vazio ou acima de 5 MB');
  if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || bytes.toString('ascii', 12, 16) !== 'IHDR') throw new Error('Arquivo nao e PNG valido');
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (!width || !height) throw new Error('Dimensoes PNG invalidas');
  if (width > 4096 || height > 4096 || width * height > 4_000_000)
    throw new Error('Dimensoes PNG acima do limite seguro');
  try {
    const decoded = PNG.sync.read(bytes);
    if (decoded.width !== width || decoded.height !== height) throw new Error('Dimensoes decodificadas divergentes');
  } catch {
    throw new Error('Arquivo PNG corrompido ou incompleto');
  }
  return { width, height, bytes: bytes.length };
}

export async function verifyArtifact({ job, slot, version, serviceUrl, serviceKey, fetchImpl = fetch }) {
  if (job.status !== 'RUNNING') throw new Error('Arquivo so pode ser validado por job em execucao');
  const path = artifactPath(job, slot, version);
  const response = await fetchImpl(`${serviceUrl.replace(/\/$/, '')}/storage/v1/object/authenticated/${ARTIFACT_BUCKET}/${path}`, {
    headers: serviceHeaders(serviceKey), signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`Arquivo nao encontrado no Supabase (HTTP ${response.status})`);
  const size = Number(response.headers.get('content-length'));
  if (size > MAX_BYTES) throw new Error('Arquivo acima de 5 MB');
  const bytes = Buffer.from(await response.arrayBuffer());
  const dimensions = pngDimensions(bytes);
  const expected = slot === 'post' ? [1080, 1350] : [1080, 1920];
  if (dimensions.width !== expected[0] || dimensions.height !== expected[1]) throw new Error(`Dimensoes incorretas para ${slot}: ${dimensions.width}x${dimensions.height}`);
  return { reference: artifactReference(job, slot, version), path, slot, version, ...dimensions, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
}

export function artifactEventId(reference) {
  const hash = crypto.createHash('md5').update(reference).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}
