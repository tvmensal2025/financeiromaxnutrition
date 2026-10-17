import { z } from 'zod';

export const BRAND_FIELDS = [
  ['description', 'Sobre a empresa', 'O que fazemos, para quem e como ajudamos.'],
  ['audience', 'Quem queremos alcançar', 'Perfil, necessidades e momento do público.'],
  ['offer', 'O que oferecemos', 'Produtos, serviços e condições já confirmadas.'],
  ['positioning', 'Nosso diferencial', 'Por que alguém escolheria esta empresa?'],
  ['voice', 'Como a marca fala', 'Tom de voz, palavras preferidas e palavras a evitar.'],
  ['imagery', 'Fotografia e personagens', 'Quem aparece, cenário, luz, enquadramento e estilo.'],
  ['logo_rules', 'Como usar o logo', 'Posição, respiro, contraste e usos proibidos.'],
  ['layout_rules', 'Como compor as peças', 'Hierarquia, margens, legibilidade e formatos.'],
  ['cta', 'Próximo passo do público', 'Chamada para ação e destino autorizado.'],
  ['channels', 'Canais oficiais', 'Instagram, WhatsApp e site. Não inventar contatos.'],
  ['restrictions', 'O que não podemos prometer', 'Limites de comunicação, afirmações proibidas e cuidados.'],
  ['sources', 'Fontes e referências', 'Documentos, fatos confirmados e referências visuais.'],
  ['review', 'Como conferir a entrega', 'Quem revisa e o que precisa verificar antes de aprovar.'],
] as const;
export type BrandField = typeof BRAND_FIELDS[number][0];
const textFields = Object.fromEntries(BRAND_FIELDS.map(([key]) => [key, z.string().max(1600)])) as Record<BrandField, z.ZodString>;
export function safeBrandAsset(value: string) {
  if (!value) return true;
  if (/^\/brand\/[a-zA-Z0-9/_\-.]+$/.test(value) && !value.includes('..')) return true;
  if (/^storage:\/\/helena-brand-assets\/BIZ-\d{3}\/[a-zA-Z0-9_.-]+$/.test(value)) return true;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
}
export const brandSchema = z.object({
  schema_version: z.literal(1), business_id: z.string().regex(/^BIZ-\d{3}$/),
  name: z.string().trim().min(2).max(100), status: z.enum(['DRAFT', 'APPROVED']),
  logo_url: z.string().max(1000).refine(safeBrandAsset, 'Use um arquivo da marca ou endereço HTTPS válido.'),
  logo_approved: z.boolean(), reference_image: z.string().max(1000).refine(safeBrandAsset),
  colors: z.array(z.object({ name: z.string().min(2).max(40), hex: z.string().regex(/^#[a-fA-F0-9]{6}$/), use: z.string().max(160) })).max(8),
  heading_font: z.string().max(100), body_font: z.string().max(100), ...textFields,
});
export type BrandIdentity = z.infer<typeof brandSchema>;
export function emptyBrand(businessId: string, name: string): BrandIdentity {
  const fields = Object.fromEntries(BRAND_FIELDS.map(([key]) => [key, ''])) as Record<BrandField, string>;
  return { schema_version: 1, business_id: businessId, name, status: 'DRAFT', logo_url: '', logo_approved: false,
    reference_image: '', colors: [], heading_font: '', body_font: '',
    ...fields };
}
export function brandMissing(brand: BrandIdentity) {
  return [ ...BRAND_FIELDS.filter(([key]) => !brand[key]?.trim()).map(([,label]) => label),
    ...(!brand.logo_url || !brand.logo_approved ? ['Logo aprovado'] : []),
    ...(!brand.colors.length ? ['Paleta de cores'] : []),
    ...(!brand.heading_font.trim() || !brand.body_font.trim() ? ['Tipografia'] : []) ];
}
