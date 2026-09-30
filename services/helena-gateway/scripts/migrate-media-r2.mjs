/** Run in the Gateway container with its existing secrets. Never prints credentials or signed URLs. */
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createMediaStorage, mediaKey } from '../src/media-storage.mjs';

const apply = process.argv.includes('--apply');
const base = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!base || !serviceKey) throw new Error('Supabase legado nao configurado');
const storage = createMediaStorage({ env: { ...process.env, HELENA_MEDIA_PROVIDER: 'r2' }, serviceUrl: base, serviceKey });
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = { schema_version: 1, created_at: new Date().toISOString(), mode: apply ? 'APPLY' : 'PREVIEW', provider: 'r2', bucket: process.env.HELENA_R2_BUCKET, copied: 0, verified: 0, failed: 0, items: [] };
const output = process.env.HELENA_MEDIA_MIGRATION_MANIFEST || '/tmp/helena-media-r2-manifest.json';
const save = () => writeFileSync(output, JSON.stringify(manifest, null, 2), { mode: 0o600 });
async function* list(bucket, prefix = '') {
  for (let offset = 0; ; offset += 100) {
    const response = await fetch(`${base}/storage/v1/object/list/${bucket}`, { method: 'POST',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix, limit: 100, offset, sortBy: { column: 'name', order: 'asc' } }), redirect: 'error', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Listagem legada recusada (HTTP ${response.status})`);
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error('Listagem legada invalida');
    for (const row of rows) {
      if (typeof row.name !== 'string' || row.name.includes('/') || row.name.includes('..')) throw new Error('Caminho legado invalido');
      const path = prefix ? `${prefix}/${row.name}` : row.name;
      if (row.id) yield { bucket, path };
      else yield* list(bucket, path);
    }
    if (rows.length < 100) break;
  }
}
try {
  for (const bucket of ['helena-brand-assets', 'helena-deliveries']) {
    for await (const item of list(bucket)) {
      const result = { reference: `storage://${bucket}/${item.path}`, status: 'PENDING' }; manifest.items.push(result);
      try {
        mediaKey(bucket, item.path);
        const bytes = await storage.legacyRead(bucket, item.path);
        result.bytes = bytes.length; result.sha256 = digest(bytes);
        if (apply) {
          const type = /\.webp$/i.test(item.path) ? 'image/webp' : /\.jpe?g$/i.test(item.path) ? 'image/jpeg' : 'image/png';
          await storage.put(bucket, item.path, bytes, type);
          if (digest(await storage.readR2(bucket, item.path)) !== result.sha256) throw new Error('Conteudo copiado divergiu da origem');
          result.status = 'VERIFIED'; manifest.copied++; manifest.verified++;
        } else result.status = 'READY_TO_COPY';
      } catch { result.status = 'FAILED'; manifest.failed++; }
      save();
    }
  }
} catch { manifest.failed++; manifest.inventory_error = true; save(); }
manifest.completed_at = new Date().toISOString(); save();
console.log(JSON.stringify({ mode: manifest.mode, files: manifest.items.length, copied: manifest.copied, verified: manifest.verified, failed: manifest.failed, manifest: output, originals_deleted: 0 }));
if (manifest.failed) process.exitCode = 1;
