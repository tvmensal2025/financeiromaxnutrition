import crypto from 'node:crypto';
import { PNG } from 'pngjs';
import { Resvg } from '@resvg/resvg-js';

export const ARTIFACT_BUCKET = 'helena-deliveries';
export const ARTIFACT_SLOTS = ['post', 'story-1', 'story-2', 'story-3'];
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_SVG_BYTES = 35 * 1024;
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

export function renderArtifactSvg(svg, slot) {
  if (typeof svg !== 'string' || Buffer.byteLength(svg, 'utf8') > MAX_SVG_BYTES) {
    throw new Error('SVG vazio ou acima de 35 KB');
  }
  if (!ARTIFACT_SLOTS.includes(slot)) throw new Error('Slot de arquivo invalido');

  // This tool accepts vector artwork only. Disallow active content and all
  // external resources before passing untrusted model output to the renderer.
  const localRefsRemoved = svg
    .replace(/\sxmlns\s*=\s*(["'])http:\/\/www\.w3\.org\/2000\/svg\1/i, '')
    .replace(/url\(\s*#[A-Za-z_][\w.-]*\s*\)/gi, '');
  if (/<!DOCTYPE|<!ENTITY|<\s*(script|foreignObject|image|iframe|audio|video|use)\b|\b(?:href|src)\s*=|\bon[a-z]+\s*=|@import|@font-face|url\s*\(|javascript:|data:|https?:|file:|expression\s*\(/i.test(localRefsRemoved)) {
    throw new Error('SVG contem conteudo ativo ou recurso externo');
  }
  const root = /<svg\b([^>]*)>/i.exec(svg)?.[1];
  if (!root) throw new Error('SVG invalido: elemento raiz ausente');
  const expected = slot === 'post' ? [1080, 1350] : [1080, 1920];
  const attr = name => new RegExp(`(?:^|\\s)${name}\\s*=\\s*["'](\\d+)["']`, 'i').exec(root)?.[1];
  const width = Number(attr('width'));
  const height = Number(attr('height'));
  const viewBox = /(?:^|\s)viewBox\s*=\s*["']\s*0\s+0\s+(\d+)\s+(\d+)\s*["']/i.exec(root);
  if (width !== expected[0] || height !== expected[1]
      || Number(viewBox?.[1]) !== expected[0] || Number(viewBox?.[2]) !== expected[1]) {
    throw new Error(`Dimensoes SVG invalidas; width, height e viewBox devem ser ${expected[0]}x${expected[1]} para ${slot}`);
  }

  // Compare the rendered image against the same design without text. Colored
  // frames are not evidence that the caption actually survived rendering.
  const withoutText = svg.replace(/<text\b[^>]*>[\s\S]*?<\/text\s*>/gi, '');
  if (withoutText === svg) throw new Error('Arte social exige texto visivel; moldura vazia nao e entrega');
  let bytes;
  try {
    const options = {
      fitTo: { mode: 'original' },
      font: { loadSystemFonts: true, defaultFontFamily: 'DejaVu Sans', sansSerifFamily: 'DejaVu Sans' },
      logLevel: 'error'
    };
    const rendered = new Resvg(svg, options).render();
    const background = new Resvg(withoutText, options).render();
    const actual = rendered.pixels;
    const base = background.pixels;
    let textPixels = 0;
    for (let i = 0; i < actual.length; i += 4) {
      if (actual[i + 3] > 0 && Math.max(Math.abs(actual[i]-base[i]), Math.abs(actual[i+1]-base[i+1]), Math.abs(actual[i+2]-base[i+2]), Math.abs(actual[i+3]-base[i+3])) >= 24) textPixels++;
    }
    if (textPixels < 500) throw new Error('Texto nao ficou visivel no PNG; confira fontes, contraste e enquadramento');
    bytes = rendered.asPng();
  } catch (error) {
    throw new Error(`SVG nao pode ser convertido em PNG: ${error.message}`);
  }
  const dimensions = pngDimensions(bytes);
  assertArtifactContent(bytes);
  if (dimensions.width !== expected[0] || dimensions.height !== expected[1]) {
    throw new Error(`PNG gerado com dimensoes incorretas: ${dimensions.width}x${dimensions.height}`);
  }
  return { png: bytes, ...dimensions };
}

export async function uploadRenderedArtifact({ job, slot, version, bytes, serviceUrl, serviceKey, fetchImpl = fetch }) {
  if (job.status !== 'RUNNING') throw new Error('Arquivo so pode ser enviado por job em execucao');
  const dimensions = pngDimensions(bytes);
  assertArtifactContent(bytes);
  const expected = slot === 'post' ? [1080, 1350] : [1080, 1920];
  if (dimensions.width !== expected[0] || dimensions.height !== expected[1]) throw new Error('Dimensoes de PNG incorretas para o slot');
  const path = artifactPath(job, slot, version);
  const response = await fetchImpl(`${serviceUrl.replace(/\/$/, '')}/storage/v1/object/${ARTIFACT_BUCKET}/${path}`, {
    method: 'POST', headers: { ...serviceHeaders(serviceKey), 'Content-Type': 'image/png', 'x-upsert': 'false' },
    body: bytes, signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) {
    // A retry after a lost response may encounter the object created by the
    // first attempt. Accept only byte-identical content; never overwrite it.
    if ([400, 409].includes(response.status)) {
      const existing = await fetchImpl(`${serviceUrl.replace(/\/$/, '')}/storage/v1/object/authenticated/${ARTIFACT_BUCKET}/${path}`, {
        headers: serviceHeaders(serviceKey), signal: AbortSignal.timeout(15000)
      });
      if (existing.ok) {
        const priorBytes = Buffer.from(await existing.arrayBuffer());
        pngDimensions(priorBytes);
        assertArtifactContent(priorBytes);
        const priorHash = crypto.createHash('sha256').update(priorBytes).digest('hex');
        const currentHash = crypto.createHash('sha256').update(bytes).digest('hex');
        if (priorHash === currentHash) return { reference: artifactReference(job, slot, version), path, ...dimensions, sha256: currentHash };
        throw new Error('Arquivo existente difere do PNG atual; nenhuma sobrescrita foi feita');
      }
    }
    throw new Error(`Supabase recusou o PNG (HTTP ${response.status}); arquivo existente nao foi sobrescrito`);
  }
  return { reference: artifactReference(job, slot, version), path, ...dimensions,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
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

// A valid PNG can still be a blank canvas. Keep the binary/dimension parser
// generic, but require visible variation before an artifact is uploaded or
// accepted as evidence for a delivery.
export function assertArtifactContent(bytes) {
  if (!Buffer.isBuffer(bytes)) throw new Error('Arquivo PNG vazio ou sem conteudo visual');
  let image;
  try {
    image = PNG.sync.read(bytes);
  } catch {
    throw new Error('Arquivo PNG corrompido ou incompleto');
  }
  const first = image.data.subarray(0, 4);
  let visiblePixels = 0;
  let variedPixels = 0;
  for (let offset = 0; offset < image.data.length; offset += 4) {
    if (image.data[offset + 3] > 0) visiblePixels += 1;
    if (image.data[offset] !== first[0]
      || image.data[offset + 1] !== first[1]
      || image.data[offset + 2] !== first[2]
      || image.data[offset + 3] !== first[3]) variedPixels += 1;
  }
  if (!visiblePixels || !variedPixels) throw new Error('Arquivo PNG vazio ou sem conteudo visual');
  return { visible_pixels: visiblePixels, varied_pixels: variedPixels };
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
  assertArtifactContent(bytes);
  const expected = slot === 'post' ? [1080, 1350] : [1080, 1920];
  if (dimensions.width !== expected[0] || dimensions.height !== expected[1]) throw new Error(`Dimensoes incorretas para ${slot}: ${dimensions.width}x${dimensions.height}`);
  return { reference: artifactReference(job, slot, version), path, slot, version, ...dimensions, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
}

export function artifactEventId(reference) {
  const hash = crypto.createHash('md5').update(reference).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}
