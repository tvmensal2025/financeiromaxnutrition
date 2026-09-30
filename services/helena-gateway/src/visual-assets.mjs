import { createHash } from 'node:crypto';
import { parseArtifactReference, pngDimensions } from './artifact-storage.mjs';

export async function readVisualAsset({ job, reference, brand, verified = [], serviceUrl, serviceKey, fetchImpl = fetch }) {
  let path;
  if (reference === 'brand-logo') {
    if (brand?.status !== 'APPROVED' || !brand.logo_approved || brand.business_id !== job.business_id)
      throw new Error('Logo da empresa ainda nao aprovado');
    const match = /^storage:\/\/(helena-brand-assets)\/(BIZ-\d{3})\/([a-zA-Z0-9_.-]+\.png)$/.exec(brand.logo_url || '');
    if (!match || match[2] !== job.business_id) throw new Error('Logo deve ser PNG privado da propria empresa');
    path = `${match[1]}/${match[2]}/${match[3]}`;
    reference = brand.logo_url;
  } else {
    const artifact = parseArtifactReference(reference, job);
    if (!artifact || !verified.some(record => record.reference === reference && record.path === artifact.path))
      throw new Error('Imagem nao vinculada e verificada nesta tarefa');
    path = `helena-deliveries/${artifact.path}`;
  }
  const response = await fetchImpl(`${serviceUrl.replace(/\/$/, '')}/storage/v1/object/authenticated/${path}`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }, signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`Arquivo visual indisponivel (HTTP ${response.status})`);
  const chunks = []; let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 5 * 1024 * 1024) throw new Error('Arquivo visual excede 5 MB');
    chunks.push(Buffer.from(chunk));
  }
  const bytes = Buffer.concat(chunks); const dimensions = pngDimensions(bytes);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (path.startsWith('helena-deliveries/') && !verified.some(record => record.reference === reference && record.sha256 === sha256))
    throw new Error('Imagem mudou apos verificacao; revisao recusada');
  return { reference, mimeType: 'image/png', data: bytes.toString('base64'), sha256, ...dimensions };
}

export function toolResultContent(name, result) {
  if (name !== 'get_visual_asset') return [{ type: 'text', text: JSON.stringify(result) }];
  const { data, mimeType, ...metadata } = result;
  return [{ type: 'text', text: JSON.stringify(metadata) }, { type: 'image', mimeType, data }];
}
