import { z } from 'zod';

const description = z.string().trim().min(15).max(1200);
const schema = z.object({
  business_id: z.string().regex(/^BIZ-\d{3}$/),
  brand: z.string().trim().min(2).max(100),
  brand_version: z.number().int().positive(),
  logo_asset: z.string().trim().min(8).max(1000),
  audience: description,
  objective: description,
  verified_facts: z.array(description).min(1).max(8),
  sources: z.array(z.string().trim().min(8).max(500)).min(1).max(8),
  subject: description,
  scene: description,
  composition: description,
  typography: description,
  palette: description,
  imagery_method: z.enum(['GENERATED_IMAGE', 'LICENSED_PHOTO', 'ORIGINAL_ILLUSTRATION']),
  formats: z.array(z.enum(['post', 'story-1', 'story-2', 'story-3'])).min(1).max(4),
  exact_copy: description,
  cta: description,
  constraints: description,
  review: description
}).strict();

export function validateCreativeBrief(instruction, businessId) {
  const blocks = [...String(instruction).matchAll(/```direcao-arte\s*\n([\s\S]*?)```/g)];
  if (blocks.length !== 1) throw new Error('Design exige um briefing direcao-arte com empresa, pesquisa, imagem, copy e revisao');
  let brief;
  try { brief = schema.parse(JSON.parse(blocks[0][1])); }
  catch { throw new Error('Direcao de arte incompleta: confira todos os campos do contrato criativo'); }
  if (businessId && brief.business_id !== businessId) throw new Error('Direcao de arte pertence a outra empresa');
  if (new Set(brief.formats).size !== brief.formats.length) throw new Error('Direcao de arte repete formatos');
  return brief;
}

export function validateRequestedArtifacts(context) {
  const brief = validateCreativeBrief(context.job.instruction, context.job.business_id);
  const artifacts = context.artifact_records || [];
  const slots = artifacts.map(record => record.slot);
  if (slots.length !== new Set(slots).size || slots.length !== brief.formats.length || brief.formats.some(slot => !slots.includes(slot)))
    throw new Error('Entrega visual deve conter exatamente os formatos solicitados, com uma versao por arte');
  for (const artifact of artifacts) {
    const height = artifact.slot === 'post' ? 1350 : 1920;
    if (!artifact.reference || artifact.width !== 1080 || artifact.height !== height)
      throw new Error('Arquivo visual verificado tem dimensoes divergentes do formato solicitado');
  }
  return artifacts;
}

export function validateBrandForDesign(detail, brief) {
  const company = detail.company_identity;
  const brand = company?.brand_identity;
  if (!company || company.business_id !== detail.job.business_id || brand?.business_id !== detail.job.business_id)
    throw new Error('Identidade da empresa ausente ou de outro negocio; confira o cadastro da marca');
  if (brand.status !== 'APPROVED' || !brand.logo_approved || !brand.logo_url || !brand.colors?.length)
    throw new Error('Identidade e logo precisam de aprovacao antes de produzir arte');
  if (Number(company.row_version) !== brief.brand_version || brief.logo_asset !== brand.logo_url || brief.brand !== brand.name)
    throw new Error('Briefing usa identidade desatualizada; releia a empresa e alinhe marca, versao e logo');
  if (!brand.colors.every(color => /^#[a-fA-F0-9]{6}$/.test(color.hex) && brief.palette.toLowerCase().includes(color.hex.toLowerCase())))
    throw new Error('Direcao de arte deve incluir a paleta aprovada da empresa');
  for (const key of ['description','audience','offer','positioning','voice','imagery','logo_rules','layout_rules','cta','channels','restrictions','sources','review','heading_font','body_font'])
    if (typeof brand[key] !== 'string' || !brand[key].trim()) throw new Error(`Identidade incompleta: ${key}`);
  return brand;
}
