import { normalizar, type AtividadeTarefaComando } from './comando';

export type Period = 'day' | 'week' | 'month' | 'year' | 'custom';
export type DateRange = { start: string; end: string };
const DAY = 86400000;
// Business-day boundaries are explicit and independent of the viewer's timezone.
export function businessDay(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year:'numeric',month:'2-digit',day:'2-digit' }).formatToParts(date);
  const part = (type:string) => parts.find(p=>p.type===type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
function dayNumber(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const result = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(result) && new Date(result).toISOString().slice(0,10)===value ? result : NaN;
}
export function periodRange(period: Exclude<Period,'custom'>, now = new Date()): DateRange {
  const end = businessDay(now);
  const start = new Date(dayNumber(end) - ({day:0,week:6,month:29,year:364}[period])*DAY).toISOString().slice(0,10);
  return {start,end};
}
export function analyzeActivity(events: AtividadeTarefaComando[], range: DateRange) {
  const start = dayNumber(range.start), end = dayNumber(range.end);
  const days = (end-start)/DAY+1;
  if (!Number.isFinite(days) || days<1 || days>366) return null;
  const monthly = days>62;
  const buckets = new Map<string,{key:string;label:string;changes:number;completed:number}>();
  for(let t=start;t<=end;t+=DAY) {
    const day=new Date(t).toISOString().slice(0,10), key=monthly?day.slice(0,7):day;
    if(!buckets.has(key)) buckets.set(key,{key,label:monthly?`${key.slice(5)}/${key.slice(2,4)}`:`${day.slice(8)}/${day.slice(5,7)}`,changes:0,completed:0});
  }
  let previous=0, ignored=0;
  const seen = new Set<number>();
  for(const e of events) {
    if(seen.has(e.event_id)) continue;
    seen.add(e.event_id);
    const instant=new Date(e.occurred_at);
    if(!Number.isFinite(instant.getTime())) { ignored++; continue; }
    const day=businessDay(instant), time=dayNumber(day);
    if(time>=start-days*DAY && time<start) previous++;
    const bucket=buckets.get(monthly?day.slice(0,7):day);
    if(time<start || time>end || !bucket) continue;
    bucket.changes++;
    if(['CONCLUIDA','CONCLUIDO'].includes(normalizar(e.status_after)) && !['CONCLUIDA','CONCLUIDO'].includes(normalizar(e.status_before))) bucket.completed++;
  }
  const points=[...buckets.values()];
  return {points,total:points.reduce((sum,p)=>sum+p.changes,0),completed:points.reduce((sum,p)=>sum+p.completed,0),previous,ignored,monthly};
}
