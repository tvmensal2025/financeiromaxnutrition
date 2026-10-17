import { supabase } from '@/lib/supabase';

const BUCKET = 'helena-brand-assets';

function pathFromReference(reference: string) {
  const match = /^storage:\/\/helena-brand-assets\/(BIZ-\d{3})\/([a-zA-Z0-9_.-]+)$/.exec(reference);
  if (!match) throw new Error('Referência de imagem da marca inválida.');
  return `${match[1]}/${match[2]}`;
}

export async function brandPreview(reference: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(pathFromReference(reference), 300);
  if (error || !data?.signedUrl) throw new Error(error?.message || 'Imagem da marca indisponível.');
  return data.signedUrl;
}

export async function uploadBrand(businessId: string, file: File) {
  if (!/^BIZ-\d{3}$/.test(businessId)) throw new Error('Escolha uma empresa válida.');
  const extensions: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
  const extension = extensions[file.type];
  if (!extension || file.size > 5 * 1024 * 1024) throw new Error('Escolha PNG, JPG ou WebP de até 5 MB.');
  const path = `${businessId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);
  return `storage://${BUCKET}/${path}`;
}
