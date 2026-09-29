import React, { useState } from 'react';
import { dataHora } from '@/lib/data-hora';
import { ArrowUpRight, ShieldCheck, Building2, CircleDollarSign, Search, Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AgentAvatar } from './AgentCard';
import { analisarTarefas, distribuirEmpresas } from '@/lib/supervisao';
import { atribuidoA, encerrada, noEscopo, normalizar, type DadosComando, type TarefaComando } from '@/lib/comando';
import { useBusiness } from '@/contexts/BusinessContext';
import { desfechoJob, eventosDoJob, faseJob, rotuloFase } from '@/lib/execucoes-comando';

type Props = { dados: DadosComando | null; tarefas: TarefaComando[]; modo: 'Supervisão' | 'Empresas' | 'Consumo'; abrirTarefa: (id: string) => void; abrirAgente: (id: string) => void };
type RevisaoLote = { resumo: string; acoes: string[]; decisoes_pendentes: string[]; fontes: string[] };

function lerRevisao(valor: string | null): RevisaoLote | null {
  if (!valor) return null;
  try {
    const dado: unknown = JSON.parse(valor);
    if (!dado || typeof dado !== 'object') return null;
    const r = dado as Record<string, unknown>;
    if (typeof r.resumo !== 'string') return null;
    const textos = (v: unknown) => Array.isArray(v) ? v.filter((item): item is string => typeof item === 'string').slice(0, 5) : [];
    return { resumo: r.resumo, acoes: textos(r.acoes), decisoes_pendentes: textos(r.decisoes_pendentes), fontes: textos(r.fontes) };
  } catch { return null; }
}

export function SupervisionPanel({ dados, tarefas, modo, abrirTarefa, abrirAgente }: Props) {
  const { nomeDe, currentBusinessId, isConsolidated, businesses = [], error: erroEmpresas } = useBusiness();
  const [busca, setBusca] = useState('');
  const [nivel, setNivel] = useState('TODOS');
  const [limite, setLimite] = useState(12);
  const pronto = dados?.tarefas.estado === 'ok';
  const revisaoCompleta = pronto && dados?.agentes.estado === 'ok' && dados?.projetos.estado === 'ok';
  const agentes = dados?.agentes.rows || [];
  const alertas = analisarTarefas(tarefas, agentes, dados?.projetos.rows || []);
  const visiveis = alertas.filter(a => (nivel === 'TODOS' || String(a.prioridade) === nivel) && normalizar(`${a.tarefa.task_id} ${a.tarefa.tarefa} ${a.tarefa.responsavel} ${a.motivos.join(' ')}`).includes(normalizar(busca)));
  const escopo = isConsolidated ? 'GRUPO' : currentBusinessId;
  const recorrencias = (dados?.recorrencias.rows || []).filter(r => noEscopo(r.business_id, escopo));
  const jobs = (dados?.jobs.rows || []).filter(j => noEscopo(j.business_id, escopo));
  const filas = distribuirEmpresas(tarefas);
  const cadastradas = businesses.filter(b => isConsolidated || b.id === currentBusinessId);
  cadastradas.forEach(b => { if (!filas.some(f => f.id === b.id)) filas.push({ id: b.id, itens: [], abertas: 0, bloqueadas: 0, concluidas: 0 }); });
  const nome = (id: string) => ['GRUPO','SISTEMA'].includes(normalizar(id)) ? 'Operação compartilhada · ' + id : id === 'SEM EMPRESA' ? 'Empresa não definida' : (nomeDe?.(id) || id);
  const ultimoCheckpoint = dados?.auditoria.rows
    .filter(a => a.acao === 'CHECKPOINT_SUPERVISAO_LOTE')
    .sort((a, b) => (b.criado_em || b.data_hora || '').localeCompare(a.criado_em || a.data_hora || ''))[0];
  const parecer = lerRevisao(ultimoCheckpoint?.valor_novo || null);
  const dataRevisao = ultimoCheckpoint?.criado_em || ultimoCheckpoint?.data_hora;
  const rotinaSupervisao = dados?.recorrencias.estado === 'ok'
    ? dados.recorrencias.rows.find(r => r.recurrence_id === 'REC-0001') : undefined;
  const situacaoAgenda = normalizar(rotinaSupervisao?.status) === 'PAUSADA'
    ? 'Agenda anterior pausada. A revisão no ChatGPT ainda precisa ser configurada e testada.'
    : rotinaSupervisao?.status
      ? `Situação da rotina no Supabase: ${rotinaSupervisao.status}. Consulte a implantação para conferir o executor e a homologação.`
      : 'Agenda não confirmada nesta leitura. Consulte a implantação antes de contar com uma revisão automática.';

  if (modo === 'Supervisão') return <div className="hc-stack">
    <div className="hs-lead"><div><div className="hc-eyebrow">GABINETE DA CEO</div><h2>Exceções à vista.<br/>Cada entrega tem um dono.</h2><p>Apontamentos calculados dos registros visíveis. A análise da Helena acontece em checkpoint por lote, separado desta atualização visual.</p></div><div className="hs-ceo"><AgentAvatar agentId="AGT-01" nome="Helena" size={72}/><strong>Helena</strong><span>CEO · coordenação e decisões</span><span className="hc-tag">Revisão por lote</span><button className="hc-text-button" onClick={() => abrirAgente('AGT-01')}>Ver atribuições <ArrowUpRight size={16}/></button></div></div>
    <article className="hc-card" aria-labelledby="checkpoint-supervisao-titulo">
      <div className="hc-section-heading hc-row"><div><div className="hc-eyebrow">CHECKPOINT OPERACIONAL · CONSOLIDADO DO GRUPO</div><h2 id="checkpoint-supervisao-titulo">Última varredura da Helena</h2><p>{situacaoAgenda} A atualização desta página apenas consulta os registros.</p></div><button className="hc-text-button" onClick={() => abrirTarefa('TSK-0031')}>Ver implantação <ArrowUpRight size={16}/></button></div>
      {parecer ? <div className="hc-stack">
        <p><strong>{dataHora(dataRevisao)}</strong> · {ultimoCheckpoint?.audit_id} · {ultimoCheckpoint?.agente_usuario || 'Responsável não identificado'}</p>
        <p>{parecer.resumo}</p>
        {parecer.acoes.length > 0 && <div><strong>Próximos passos</strong><ul className="hc-list">{parecer.acoes.map((acao, i) => <li key={`${i}-${acao}`}>{acao}</li>)}</ul></div>}
        {parecer.decisoes_pendentes.length > 0 && <div><strong>Decisões que dependem de você</strong><ul className="hc-list">{parecer.decisoes_pendentes.map((decisao, i) => <li key={`${i}-${decisao}`}>{decisao}</li>)}</ul></div>}
        {parecer.fontes.length > 0 && <small>Fontes: {parecer.fontes.join(', ')}</small>}
      </div> : <p className="hc-empty">{dados?.auditoria.estado === 'ok' ? 'Nenhum parecer de checkpoint em lote registrado para este acesso.' : 'Não foi possível confirmar o último parecer no Supabase.'}</p>}
    </article>
    <div className="hc-metrics">{[{label:'Entregas para revisar',value:alertas.length,hint:'Uma tarefa pode ter vários apontamentos'},{label:'Inconsistências de registro',value:alertas.filter(a=>a.prioridade===3).length,hint:'Empresa divergente ou conclusão sem evidência'},{label:'Bloqueios e atrasos',value:alertas.filter(a=>a.prioridade===2).length,hint:'Exceções com prioridade operacional'},{label:'Jobs sem tarefa',value:jobs.filter(j=>!j.task_id).length,hint:'Inclui testes e jobs ainda na fila'}].map((m,i)=><article className="hc-metric" key={m.label}><p>{m.label}</p><strong>{(i===3 ? dados?.jobs.estado === 'ok' : revisaoCompleta) ? m.value : '—'}</strong><small>{m.hint}</small></article>)}</div>
    <article className="hc-card"><div className="hc-section-heading hc-row"><div><div className="hc-eyebrow">FILA DE EXCEÇÕES</div><h2>O que precisa de atenção</h2><p>Abra a entrega para conferir o responsável, a dependência e o critério de aceite.</p></div><label className="hc-select">Prioridade<select value={nivel} onChange={e=>{setNivel(e.target.value);setLimite(12);}}><option value="TODOS">Todas</option><option value="3">Inconsistência</option><option value="2">Bloqueio ou atraso</option><option value="1">Completar planejamento</option></select></label></div>
    <label className="hc-search hc-task-search"><Search size={18}/><input aria-label="Buscar pendência de supervisão" placeholder="Tarefa, agente ou pendência…" value={busca} onChange={e=>{setBusca(e.target.value);setLimite(12);}}/></label>
    <div className="hs-exceptions">{visiveis.slice(0,limite).map(a=><button key={a.tarefa.task_id} onClick={()=>abrirTarefa(a.tarefa.task_id)} className="hs-exception"><span className={`hs-severity level-${a.prioridade}`} aria-hidden="true"/><div><small>{a.tarefa.task_id} · {nome(a.tarefa.business_id || 'SEM EMPRESA')}</small><h3>{a.tarefa.tarefa}</h3><div className="hs-tags">{a.motivos.map(m=><span key={m}>{m}</span>)}</div><p>Encaminhamento sugerido: {a.encaminhar}</p></div><ArrowUpRight size={18}/></button>)}</div>
    {!visiveis.length && <p className="hc-empty">{revisaoCompleta ? 'Nenhum apontamento encontrado nos registros e filtros visíveis. Isso não comprova validação integral da operação.' : 'Aguardando dados para avaliar as entregas.'}</p>}
    {visiveis.length>limite && <button className="hc-button hc-load-more" onClick={()=>setLimite(n=>n+12)}>Ver mais pendências</button>}</article>
    <div className="hc-note"><ShieldCheck size={22}/><p><strong>Cobertura desta supervisão:</strong> empresa, responsável, prazo, critério de aceite, bloqueio e evidência. O checkpoint registra parecer em separado do Checkpoint Mestre. A integração de WhatsApp ainda requer destinatário verificado e teste de envio.</p></div>
  </div>;

  if (modo === 'Empresas') return <div className="hc-stack"><div className="hc-section-heading"><div className="hc-eyebrow">PORTFÓLIO OPERACIONAL</div><h2>Uma gestão. Empresas com filas próprias.</h2><p>Cada tarefa entra em uma única fila pelo campo empresa. O mesmo especialista pode atender diferentes negócios.</p></div>{erroEmpresas && <p className="hc-warning" role="alert">O cadastro de empresas não está disponível. As filas abaixo refletem somente as tarefas visíveis.</p>}<div className="hs-companies">{filas.map(f=><article className="hc-card hs-company" key={f.id}><div className="hc-row"><Building2 size={23}/><span className="hc-tag">{f.id}</span></div><h3>{nome(f.id)}</h3><div className="hs-company-count"><strong>{pronto ? f.abertas : '—'}</strong><span>entregas abertas</span></div><div className="hs-segments" aria-label={`${f.bloqueadas} bloqueadas, ${f.concluidas} concluídas, ${f.itens.length} tarefas visíveis`}><span style={{flex:Math.max(0,f.abertas-f.bloqueadas),background:'#5686ab'}}/><span style={{flex:f.bloqueadas,background:'#bf844a'}}/><span style={{flex:f.concluidas,background:'#438777'}}/></div><p>{pronto ? `${f.bloqueadas} bloqueadas · ${f.concluidas} concluídas · ${f.itens.length} registros visíveis` : 'Contagens aguardando leitura completa'}</p><div className="hs-company-tasks">{f.itens.filter(t=>!encerrada(t.status)).slice(0,3).map(t=><button key={t.task_id} onClick={()=>abrirTarefa(t.task_id)}><span>{t.task_id}<strong>{t.tarefa}</strong></span><ArrowUpRight size={16}/></button>)}</div></article>)}</div>
    <article className="hc-card"><div className="hc-section-heading"><div className="hc-eyebrow">DISTRIBUIÇÃO POR ESPECIALISTA</div><h2>Quem atende cada empresa</h2><p>Tarefas abertas, com vínculos inferidos do responsável cadastrado. Uma tarefa compartilhada conta para cada participante.</p></div><div className="hs-matrix-scroll"><table className="hs-matrix"><thead><tr><th>Agente</th>{filas.map(f=><th key={f.id}>{nome(f.id)}</th>)}</tr></thead><tbody>{agentes.map(a=><tr key={a.agent_id}><th><button onClick={()=>abrirAgente(a.agent_id)}><AgentAvatar agentId={a.agent_id} nome={a.agente} size={28}/>{a.agente}</button></th>{filas.map(f=><td key={f.id}>{pronto ? f.itens.filter(t=>!encerrada(t.status)&&atribuidoA(t.responsavel,a)).length : '—'}</td>)}</tr>)}</tbody></table></div></article><div className="hc-note"><Building2 size={22}/><p>Os filtros organizam a leitura. O isolamento de acesso entre empresas precisa ser garantido também pelas permissões do banco e pela identidade do executor; não é comprovado pela separação visual.</p></div></div>;

  return <div className="hc-stack"><div className="hs-lead"><div><div className="hc-eyebrow">CONTROLE DE CONSUMO</div><h2>Preservar a cota.<br/>Cobrar entregas claras.</h2><p>Visibilidade das rotinas e tentativas registradas. A cota semanal de tarefas do Grok Bot é separada de tokens e da cota do Codex/Cursor. O saldo ainda não está conectado a esta página.</p></div><div className="hs-ceo"><CircleDollarSign size={44}/><strong>Não medido</strong><span>Cota semanal · Grok Bot</span><span className="hc-tag">Medição não conectada</span></div></div>
    <div className="hc-two"><article className="hc-card"><div className="hc-eyebrow">O QUE ESTA PÁGINA CONSOME</div><h2>Consulta dados. Não aciona agentes.</h2><p>A atualização automática faz leituras enquanto a página está visível. A supervisão usa regras locais, com zero chamadas de IA.</p><p>Isso não interrompe nem limita rotinas que estejam ativas diretamente no Grok ou em outro serviço.</p></article><article className="hc-card"><div className="hc-eyebrow">ORÇAMENTO DE TAREFAS</div><h2>Saldo semanal não conectado</h2><p>Os registros mostram trabalhos e tentativas, mas não o percentual consumido no Grok Bot. Não é possível converter essas contagens em cota semanal.</p><p>Cada pedido deve ter escopo fechado e critério de aceite. Comparar o saldo antes e depois permite avaliar o consumo; o bloqueio automático depende de acesso e controle no Grok Bot.</p></article></div>
    <article className="hc-card"><div className="hc-section-heading hc-row"><div><div className="hc-eyebrow">ROTINAS CADASTRADAS</div><h2>O que pode voltar a executar</h2><p>Status informado no cadastro; não comprova que a agenda externa está igual.</p></div><Link className="hc-text-button" to="/modulo/recorrencias">Abrir cadastro <ArrowUpRight size={16}/></Link></div><div className="hs-routines">{recorrencias.map(r=><div key={r.recurrence_id}><Clock3 size={20}/><div><small>{r.recurrence_id} · {r.business_id || 'Empresa não definida'}</small><h3>{r.nome}</h3><p>{r.responsavel || 'Responsável não definido'} · {r.frequencia || 'Frequência não definida'} · Geração automática: {r.gerar_automaticamente || 'Não confirmada'}</p><small>Próxima ocorrência registrada: {r.proxima_ocorrencia || 'Não definida'}</small></div><span className="hc-tag">{r.status || 'Sem status'}</span></div>)}</div>{!recorrencias.length && <p className="hc-empty">{dados?.recorrencias.estado === 'ok' ? 'Nenhuma rotina visível neste recorte.' : 'Leitura de rotinas indisponível.'}</p>}</article>
    <article className="hc-card"><div className="hc-section-heading"><div className="hc-eyebrow">RASTREABILIDADE</div><h2>Jobs registrados, não consumo de cota</h2><p>READY significa entrada na fila. Abra Acompanhamento para distinguir testes, mensagens, despacho, início e desfecho.</p></div>{jobs.length ? <div className="hs-routines">{jobs.map(j=><div key={j.job_id}><div><h3>{j.job_id} · {j.agent_id}</h3><p>{j.business_id || 'Empresa não definida'} · {j.task_id || 'Sem tarefa vinculada'} · Tentativas: {j.attempt_count} / {j.max_attempts}</p></div><span className="hc-tag">{desfechoJob(j) || rotuloFase[faseJob(j, dados?.eventos.estado === 'ok' ? eventosDoJob(j, dados.eventos.rows) : [])]}</span></div>)}</div> : <div className="hc-warning">{dados?.jobs.estado === 'ok' ? 'Nenhum job visível neste recorte. Isso não mede a cota semanal.' : 'Leitura da fila não confirmada nesta sessão; não é possível afirmar ausência de jobs ou consumo de cota.'}</div>}</article>
    <article className="hc-card"><div className="hc-eyebrow">CONTROLES A HOMOLOGAR NO EXECUTOR</div><h2>Antes de ampliar a autonomia</h2><ol className="hs-controls"><li><strong>Helena define o propósito</strong><p>Objetivo, empresa, dono e critério de aceite antes do despacho.</p></li><li><strong>Cota antes de iniciar</strong><p>Registrar saldo semanal, definir quanto pode ser usado por entrega e exigir revisão antes de ampliar o escopo. Conectar a medição ao Grok Bot.</p></li><li><strong>Sem repetição infinita</strong><p>Identificador único, limite de tentativas, intervalo progressivo e escalonamento de falhas.</p></li><li><strong>Revisão por lote</strong><p>Acumular mudanças e revisar em uma ou duas janelas diárias, com limite de chamadas e mensagem somente quando houver algo relevante.</p></li></ol><p>Esta lista é um plano de implantação. Nenhum limite de cota ou agendamento do Grok Bot foi alterado por esta página.</p></article></div>;
}
