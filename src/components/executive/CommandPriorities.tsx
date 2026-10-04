import React from 'react';
import { ArrowRight, ArrowUpRight, CircleUserRound, LockKeyhole, Clock3 } from 'lucide-react';
import { atrasada, encerrada, etiquetasPrioridade, normalizar, requerFundador, resumoExecutivoTarefa, scorePrioridade, type TarefaComando } from '@/lib/comando';

export type PriorityFilter = 'FUNDADOR' | 'BLOQUEADA' | 'ATRASOS';
export function CommandPriorities({ tarefas, disponivel, abrirTarefa, verFila }: { tarefas: TarefaComando[]; disponivel: boolean; abrirTarefa: (id: string)=>void; verFila: (filtro: PriorityFilter)=>void }) {
  const contadores = [
    {id:'FUNDADOR' as const, titulo:'Precisa de você', icon:CircleUserRound, itens:tarefas.filter(requerFundador), cta:'Ver suas pendências'},
    {id:'BLOQUEADA' as const, titulo:'O que está travado', icon:LockKeyhole, itens:tarefas.filter(t=>normalizar(t.status)==='BLOQUEADA'), cta:'Ver o que está travado'},
    {id:'ATRASOS' as const, titulo:'Prazo vencido', icon:Clock3, itens:tarefas.filter(t=>atrasada(t)), cta:'Ver atrasos'},
  ];
  const fila = tarefas
    .filter(t => !encerrada(t.status) && etiquetasPrioridade(t).length)
    .slice()
    .sort((a,b) => scorePrioridade(b) - scorePrioridade(a) || (a.prazo || '9999').localeCompare(b.prazo || '9999') || a.task_id.localeCompare(b.task_id))
    .slice(0, 6);
  return <section className="hc-priorities" aria-label="Prioridades de agora">
    <div className="hc-priorities-heading"><div><span className="hc-eyebrow">SUA ATENÇÃO, NO LUGAR CERTO</span><h2>O que merece atenção agora</h2><p>Decisões, bloqueios e prazos reunidos em um só lugar.</p></div><span>{disponivel ? `${fila.length} destaques` : 'Leitura pendente'}</span></div>
    <div className="hc-priority-counters">{contadores.map(f=><button key={f.id} aria-label={f.cta} className={`hc-priority-counter is-${f.id.toLowerCase()}`} onClick={()=>verFila(f.id)} disabled={!disponivel || !f.itens.length}><f.icon size={18}/><span>{f.titulo}</span><strong>{disponivel ? f.itens.length : '—'}</strong><small>{f.cta}</small></button>)}</div>
    <div className="hc-executive-queue">
      {fila.map(t => <button key={t.task_id} onClick={()=>abrirTarefa(t.task_id)} className="hc-executive-item" aria-label={`Abrir prioridade: ${t.tarefa}`}>
        <div><small>{t.task_id} · {t.business_id || 'Escopo não informado'}</small><strong>{resumoExecutivoTarefa(t)}</strong><span>{t.responsavel || 'Responsável não definido'} · {t.prazo || 'Sem prazo'}</span></div>
        <div className="hc-priority-tags">{etiquetasPrioridade(t).map(e=><span key={e}>{e}</span>)}</div><ArrowUpRight size={17}/>
      </button>)}
      {!fila.length && <p className="hc-empty">{disponivel ? 'Nenhuma prioridade crítica visível neste recorte.' : 'Aguardando a leitura das tarefas.'}</p>}
    </div>
    <button className="hc-priority-open hc-priority-all" onClick={()=>verFila('BLOQUEADA')} disabled={!disponivel || !contadores[1].itens.length}>Abrir fila de bloqueios <ArrowRight size={16}/></button>
  </section>;
}
