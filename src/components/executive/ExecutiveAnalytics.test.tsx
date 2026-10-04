import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { TarefaComando } from '@/lib/comando';
import { ExecutiveAnalytics } from './ExecutiveAnalytics';

vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
const tasks = [
  { task_id:'T1', business_id:'BIZ-003', status:'BLOQUEADA', responsavel:'Maya' },
  { task_id:'T2', business_id:'BIZ-003', status:'CONCLUÍDA', responsavel:'Maya' },
  { task_id:'T3', business_id:'GRUPO', status:'CANCELADA', responsavel:'Maya' },
] as TarefaComando[];
const props = { tarefas:tasks, agentes:[], disponivel:true, agentesDisponiveis:true, nomeEmpresa:(id:string)=>id, abrirStatus:vi.fn(), abrirAgente:vi.fn(), abrirEmpresas:vi.fn() };

describe('Panorama visual',()=>{
  it('não apresenta contagens parciais como cenário confirmado',()=>{
    render(<ExecutiveAnalytics {...props} disponivel={false}/>);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('Aguardando a leitura das tarefas.')).toBeVisible();
  });
  it('mantém cancelamento separado de conclusão e abre o filtro correspondente',()=>{
    render(<ExecutiveAnalytics {...props}/>);
    const region=screen.getByRole('region',{name:'Panorama visual da operação'});
    expect(within(region).getByRole('img',{name:/3 tarefas:.*1 concluídas, 1 canceladas/})).toBeInTheDocument();
    fireEvent.click(within(region).getByRole('button',{name:'Bloqueadas: 1 tarefas'}));
    expect(props.abrirStatus).toHaveBeenCalledWith('BLOQUEADA');
  });
});
