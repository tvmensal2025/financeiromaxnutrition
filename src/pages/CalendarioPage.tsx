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

function idTarefaDeEvento(ev: EventoAgenda) {
  if (ev.related_object_type === "tarefas" && ev.related_object_id) return ev.related_object_id;
  if (ev.event_id.startsWith("EVT-TSK-")) return ev.event_id.replace("EVT-TSK-", "");
  return null;
}

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

  const grade = useMemo(() => {
    const ini = startOfWeek(startOfMonth(mes), { weekStartsOn: 0 });
    const fim = endOfWeek(endOfMonth(mes), { weekStartsOn: 0 });
    return eachDayOfInterval({ start: ini, end: fim });
  }, [mes]);

  const porDia = useMemo(() => {
    const mapa = new Map<string, EventoAgenda[]>();
    for (const ev of eventosComData) {
      const chave = format(ev.quando!, "yyyy-MM-dd");
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave)!.push(ev);
    }
    return mapa;
  }, [eventosComData]);

  const doDia = porDia.get(format(diaSel, "yyyy-MM-dd")) || [];

  const listaOrdenada = useMemo(() => {
    return [...eventosComData].sort((a, b) => a.quando!.getTime() - b.quando!.getTime());
  }, [eventosComData]);

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
          <div className="flex items-center gap-2">
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
                    className={`pe-cal-dia ${fora ? "is-out" : ""} ${sel ? "is-sel" : ""}`}
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
                <li className="text-sm text-[var(--pe-text-muted)]">Nenhum compromisso neste dia.</li>
              )}
            </ul>
          </aside>
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
            <p className="py-6 text-center text-sm text-[var(--pe-text-muted)]">Nenhum evento com data neste recorte.</p>
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
