import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowUpRight, ChartNoAxesCombined } from 'lucide-react';
import { agruparStatus, atribuidoA, encerrada, normalizar, type AgenteComando, type TarefaComando } from '@/lib/comando';

const palette = ['#bcc5ad', '#54764e', '#d4a779', '#2a513c', '#b5a9c6', '#869fac'];
const labels = ['A iniciar', 'Em andamento', 'Bloqueadas', 'Concluídas', 'Canceladas', 'Outras'];
const tooltipStyle = { background:'var(--pe-surface)', color:'var(--pe-text)', border:'1px solid var(--pe-border)', borderRadius:12, fontSize:12, boxShadow:'0 8px 30px #20382418' };

export function ExecutiveAnalytics({ tarefas, agentes, disponivel, agentesDisponiveis, nomeEmpresa, abrirStatus, abrirAgente, abrirEmpresas }: {
  tarefas: TarefaComando[]; agentes: AgenteComando[]; disponivel: boolean; agentesDisponiveis: boolean;
  nomeEmpresa: (id:string) => string; abrirStatus:(status:string)=>void; abrirAgente:(id:string)=>void; abrirEmpresas:()=>void;
}) {
  const stages = agruparStatus(tarefas).map((g,i)=>({ ...g, name:labels[i], color:palette[i] }));
  const open = tarefas.filter(t=>!encerrada(t.status));
  const workload = agentes.map(a=>({ id:a.agent_id, name:a.agente, tarefas:open.filter(t=>atribuidoA(t.responsavel,a)).length })).filter(a=>a.tarefas>0).sort((a,b)=>b.tarefas-a.tarefas).slice(0,5);
  const businesses = [...new Set(tarefas.map(t=>t.business_id || 'SEM EMPRESA'))].map(id=>{
    const rows = tarefas.filter(t=>(t.business_id || 'SEM EMPRESA')===id);
    return { name:nomeEmpresa(id), total:rows.length, 'Em aberto':rows.filter(t=>!encerrada(t.status)&&normalizar(t.status)!=='BLOQUEADA').length, Bloqueadas:rows.filter(t=>normalizar(t.status)==='BLOQUEADA').length, Encerradas:rows.filter(t=>encerrada(t.status)).length };
  }).sort((a,b)=>b.total-a.total).slice(0,5);
  const empty = (text:string) => <div className="he-chart-empty"><ChartNoAxesCombined size={34}/><p>{text}</p></div>;
  return <section className="he-analytics" aria-label="Panorama visual da operação">
    <div className="he-analytics-heading"><div><span className="he-page-kicker">OS NÚMEROS POR TRÁS DAS ENTREGAS</span><h2>Sua operação, em perspectiva.</h2></div><span className="he-source-chip">Dados da empresa selecionada</span></div>
    <div className="he-analytics-grid">
      <article className="he-chart-card he-chart-status">
        <header><h3>Ritmo da operação</h3><span>Por situação</span></header>
        {disponivel && tarefas.length>0 ? <>
          <div className="he-donut-wrap" role="img" aria-label={`${tarefas.length} tarefas: ${stages.map(s=>`${s.n} ${s.name.toLowerCase()}`).join(', ')}`}>
            <ResponsiveContainer width="100%" height={210}><PieChart><Pie data={stages.filter(s=>s.n>0)} dataKey="n" nameKey="name" cx="50%" cy="50%" innerRadius={67} outerRadius={88} paddingAngle={3} stroke="none" isAnimationActive={false}>{stages.filter(s=>s.n>0).map(s=><Cell key={s.id} fill={s.color}/>)}</Pie><Tooltip contentStyle={tooltipStyle} formatter={(value:number)=>[`${value} tarefas`, 'Quantidade']}/></PieChart></ResponsiveContainer>
            <div className="he-donut-total" aria-hidden="true"><strong>{tarefas.length}</strong><span>tarefas</span></div>
          </div>
          <div className="he-chart-legend">{stages.map(s=><button key={s.id} aria-label={`${s.name}: ${s.n} tarefas`} onClick={()=>abrirStatus(s.id)}><i style={{background:s.color}}/><span>{s.name}</span><strong>{s.n}</strong></button>)}</div>
        </> : empty(disponivel?'Nenhuma tarefa neste recorte.':'Aguardando a leitura das tarefas.')}
        <footer>Situação registrada. Conclusão não equivale a aprovação.</footer>
      </article>
      <article className="he-chart-card he-chart-workload">
        <header><h3>Equipe em movimento</h3><span>Tarefas abertas · até 5 agentes</span></header>
        {disponivel && agentesDisponiveis && workload.length>0 ? <>
          <div className="he-bars-wrap" role="img" aria-label={workload.map(a=>`${a.name}: ${a.tarefas} tarefas abertas`).join('; ')}><ResponsiveContainer width="100%" height={230}><BarChart data={workload} layout="vertical" margin={{top:10,right:16,left:0,bottom:0}} barSize={18}><CartesianGrid strokeDasharray="3 6" horizontal={false} stroke="var(--pe-border)"/><XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{fill:'var(--pe-text-muted)',fontSize:10}}/><YAxis type="category" dataKey="name" width={66} axisLine={false} tickLine={false} tick={{fill:'var(--pe-text)',fontSize:11}}/><Tooltip cursor={{fill:'var(--pe-bg)'}} contentStyle={tooltipStyle}/><Bar dataKey="tarefas" name="Tarefas abertas" radius={[0,7,7,0]} isAnimationActive={false}>{workload.map((a,i)=><Cell key={a.id} fill={i===0?'#365d40':'#acbc8e'}/>)}</Bar></BarChart></ResponsiveContainer></div>
          <div className="he-agent-shortcuts">{workload.map(a=><button key={a.id} onClick={()=>abrirAgente(a.id)}>{a.name}<ArrowUpRight size={12}/></button>)}</div>
        </> : empty(disponivel&&agentesDisponiveis?'Sem atribuições abertas neste recorte.':'Aguardando tarefas e cadastro da equipe.')}
        <footer>Atribuições registradas, sem estimativa de esforço. Tarefas compartilhadas contam para cada agente.</footer>
      </article>
      <article className="he-chart-card he-chart-business">
        <header><h3>Cada negócio, seu momento</h3><button onClick={abrirEmpresas}>Ver empresas <ArrowUpRight size={14}/></button></header>
        {disponivel && businesses.length>0 ? <>
          <div role="img" aria-label={businesses.map(b=>`${b.name}: ${b['Em aberto']} em aberto, ${b.Bloqueadas} bloqueadas, ${b.Encerradas} encerradas`).join('; ')}><ResponsiveContainer width="100%" height={200}><BarChart data={businesses} margin={{top:12,right:8,left:-25,bottom:10}} barSize={36}><CartesianGrid strokeDasharray="3 6" vertical={false} stroke="var(--pe-border)"/><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill:'var(--pe-text-muted)',fontSize:10}} tickFormatter={v=>v.length>17?`${v.slice(0,16)}…`:v} interval={0}/><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{fill:'var(--pe-text-muted)',fontSize:10}}/><Tooltip cursor={{fill:'var(--pe-bg)'}} contentStyle={tooltipStyle}/><Bar dataKey="Em aberto" stackId="tasks" fill="#a9b98d" isAnimationActive={false}/><Bar dataKey="Bloqueadas" stackId="tasks" fill="#d4a779" isAnimationActive={false}/><Bar dataKey="Encerradas" stackId="tasks" fill="#395e43" radius={[6,6,0,0]} isAnimationActive={false}/></BarChart></ResponsiveContainer></div>
          <div className="he-business-legend"><span><i style={{background:'#a9b98d'}}/>Em aberto</span><span><i style={{background:'#d4a779'}}/>Bloqueadas</span><span><i style={{background:'#395e43'}}/>Encerradas</span></div>
          <details className="he-chart-data"><summary>Consultar os valores</summary><ul>{businesses.map(b=><li key={b.name}><strong>{b.name}</strong>: {b['Em aberto']} em aberto · {b.Bloqueadas} bloqueadas · {b.Encerradas} encerradas</li>)}</ul></details>
        </> : empty(disponivel?'Sem tarefas por empresa neste recorte.':'Aguardando a leitura das empresas.')}
        <footer>Até 5 empresas. Encerradas inclui concluídas e canceladas.</footer>
      </article>
    </div>
  </section>;
}
