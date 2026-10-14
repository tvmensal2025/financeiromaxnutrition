import { describe, expect, it } from 'vitest';
import { analyzeActivity, businessDay, periodRange } from './activity-analytics';
import type { AtividadeTarefaComando } from './comando';
const event=(event_id:number, occurred_at:string, status_after='CONCLUÍDA',status_before='EM EXECUÇÃO')=>({event_id,occurred_at,status_after,status_before} as AtividadeTarefaComando);
describe('Activity analytics',()=>{
  it('uses business timezone at midnight and rolling ranges across year boundary',()=>{
    expect(businessDay(new Date('2026-01-01T01:00:00Z'))).toBe('2025-12-31');
    expect(periodRange('week',new Date('2026-01-03T12:00:00Z'))).toEqual({start:'2025-12-28',end:'2026-01-03'});
  });
  it('counts unique events, previous equivalent period and real completion transitions',()=>{
    const rows=[event(1,'2026-10-03T01:00:00Z'),event(2,'2026-10-03T12:00:00Z'),event(2,'2026-10-03T12:00:00Z'),event(3,'2026-10-03T15:00:00Z','CANCELADA'),event(4,'2026-10-03T18:00:00Z','CONCLUÍDA','CONCLUÍDA'),event(5,'bad')];
    expect(analyzeActivity(rows,{start:'2026-10-03',end:'2026-10-03'})).toMatchObject({total:3,completed:1,previous:1,ignored:1});
  });
  it('rejects invalid, inverted and unbounded ranges',()=>{
    for(const range of [{start:'2026-02-30',end:'2026-03-01'},{start:'2026-10-04',end:'2026-10-03'},{start:'2020-01-01',end:'2026-01-01'}]) expect(analyzeActivity([],range)).toBeNull();
  });
  it('monthly grouping does not include events outside partial edge months',()=>{
    const result=analyzeActivity([event(1,'2026-01-01T12:00:00Z'),event(2,'2026-04-20T12:00:00Z'),event(3,'2026-03-01T12:00:00Z')],{start:'2026-01-15',end:'2026-04-15'});
    expect(result).toMatchObject({monthly:true,total:1,completed:1});
    expect(result?.points).toHaveLength(4);
  });
});
