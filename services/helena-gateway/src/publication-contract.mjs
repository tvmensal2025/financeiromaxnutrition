import { z } from 'zod';

export const publicationSchema = z.object({
  title: z.string().trim().min(5).max(120),
  caption: z.string().trim().min(20).max(2200),
  strategy: z.string().trim().min(40).max(1800),
  instructions: z.string().trim().min(20).max(1200),
  alt_text: z.string().trim().min(20).max(1000)
}).strict();

export const visualReviewSchema = z.object({
  inspected_references: z.array(z.string().min(1).max(500)).min(1).max(10),
  findings: z.string().trim().min(80).max(2000),
  text_readable: z.boolean(),
  brand_matches: z.boolean(),
  copy_matches: z.boolean(),
  composition_approved: z.boolean()
}).strict();

export function validatePublication(value) {
  const parsed = publicationSchema.parse(value);
  if (/storage:\/\/|JOB-HR-|MEM-HR-|SHA-?256|verified\s*=|gateway|```/i.test(parsed.caption))
    throw new Error('Legenda contem relatorio tecnico; envie somente a copy destinada ao publico');
  return parsed;
}

export function validateVisualReview(review, artifacts) {
  const parsed = visualReviewSchema.parse(review);
  const expected = artifacts.map(item => item.reference);
  const inspected = new Set(parsed.inspected_references);
  if (inspected.size !== expected.length || expected.some(ref => !ref || !inspected.has(ref)))
    throw new Error('Revisao visual deve identificar exatamente todos os arquivos e versoes entregues');
  if (![parsed.text_readable, parsed.brand_matches, parsed.copy_matches, parsed.composition_approved].every(Boolean))
    throw new Error('Revisao visual reprovada; solicite ajustes antes de aprovar');
  return parsed;
}
