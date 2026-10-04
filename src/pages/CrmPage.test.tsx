import { MemoryRouter } from "react-router-dom";
import React from 'react';
import { act,render,screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach,describe,it,expect,vi } from 'vitest';
const mock=vi.hoisted(()=>({business:'BIZ-003',requests:[] as {business:string;start:number;resolve:(value:unknown)=>void}[]}));
vi.mock('@/contexts/BusinessContext',()=>({useBusiness:()=>({empresas:[],currentBusiness:null,currentBusinessId:mock.business,isConsolidated:false,selecionadas:[mock.business],rotulo:'Empresa'})}));
vi.mock('@/lib/supabase',()=>({supabase:{from:()=>{
  let business='';
  const query={select:()=>query,eq:(_key:string,value:string)=>{business=value;return query;},in:()=>query,order:()=>query,range:(start:number)=>new Promise(resolve=>mock.requests.push({business,start,resolve}))};return query;
}}}));
import CrmPage from './CrmPage';
const row=(id:string,name:string)=>({opportunity_id:id,business_id:id,empresa_lead:name,etapa:'PROSPECCAO',status:'ABERTA'});
beforeEach(()=>{mock.business='BIZ-003';mock.requests=[];});
describe('CRM scoped loading',()=>{
  it('ignores an old response after switching businesses',async()=>{
    const view=render(<MemoryRouter><CrmPage/></MemoryRouter>);
    mock.business='BIZ-002';view.rerender(<MemoryRouter><CrmPage/></MemoryRouter>);
    expect(mock.requests.map(r=>r.business)).toEqual(['BIZ-003','BIZ-002']);
    await act(async()=>mock.requests[1].resolve({data:[row('BIZ-002','Empresa atual')],count:1,error:null}));
    expect(screen.getByText('Empresa atual')).toBeInTheDocument();
    await act(async()=>mock.requests[0].resolve({data:[row('BIZ-003','Empresa anterior')],count:1,error:null}));
    expect(screen.queryByText('Empresa anterior')).not.toBeInTheDocument();
  });
  it('continues reading when the service returns fewer rows than requested',async()=>{
    render(<MemoryRouter><CrmPage/></MemoryRouter>);
    await act(async()=>mock.requests[0].resolve({data:[row('1','Primeira')],count:2,error:null}));
    expect(mock.requests[1].start).toBe(1);
    await act(async()=>mock.requests[1].resolve({data:[row('2','Segunda')],count:2,error:null}));
    expect(screen.getByText('Primeira')).toBeInTheDocument();
    expect(screen.getByText('Segunda')).toBeInTheDocument();
  });
});
