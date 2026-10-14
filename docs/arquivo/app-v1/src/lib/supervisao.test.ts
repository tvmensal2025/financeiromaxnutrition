import { describe, expect, it } from 'vitest';
import { analisarTarefas, distribuirEmpresas } from './supervisao';
import { noEscopo, type TarefaComando } from './comando';
const task = (patch: Partial<TarefaComando> = {}): TarefaComando => ({task_id:'T1',tarefa:'Entrega',business_id:'BIZ-001',project_id:'P1',responsavel:'Fundador',status:'NÃO INICIADA',prioridade:'ALTA',prazo:'2026-10-01',bloqueio:null,evidencia:null,definicao_de_pronto:'Entrega validada',atualizado_em:null,...patch});
describe('Supervisão por regras',()=>{
  it('reconhece divergência de empresa sem proibir projetos do grupo',()=>{
    expect(analisarTarefas([task()],[],[{project_id:'P1',business_id:'BIZ-002'}],'2026-09-26')[0].motivos).toContain('Empresa da tarefa difere da empresa do projeto');
    expect(analisarTarefas([task()],[],[{project_id:'P1',business_id:'GRUPO'}],'2026-09-26')).toHaveLength(0);
  });
  it('não aprova conclusão sem prova nem cobra prova de tarefas canceladas',()=>{
    expect(analisarTarefas([task({status:'CONCLUÍDA',evidencia:'DADO A COLETAR'})],[],[])[0].motivos).toContain('Conclusão sem evidência registrada');
    expect(analisarTarefas([task({status:'CANCELADA'})],[],[])).toHaveLength(0);
  });
  it('não mistura filas e mantém registros compartilhados em uma fila própria',()=>{
    const tarefas=[task(),task({task_id:'T2',business_id:'BIZ-002'}),task({task_id:'T3',business_id:'GRUPO'}),task({task_id:'T4',business_id:null})];
    const filas=distribuirEmpresas(tarefas);
    expect(filas.map(f=>f.itens.length)).toEqual([1,1,1,1]);
    expect(tarefas.filter(t=>noEscopo(t.business_id,'BIZ-001')).map(t=>t.task_id)).toEqual(['T1','T3']);
  });
  it('prioriza bloqueios e mostra a ausência de motivo sem inventar uma dependência',()=>{
    const alertas=analisarTarefas([task({task_id:'T1',prazo:null}),task({task_id:'T2',status:'BLOQUEADA'})],[],[],'2026-09-26');
    expect(alertas[0].tarefa.task_id).toBe('T2');
    expect(alertas[0].motivos).toContain('Bloqueio sem motivo registrado');
  });
});
