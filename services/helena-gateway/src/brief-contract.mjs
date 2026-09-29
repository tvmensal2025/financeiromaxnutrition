// A deterministic quality gate: check structure before a model is dispatched.
// The coordinator remains responsible for checking factual quality and scope.
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
  if (instruction.length < 700 || instruction.length > 8000) {
    throw new Error('Briefing profissional exige instrução substantiva de 700 a 8000 caracteres');
  }
  const positions = BRIEF_SECTIONS.map(title => {
    const match = new RegExp(`^## ${title}\\r?$`, 'im').exec(instruction);
    if (!match) throw new Error(`Briefing profissional sem seção: ${title}`);
    return { title, start: match.index, end: match.index + match[0].length };
  });
  for (let index = 0; index < positions.length; index++) {
    const current = positions[index];
    const next = positions[index + 1];
    if (next && next.start <= current.start) throw new Error('Briefing profissional com seções fora de ordem');
    const body = instruction.slice(current.end, next?.start ?? instruction.length).trim();
    if (body.length < 40) throw new Error(`Briefing profissional raso na seção: ${current.title}`);
  }
  return true;
}
