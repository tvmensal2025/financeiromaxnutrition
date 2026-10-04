import { useMemo, useState } from 'react';
import { Area, CartesianGrid, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { analyzeActivity, periodRange, type Period } from '@/lib/activity-analytics';
import type { AtividadeTarefaComando } from '@/lib/comando';

const periods: [Period,string][] = [['day','Hoje'],['week','7 dias'],['month','30 dias'],['year','365 dias'],['custom','Personalizado']];
export function ActivityTimeline({events, available}:{events:AtividadeTarefaComando[];available:boolean}) {
  const [period,setPeriod]=useState<Period>('month');
  const [custom,setCustom]=useState(()=>periodRange('month'));
  const range=period==='custom'?custom:periodRange(period);
  const result=useMemo(()=>analyzeActivity(events,range),[events,range.start,range.end]);
  return <section className="he-timeline" aria-label="Evolução da atividade">
    <header><div><span className="he-page-kicker">O TEMPO CONTA UMA HISTÓRIA</span><h2>Do movimento ao resultado.</h2><p>Atividades registradas · horário de Brasília</p></div>
      <div className="he-periods" role="group" aria-label="Período da atividade">{periods.map(([value,label])=><button key={value} aria-pressed={period===value} onClick={()=>setPeriod(value)}>{label}</button>)}</div>
    </header>
    {period==='custom' && <form className="he-date-range" onSubmit={e=>{e.preventDefault();const form=new FormData(e.currentTarget);setCustom({start:String(form.get('start')??''),end:String(form.get('end')??'')});}}><label>De<input name="start" type="date" required defaultValue={custom.start}/></label><label>Até<input name="end" type="date" required defaultValue={custom.end}/></label><button type="submit" className="he-action-button">Aplicar período</button><span>Até 366 dias por consulta</span></form>}
    {!result?<p role="alert">Selecione um intervalo válido, de até 366 dias.</p>:!available?<div className="he-chart-empty"><TrendingUp/><p>O histórico ainda não está disponível. Os indicadores serão exibidos quando a leitura for concluída.</p></div>:<>
      <div className="he-trend-summary"><div><strong>{result.total}</strong><span>atividades no período</span></div><div><strong>{result.completed}</strong><span>registros de conclusão</span></div><div><strong>{result.previous}</strong><span>atividades no período anterior equivalente</span></div></div>
      {result.total>0?<div className="he-timeline-plot" role="img" aria-label={`${result.total} atividades e ${result.completed} registros de conclusão entre ${range.start} e ${range.end}. Valores detalhados disponíveis abaixo.`}>
        <ResponsiveContainer width="100%" height={255}><ComposedChart data={result.points} margin={{top:14,right:16,bottom:4,left:-24}}>
          <CartesianGrid vertical={false} stroke="var(--pe-border)" strokeDasharray="3 6"/><XAxis dataKey="label" minTickGap={30} tick={{fill:'var(--pe-text-muted)',fontSize:11}} axisLine={false} tickLine={false}/><YAxis allowDecimals={false} tick={{fill:'var(--pe-text-muted)',fontSize:11}} axisLine={false} tickLine={false}/>
          <Tooltip contentStyle={{background:'var(--pe-surface)',color:'var(--pe-text)',border:'1px solid var(--pe-border)',borderRadius:12}}/>
          <Area type="linear" dataKey="changes" name="Atividades" fill="var(--he-chart-fill)" stroke="var(--he-chart-line)" strokeWidth={2.5} isAnimationActive={false}/>
          <Line type="linear" dataKey="completed" name="Registros de conclusão" stroke="var(--he-chart-secondary)" strokeWidth={2} dot={false} isAnimationActive={false}/>
        </ComposedChart></ResponsiveContainer>
      </div>:<div className="he-chart-empty"><TrendingUp/><p>Sem atividade registrada nesse período. Experimente ampliar as datas.</p></div>}
      <div className="he-timeline-foot"><span><i/>Atividades</span><span><i/>Registros de conclusão</span><span>{result.monthly?'Agrupado por mês':'Agrupado por dia'}</span></div>
      <details className="he-chart-data"><summary>Ver valores e critério de contagem</summary><p>Conta eventos disponíveis no histórico da empresa e das atividades compartilhadas. Uma tarefa reaberta e concluída novamente pode gerar outra conclusão. Não representa aprovação nem produtividade. Comparação anterior considera a mesma quantidade de dias.</p><table><caption>Atividade entre {range.start} e {range.end}</caption><thead><tr><th>Período</th><th>Atividades</th><th>Conclusões</th></tr></thead><tbody>{result.points.map(p=><tr key={p.key}><th scope="row">{p.label}</th><td>{p.changes}</td><td>{p.completed}</td></tr>)}</tbody></table>{result.ignored>0&&<p>{result.ignored} eventos sem data válida foram excluídos.</p>}</details>
    </>}
  </section>;
}
