import { atrasada, atribuidoA, encerrada, normalizar, temInformacao, type AgenteComando, type TarefaComando } from './comando';

export type ProjetoSupervisao = { project_id: string; business_id: string | null };
export type AlertaSupervisao = { tarefa: TarefaComando; motivos: string[]; prioridade: number; encaminhar: string };

// Deterministic checks only. These findings request review; they never approve or execute work.
export function analisarTarefas(tarefas: TarefaComando[], agentes: AgenteComando[], projetos: ProjetoSupervisao[], hoje?: string): AlertaSupervisao[] {
  return tarefas.flatMap(tarefa => {
    const motivos: string[] = [];
    const status = normalizar(tarefa.status);
    if (status === 'CANCELADA' || status === 'CANCELADO') return [];
    const aberta = !encerrada(tarefa.status);
    const responsavel = temInformacao(tarefa.responsavel);
    const projeto = projetos.find(p => p.project_id === tarefa.project_id);
    if (!temInformacao(tarefa.business_id)) motivos.push('Empresa não definida');
    // Group projects may legitimately coordinate tasks across subsidiaries.
    if (projeto?.business_id && tarefa.business_id && !['GRUPO','SISTEMA'].includes(normalizar(projeto.business_id)) && projeto.business_id !== tarefa.business_id) motivos.push('Empresa da tarefa difere da empresa do projeto');
    if (aberta && !responsavel) motivos.push('Responsável não definido');
    if (aberta && responsavel && agentes.length && !agentes.some(a => atribuidoA(tarefa.responsavel, a)) && !/FUNDADOR|THEO\s+FUNDADOR/.test(normalizar(tarefa.responsavel))) motivos.push('Responsável precisa de conferência no cadastro');
    if (aberta && !temInformacao(tarefa.prazo)) motivos.push('Prazo não combinado');
    if (aberta && !temInformacao(tarefa.definicao_de_pronto)) motivos.push('Critério de aceite ausente');
    if (atrasada(tarefa, hoje)) motivos.push('Prazo vencido');
    if (status === 'BLOQUEADA') motivos.push(temInformacao(tarefa.bloqueio) ? 'Dependência aguardando resolução' : 'Bloqueio sem motivo registrado');
    if (!aberta && !temInformacao(tarefa.evidencia)) motivos.push('Conclusão sem evidência registrada');
    if (!motivos.length) return [];
    return [{ tarefa, motivos, prioridade: motivos.some(m => /difere|Conclusão/.test(m)) ? 3 : status === 'BLOQUEADA' || atrasada(tarefa, hoje) ? 2 : 1, encaminhar: responsavel ? `${tarefa.responsavel} · coordenação da Helena` : 'Helena · definir responsável' }];
  }).sort((a,b) => b.prioridade - a.prioridade || a.tarefa.task_id.localeCompare(b.tarefa.task_id));
}

export function distribuirEmpresas(tarefas: TarefaComando[]) {
  const grupos = new Map<string, TarefaComando[]>();
  tarefas.forEach(t => { const id = t.business_id?.trim() || 'SEM EMPRESA'; grupos.set(id, [...(grupos.get(id) || []), t]); });
  return [...grupos].map(([id, itens]) => ({ id, itens, abertas: itens.filter(t => !encerrada(t.status)).length, bloqueadas: itens.filter(t => normalizar(t.status) === 'BLOQUEADA').length, concluidas: itens.filter(t => normalizar(t.status) === 'CONCLUIDA').length }));
}
