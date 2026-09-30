// A deterministic quality gate: check structure before a model is dispatched.
// The coordinator remains responsible for checking factual quality and scope.
import { validateCreativeBrief, validateBrandForDesign } from './creative-brief.mjs';
export const BRIEF_SECTIONS = [
  'Contexto e fontes',
  'Objetivo e impacto',
  'Escopo e limites',
  'Plano de trabalho',
  'Entregáveis',
  'Critérios de pronto',
  'Evidências e registro',
  'Revisão e encaminhamento'
];

export function validateBriefStructure(value) {
  const instruction = typeof value === 'string' ? value.trim() : '';
  if (instruction.length < 700 || instruction.length > 8000) {
    throw new Error('Briefing profissional exige instrução substantiva de 700 a 8000 caracteres');
  }
  const positions = BRIEF_SECTIONS.map(title => {
    const matches = [...instruction.matchAll(new RegExp(`^## ${title}\\r?$`, 'gim'))];
    if (matches.length !== 1) throw new Error(`Briefing profissional exige uma única seção: ${title}`);
    return { title, start: matches[0].index, end: matches[0].index + matches[0][0].length };
  });
  const bodies = new Set();
  for (let index = 0; index < positions.length; index++) {
    const current = positions[index];
    const next = positions[index + 1];
    if (next && next.start <= current.start) throw new Error('Briefing profissional com seções fora de ordem');
    const body = instruction.slice(current.end, next?.start ?? instruction.length).trim();
    if (body.length < 40) throw new Error(`Briefing profissional raso na seção: ${current.title}`);
    const normalized = body.toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim();
    if (bodies.has(normalized)) throw new Error(`Briefing profissional repete conteúdo genérico: ${current.title}`);
    bodies.add(normalized);
    if (/\[(?:preencher|inserir|definir|todo|tbd)[^\]]*\]/i.test(body))
      throw new Error(`Briefing profissional contém campo não preenchido: ${current.title}`);
  }
  return true;
}

export function validateProfessionalBrief(detail) {
  const job = detail?.job;
  const task = detail?.task;
  const binding = detail?.runtime_binding;
  if (!job || !task || !binding || job.task_id !== task.task_id || job.business_id !== task.business_id ||
      job.agent_id !== binding.agent_id || (binding.business_id !== job.business_id &&
        !(binding.scope_type === 'GROUP' && binding.agent_id === 'AGT-01'))) {
    throw new Error('Briefing incompleto: tarefa, empresa, executor e perfil devem corresponder');
  }
  if (!job.objective?.trim() || !task.definicao_de_pronto?.trim()) {
    throw new Error('Briefing incompleto: objetivo e definição de pronto são obrigatórios');
  }
  const instruction = job.instruction?.trim() || '';
  const inputIds = [...new Set(instruction.match(/\bMEM-HR-[a-f0-9]{32}\b/gi) || [])];
  if (inputIds.length > 10 || inputIds.some(id => !detail.input_evidence_records?.some(record => record.id === id))
      || detail.input_evidence_missing?.length) {
    throw new Error('Fontes do briefing indisponiveis ou sem revisao aprovada; liberacao e aceite recusados antes de chamar IA');
  }
  validateBriefStructure(instruction);
  if (job.agent_id === 'AGT-12' && /post|stor(y|ies)|arte|campanha/i.test(job.objective)) {
    const creative = validateCreativeBrief(instruction, job.business_id);
    validateBrandForDesign(detail, creative);
    if (creative.imagery_method !== 'ORIGINAL_ILLUSTRATION')
      throw new Error('Ferramenta de foto/imagem gerada ainda nao conectada ao executor de design; liberacao recusada antes de gastar IA');
  }
  return true;
}
