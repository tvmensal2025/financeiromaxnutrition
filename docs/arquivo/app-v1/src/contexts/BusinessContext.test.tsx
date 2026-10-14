import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
const mock = vi.hoisted(()=>({ user: null as {id:string}|null, from: vi.fn(), order: vi.fn() }));
vi.mock('@/auth',()=>({useAuth:()=>({user:mock.user,loading:false})}));
vi.mock('@/lib/supabase',()=>({supabase:{from:mock.from}}));
import { BusinessProvider, useBusiness } from './BusinessContext';
function Probe(){const b=useBusiness();return <div>{b.loading?'carregando':'pronto'}<span>{b.empresas.map(e=>e.nome+' '+e.cor).join(',')}</span>{b.error&&<p role="alert">Falha de leitura</p>}</div>;}
beforeEach(()=>{mock.user=null;mock.from.mockReset();mock.order.mockReset();mock.from.mockReturnValue({select:()=>({order:mock.order})});localStorage.clear();});
describe('Empresas da sessão',()=>{
  it('usa a cor aprovada da propria empresa e ignora identidade de outra empresa',async()=>{
    mock.user={id:'u1'};mock.order.mockResolvedValue({data:[
      {business_id:'BIZ-003',negocio:'Marca atual',brand_identity:{business_id:'BIZ-003',status:'APPROVED',colors:[{hex:'#123456'}]}},
      {business_id:'BIZ-002',negocio:'Outra marca',brand_identity:{business_id:'BIZ-003',status:'APPROVED',colors:[{hex:'#123456'}]}},
    ],error:null});
    render(<BusinessProvider><Probe/></BusinessProvider>);
    expect(await screen.findByText('Marca atual #123456,Outra marca #2563EB')).toBeInTheDocument();
  });
  it('aguarda autenticação e não apresenta empresas fictícias',async()=>{
    render(<BusinessProvider><Probe/></BusinessProvider>);
    await screen.findByText('pronto');
    expect(mock.from).not.toHaveBeenCalled();
    expect(screen.queryByText(/iGreen/)).not.toBeInTheDocument();
  });
  it('exibe falha de leitura em vez de restaurar cadastro de exemplo',async()=>{
    mock.user={id:'u1'};mock.order.mockResolvedValue({data:null,error:{message:'Sem acesso'}});
    render(<BusinessProvider><Probe/></BusinessProvider>);
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha de leitura');
    expect(screen.queryByText(/iGreen/)).not.toBeInTheDocument();
  });
  it('ignora a resposta de uma sessão encerrada durante a consulta',async()=>{
    mock.user={id:'u1'};
    let resolve!: (value:unknown)=>void;
    mock.order.mockReturnValue(new Promise(r=>{resolve=r;}));
    const view=render(<BusinessProvider><Probe/></BusinessProvider>);
    await waitFor(()=>expect(mock.order).toHaveBeenCalled());
    mock.user=null;view.rerender(<BusinessProvider><Probe/></BusinessProvider>);
    await act(async()=>resolve({data:[{business_id:'BIZ-099',negocio:'Empresa anterior'}],error:null}));
    expect(screen.queryByText('Empresa anterior')).not.toBeInTheDocument();
  });
});
