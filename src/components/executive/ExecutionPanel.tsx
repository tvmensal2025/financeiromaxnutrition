import { useState } from "react";
import { dataHora } from "@/lib/data-hora";
import { ArrowRight, FileCheck2, Link2Off } from "lucide-react";
import { noEscopo, normalizar, type DadosComando, type EventoComando, type JobComando } from "@/lib/comando";
import { desfechoJob, eventosDoJob, faseJob, origemJob, revisaoConfirmada, rotuloFase, rotuloRevisao, type FaseJob, type OrigemJob } from "@/lib/execucoes-comando";

function referencia(valor: string) {
  try {
    const url = new URL(valor);
    if (["https:", "http:"].includes(url.protocol)) return `${url.hostname}${url.pathname}`.slice(0, 180);
  } catch { /* Identificador local, não URL. */ }
  return valor.replace(/(token|secret|key|password)\s*[:=]\s*\S+/gi, "$1=[oculto]").slice(0, 180);
}

const origemTexto: Record<OrigemJob, { titulo: string; descricao: string }> = {
  WHATSAPP: { titulo: "Mensagens do WhatsApp", descricao: "Jobs criados pelo webhook do atendimento. Registro de mensagem não comprova resposta ou entrega." },
  HOMOLOGACAO: { titulo: "Testes de conexão dos agentes", descricao: "Lote controlado de homologação do Helena Gateway; não são tarefas de clientes." },
  OUTROS: { titulo: "Outras origens", descricao: "A origem não está identificada pelos códigos conhecidos do Gateway." },
};
const fases: FaseJob[] = ["RASCUNHO", "FILA", "DESPACHADO", "ASSUMIDO", "EM_EXECUCAO", "REVISAO", "ENCERRADO", "OUTROS"];
const passosTexto: Record<string, string> = { CREATED: "Criado", DISPATCHED: "Despachado", CLAIMED: "Assumido", STARTED: "Iniciado", PROGRESS: "Marco do trabalho", COMPLETED: "Encerrado", FAILED: "Falhou", CANCELLED: "Cancelado", WORKFLOW_CREATE_TASK: "Tarefa criada", WORKFLOW_RELEASE_JOB: "Liberado pela coordenação", WORKFLOW_RECORD_MEMORY: "Memória registrada", WORKFLOW_SUBMIT_DELIVERY: "Entregue para revisão", WORKFLOW_REVIEW_DELIVERY: "Revisão registrada", WORKFLOW_HANDOFF: "Passagem ao próximo agente" };

function marcoRegistrado(evento: EventoComando) {
  if (normalizar(evento.event_type) !== "PROGRESS" || !evento.payload || typeof evento.payload !== "object" || Array.isArray(evento.payload)) return null;
  const payload = evento.payload as Record<string, unknown>;
  return {
    motivo: typeof payload.reason === "string" ? payload.reason : null,
    proximo: typeof payload.next_step === "string" ? payload.next_step : null,
    evidencias: Array.isArray(payload.evidence_refs) ? payload.evidence_refs.filter((ref): ref is string => typeof ref === "string") : [],
  };
}

export function ExecutionTrail({ jobs, eventos, eventosDisponiveis, nomeAgente }: {
  jobs: JobComando[];
  eventos: EventoComando[];
  eventosDisponiveis: boolean;
  nomeAgente: (id: string | null) => string;
}) {
  return <div className="hc-execution-trail">{jobs.map(job => {
    const passos = eventosDoJob(job, eventos).slice().sort((a,b) => (a.created_at || "").localeCompare(b.created_at || ""));
    const referencias = Array.isArray(job.evidence_refs) ? job.evidence_refs.filter((v): v is string => typeof v === "string" && !!v.trim()) : [];
    const fase = faseJob(job, eventosDisponiveis ? passos : []);
    const desfecho = desfechoJob(job);
    const revisao = job.result_payload && typeof job.result_payload === "object" && !Array.isArray(job.result_payload) ? job.result_payload as Record<string, unknown> : null;
    const revisadoPor = typeof revisao?.reviewed_by === "string" ? revisao.reviewed_by : null;
    const motivoRevisao = typeof revisao?.review_reason === "string" ? revisao.review_reason : null;
    return <details className="hc-run" key={job.job_id}>
      <summary className="hc-run-head"><div><small>{job.job_id} · {job.business_id || (origemJob(job) === "HOMOLOGACAO" ? "Teste global" : "Empresa não atribuída")}</small><h3>{job.objective || "Job sem objetivo resumido"}</h3><p>{nomeAgente(job.agent_id)} · {desfecho || (fase === "FILA" ? "Criado; início não registrado" : rotuloFase[fase])}</p></div><span className={`hc-tag hc-run-status hc-run-status-${fase.toLowerCase()}`}>{rotuloFase[fase]}</span></summary>
      <div className="hc-run-facts"><span>Criado <strong>{dataHora(job.created_at)}</strong></span>{job.available_at && <span>Disponível <strong>{dataHora(job.available_at)}</strong></span>}{job.claimed_at && <span>Assumido <strong>{dataHora(job.claimed_at)}</strong></span>}{job.started_at && <span>Iniciado <strong>{dataHora(job.started_at)}</strong></span>}{job.completed_at && <span>Encerrado <strong>{dataHora(job.completed_at)}</strong></span>}<span>Tentativas <strong>{job.attempt_count ?? 0} / {job.max_attempts ?? "—"}</strong></span><span>Tarefa <strong>{job.task_id || "Sem vínculo"}</strong></span><span>Revisão <strong>{rotuloRevisao(job)}</strong></span></div>
      {job.correlation_id && <p className="hc-run-correlation">Lote de origem: <strong>{job.correlation_id}</strong></p>}
      {fase === "FILA" && <div className="hc-run-next"><strong>O que falta para avançar</strong><p>{eventosDisponiveis && !passos.some(p => normalizar(p.event_type) === "DISPATCHED") ? "O banco não registra despacho nem início deste job. A entrada na fila, por si só, não aciona o agente." : "O job está na fila, mas o histórico desta leitura não confirma o próximo passo."}</p></div>}
      {desfecho && <div className="hc-run-result"><strong>{desfecho}</strong><p>{job.result_summary || "Resultado detalhado não registrado."}</p></div>}
      {motivoRevisao && revisaoConfirmada(job) && <div className="hc-run-result"><strong>Revisão de {nomeAgente(revisadoPor)}</strong><p>{motivoRevisao}</p></div>}
      {job.error_message && <div className="hc-run-error"><strong>Falha registrada</strong><p>{job.error_message}</p></div>}
      <div className="hc-run-evidence"><FileCheck2 size={16}/><div><strong>Evidências do job</strong>{referencias.length ? <ul>{referencias.map((ref,i) => <li key={`${i}-${ref}`}>{referencia(ref)}</li>)}</ul> : <p>Nenhuma referência de evidência neste registro.</p>}</div></div>
      <div className="hc-run-events"><strong>Passos registrados</strong>{!eventosDisponiveis ? <p>Histórico de eventos indisponível nesta consulta.</p> : passos.length ? <ol>{passos.map(p => { const marco = marcoRegistrado(p); return <li key={p.event_id}><time>{dataHora(p.created_at)}</time><div><b>{passosTexto[normalizar(p.event_type)] || p.event_type || p.status || "Evento"}</b><span>{nomeAgente(p.agent_id)}{p.message ? ` · ${p.message}` : ""}</span>{marco && <div className="hc-run-progress"><p><strong>Por quê:</strong> {marco.motivo || "Motivo não registrado"}</p><p><strong>Próximo passo:</strong> {marco.proximo || "Não registrado"}</p>{marco.evidencias.length > 0 && <p><strong>Evidências:</strong> {marco.evidencias.map(referencia).join(" · ")}</p>}</div>}</div></li>; })}</ol> : <p>Nenhum evento vinculado a este job. Somente seu registro na fila foi encontrado.</p>}</div>
    </details>;
  })}</div>;
}

function ExecutionCohort({ origem, registros, eventos, eventosDisponiveis, nomeAgente, abertoInicialmente }: {
  origem: OrigemJob;
  registros: JobComando[];
  eventos: EventoComando[];
  eventosDisponiveis: boolean;
  nomeAgente: (id: string | null) => string;
  abertoInicialmente: boolean;
}) {
  const [aberto, setAberto] = useState(abertoInicialmente);
  return <details className="hc-exec-cohort" open={aberto}><summary onClick={event => { event.preventDefault(); setAberto(valor => !valor); }}><div><span>{origemTexto[origem].titulo}</span><p>{origemTexto[origem].descricao}</p></div><strong>{registros.length} job{registros.length !== 1 ? "s" : ""}</strong></summary><ExecutionTrail jobs={registros} eventos={eventos} eventosDisponiveis={eventosDisponiveis} nomeAgente={nomeAgente}/></details>;
}

export function ExecutionPanel({ dados, escopo, agenteId, limparAgente }: { dados: DadosComando | null; escopo: string; agenteId?: string | null; limparAgente?: () => void }) {
  const [filtroOrigem, setFiltroOrigem] = useState<OrigemJob | "TODOS">("TODOS");
  const [filtroFase, setFiltroFase] = useState<FaseJob | "TODOS">("TODOS");
  const [filtroStatus, setFiltroStatus] = useState("TODOS");
  const jobs = (dados?.jobs.rows || []).filter(j => noEscopo(j.business_id, escopo) && (!agenteId || j.agent_id === agenteId)).slice().sort((a,b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
  const eventos = dados?.eventos.rows || [];
  const jobsDisponiveis = dados?.jobs.estado === "ok";
  const eventosDisponiveis = dados?.eventos.estado === "ok";
  const etapa = (job: JobComando) => faseJob(job, eventosDisponiveis ? eventosDoJob(job, eventos) : []);
  const porOrigem = (origem: OrigemJob) => jobs.filter(j => origemJob(j) === origem);
  const etapasOrigem = jobs.filter(j => filtroOrigem === "TODOS" || origemJob(j) === filtroOrigem);
  const visiveis = etapasOrigem.filter(j => (!eventosDisponiveis || filtroFase === "TODOS" || etapa(j) === filtroFase) && (filtroStatus === "TODOS" || normalizar(j.status) === filtroStatus));
  const estados = [...new Set(jobs.map(j => normalizar(j.status)))].sort();
  const aguardando = jobs.filter(j => etapa(j) === "FILA").length;
  const iniciados = jobs.filter(j => !!j.started_at || (eventosDisponiveis && eventosDoJob(j, eventos).some(e => normalizar(e.event_type) === "STARTED"))).length;
  const comMotivo = jobs.filter(j => eventosDisponiveis && eventosDoJob(j, eventos).some(e => !!marcoRegistrado(e)?.motivo)).length;
  const fechadosSemResposta = jobs.filter(j => desfechoJob(j) === "Teste encerrado sem resposta ao cliente").length;
  const homologados = jobs.filter(j => desfechoJob(j) === "Teste do Gateway aprovado").length;
  const encerrados = jobs.filter(j => etapa(j) === "ENCERRADO").length;
  const semTarefaForaDeTeste = jobs.filter(j => origemJob(j) !== "HOMOLOGACAO" && !j.task_id).length;
  const semEmpresaForaDeTeste = jobs.filter(j => origemJob(j) !== "HOMOLOGACAO" && !j.business_id).length;
  const nomeAgente = (id: string | null) => dados?.agentes.rows.find(a => a.agent_id === id)?.agente || id || "Agente não informado";
  const ordem: OrigemJob[] = ["WHATSAPP", "HOMOLOGACAO", "OUTROS"];

  return <div className="hc-stack"><div className="hc-section-heading hc-row"><div><span className="hc-eyebrow">REGISTROS DA FILA / SUPABASE</span><h2>Entenda o que há por trás dos jobs</h2><p>Origem, etapa e desfecho são separados. Um job criado não significa que o agente trabalhou.</p></div><label className="hc-select">Estado no banco<select aria-label="Filtrar status do job" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}><option value="TODOS">Todos</option>{estados.map(e => <option key={e} value={e}>{e}</option>)}</select></label></div>
    {agenteId && <div className="hc-active-filter"><span>Agente: {nomeAgente(agenteId)}</span><button onClick={limparAgente}>Ver todos os agentes</button></div>}
    {jobsDisponiveis ? <>
      <div className="hc-exec-overview"><span>RETRATO DOS JOBS NESTE RECORTE</span><div><strong>{jobs.length}</strong><h3>jobs registrados<br/><em>{eventosDisponiveis ? `${aguardando} ainda na fila` : "etapas não confirmadas"}</em></h3></div><p>{eventosDisponiveis ? `${iniciados} ${iniciados === 1 ? "tem" : "têm"} início registrado; ${comMotivo} com marco e motivo documentados. ${homologados} ${homologados === 1 ? "teste do Gateway aprovado" : "testes do Gateway aprovados"}; ${fechadosSemResposta} ${fechadosSemResposta === 1 ? "teste de WhatsApp encerrado" : "testes de WhatsApp encerrados"} sem resposta ao cliente.` : "A leitura de eventos está incompleta; não é possível confirmar despacho e início apenas pela existência do job."}</p></div>
      {eventosDisponiveis && iniciados > comMotivo && <div className="hc-warning"><strong>Motivo ainda sem trilha completa.</strong> {iniciados - comMotivo} execução(ões) iniciada(s) não têm marco com motivo neste histórico. Registros anteriores à regra não são reconstruídos automaticamente.</div>}
      <div className="hc-exec-sources" role="group" aria-label="Filtrar origem dos jobs"><button aria-pressed={filtroOrigem === "TODOS"} onClick={() => { setFiltroOrigem("TODOS"); setFiltroFase("TODOS"); setFiltroStatus("TODOS"); }}><span>VISÃO COMPLETA</span><strong>{jobs.length}</strong><small>{eventosDisponiveis ? `${aguardando} na fila · ${encerrados} encerrados` : "Etapas não confirmadas"}</small></button>{ordem.filter(origem => porOrigem(origem).length > 0).map(origem => { const grupo = porOrigem(origem); const fila = grupo.filter(j => etapa(j) === "FILA").length; const fechados = grupo.filter(j => etapa(j) === "ENCERRADO").length; return <button key={origem} aria-pressed={filtroOrigem === origem} onClick={() => { setFiltroOrigem(origem); setFiltroFase("TODOS"); setFiltroStatus("TODOS"); }}><span>{origemTexto[origem].titulo.toUpperCase()}</span><strong>{grupo.length}</strong><small>{eventosDisponiveis ? `${fila} na fila · ${fechados} encerrados` : "Etapas não confirmadas"}</small></button>; })}</div>
      {eventosDisponiveis ? <div className="hc-exec-stages" role="group" aria-label="Filtrar etapa dos jobs">{fases.filter(fase => fase !== "OUTROS" || etapasOrigem.some(j => etapa(j) === "OUTROS")).map((fase,i) => <div className="hc-exec-stage-wrap" key={fase}>{i > 0 && <ArrowRight size={18} aria-hidden="true"/>}<button aria-pressed={filtroFase === fase} onClick={() => setFiltroFase(atual => atual === fase ? "TODOS" : fase)}><span>{rotuloFase[fase]}</span><strong>{etapasOrigem.filter(j => etapa(j) === fase).length}</strong></button></div>)}</div> : <div className="hc-warning"><strong>Eventos indisponíveis ou parciais.</strong> A contagem de jobs permanece visível, mas a etapa de despacho não foi confirmada nesta leitura.</div>}
      <div className="hc-exec-ledger-head"><div><h3>Registro por registro</h3><p>{visiveis.length} de {jobs.length} jobs neste recorte. Clique no grupo e no job para ver horários, resultado e evidências.</p></div>{(filtroOrigem !== "TODOS" || filtroFase !== "TODOS" || filtroStatus !== "TODOS") && <button className="hc-text-button" onClick={() => {setFiltroOrigem("TODOS");setFiltroFase("TODOS");setFiltroStatus("TODOS");}}>Limpar filtros</button>}</div>
      {ordem.map(origem => { const registros = visiveis.filter(j => origemJob(j) === origem); if (!registros.length) return null; return <ExecutionCohort key={`${origem}-${filtroOrigem}-${filtroFase}-${filtroStatus}`} origem={origem} registros={registros} eventos={eventos} eventosDisponiveis={eventosDisponiveis} nomeAgente={nomeAgente} abertoInicialmente={origem !== "HOMOLOGACAO" || filtroOrigem === "HOMOLOGACAO" || filtroFase !== "TODOS" || filtroStatus !== "TODOS"}/>; })}
      {!visiveis.length && <p className="hc-empty">Nenhum job neste filtro. Escolha outra origem ou etapa.</p>}
      {(semTarefaForaDeTeste > 0 || semEmpresaForaDeTeste > 0) && <div className="hc-warning"><Link2Off size={18}/><div><strong>Vínculos ainda ausentes</strong><p>{semTarefaForaDeTeste > 0 ? `${semTarefaForaDeTeste} job(s) fora do lote de testes não têm task_id; não podem aparecer como etapa de uma tarefa específica. ` : ""}{semEmpresaForaDeTeste > 0 ? `${semEmpresaForaDeTeste} job(s) fora do lote de testes não têm empresa definida.` : ""}</p></div></div>}
      <p className="hc-caption">Os testes do Gateway são reconhecidos pelo código do lote; o WhatsApp, pelo padrão de criação do Gateway. A origem não é um campo próprio destes jobs. Os testes globais não representam empresas. Encerramento isolado não comprova atendimento ao cliente nem aceite; a revisão aprovada aparece quando registrada no job.</p>
    </> : <p className="hc-empty">Leitura da fila indisponível ou parcial. Não é possível confirmar o total de jobs.</p>}
  </div>;
}
