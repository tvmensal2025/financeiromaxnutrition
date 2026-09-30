import express from 'express';
import { randomUUID } from 'node:crypto';
import { mediaKey, MEDIA_MAX_BYTES } from '../media-storage.mjs';
import { parseArtifactReference, pngDimensions } from '../artifact-storage.mjs';

const first = rows => Array.isArray(rows) ? rows[0] : null;
const enc = encodeURIComponent;
const fail = (message, status = 403) => { const error = new Error(message); error.status = status; throw error; };

export async function authorizeMedia(identity, businessId, read, { write = false } = {}) {
  if (identity?.type !== 'oauth2' || !identity.userId) fail('Entre com sua conta para abrir os arquivos', 401);
  if (!/^BIZ-\d{3}$/.test(businessId || '')) fail('Empresa invalida', 400);
  const access = first(await read(`/rest/v1/app_access?select=role&user_id=eq.${enc(identity.userId)}&active=eq.true&limit=1`));
  if (!access || (write && access.role !== 'founder')) fail('Acesso a imagem nao autorizado');
  if (access.role !== 'founder') {
    const membership = first(await read(`/rest/v1/user_business_access?select=business_id&user_id=eq.${enc(identity.userId)}&business_id=eq.${enc(businessId)}&active=eq.true&limit=1`));
    if (!membership) fail('Empresa fora do seu acesso');
  }
  const company = first(await read(`/rest/v1/portfolio?select=business_id,brand_identity&business_id=eq.${enc(businessId)}&limit=1`));
  if (!company) fail('Empresa nao cadastrada', 404);
  return company;
}

export function createMediaRouter({ storage, authenticateUser, read }) {
  const router = express.Router();
  router.use('/api/media', authenticateUser, (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  const route = fn => async (req, res) => {
    try { return await fn(req, res); }
    catch (error) { return res.status(error.status || 503).json({ error: error.status ? error.message : 'Nao foi possivel acessar a imagem. Tente novamente.' }); }
  };
  router.post('/api/media/sign', route(async (req, res) => {
    const { business_id, job_id, references } = req.body || {};
    const company = await authorizeMedia(req.identity, business_id, read);
    if (!Array.isArray(references) || !references.length || references.length > 9 || references.some(ref => typeof ref !== 'string')) fail('Referencias invalidas', 400);
    let job;
    if (references.some(ref => ref.startsWith('storage://helena-deliveries/'))) {
      if (!/^JOB-HR-[a-f0-9]{32}$/i.test(job_id || '')) fail('Pedido invalido', 400);
      job = first(await read(`/rest/v1/agent_jobs?select=job_id,business_id,evidence_refs&job_id=eq.${enc(job_id)}&limit=1`));
      if (!job || job.business_id !== business_id) fail('Pedido fora do seu acesso');
    }
    // Validate every reference before creating any capability URL.
    const items = references.map(reference => {
      if (reference.startsWith('storage://helena-deliveries/')) {
        const artifact = parseArtifactReference(reference, job);
        if (!artifact || !job.evidence_refs?.includes(reference)) fail('Arquivo nao vinculado a entrega');
        return { reference, bucket: 'helena-deliveries', path: artifact.path };
      }
      const prefix = 'storage://helena-brand-assets/';
      if (!reference.startsWith(prefix) || ![company.brand_identity?.logo_url, company.brand_identity?.reference_image].includes(reference)) fail('Arquivo nao vinculado a marca');
      const path = reference.slice(prefix.length);
      mediaKey('helena-brand-assets', path);
      if (!path.startsWith(`${business_id}/`)) fail('Arquivo pertence a outra empresa');
      return { reference, bucket: 'helena-brand-assets', path };
    });
    const data = [];
    for (const item of items) {
      try { data.push({ reference: item.reference, path: item.path, ...await storage.signRead(item.bucket, item.path) }); }
      catch { data.push({ reference: item.reference, path: item.path, error: 'Imagem indisponivel' }); }
    }
    return res.json({ data });
  }));
  router.post('/api/media/brand/:businessId', express.raw({ type: ['image/png', 'image/jpeg', 'image/webp'], limit: MEDIA_MAX_BYTES }), route(async (req, res) => {
    await authorizeMedia(req.identity, req.params.businessId, read, { write: true });
    const bytes = req.body; const type = req.get('Content-Type');
    if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > MEDIA_MAX_BYTES) fail('Escolha uma imagem de ate 5 MB', 400);
    if (type === 'image/png') { try { pngDimensions(bytes); } catch { fail('PNG invalido', 400); } }
    else if (type === 'image/jpeg') { if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) fail('JPG invalido', 400); }
    else if (type === 'image/webp') { if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') fail('WebP invalido', 400); }
    else fail('Tipo de imagem invalido', 400);
    const ext = type === 'image/jpeg' ? 'jpg' : type.split('/')[1];
    const path = `${req.params.businessId}/${randomUUID()}.${ext}`;
    const result = await storage.put('helena-brand-assets', path, bytes, type);
    // A preview is allowed only for the file just uploaded by this authenticated founder.
    return res.status(201).json({ ...result, preview: await storage.signRead('helena-brand-assets', path) });
  }));
  return router;
}
