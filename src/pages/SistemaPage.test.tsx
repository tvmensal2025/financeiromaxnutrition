import React from 'react';
import { describe,it,expect,vi,beforeEach } from 'vitest';
import { render,screen,within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
const mock=vi.hoisted(()=>({rows:[] as unknown[],error:null as unknown}));
vi.mock('@/lib/supabase',()=>({supabase:{from:()=>({select:()=>({order:()=>({range:()=>({abortSignal:()=>Promise.resolve({data:mock.rows,count:mock.rows.length,error:mock.error})})})})})}}));
import SistemaPage from './SistemaPage';
describe('System connections truthfulness',()=>{
  beforeEach(()=>{mock.rows=[];mock.error=null;});
  it('keeps zero connections zero, without simulated operational status',async()=>{
    render(<MemoryRouter><SistemaPage/></MemoryRouter>);
    await screen.findByText('Nenhuma conexão cadastrada está visível para sua conta.');
    const card=screen.getByText('Marcadas como conectadas').closest('.he-metric')!;
    expect(within(card as HTMLElement).getByText('0')).toBeInTheDocument();
    expect(screen.queryByText('OPERACIONAL')).not.toBeInTheDocument();
    expect(screen.queryByText(/20 CONNECTED/)).not.toBeInTheDocument();
  });
  it('shows unavailable instead of zero when data cannot be read',async()=>{
    mock.error={message:'denied'};
    render(<MemoryRouter><SistemaPage/></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível consultar');
    expect(screen.getAllByText('—')).toHaveLength(3);
  });
});
