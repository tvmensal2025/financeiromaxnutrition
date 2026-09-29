import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, RefreshCw, Search, ShieldCheck, Waypoints, CircleHelp, ChevronLeft, ChevronRight, X, Layers3 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { dataHora } from "@/lib/data-hora";
import { lerPaginas } from "@/lib/leitura-paginada";
import { useBusiness } from "@/contexts/BusinessContext";
import { AgentAvatar } from "@/components/executive/AgentCard";
import * as Dialog from "@radix-ui/react-dialog";
import { TaskBrief } from "@/components/executive/TaskBrief";
import { CommandPriorities, type PriorityFilter } from "@/components/executive/CommandPriorities";
import { distribuirEmpresas } from "@/lib/supervisao";
import { SupervisionPanel } from "@/components/executive/SupervisionPanel";
import { requerFundador, agruparStatus, atribuidoA, atrasada, encerrada, fonteResultado, indicadoresPropostos, noEscopo, normalizar, planoEvolucao, planoDoCheckpoint, resumoExecutivoTarefa, type DadosComando, type TarefaComando } from "@/lib/comando";
import { CoveragePanel } from "@/components/executive/CoveragePanel";
import { ProcessBoard } from "@/components/executive/ProcessBoard";
import { ExecutionPanel } from "@/components/executive/ExecutionPanel";
import { desfechoJob, eventosDoJob, faseJob, rotuloFase } from "@/lib/execucoes-comando";
import { DecisionPanel } from "@/components/executive/DecisionPanel";
import "./comando.css";

const consultas = [
  ["agentes", "agentes", "agent_id,agente,cargo_funcao,missao,quando_ativar,ler_antes_de_responder,pode_atualizar,saida_obrigatoria,escalar_para,status", "agent_id"],
  ["tarefas", "tarefas", "task_id,tarefa,business_id,project_id,responsavel,status,prioridade,prazo,bloqueio,evidencia,definicao_de_pronto,atualizado_em", "task_id"],
  ["focos", "foco_executivo", "id,frente,status,responsavel,criterio_de_saida,objetivo", "id"],
  ["conexoes", "agent_connections", "agent_id,connection_status,last_tested_at", "agent_id"],
  ["handoffs", "handoffs", "id,de,para,business_id_area,assunto,status,atualizado_em", "id"],
  ["projetos", "projetos", "project_id,business_id", "project_id"],
  ["recorrencias", "recorrencias", "recurrence_id,nome,business_id,status,responsavel,frequencia,gerar_automaticamente,proxima_ocorrencia", "recurrence_id"],
  ["jobs", "agent_jobs", "job_id,task_id,agent_id,business_id,objective,status,priority,correlation_id,available_at,claimed_at,started_at,completed_at,attempt_count,max_attempts,approval_required,approval_status,result_summary,result_payload,evidence_refs,error_message,created_at,updated_at", "job_id"],
  ["eventos", "agent_job_events", "event_id,job_id,agent_id,business_id,event_type,status,message,payload,created_at", "event_id"],
  ["decisoes", "decisoes", "decision_id,business_id,escopo,tipo,decisao,motivo,decisor,evidencia_fonte,impacto_esperado,revisar_em,status,data_hora,atualizado_em", "decision_id"],
  ["auditoria", "auditoria", "audit_id,data_hora,agente_usuario,acao,sheet,object_id,campo,motivo,fonte_evidencia,valor_novo,criado_em", "audit_id"],
  ["atividade", "task_activity", "event_id,task_id,business_id,event_type,changed_fields,status_before,status_after,actor_uid,actor_role,occurred_at", "event_id"],
  ["checkpoint", "checkpoint_mestre_atual", "checkpoint_id,versao,status,atualizado_em,snapshot", "versao"],
] as const;
const abas = ["Visão geral", "Supervisão", "Empresas", "Tarefas", "Agentes", "Acompanhamento", "Consumo", "Processo", "Cobertura", "Plano de evolução"] as const;
type Aba = typeof abas[number];
const abasPrincipais: Aba[] = ["Visão geral", "Processo", "Tarefas", "Acompanhamento", "Empresas", "Agentes", "Supervisão"];
const abasAvancadas: Aba[] = ["Cobertura", "Consumo", "Plano de evolução"];
const passos = [
  { nome: "Direção", dono: "Fundador + Helena", texto: "Registrar objetivo, empresa, prioridade e critério de sucesso. Helena verifica foco e decisões vigentes.", fonte: "Foco e decisões já existem.", falta: "Vincular cada direção à execução e à aprovação correspondente." },
  { nome: "Plano", dono: "Helena + Marina", texto: "Escolher o especialista, explicitar dependências, prazo e definição de pronto. Uma frente executiva por vez.", fonte: "Tarefas, projetos e handoffs já existem.", falta: "Substituir vínculos por texto por responsáveis e dependências estruturados." },
  { nome: "Execução", dono: "Especialista responsável", texto: "Mostrar recebimento, início, etapas, ferramentas usadas, bloqueios e novas tentativas. Cada evento precisa de horário e origem.", fonte: "Fila e eventos existem no banco.", falta: "Comprovar cobertura dos eventos de cada executor; a leitura por empresa já está disponível." },
  { nome: "Validação", dono: "Bruno + dono da entrega", texto: "Comparar o resultado com a definição de pronto. Anexar evidência, apontar falhas e devolver para correção quando necessário.", fonte: "Tarefas já contêm evidência e critério de pronto.", falta: "Separar trabalho finalizado de resultado aprovado. Status de tarefa não basta para comprovar qualidade." },
  { nome: "Decisão", dono: "Helena + fundador", texto: "Helena consolida o resultado, a recomendação e os impactos. O fundador decide o que exige sua autoridade.", fonte: "Decisões e limites dos agentes estão registrados.", falta: "Inbox persistente, trilha de aprovações e ações autorizadas com prevenção de duplicidade." },
  { nome: "Memória", dono: "Helena", texto: "Relacionar entrega, decisão e memória. Atualizar o checkpoint quando houver mudança material conforme o protocolo.", fonte: "Memória e checkpoint já existem.", falta: "Homologar o uso do checkpoint em nova conversa; a aba Cobertura já compara contagens com o banco atual." },
];

function Campo({ titulo, valor }: { titulo: string; valor: string | null | undefined }) {
  return <div className="hc-field"><h3>{titulo}</h3><p>{valor?.trim() || "Não registrado na fonte."}</p></div>;
}
function Status({ children }: { children: React.ReactNode }) { return <span className="hc-tag">{children}</span>; }

export default function ComandoPage({ inicial = "Visão geral" }: { inicial?: Aba }) {
  const { currentBusinessId, isConsolidated, rotulo, nomeDe } = useBusiness();
  const [aba, setAba] = useState<Aba>(inicial);
  useEffect(() => { setAba(inicial); }, [inicial]);
  const [dados, setDados] = useState<DadosComando | null>(null);
  const [ciclo, setCiclo] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [leitura, setLeitura] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [buscaTarefa, setBuscaTarefa] = useState("");
  const [limite, setLimite] = useState(8);
  const [agenteId, setAgenteId] = useState<string | null>(null);
  const [tarefaId, setTarefaId] = useState<string | null>(null);
  const [etapa, setEtapa] = useState(0);
  const [acompanhamento, setAcompanhamento] = useState<"Execuções" | "Decisões">("Execuções");
  const [agenteAcompanhamento, setAgenteAcompanhamento] = useState<string | null>(null);
  const [filtroAtencao, setFiltroAtencao] = useState<"TODOS" | "FUNDADOR" | "ATRASOS">("TODOS");
  const [filtroStatus, setFiltroStatus] = useState("TODOS");
  const origemDrawer = useRef<HTMLElement | null>(null);
  const corpoModal = useRef<HTMLDivElement | null>(null);
  useEffect(() => { if (corpoModal.current) corpoModal.current.scrollTop = 0; }, [tarefaId, agenteId]);
  function abrirAgente(id: string) {
    origemDrawer.current = document.activeElement as HTMLElement;
    setAgenteId(id);
  }
  function abrirTarefa(id: string) {
    if (!agenteId && !tarefaId) origemDrawer.current = document.activeElement as HTMLElement;
    setAgenteId(null);
    setTarefaId(id);
  }

  useEffect(() => {
    const controller = new AbortController();
    let ativa = true;
    setCarregando(true);
    async function ler() {
      const resultados = await Promise.all(consultas.map(async ([chave, tabela, campos, ordem]) => {
        try {
          const resposta = await lerPaginas((inicio, fim) => supabase.from(tabela).select(campos, { count: "exact" }).order(ordem).range(inicio, fim).abortSignal(controller.signal), controller.signal);
          return [chave, fonteResultado(resposta)] as const;
        } catch {
          return [chave, { rows: [], estado: "erro" }] as const;
        }
      }));
      if (!ativa) return;
      setDados(Object.fromEntries(resultados) as unknown as DadosComando);
      setLeitura(new Date().toISOString());
      setCarregando(false);
    }
    void ler();
    const timer = window.setTimeout(() => controller.abort(), 20000);
    return () => { ativa = false; controller.abort(); window.clearTimeout(timer); };
  }, [ciclo]);

  useEffect(() => {
    const timer = window.setInterval(() => { if (!document.hidden) setCiclo(n => n + 1); }, 30000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => { setTarefaId(null); setAgenteId(null); setAgenteAcompanhamento(null); setFiltroStatus("TODOS"); setFiltroAtencao("TODOS"); }, [currentBusinessId]);
  useEffect(() => { setLimite(8); }, [buscaTarefa, filtroStatus, filtroAtencao, currentBusinessId]);

  const escopo = isConsolidated ? "GRUPO" : currentBusinessId;
  const tarefas = useMemo(() => (dados?.tarefas.rows ?? []).filter(t => noEscopo(t.business_id, escopo)), [dados, escopo]);
  const agentes = dados?.agentes.rows ?? [];
  const foco = dados?.focos.rows.filter(f => normalizar(f.status) === "EM EXECUCAO") ?? [];
  const handoffs = (dados?.handoffs.rows ?? []).filter(h => noEscopo(h.business_id_area, escopo) && !encerrada(h.status));
  const grupos = agruparStatus(tarefas);
  const planoPersistido = dados?.checkpoint.estado === "ok" ? planoDoCheckpoint(dados.checkpoint.rows[0]?.snapshot) : null;
  const planoVisivel = planoPersistido ?? planoEvolucao;
  const abertos = tarefas.filter(t => !encerrada(t.status));
  const disponivel = dados?.tarefas.estado === "ok";
  const falhas = dados ? consultas.filter(([k]) => dados[k].estado !== "ok").map(([,t]) => t) : [];
  const agentesFiltrados = agentes.filter(a => normalizar(`${a.agente} ${a.cargo_funcao}`).includes(normalizar(busca)));
  const agente = agentes.find(a => a.agent_id === agenteId);
  const execucoesAgente = agente ? (dados?.jobs.rows ?? []).filter(j => j.agent_id === agente.agent_id && noEscopo(j.business_id, escopo)).slice().sort((a,b) => (b.updated_at || "").localeCompare(a.updated_at || "")) : [];
  const jobsVisiveis = (dados?.jobs.rows ?? []).filter(j => noEscopo(j.business_id, escopo));
  const jobsNaFila = dados?.eventos.estado === "ok" ? jobsVisiveis.filter(j => faseJob(j, eventosDoJob(j, dados.eventos.rows)) === "FILA").length : null;
  const jobsEncerrados = jobsVisiveis.filter(j => faseJob(j, []) === "ENCERRADO").length;
  const tarefa = tarefas.find(t => t.task_id === tarefaId);
  const porAgente = agentes.map(a => ({ a, n: abertos.filter(t => atribuidoA(t.responsavel, a)).length })).filter(x => x.n > 0).sort((a,b) => b.n - a.n);
  const listaTarefas = tarefas.filter(t => filtroAtencao === "TODOS" || (filtroAtencao === "FUNDADOR" ? requerFundador(t) : atrasada(t))).filter(t => normalizar(`${t.task_id} ${t.tarefa} ${t.responsavel}`).includes(normalizar(buscaTarefa))).filter(t => filtroStatus === "TODOS" || (filtroStatus === "OUTROS" ? !grupos.slice(0,5).some(g => normalizar(g.id) === normalizar(t.status)) : normalizar(t.status) === normalizar(filtroStatus)));
  const recentes = tarefas.filter(t => t.atualizado_em).slice().sort((a,b) => Date.parse(b.atualizado_em!) - Date.parse(a.atualizado_em!)).slice(0,5);

  const tarefasNavegaveis = aba === "Tarefas" ? listaTarefas : tarefas;
  const indiceTarefa = tarefa ? tarefasNavegaveis.findIndex(t => t.task_id === tarefa.task_id) : -1;
  function mostrarTarefas(status = "TODOS") { setFiltroAtencao("TODOS"); setFiltroStatus(status); setAba("Tarefas"); }
  function verFila(filtro: PriorityFilter) {
    mostrarTarefas(filtro === "BLOQUEADA" ? "BLOQUEADA" : "TODOS");
    setFiltroAtencao(filtro === "BLOQUEADA" ? "TODOS" : filtro);
    setBuscaTarefa("");
  }

  function cardTarefa(t: TarefaComando) {
    return <button key={t.task_id} className={`hc-task ${normalizar(t.status) === "BLOQUEADA" ? "is-blocked" : ""}`} onClick={() => abrirTarefa(t.task_id)}>
      <span className="hc-task-top"><span>{t.task_id} · {t.business_id || "Escopo não informado"}</span><Status>{t.status || "Sem status"}</Status></span>
      <strong>{resumoExecutivoTarefa(t)}</strong><span className="hc-task-bottom"><span>{t.responsavel || "Responsável não informado"}</span><span className="hc-open-task">Abrir tarefa <ArrowUpRight size={16} /></span></span>
    </button>;
  }

  return <section className="hc" aria-label="Sala de comando da Helena">
    <header className="hc-heading hc-heading-compact">
      <div><h1>Sala de comando<span>.</span></h1><p><strong>{isConsolidated ? "Grupo consolidado" : rotulo}</strong><span> · {isConsolidated ? "Visão dos negócios" : "Empresa selecionada + grupo e sistema"}</span></p></div>
      <div className="hc-header-actions"><details className="hc-update-details"><summary><ShieldCheck size={15}/> Consulta e fonte</summary><div><strong>Última consulta: {dataHora(leitura)}</strong><p>Consulta a cada 30 s enquanto a página está visível. As leituras não acionam agentes nem aprovam tarefas.</p><p>Dados permitidos pela sua sessão. A leitura do banco e as regras de execução permanecem separadas da apresentação.</p></div></details><button className="hc-button" aria-label="Atualizar dados" disabled={carregando} onClick={() => setCiclo(n => n + 1)}><RefreshCw size={16} className={carregando ? "animate-spin" : ""}/><span>{carregando ? "Consultando…" : "Atualizar"}</span></button></div>
    </header>
    {falhas.length > 0 && <div className="hc-warning" role="alert">Leitura incompleta: {falhas.join(", ")}. Indicadores podem estar indisponíveis ou parciais; isso não significa ausência de trabalho. Tente atualizar.</div>}
    <nav className="hc-tabs" aria-label="Seções da sala de comando">{abasPrincipais.map(a => <button key={a} aria-current={aba === a ? "page" : undefined} onClick={() => {setAba(a); if (a === "Acompanhamento") setAgenteAcompanhamento(null);}}>{a}{a === "Agentes" && dados?.agentes.estado === "ok" && <span>{agentes.length}</span>}</button>)}<details className="hc-nav-more"><summary aria-label="Mais seções">Mais {abasAvancadas.includes(aba) && <span>•</span>}</summary><div>{abasAvancadas.map(a => <button key={a} aria-current={aba === a ? "page" : undefined} onClick={e => {setAba(a); e.currentTarget.closest("details")?.removeAttribute("open");}}>{a}</button>)}</div></details></nav>

    {(aba === 'Supervisão' || aba === 'Empresas' || aba === 'Consumo') && <SupervisionPanel key={`${aba}-${escopo}`} dados={dados} tarefas={tarefas} modo={aba} abrirTarefa={abrirTarefa} abrirAgente={abrirAgente}/>}

    {aba === "Visão geral" && <div className="hc-stack">
      <CommandPriorities tarefas={tarefas} disponivel={disponivel} abrirTarefa={abrirTarefa} verFila={verFila}/>
      <ProcessBoard tarefas={tarefas} disponivel={disponivel} consolidado={isConsolidated} escopo={escopo} nomeEmpresa={nomeDe} abrirTarefa={abrirTarefa}/>
      <div className="hc-flow-links"><button onClick={() => {setAgenteAcompanhamento(null);setAcompanhamento("Execuções");setAba("Acompanhamento");}}><span>JOBS DOS AGENTES</span><strong>{dados?.jobs.estado === "ok" ? jobsVisiveis.length : "—"} jobs registrados</strong><small>{dados?.jobs.estado === "ok" && jobsNaFila !== null ? `${jobsNaFila} na fila · ${jobsEncerrados} encerrados · abrir origem e passos` : "Ver origem, etapas e evidências"} <ArrowUpRight size={14}/></small></button><button onClick={() => {setAcompanhamento("Decisões");setAba("Acompanhamento");}}><span>DECISÕES REGISTRADAS</span><strong>{dados?.decisoes.estado === "ok" ? dados.decisoes.rows.filter(d => noEscopo(d.business_id, escopo)).length : "—"} decisões</strong><small>Ver decisor, motivo e fonte <ArrowUpRight size={14}/></small></button></div>
      <section className="hc-company-overview" aria-label="Entregas por empresa"><div className="hc-section-heading hc-row"><div><span className="hc-eyebrow">ENTREGAS POR EMPRESA</span><h2>Cada negócio com sua própria fila</h2></div><button className="hc-text-button" onClick={()=>setAba('Empresas')}>Ver distribuição completa <ArrowRight size={16}/></button></div><div className="hc-company-strip">{distribuirEmpresas(tarefas).map(f=><button key={f.id} onClick={()=>setAba('Empresas')}><small>{f.id}</small><strong>{normalizar(f.id) === 'GRUPO' ? 'Compartilhado do grupo' : normalizar(f.id) === 'SISTEMA' ? 'Operação do sistema' : nomeDe?.(f.id) || f.id}</strong><span>{disponivel ? f.abertas : '—'} abertas · {disponivel ? f.bloqueadas : '—'} bloqueadas</span></button>)}</div>{!tarefas.length && <p className="hc-empty">{disponivel ? 'Sem entregas visíveis neste recorte.' : 'Aguardando leitura das entregas.'}</p>}</section>
      <div className="hc-two">
        <article className="hc-card"><div className="hc-section-heading"><div className="hc-eyebrow">PANORAMA DA OPERAÇÃO</div><h2>Distribuição das tarefas</h2><p>Clique em uma faixa para inspecionar os registros.</p></div>
          {disponivel ? <div className="hc-bars">{grupos.filter(g => g.n || g.id !== "OUTROS").map(g => <button key={g.id} className="hc-bar-item" aria-pressed={filtroStatus === g.id} onClick={() => mostrarTarefas(g.id)}><span>{g.id}<strong>{g.n}</strong></span><span className="hc-track"><span style={{ width: `${tarefas.length ? g.n / tarefas.length * 100 : 0}%`, background: g.cor }} /></span></button>)}</div> : <p className="hc-empty">Distribuição indisponível até a leitura completa.</p>}
          <small>{tarefas.length} registros visíveis{!disponivel ? " (leitura não confirmada)" : ""}. Esta contagem não é percentual de qualidade.</small>
        </article>
        <article className="hc-card"><div className="hc-section-heading"><div className="hc-eyebrow">EQUIPE EM FOCO</div><h2>Onde o trabalho se concentra</h2><p>Tarefas abertas atribuídas; não mede esforço ou produtividade.</p></div>
          {disponivel && dados?.agentes.estado === "ok" ? <div className="hc-workload">{porAgente.slice(0,6).map(({a,n}) => <button key={a.agent_id} onClick={() => abrirAgente(a.agent_id)}><AgentAvatar agentId={a.agent_id} nome={a.agente} size={32}/><span>{a.agente}<span className="hc-track"><span style={{width: `${n / Math.max(...porAgente.map(p => p.n),1)*100}%`}} /></span></span><strong>{n}</strong><ArrowUpRight size={15}/></button>)}{!porAgente.length && <p className="hc-empty">Sem atribuições reconhecidas neste recorte.</p>}</div> : <p className="hc-empty">Atribuições indisponíveis até a leitura completa.</p>}
          <small>Mostra até 6 agentes. Uma tarefa compartilhada conta para cada participante. Vínculos inferidos do campo responsável.</small>
        </article>
      </div>

        <article className="hc-focus hc-direction-summary">
          <div className="hc-focus-head"><span>PRIORIDADE EXECUTIVA</span><Status>{dados?.focos.estado === "ok" ? `${foco.length} frente(s) registrada(s) em execução` : "Frentes não confirmadas"}</Status></div>
          <h2>{!dados || dados.focos.estado !== "ok" ? "Consultando a direção atual" : foco[0]?.frente || "Foco em execução não visível"}</h2>
          <p>{foco[0]?.objetivo || "O foco precisa ser confirmado na fonte antes de orientar novas entregas."}</p>
          <div className="hc-focus-footer"><AgentAvatar agentId="AGT-01" nome="Helena" size={40}/><div><small>RESPONSÁVEL REGISTRADO</small><strong>{foco[0]?.responsavel || "Não confirmado"}</strong></div><Link to="/modulo/foco_executivo">Consultar foco <ArrowUpRight size={18} /></Link></div>
          {foco.length > 1 && <p role="alert">Há mais de uma frente executiva ativa. Revisar o limite WIP = 1.</p>}
        </article>
      <div className="hc-metrics">
        {[{ label: "Tarefas abertas", value: disponivel ? abertos.length : "—", hint: "Exceto concluídas e canceladas" }, { label: "Em execução", value: disponivel ? grupos[1].n : "—", hint: "Status registrado da tarefa" }, { label: "Passagens pendentes", value: dados?.handoffs.estado === "ok" ? handoffs.length : "—", hint: "Handoffs no recorte selecionado" }, { label: "Execução dos agentes", value: "A validar", hint: "Conexão não comprova operação" }].map(m => <article className="hc-metric" key={m.label}><p>{m.label}</p><strong>{m.value}</strong><small>{m.hint}</small></article>)}
      </div>
      <article className="hc-card"><div className="hc-section-heading"><div className="hc-eyebrow">MOVIMENTAÇÕES RECENTES</div><h2>Últimas alterações das tarefas</h2><p>Retrato da última atualização de cada registro. Abra a tarefa para consultar alterações auditadas e execuções que tenham vínculo explícito.</p></div><div className="hc-timeline">{recentes.map(t => <button key={t.task_id} onClick={() => abrirTarefa(t.task_id)}><span className="hc-timeline-dot"/><time>{dataHora(t.atualizado_em)}</time><span><strong>{t.task_id} · {t.tarefa}</strong><small>{t.responsavel} · {t.status}</small></span><ArrowUpRight size={16}/></button>)}</div>{!recentes.length && <p className="hc-empty">Sem atualização com horário visível neste recorte.</p>}</article>
    </div>}

    {aba === "Tarefas" && <div className="hc-stack"><article className="hc-card" id="hc-tarefas"><div className="hc-section-heading hc-row"><div><div className="hc-eyebrow">CENTRAL DE ENTREGAS</div><h2>Toda tarefa tem um próximo passo.</h2></div><label className="hc-select">Status<select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}><option value="TODOS">Todos</option>{grupos.map(g => <option key={g.id}>{g.id}</option>)}</select></label></div><label className="hc-search hc-task-search"><Search size={18}/><input aria-label="Buscar tarefa ou responsável" placeholder="Buscar por tarefa, responsável ou código…" value={buscaTarefa} onChange={e => setBuscaTarefa(e.target.value)}/><span>{listaTarefas.length} registros</span></label>{filtroAtencao !== "TODOS" && <div className="hc-active-filter"><span>Mostrando: {filtroAtencao === "FUNDADOR" ? "Precisa de você" : "Prazo vencido"}</span><button onClick={()=>setFiltroAtencao("TODOS")}>Limpar filtro <X size={14}/></button></div>}<div className="hc-task-grid">{listaTarefas.slice(0,limite).map(cardTarefa)}</div>{!listaTarefas.length && <p className="hc-empty">{disponivel ? "Nenhuma tarefa visível para este filtro." : "Consulta de tarefas ainda não confirmada."}</p>}{listaTarefas.length > limite && <button className="hc-button hc-load-more" onClick={() => setLimite(n => n+8)}>Mostrar mais tarefas <ChevronRight size={16}/></button>}</article></div>}

    {aba === "Agentes" && <div className="hc-stack"><div className="hc-section-heading hc-row"><div><div className="hc-eyebrow">ESTRUTURA CORPORATIVA</div><h2>Uma função clara. Uma entrega verificável.</h2><p>Abra um agente para ver missão, limites, entregas e tarefas no recorte atual.</p></div><label className="hc-search"><Search size={18}/><input aria-label="Buscar agente ou função" placeholder="Buscar agente ou função" value={busca} onChange={e => setBusca(e.target.value)} /></label></div><div className="hc-agent-grid">{agentesFiltrados.map(a => { const n = abertos.filter(t => atribuidoA(t.responsavel,a)).length; const con = dados?.conexoes.rows.find(c => c.agent_id === a.agent_id); return <button className="hc-agent" key={a.agent_id} onClick={() => abrirAgente(a.agent_id)}><div className="hc-agent-top"><AgentAvatar agentId={a.agent_id} nome={a.agente} size={48}/><ArrowUpRight size={18}/></div><small>{a.agent_id} · {a.status || "Cadastro sem status"}</small><h3>{a.agente}</h3><p>{a.cargo_funcao}</p><div className="hc-agent-mission">{a.missao || "Missão não registrada."}</div><div className="hc-agent-bottom"><span>{disponivel ? `${n} tarefa(s) aberta(s)` : "Tarefas não confirmadas"}</span><span>{dados?.conexoes.estado !== "ok" ? "Conexão indisponível" : con?.connection_status === "CONNECTED" ? "Conexão registrada" : con?.connection_status || "Conexão não confirmada"}</span></div></button>; })}</div>{!agentesFiltrados.length && <p className="hc-empty">{dados?.agentes.estado === "ok" ? "Nenhum agente visível para esta busca." : "Leitura dos agentes não confirmada."}</p>}<div className="hc-note"><CircleHelp size={20}/><p>Conexão, cadastro ativo e tarefa atribuída são informações diferentes. A execução só será comprovada por eventos, resultado e evidência. Agentes sem tarefas visíveis não são classificados como ociosos.</p></div></div>}

    {aba === "Processo" && <ProcessBoard tarefas={tarefas} disponivel={disponivel} consolidado={isConsolidated} escopo={escopo} nomeEmpresa={nomeDe} abrirTarefa={abrirTarefa}/>}
    {aba === "Processo" && <div className="hc-stack"><div className="hc-section-heading"><div className="hc-eyebrow">MODELO PROPOSTO / NÃO É UMA EXECUÇÃO EM ANDAMENTO</div><h2>Cada direção com começo, dono e retorno.</h2><p>Selecione uma etapa para entender quem responde e o que falta conectar.</p></div><div className="hc-process">{passos.map((p,i) => <button key={p.nome} aria-pressed={etapa === i} onClick={() => setEtapa(i)}><span>{String(i+1).padStart(2,"0")}</span><strong>{p.nome}</strong><small>{p.dono}</small></button>)}</div><article className="hc-card hc-process-detail"><Waypoints size={28}/><div><Status>Etapa {etapa+1} · {passos[etapa].dono}</Status><h2>{passos[etapa].nome}</h2><p>{passos[etapa].texto}</p><Campo titulo="O que já existe" valor={passos[etapa].fonte}/><Campo titulo="O que precisa ser ajustado" valor={passos[etapa].falta}/></div></article><div className="hc-two"><article className="hc-card"><h2>O que você deve enxergar</h2><ul className="hc-list"><li>Pedido original, objetivo e empresa.</li><li>Responsável, etapa atual, prazo e dependências.</li><li>Ações registradas, horários e resultado de cada etapa.</li><li>Falhas, tentativas, bloqueios e quem pode destravar.</li><li>Evidência, validação, decisão e retorno da Helena.</li></ul></article><article className="hc-card"><h2>O significado de acompanhar 100%</h2><p>Cobrir todos os caminhos de execução com registros verificáveis, incluindo falhas e ações externas. A cobertura atual ainda não está comprovada.</p><p>O painel deve mostrar ações, justificativas resumidas e evidências. Não pode inventar etapas nem apresentar raciocínio interno dos modelos como registro de auditoria.</p></article></div></div>}

    {aba === "Cobertura" && <CoveragePanel jobs={dados?.jobs}/>}

    {aba === "Plano de evolução" && <div className="hc-stack"><div className="hc-section-heading"><div className="hc-eyebrow">ANÁLISE DO CÓDIGO E SUPABASE / 26 SET 2026</div><h2>Primeiro confiança. Depois amplitude.</h2><p>{planoPersistido ? "Proposta recuperada do Checkpoint Mestre no Supabase." : "Proposta local: o planejamento persistido não pôde ser confirmado nesta leitura."} Responsáveis abaixo são sugestões; este plano não abre tarefas nem muda o foco executivo.</p></div><div className="hc-note"><ShieldCheck size={22}/><p><strong>Base preservada:</strong> login, empresas, módulos, agentes e dados atuais. Esta sala acrescenta uma leitura executiva. Consulte a aba Supervisão para ver a situação da revisão agendada e a tarefa de implantação para conferir sua homologação.</p></div>{planoVisivel.map(p => <article className="hc-card hc-roadmap" key={p.fase}><span className="hc-phase">{p.fase}</span><div><div className="hc-row"><h2>{p.titulo}</h2><Status>{p.estado}</Status></div><p className="hc-owner">Coordenação proposta: {p.dono}</p><div className="hc-two"><Campo titulo="O que já temos" valor={p.existe}/><Campo titulo="Lacuna observada" valor={p.lacuna}/></div><Campo titulo="Ajuste proposto" valor={p.ajuste}/><div className="hc-accept"><strong>Como comprovar</strong><p>{p.aceite}</p></div></div></article>)}<article className="hc-card"><h2>Controles antes de ampliar a operação</h2><ul className="hc-list"><li>O cliente de integrações já exige a sessão JWT do Supabase; confirmar a autorização de cada rota no Gateway implantado.</li><li>Validar identidade do executor antes de retomar despachos: há uma exceção registrada de atribuição ao agente incorreto.</li><li>Separar permissões do fundador, da Helena e dos especialistas; permissões declaradas no cadastro não comprovam restrição técnica.</li><li>Validar o checkpoint ativo contra o estado atual após mudanças materiais, preservando o histórico.</li><li>Manter os problemas do aplicativo de Saúde separados dos problemas do Helena-HUB; são escopos diferentes.</li></ul><p>Esses ajustes precisam de implementação e validação próprias. A política de decisões foi restringida à empresa autorizada; as demais regras dependem de validação própria.</p></article><article className="hc-card"><h2>Critérios para o novo design</h2><p>Hierarquia clara, leitura confortável, cores com significado, estados vazios honestos, gráficos com origem e detalhes por clique. Navegação progressiva e uso por teclado devem ser verificados em cada etapa.</p><a className="hc-text-button" href="https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html" target="_blank" rel="noreferrer">Referência: WCAG 2.2 — tamanho dos alvos <ArrowUpRight size={16}/></a></article></div>}

    {aba === "Acompanhamento" && <div className="hc-stack"><div className="hc-follow-tabs" role="group" aria-label="Tipo de acompanhamento"><button aria-pressed={acompanhamento === "Execuções"} onClick={() => setAcompanhamento("Execuções")}>Fila e execuções</button><button aria-pressed={acompanhamento === "Decisões"} onClick={() => setAcompanhamento("Decisões")}>Decisões registradas</button></div>{acompanhamento === "Execuções" ? <ExecutionPanel key={escopo} dados={dados} escopo={escopo} agenteId={agenteAcompanhamento} limparAgente={() => setAgenteAcompanhamento(null)}/> : <DecisionPanel dados={dados} escopo={escopo}/>}</div>}

    <footer className="hc-footer"><span>HELENA / DECIDIR · EXECUTAR · COMPROVAR</span><Link to="/execucao">Abrir central existente <ArrowUpRight size={14}/></Link></footer>
    <Dialog.Root open={!!agente || !!tarefa} onOpenChange={open => { if (!open) { setAgenteId(null); setTarefaId(null); } }}><Dialog.Portal><Dialog.Overlay className="hc-modal-overlay"/><Dialog.Content onCloseAutoFocus={event => { event.preventDefault(); origemDrawer.current?.focus(); }} className={tarefa ? "hc-modal" : "hc-modal hc-agent-modal"}>
      <header className="hc-modal-header"><div><span className="hc-eyebrow"><Layers3 size={14}/>{tarefa ? "ESPAÇO DA ENTREGA" : "PERFIL DO ESPECIALISTA"}</span>
      <Dialog.Title>{agente ? `${agente.agente} · ${agente.cargo_funcao}` : tarefa?.tarefa || "Detalhes"}</Dialog.Title><Dialog.Description>{agente ? "Responsabilidades e entregas no recorte selecionado." : "Responsável, dependências e evidência em um só lugar."}</Dialog.Description></div><Dialog.Close className="hc-modal-close" aria-label="Fechar detalhes"><X size={20}/></Dialog.Close></header><div ref={corpoModal} className="hc-modal-body">
      {agente && <><div className="hc-drawer-avatar"><AgentAvatar agentId={agente.agent_id} nome={agente.agente} size={64}/><Status>{agente.agent_id}</Status></div><Campo titulo="Missão" valor={agente.missao}/><Campo titulo="Quando ativar" valor={agente.quando_ativar}/><Campo titulo="Entrega obrigatória" valor={agente.saida_obrigatoria}/><Campo titulo="O que pode atualizar — regra declarada" valor={agente.pode_atualizar}/><Campo titulo="Para quem escalar — cadastro atual" valor={agente.escalar_para}/><details className="hc-details"><summary>Contexto que deve ler antes de responder</summary><p>{agente.ler_antes_de_responder || "Não registrado."}</p></details><div className="hc-accept"><strong>Indicadores propostos para esta função</strong><p>{indicadoresPropostos[agente.agent_id] || "A definir com a Helena."}</p><small>Proposta de medição; resultados ainda não calculados.</small></div><h3 className="hc-subheading">Tarefas visíveis deste agente</h3>{tarefas.filter(t => atribuidoA(t.responsavel,agente)).map(cardTarefa)}{!tarefas.some(t => atribuidoA(t.responsavel,agente)) && <p>Sem tarefas vinculadas visíveis neste recorte.</p>}<h3 className="hc-subheading">Passagens pendentes relacionadas</h3>{handoffs.filter(h => atribuidoA(h.de,agente) || atribuidoA(h.para,agente)).map(h => <div className="hc-field" key={h.id}><h3>{h.id} · {h.status}</h3><p>{h.assunto}</p><small>{h.de} → {h.para}</small></div>)}<p className="hc-caption">Associações pelo campo de responsável. Para rastreio definitivo, a fase 02 propõe vínculos por identificador.</p></>}
      {agente && <section className="hc-agent-runs"><h3>Jobs registrados deste agente</h3>{dados?.jobs.estado !== "ok" ? <p>Leitura da fila indisponível ou parcial.</p> : execucoesAgente.length ? <><div>{execucoesAgente.slice(0,5).map(j => <div key={j.job_id}><span>{j.job_id} · {j.business_id || "Sem empresa"}</span><strong>{j.objective || "Sem objetivo resumido"}</strong><small>{desfechoJob(j) || rotuloFase[faseJob(j, dados?.eventos.estado === "ok" ? eventosDoJob(j, dados.eventos.rows) : [])]} · {j.attempt_count} de {j.max_attempts} tentativas</small></div>)}</div><button className="hc-text-button" onClick={() => {setAgenteAcompanhamento(agente.agent_id);setAgenteId(null);setAcompanhamento("Execuções");setAba("Acompanhamento");}}>Ver eventos e evidências <ArrowUpRight size={16}/></button></> : <p>Nenhum job vinculado ao identificador deste agente no recorte.</p>}<small>Estar conectado não comprova execução; esta lista usa somente jobs registrados.</small></section>}
      {tarefa && <TaskBrief tarefa={tarefa} agentes={agentes} dados={dados}/>}
      </div><footer className="hc-modal-footer"><span>{tarefa ? "Último registro: " + dataHora(tarefa.atualizado_em) : "Permissões descritas conforme cadastro do agente"}</span>{tarefa && <div className="hc-modal-navigation"><button aria-label="Tarefa anterior" disabled={indiceTarefa <= 0} onClick={() => setTarefaId(tarefasNavegaveis[indiceTarefa-1].task_id)}><ChevronLeft size={18}/></button><span>{indiceTarefa+1} / {tarefasNavegaveis.length}</span><button aria-label="Próxima tarefa" disabled={indiceTarefa >= tarefasNavegaveis.length-1} onClick={() => setTarefaId(tarefasNavegaveis[indiceTarefa+1].task_id)}><ChevronRight size={18}/></button></div>}</footer>
    </Dialog.Content></Dialog.Portal></Dialog.Root>
  </section>;
}
