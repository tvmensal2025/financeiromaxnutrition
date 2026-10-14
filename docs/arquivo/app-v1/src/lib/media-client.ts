import { supabase } from '@/lib/supabase';
import { PRIMARY_GATEWAY_URL } from '@/lib/integrations-client';

const account = import.meta.env.VITE_HELENA_R2_ACCOUNT_ID || 'ae2b5f97708d13fa7e187cb470aafc40';
const bucket = import.meta.env.VITE_HELENA_R2_BUCKET || 'helena-media';
const legacyOrigin = new URL(import.meta.env.VITE_SUPABASE_URL || 'https://wxkgrykduqtsgmjkzlou.supabase.co').origin;
type MediaUrl = { reference: string; path: string; url?: string; error?: string; provider?: string };
const uploadPreviews = new Map<string, { url: string; until: number }>();

export function trustedMediaUrl(value: unknown, reference: string): value is string {
  if (typeof value !== 'string' || !/^storage:\/\/(helena-deliveries|helena-brand-assets)\/BIZ-\d{3}\//.test(reference) || reference.includes('..')) return false;
  try {
    const url = new URL(value); const key = reference.slice('storage://'.length);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash) return false;
    if (url.origin === legacyOrigin) return url.pathname === `/storage/v1/object/sign/${key}` && Boolean(url.searchParams.get('token'));
    return url.hostname === `${account}.r2.cloudflarestorage.com` && url.port === '' && url.pathname === `/${bucket}/${key}`
      && url.searchParams.get('X-Amz-Algorithm') === 'AWS4-HMAC-SHA256' && Boolean(url.searchParams.get('X-Amz-Signature'))
      && Number(url.searchParams.get('X-Amz-Expires')) > 0 && Number(url.searchParams.get('X-Amz-Expires')) <= 300;
  } catch { return false; }
}

async function mediaRequest(path: string, body: BodyInit, contentType = 'application/json') {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) throw new Error('Entre novamente para abrir os arquivos.');
  const response = await fetch(`${PRIMARY_GATEWAY_URL}/api/media${path}`, {
    method: 'POST', headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': contentType }, body, redirect: 'error'
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Não foi possível acessar os arquivos.');
  return result;
}

export async function signedMedia(businessId: string, references: string[], jobId?: string): Promise<MediaUrl[]> {
  const result = await mediaRequest('/sign', JSON.stringify({ business_id: businessId, job_id: jobId, references }));
  return (result.data as MediaUrl[]).map(item => references.includes(item.reference) && trustedMediaUrl(item.url, item.reference)
    ? item : { reference: item.reference, path: item.path, error: 'Imagem indisponível' });
}

export async function brandPreview(reference: string) {
  const cached = uploadPreviews.get(reference);
  if (cached && cached.until > Date.now()) return cached.url;
  uploadPreviews.delete(reference);
  const business = /^storage:\/\/helena-brand-assets\/(BIZ-\d{3})\//.exec(reference)?.[1];
  if (!business) throw new Error('Imagem da marca inválida');
  const [item] = await signedMedia(business, [reference]);
  return item.url || '';
}

export async function uploadBrand(businessId: string, file: File): Promise<string> {
  const result = await mediaRequest(`/brand/${businessId}`, file, file.type);
  if (!result.reference?.startsWith(`storage://helena-brand-assets/${businessId}/`) || !trustedMediaUrl(result.preview?.url, result.reference)) throw new Error('Não foi possível conferir o logo enviado.');
  uploadPreviews.set(result.reference, { url: result.preview.url, until: Date.now() + 240000 });
  return result.reference;
}
