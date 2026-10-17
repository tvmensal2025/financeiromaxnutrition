import { beforeEach,describe,it,expect,vi } from 'vitest';
const mock=vi.hoisted(()=>({from:vi.fn(),rpc:vi.fn(),error:null as unknown}));
vi.mock('@/lib/supabase',()=>({supabase:mock}));
import { carregarAgenda } from './agenda-unificada';
beforeEach(()=>{
  mock.from.mockReset();mock.rpc.mockReset();mock.error=null;
  mock.from.mockImplementation((table:string)=>{
    const query={select:()=>query,in:()=>query,order:()=>query,range:()=>Promise.resolve({data:table==='tarefas'?[{task_id:'T1',tarefa:'Entrega',business_id:'BIZ-003',prazo:'2026-10-10'}]:[],count:table==='tarefas'?1:0,error:mock.error})};return query;
  });
});
describe('Agenda read path',()=>{
  it('combines tasks without writing calendar records',async()=>{
    const result=await carregarAgenda(['BIZ-003'],false);
    expect(result.eventos).toHaveLength(1);
    expect(result.eventos[0].related_object_id).toBe('T1');
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it('reports permission failure instead of a falsely empty successful agenda',async()=>{
    mock.error={message:'permission denied'};
    const result=await carregarAgenda(['BIZ-003'],false);
    expect(result.erro).toContain('Não foi possível');
    expect(result.eventos).toHaveLength(0);
  });
  it('does not broaden scope when no companies are selected',async()=>{
    expect(await carregarAgenda([],false)).toEqual({eventos:[],semData:[],erro:''});
    expect(mock.from).not.toHaveBeenCalled();
  });
});
