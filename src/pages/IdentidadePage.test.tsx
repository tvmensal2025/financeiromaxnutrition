import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
const mocks = vi.hoisted(() => ({ from: vi.fn(), write: vi.fn(), founder: true }));
vi.mock('@/auth', () => ({ useAuth: () => ({ isFounder: mocks.founder }) }));
vi.mock('@/contexts/BusinessContext', () => ({ useBusiness: () => ({ currentBusinessId: 'BIZ-003', businesses: [{ business_id: 'BIZ-003', nome:'Humano Digital' },{ business_id:'BIZ-002',nome:'Saúde360' }] }) }));
vi.mock('@/lib/supabase', () => ({supabase:{from:mocks.from}}));
vi.mock('@/lib/escrita-protegida', () => ({ escreverRegistro:mocks.write }));
import IdentidadePage from './IdentidadePage';
describe('cadastro da identidade', () => {
  beforeEach(() => {
    cleanup(); vi.clearAllMocks(); mocks.founder = true;
    mocks.from.mockImplementation(() => ({select:()=>({eq:(_:string,id:string)=>({single:async()=>({data:{business_id:id,negocio:id==='BIZ-003'?'Humano Digital':'Saúde360',row_version:415},error:null})})})}));
    mocks.write.mockResolvedValue({data:{row_version:416},error:null});
  });
  function open() {render(<MemoryRouter initialEntries={['/identidade?empresa=BIZ-003']}><IdentidadePage/></MemoryRouter>);}
  it('mostra proposta e impede aprovação sem logo autorizado', async () => {
    open(); await screen.findByText('Cores e tipografia');
    fireEvent.click(screen.getByRole('button',{name:'Aprovar identidade'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('Logo aprovado'); expect(mocks.write).not.toHaveBeenCalled();
  });
  it('salva no registro certo com versão original e mantém rascunho no conflito', async () => {
    mocks.write.mockResolvedValue({data:null,error:{code:'40001',message:'Outra conversa alterou este registro. Seu rascunho foi preservado.'}});
    open(); await screen.findByText('Cores e tipografia');
    fireEvent.change(screen.getByLabelText(/Sobre a empresa/),{target:{value:'Descrição editada para esta empresa.'}});
    fireEvent.click(screen.getByRole('button',{name:'Salvar rascunho'}));
    await waitFor(()=>expect(mocks.write).toHaveBeenCalledWith('portfolio','BIZ-003',415,expect.objectContaining({brand_identity:expect.objectContaining({description:'Descrição editada para esta empresa.',status:'DRAFT'})})));
    expect(await screen.findByRole('alert')).toHaveTextContent('preservado');
    expect(screen.getByLabelText(/Sobre a empresa/)).toHaveValue('Descrição editada para esta empresa.');
  });
  it('troca de empresa sem levar a identidade do Humano Digital', async () => {
    open(); await screen.findByText('Cores e tipografia');
    fireEvent.change(screen.getByRole('combobox'),{target:{value:'BIZ-002'}});
    await waitFor(()=>expect(screen.getByLabelText(/Sobre a empresa/)).toHaveValue(''));
    expect(screen.queryByAltText('Referência visual de Humano Digital')).not.toBeInTheDocument();
  });
  it('usuário comum consulta sem ação de salvar', async () => {
    mocks.founder=false; open(); await screen.findByText('Cores e tipografia');
    expect(screen.queryByRole('button',{name:'Salvar rascunho'})).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Sobre a empresa/)).toHaveAttribute('readonly');
  });
});
