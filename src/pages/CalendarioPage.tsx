import { useEffect, useMemo, useState, useRef } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  ListTodo,
  Table2,
  CalendarSearch,
} from "lucide-react";
import { useBusiness } from "@/contexts/BusinessContext";
import { Link } from 'react-router-dom';
import {
  carregarAgenda,
  parseDataAgenda,
  type EventoAgenda,
  type TarefaRow,
} from "@/lib/agenda-unificada";
import { TarefaAgendaModal, type AcaoTarefaModal } from "@/components/tarefas/TarefaAgendaModal";
import { concluirTarefa, concluirTarefaPorId } from "@/lib/tarefa-acoes";
import { ExecutivePageHeader } from "@/components/executive/ExecutivePageHeader";
import { ExecutiveLoadingState } from "@/components/executive/ExecutiveLoadingState";
import { ExecutiveErrorState } from "@/components/executive/ExecutiveErrorState";
import { ExecutiveEmptyState } from "@/components/executive/ExecutiveEmptyState";
import { SeloOrigemDados } from "@/components/executive/SeloOrigemDados";

function idTarefaDeEvento(ev: EventoAgenda) {
  if (ev.related_object_type === "tarefas" && ev.related_object_id) return ev.related_object_id;
  if (ev.event_id.startsWith("EVT-TSK-")) return ev.event_id.replace("EVT-TSK-", "");
  return null;
}

const STATUS_CONCLUIDOS = /CONCLU|FEIT|ENTREGUE|CANCEL|ARQUIV/i;

export default function CalendarioPage() {
  const { currentBusinessId, isConsolidated, selecionadas, todasLigadas, nomeDe, loading: businessLoading, error: businessError } = useBusiness();
  const [mes, setMes] = useState(() => startOfMonth(new Date()));
  const [diaSel, setDiaSel] = useState<Date>(new Date());
  const [eventos, setEventos] = useState<EventoAgenda[]>([]);
  const [semData, setSemData] = useState<TarefaRow[]>([]);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [modo, setModo] = useState<"calendario" | "agenda">("calendario");
  const [modalTarefas, setModalTarefas] = useState(false);
  const [taskIdModal, setTaskIdModal] = useState<string | null>(null);
  const [acaoModal, setAcaoModal] = useState<AcaoTarefaModal>(null);
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "tarefa" | "calendario">("todos");
  const [filtroEmpresa, setFiltroEmpresa] = useState("TODAS");
  const [ocultarConcluidos, setOcultarConcluidos] = useState(false);
  const [periodoAgenda, setPeriodoAgenda] = useState<"todos" | "futuros" | "mes">("todos");

  const abrirTarefa = (taskId: string, acao: AcaoTarefaModal = null) => {
    setTaskIdModal(taskId);
    setAcaoModal(acao);
    setModalTarefas(true);
  };

  const abrirListaTarefas = (acao: AcaoTarefaModal = null) => {
    setTaskIdModal(null);
    setAcaoModal(acao);
    setModalTarefas(true);
  };

  const concluirRapido = async (taskId: string, businessId: string) => {
    const resultado = await concluirTarefaPorId(taskId, businessId);
    if (resultado.erro) { setErro(resultado.erro); return; }
    await recarregar();
  };

  const concluirSemData = async (tarefa: TarefaRow) => {
    const resultado = await concluirTarefa(tarefa);
    if (resultado.erro) { setErro(resultado.erro); return; }
    await recarregar();
  };

  const agendaRequest = useRef<AbortController | null>(null);
  const selecaoKey = selecionadas.join("|");
  const recarregar = async () => {
    agendaRequest.current?.abort();
    const controller = new AbortController();
    agendaRequest.current = controller;
    const timer = window.setTimeout(() => controller.abort(), 20000);
    setCarregando(true);setErro("");setEventos([]);setSemData([]);
    try {
      const { eventos: lista, semData: pendentes, erro: msg } = await carregarAgenda(selecionadas, todasLigadas, controller.signal);
      if (agendaRequest.current !== controller) return;
      setErro(msg);setEventos(lista);setSemData(pendentes);
    } catch {
      if (agendaRequest.current === controller) setErro("Não foi possível carregar a agenda. Tente novamente.");
    } finally {
      window.clearTimeout(timer);
      if (agendaRequest.current === controller) setCarregando(false);
    }
  };

  useEffect(() => {
    if (businessLoading || businessError) {
      agendaRequest.current?.abort();
      agendaRequest.current = null;
      setEventos([]);
      setSemData([]);
      return;
    }
    void recarregar();
    return () => { agendaRequest.current?.abort(); agendaRequest.current = null; };
  }, [currentBusinessId, isConsolidated, selecaoKey, todasLigadas, businessLoading, businessError]);

  const eventosComData = useMemo(() => {
    return eventos
      .map((e) => ({ ...e, quando: parseDataAgenda(e.inicio) }))
      .filter((e) => e.quando);
  }, [eventos]);

  const empresasNaAgenda = useMemo(() => [...new Set(eventosComData.map((e) => e.business_id).filter(Boolean))].sort(), [eventosComData]);
  const filtrando = filtroTipo !== "todos" || filtroEmpresa !== "TODAS" || ocultarConcluidos;
  const limparFiltros = () => { setFiltroTipo("todos"); setFiltroEmpresa("TODAS"); setOcultarConcluidos(false); };

  // Os filtros valem para o mês e para a agenda; os contadores do mês mostram o que sobrou deles.
  const visiveis = useMemo(() => eventosComData.filter((e) => {
    if (filtroTipo !== "todos" && e.origem !== filtroTipo) return false;
    if (filtroEmpresa !== "TODAS" && e.business_id !== filtroEmpresa) return false;
    if (ocultarConcluidos && STATUS_CONCLUIDOS.test(e.status ?? "")) return false;
    return true;
  }), [eventosComData, filtroTipo, filtroEmpresa, ocultarConcluidos]);

  const grade = useMemo(() => {
    const ini = startOfWeek(startOfMonth(mes), { weekStartsOn: 0 });
    const fim = endOfWeek(endOfMonth(mes), { weekStartsOn: 0 });
    return eachDayOfInterval({ start: ini, end: fim });
  }, [mes]);

  const porDia = useMemo(() => {
    const mapa = new Map<string, EventoAgenda[]>();
    for (const ev of visiveis) {
      const chave = format(ev.quando!, "yyyy-MM-dd");
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave)!.push(ev);
    }
    return mapa;
  }, [visiveis]);

  const doDia = porDia.get(format(diaSel, "yyyy-MM-dd")) || [];

  const listaOrdenada = useMemo(() => {
    const inicioHoje = new Date(); inicioHoje.setHours(0, 0, 0, 0);
    return visiveis
      .filter((e) => periodoAgenda === "futuros" ? e.quando!.getTime() >= inicioHoje.getTime() : periodoAgenda === "mes" ? isSameMonth(e.quando!, mes) : true)
      .sort((a, b) => a.quando!.getTime() - b.quando!.getTime());
  }, [visiveis, periodoAgenda, mes]);

  const resumo = useMemo(() => {
    const hoje = new Date();
    const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const emSete = new Date(inicioHoje); emSete.setDate(emSete.getDate() + 8);
    return {
      hoje: visiveis.filter((e) => isSameDay(e.quando!, hoje)).length,
      proximos7: visiveis.filter((e) => e.quando! >= inicioHoje && e.quando! < emSete).length,
      mes: visiveis.filter((e) => isSameMonth(e.quando!, mes)).length,
    };
  }, [visiveis, mes]);

  if (businessLoading) return <ExecutiveLoadingState message="Carregando empresas da agenda..." />;
  if (businessError) return <ExecutiveErrorState title="Erro ao carregar as empresas" message={businessError} />;
  if (carregando) {
    return <div className="he-calendar-page space-y-6"><ExecutivePageHeader icon={CalendarIcon} title="Calendário" description="Compromissos e entregas, no mesmo lugar."/><ExecutiveLoadingState message="Lendo calendário e tarefas da agenda unificada..." /></div>;
  }

  return (
    <div className="he-calendar-page space-y-6">
      <ExecutivePageHeader
        icon={CalendarIcon}
        title="Calendário"
        description="Gestão unificada de compromissos, tarefas com prazo e entregas estratégicas"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/modulo/calendario"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/70"
            >
              <Table2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Cadastro</span>
            </Link>
            <button
              type="button"
              onClick={() => abrirListaTarefas("nova")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Nova tarefa</span>
            </button>
          </div>
        }
      />

      <SeloOrigemDados
        fontes={["calendario", "tarefas"]}
        escopo={isConsolidated ? (todasLigadas ? "Todas as empresas" : `${selecionadas.length} empresas selecionadas`) : nomeDe(currentBusinessId)}
        registros={erro ? null : eventosComData.length + semData.length}
        unidade="itens"
      />

      {erro && (
        <ExecutiveErrorState
          title="Erro no calendário"
          message={erro}
          onRetry={recarregar}
        />
      )}

      {/* Tabs Oficiais: Calendário, Agenda, Tarefas */}
      <div className="flex items-center gap-1.5 border-b border-border/50 pb-2">
        <button
          type="button"
          onClick={() => setModo("calendario")}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            modo === "calendario"
              ? "bg-foreground text-background font-semibold"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          Calendário
        </button>
        <button
          type="button"
          onClick={() => setModo("agenda")}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            modo === "agenda"
              ? "bg-foreground text-background font-semibold"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          Agenda
        </button>
        <button
          type="button"
          onClick={() => abrirListaTarefas()}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors inline-flex items-center gap-1.5"
        >
          <ListTodo className="h-3.5 w-3.5" />
          <span>Tarefas</span>
        </button>
      </div>

      {!erro && (eventosComData.length > 0 || filtrando) && (
        <div role="search" aria-label="Filtrar agenda" className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-3 sm:flex-row sm:flex-wrap sm:items-center">
          <select aria-label="Tipo de item" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value as typeof filtroTipo)} className="min-h-9 rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary">
            <option value="todos">Tarefas e compromissos</option>
            <option value="tarefa">Só tarefas com prazo</option>
            <option value="calendario">Só compromissos</option>
          </select>
          {empresasNaAgenda.length > 1 && (
            <select aria-label="Empresa" value={filtroEmpresa} onChange={(e) => setFiltroEmpresa(e.target.value)} className="min-h-9 rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary">
              <option value="TODAS">Todas as empresas</option>
              {empresasNaAgenda.map((id) => <option key={id} value={id}>{nomeDe(id)}</option>)}
            </select>
          )}
          <label className="inline-flex min-h-9 items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={ocultarConcluidos} onChange={(e) => setOcultarConcluidos(e.target.checked)} />
            Ocultar concluídos
          </label>
          {filtrando && <button type="button" onClick={limparFiltros} className="min-h-9 text-xs font-semibold text-primary hover:underline">Limpar filtros</button>}
          <p className="text-xs text-muted-foreground sm:ml-auto" aria-live="polite">
            Hoje: {resumo.hoje} · Próximos 7 dias: {resumo.proximos7} · No mês exibido: {resumo.mes}
          </p>
        </div>
      )}

      {semData.length > 0 && (
        <details className="he-undated-tasks pe-card border-amber-200 bg-amber-50/50">
          <summary><span>{semData.length} tarefas sem data definida</span><small>Abrir lista para organizar os prazos</small></summary>
          <ul className="mt-3 space-y-2 text-sm">
            {semData.map((t) => (
              <li key={t.task_id}>
                <p className="font-semibold">{t.task_id} · {t.tarefa}</p>
                <span className="text-[var(--pe-text-muted)] text-xs">{t.status}</span>
                <div className="pe-task-card-acoes mt-2">
                  <button type="button" className="pe-acao-tarefa pe-acao-tarefa--add" onClick={() => abrirTarefa(t.task_id)}>
                    Abrir
                  </button>
                  <button
                    type="button"
                    className="pe-acao-tarefa pe-acao-tarefa--done"
                    onClick={() => void concluirSemData(t)}
                  >
                    Concluir
                  </button>
                  <button type="button" className="pe-acao-tarefa pe-acao-tarefa--delegate" onClick={() => abrirTarefa(t.task_id, "delegar")}>
                    Delegar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}

      {modo === "calendario" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <section className="pe-card">
            <div className="mb-4 flex items-center justify-between">
              <button type="button" className="pe-icone" onClick={() => setMes((m) => addMonths(m, -1))} aria-label="Mês anterior">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <h2 className="text-lg font-semibold capitalize">{format(mes, "MMMM yyyy", { locale: ptBR })}</h2>
              <button type="button" className="pe-icone" onClick={() => setMes((m) => addMonths(m, 1))} aria-label="Próximo mês">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-[var(--pe-text-muted)]">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
                <div key={d} className="py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {grade.map((dia) => {
                const chave = format(dia, "yyyy-MM-dd");
                const qtd = porDia.get(chave)?.length || 0;
                const fora = !isSameMonth(dia, mes);
                const sel = isSameDay(dia, diaSel);
                return (
                  <button
                    key={chave}
                    type="button"
                    onClick={() => setDiaSel(dia)}
                    aria-label={`${format(dia, "d 'de' MMMM", { locale: ptBR })}${qtd ? `, ${qtd} ${qtd === 1 ? "item" : "itens"}` : ""}`}
                    aria-pressed={sel}
                    className={`pe-cal-dia ${fora ? "is-out" : ""} ${sel ? "is-sel" : ""} ${isSameDay(dia, new Date()) ? "is-hoje" : ""}`}
                  >
                    <span>{format(dia, "d")}</span>
                    {qtd > 0 && <span className="pe-cal-badge">{qtd}</span>}
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="pe-card">
            <p className="pe-kpi-label">Dia selecionado</p>
            <h3 className="mt-1 text-lg font-semibold capitalize">
              {format(diaSel, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </h3>
            <ul className="mt-4 space-y-3">
              {doDia.map((ev) => {
                const taskId = idTarefaDeEvento(ev);
                const conteudo = (
                  <>
                    <p className="font-semibold">{ev.titulo}</p>
                    <p className="text-xs text-[var(--pe-text-muted)]">
                      {nomeDe(ev.business_id)} · {ev.tipo || "evento"}
                      {ev.inicio && ` · ${format(parseDataAgenda(ev.inicio)!, "HH:mm")}`}
                    </p>
                    {ev.descricao && <p className="mt-1 text-xs">{ev.descricao}</p>}
                  </>
                );
                return (
                  <li key={ev.event_id}>
                    {taskId ? (
                      <div className="rounded-lg border border-[var(--pe-border)] p-3 text-sm">
                        <button type="button" onClick={() => abrirTarefa(taskId)} className="w-full text-left">
                          {conteudo}
                        </button>
                        <div className="pe-task-card-acoes">
                          <button type="button" className="pe-acao-tarefa pe-acao-tarefa--add" onClick={() => abrirTarefa(taskId)}>
                            Detalhes
                          </button>
                          <button type="button" className="pe-acao-tarefa pe-acao-tarefa--done" onClick={() => void concluirRapido(taskId, ev.business_id)}>
                            Concluir
                          </button>
                          <button
                            type="button"
                            className="pe-acao-tarefa pe-acao-tarefa--delegate"
                            onClick={() => abrirTarefa(taskId, "delegar")}
                          >
                            Delegar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-[var(--pe-border)] p-3 text-sm">
                        {conteudo}
                        {ev.related_object_type === "crm" && (
                          <Link to="/crm" className="mt-2 inline-block text-xs font-semibold text-[#007A3D]">Ver no CRM</Link>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
              {doDia.length === 0 && (
                <li className="text-sm text-[var(--pe-text-muted)]">
                  <p>{filtrando && eventosComData.some((e) => isSameDay(e.quando!, diaSel)) ? "Os filtros ocultam os itens deste dia." : "Nenhum compromisso neste dia."}</p>
                  <button type="button" onClick={() => abrirListaTarefas("nova")} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                    <Plus className="h-3 w-3" /> Nova tarefa para este dia
                  </button>
                </li>
              )}
            </ul>
          </aside>
        </div>
      )}

      {modo === "agenda" && (
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Período da agenda" value={periodoAgenda} onChange={(e) => setPeriodoAgenda(e.target.value as typeof periodoAgenda)} className="min-h-9 rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary">
            <option value="todos">Todos os itens com data</option>
            <option value="futuros">A partir de hoje</option>
            <option value="mes">Só o mês exibido ({format(mes, "MMM yyyy", { locale: ptBR })})</option>
          </select>
          <span className="text-xs text-muted-foreground">{listaOrdenada.length} {listaOrdenada.length === 1 ? "item" : "itens"} em ordem cronológica</span>
        </div>
      )}

      {modo === "agenda" && (
        <div className="pe-card divide-y">
          {listaOrdenada.map((ev) => {
            const taskId = idTarefaDeEvento(ev);
            return (
              <div key={ev.event_id} className="flex flex-wrap gap-3 py-3 text-sm">
                <div className="min-w-[120px] font-semibold">
                  {format(ev.quando!, "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </div>
                <div className="min-w-0 flex-1">
                  {taskId ? (
                    <>
                      <p className="font-semibold">{ev.titulo}</p>
                      <p className="text-xs text-[var(--pe-text-muted)]">
                        {nomeDe(ev.business_id)} · {ev.status || "—"} · {ev.origem}
                      </p>
                      <div className="pe-task-card-acoes">
                        <button type="button" className="pe-acao-tarefa pe-acao-tarefa--add" onClick={() => abrirTarefa(taskId)}>
                          Detalhes
                        </button>
                        <button type="button" className="pe-acao-tarefa pe-acao-tarefa--done" onClick={() => void concluirRapido(taskId, ev.business_id)}>
                          Concluir
                        </button>
                        <button
                          type="button"
                          className="pe-acao-tarefa pe-acao-tarefa--delegate"
                          onClick={() => abrirTarefa(taskId, "delegar")}
                        >
                          Delegar
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold">{ev.titulo}</p>
                      <p className="text-xs text-[var(--pe-text-muted)]">
                        {nomeDe(ev.business_id)} · {ev.status || "—"} · {ev.origem}
                      </p>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          {listaOrdenada.length === 0 && (
            <ExecutiveEmptyState
              icon={CalendarSearch}
              title="Nenhum evento com data neste recorte"
              description={filtrando || periodoAgenda !== "todos" ? "Os filtros ou o período escolhido ocultam os itens. Amplie o recorte para ver a agenda completa." : "Compromissos e tarefas com prazo aparecem aqui. Crie uma tarefa com prazo para começar."}
              actionLabel={filtrando ? "Limpar filtros" : periodoAgenda !== "todos" ? "Ver todos os itens" : "Nova tarefa"}
              onAction={filtrando ? limparFiltros : periodoAgenda !== "todos" ? () => setPeriodoAgenda("todos") : () => abrirListaTarefas("nova")}
            />
          )}
        </div>
      )}

      <TarefaAgendaModal
        aberto={modalTarefas}
        taskIdInicial={taskIdModal}
        acaoInicial={acaoModal}
        dataPrazoSugerida={format(diaSel, "yyyy-MM-dd")}
        onFechar={() => {
          setModalTarefas(false);
          setAcaoModal(null);
        }}
        onAtualizado={recarregar}
      />
    </div>
  );
}
