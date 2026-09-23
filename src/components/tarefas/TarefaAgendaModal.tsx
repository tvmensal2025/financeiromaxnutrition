import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Flag,
  Layers,
  Plus,
  Search,
  User,
  UserPlus,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useBusiness } from "@/contexts/BusinessContext";
import { parseDataAgenda, type TarefaRow } from "@/lib/agenda-unificada";
import { sincronizarTarefaNoCalendario } from "@/lib/tarefa-calendario";
import {
  concluirTarefa,
  criarTarefaNova,
  delegarTarefa,
  proximoTaskId,
  tarefaConcluida,
} from "@/lib/tarefa-acoes";

type TarefaCompleta = TarefaRow & {
  project_id?: string | null;
  tipo?: string | null;
  responsavel?: string | null;
  definicao_de_pronto?: string | null;
  evidencia?: string | null;
};

export type AcaoTarefaModal = "nova" | "delegar" | null;

type Props = {
  aberto: boolean;
  onFechar: () => void;
  taskIdInicial?: string | null;
  acaoInicial?: AcaoTarefaModal;
  dataPrazoSugerida?: string | null;
  onAtualizado?: () => void;
};

function corStatus(status?: string | null) {
  const s = (status || "").toUpperCase();
  if (s.includes("CONCLU")) return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
  if (s.includes("BLOQUE")) return "bg-red-500/15 text-red-700 border-red-500/30";
  if (s.includes("NÃO INICI") || s.includes("NAO INICI")) return "bg-slate-500/15 text-slate-700 border-slate-500/30";
  return "bg-amber-500/15 text-amber-800 border-amber-500/30";
}

export function TarefaAgendaModal({
  aberto,
  onFechar,
  taskIdInicial,
  acaoInicial = null,
  dataPrazoSugerida = null,
  onAtualizado,
}: Props) {
  const { selecionadas, todasLigadas, nomeDe, empresas } = useBusiness();
  const [lista, setLista] = useState<TarefaCompleta[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [form, setForm] = useState<Partial<TarefaCompleta>>({});
  const [painelDelegar, setPainelDelegar] = useState(false);
  const [painelNova, setPainelNova] = useState(false);
  const [delegadoPara, setDelegadoPara] = useState("");
  const [novaTarefa, setNovaTarefa] = useState({ titulo: "", prazo: "", responsavel: "" });

  const carregar = async () => {
    setCarregando(true);
    setErro("");
    let q = supabase.from("tarefas").select("*").order("task_id");
    if (!todasLigadas && selecionadas.length) q = q.in("business_id", selecionadas);
    const { data, error } = await q;
    if (error) setErro(error.message);
    else setLista((data || []) as TarefaCompleta[]);
    setCarregando(false);
  };

  useEffect(() => {
    if (!aberto) return;
    carregar();
    setSelId(taskIdInicial || null);
    setPainelDelegar(acaoInicial === "delegar");
    setPainelNova(acaoInicial === "nova");
    if (acaoInicial === "nova") {
      setNovaTarefa({
        titulo: "",
        prazo: dataPrazoSugerida || "",
        responsavel: "",
      });
    }
  }, [aberto, taskIdInicial, acaoInicial, dataPrazoSugerida, selecionadas.join("|"), todasLigadas]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return lista;
    return lista.filter(
      (t) =>
        t.task_id.toLowerCase().includes(termo) ||
        t.tarefa.toLowerCase().includes(termo) ||
        (t.status || "").toLowerCase().includes(termo),
    );
  }, [lista, busca]);

  const selecionada = filtradas.find((t) => t.task_id === selId) || filtradas[0] || null;

  useEffect(() => {
    if (selecionada) setForm({ ...selecionada });
    else setForm({});
    setDelegadoPara(selecionada?.responsavel || "");
  }, [selecionada?.task_id]);

  useEffect(() => {
    if (aberto && taskIdInicial) setSelId(taskIdInicial);
  }, [aberto, taskIdInicial, lista.length]);

  async function salvar() {
    if (!selecionada?.task_id || !form.tarefa?.trim()) return;
    setSalvando(true);
    setErro("");
    const payload = {
      tarefa: form.tarefa.trim(),
      status: form.status || selecionada.status,
      prazo: form.prazo || null,
      prioridade: form.prioridade || null,
      responsavel: form.responsavel || null,
      bloqueio: form.bloqueio || null,
      definicao_de_pronto: form.definicao_de_pronto || null,
    };
    const { error } = await supabase.from("tarefas").update(payload).eq("task_id", selecionada.task_id);
    if (error) {
      setErro(error.message);
      setSalvando(false);
      return;
    }
    const atualizada: TarefaCompleta = { ...selecionada, ...payload };
    await sincronizarTarefaNoCalendario(atualizada);
    await carregar();
    onAtualizado?.();
    setSalvando(false);
  }

  async function acaoConcluir() {
    if (!selecionada) return;
    if (tarefaConcluida(selecionada.status)) return;
    setSalvando(true);
    setErro("");
    const { erro: msg } = await concluirTarefa(selecionada);
    if (msg) setErro(msg);
    else {
      await carregar();
      onAtualizado?.();
      setPainelDelegar(false);
      setPainelNova(false);
    }
    setSalvando(false);
  }

  async function acaoDelegar() {
    if (!selecionada) return;
    setSalvando(true);
    setErro("");
    const { erro: msg } = await delegarTarefa(selecionada, delegadoPara);
    if (msg) setErro(msg);
    else {
      await carregar();
      onAtualizado?.();
      setPainelDelegar(false);
    }
    setSalvando(false);
  }

  async function acaoAdicionar() {
    const business_id =
      selecionadas[0] || empresas[0]?.id || selecionada?.business_id || "";
    if (!business_id) {
      setErro("Ligue uma empresa na barra lateral para criar tarefa.");
      return;
    }
    setSalvando(true);
    setErro("");
    const task_id = proximoTaskId(lista.map((t) => t.task_id));
    const { erro: msg, tarefa } = await criarTarefaNova({
      task_id,
      business_id,
      tarefa: novaTarefa.titulo,
      prazo: novaTarefa.prazo || dataPrazoSugerida || null,
      responsavel: novaTarefa.responsavel || null,
    });
    if (msg) setErro(msg);
    else {
      await carregar();
      if (tarefa) setSelId(tarefa.task_id);
      onAtualizado?.();
      setPainelNova(false);
      setNovaTarefa({ titulo: "", prazo: dataPrazoSugerida || "", responsavel: "" });
    }
    setSalvando(false);
  }

  function abrirNova() {
    setPainelNova(true);
    setPainelDelegar(false);
    setNovaTarefa({
      titulo: "",
      prazo: dataPrazoSugerida || (form.prazo || "").slice(0, 10) || "",
      responsavel: "",
    });
  }

  function abrirDelegar() {
    setPainelDelegar(true);
    setPainelNova(false);
    setDelegadoPara(selecionada?.responsavel || "");
  }

  if (!aberto) return null;

  const empresa = empresas.find((e) => e.id === selecionada?.business_id);
  const quando = selecionada ? parseDataAgenda(selecionada.prazo || selecionada.occurrence_date) : null;
  const jaConcluida = tarefaConcluida(selecionada?.status);

  return (
    <div className="pe-modal-backdrop" onClick={onFechar} role="presentation">
      <div
        className="pe-modal-premium"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tarefas-modal-titulo"
      >
        <header className="pe-modal-premium-header">
          <div>
            <p className="pe-kpi-label">Tarefas</p>
            <h2 id="tarefas-modal-titulo" className="text-xl font-semibold tracking-tight">
              Adicionar · Concluir · Delegar
            </h2>
            <p className="mt-1 text-xs text-[var(--pe-text-muted)]">
              Use os botões verdes abaixo — não precisa ir ao cadastro completo.
            </p>
          </div>
          <button type="button" className="pe-icone" onClick={onFechar} aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </header>

        {erro && (
          <p className="mx-5 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{erro}</p>
        )}

        <div className="pe-modal-premium-body">
          <aside className="pe-modal-premium-list">
            <button type="button" className="pe-acao-tarefa pe-acao-tarefa--add w-full" onClick={abrirNova}>
              <Plus className="h-4 w-4" />
              Adicionar tarefa
            </button>
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--pe-text-muted)]" />
              <input
                className="pe-input mt-0 pl-9 text-sm"
                placeholder="Buscar tarefa…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <ul className="mt-3 max-h-[min(48vh,400px)] space-y-1.5 overflow-y-auto pr-1">
              {carregando && <li className="text-xs text-[var(--pe-text-muted)]">Carregando…</li>}
              {filtradas.map((t) => (
                <li key={t.task_id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelId(t.task_id);
                      setPainelNova(false);
                    }}
                    className={`pe-modal-task-item w-full text-left ${selId === t.task_id || (!selId && filtradas[0]?.task_id === t.task_id) ? "is-active" : ""}`}
                  >
                    <span className="font-mono text-[10px] text-[var(--pe-text-muted)]">{t.task_id}</span>
                    <span className="mt-0.5 block text-sm font-semibold leading-snug">{t.tarefa}</span>
                    <span className={`mt-1 inline-block rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase ${corStatus(t.status)}`}>
                      {t.status || "—"}
                    </span>
                  </button>
                </li>
              ))}
              {!carregando && filtradas.length === 0 && (
                <li className="text-xs text-[var(--pe-text-muted)]">Nenhuma tarefa neste recorte.</li>
              )}
            </ul>
          </aside>

          <section className="pe-modal-premium-detail">
            {painelNova ? (
              <div className="pe-painel-acao">
                <h3 className="text-lg font-semibold">Adicionar tarefa</h3>
                <p className="mt-1 text-xs text-[var(--pe-text-muted)]">
                  Cria no sistema e já coloca no calendário se informar o prazo.
                </p>
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="text-xs font-semibold">O que precisa ser feito?</label>
                    <textarea
                      className="pe-input mt-1 min-h-[72px] text-sm"
                      value={novaTarefa.titulo}
                      onChange={(e) => setNovaTarefa({ ...novaTarefa, titulo: e.target.value })}
                      placeholder="Ex.: Ligar para o fornecedor…"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold">Prazo (calendário)</label>
                      <input
                        type="date"
                        className="pe-input mt-1 text-sm"
                        value={novaTarefa.prazo}
                        onChange={(e) => setNovaTarefa({ ...novaTarefa, prazo: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold">Responsável (opcional)</label>
                      <input
                        className="pe-input mt-1 text-sm"
                        value={novaTarefa.responsavel}
                        onChange={(e) => setNovaTarefa({ ...novaTarefa, responsavel: e.target.value })}
                        placeholder="Nome"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="pe-acao-tarefa pe-acao-tarefa--add" disabled={salvando} onClick={acaoAdicionar}>
                      <Plus className="h-4 w-4" />
                      {salvando ? "Gravando…" : "Adicionar"}
                    </button>
                    <button type="button" className="pe-acao-tarefa pe-acao-tarefa--ghost" onClick={() => setPainelNova(false)}>
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            ) : !selecionada ? (
              <p className="text-sm text-[var(--pe-text-muted)]">Selecione uma tarefa ou clique em Adicionar tarefa.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs text-[var(--pe-text-muted)]">{selecionada.task_id}</p>
                    <h3 className="mt-1 text-lg font-semibold leading-snug">{selecionada.tarefa}</h3>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase ${corStatus(selecionada.status)}`}>
                    {selecionada.status}
                  </span>
                </div>

                <div className="pe-barra-acoes-tarefa mt-4">
                  <button
                    type="button"
                    className="pe-acao-tarefa pe-acao-tarefa--add"
                    onClick={abrirNova}
                    disabled={salvando}
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar
                  </button>
                  <button
                    type="button"
                    className="pe-acao-tarefa pe-acao-tarefa--done"
                    onClick={acaoConcluir}
                    disabled={salvando || jaConcluida}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {jaConcluida ? "Concluída" : "Concluir"}
                  </button>
                  <button
                    type="button"
                    className="pe-acao-tarefa pe-acao-tarefa--delegate"
                    onClick={abrirDelegar}
                    disabled={salvando || jaConcluida}
                  >
                    <UserPlus className="h-4 w-4" />
                    Delegar
                  </button>
                </div>

                {painelDelegar && (
                  <div className="pe-painel-acao mt-4">
                    <p className="text-sm font-semibold">Delegar para quem?</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <input
                        className="pe-input min-w-[200px] flex-1 text-sm"
                        value={delegadoPara}
                        onChange={(e) => setDelegadoPara(e.target.value)}
                        placeholder="Ex.: Pedro, Helena…"
                      />
                      <button type="button" className="pe-acao-tarefa pe-acao-tarefa--delegate" disabled={salvando} onClick={acaoDelegar}>
                        Confirmar delegação
                      </button>
                      <button type="button" className="pe-acao-tarefa pe-acao-tarefa--ghost" onClick={() => setPainelDelegar(false)}>
                        Fechar
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="pe-modal-meta">
                    <Layers className="h-4 w-4" />
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-[var(--pe-text-muted)]">Empresa</p>
                      <p className="text-sm font-semibold">{nomeDe(selecionada.business_id)}</p>
                    </div>
                  </div>
                  <div className="pe-modal-meta">
                    <Calendar className="h-4 w-4" />
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-[var(--pe-text-muted)]">Prazo no calendário</p>
                      <p className="text-sm font-semibold">
                        {quando ? format(quando, "dd MMM yyyy", { locale: ptBR }) : "Sem data — preencha abaixo"}
                      </p>
                    </div>
                  </div>
                  <div className="pe-modal-meta">
                    <User className="h-4 w-4" />
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-[var(--pe-text-muted)]">Responsável</p>
                      <p className="text-sm font-semibold">{selecionada.responsavel || "—"}</p>
                    </div>
                  </div>
                  <div className="pe-modal-meta">
                    <Flag className="h-4 w-4" />
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-[var(--pe-text-muted)]">Prioridade</p>
                      <p className="text-sm font-semibold">{selecionada.prioridade || "—"}</p>
                    </div>
                  </div>
                </div>

                {empresa && (
                  <div
                    className="mt-4 rounded-xl border px-3 py-2 text-xs font-medium"
                    style={{ borderColor: `${empresa.cor}55`, background: `${empresa.cor}12` }}
                  >
                    {empresa.nome}
                  </div>
                )}

                <details className="mt-5 border-t border-[var(--pe-border)] pt-4">
                  <summary className="cursor-pointer text-xs font-semibold text-[var(--pe-text-muted)]">
                    Editar campos avançados
                  </summary>
                  <form
                    className="mt-3 space-y-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      salvar();
                    }}
                  >
                    <div>
                      <label className="text-xs font-semibold">Descrição da tarefa</label>
                      <textarea
                        className="pe-input mt-1 min-h-[72px] resize-y text-sm"
                        value={form.tarefa || ""}
                        onChange={(e) => setForm({ ...form, tarefa: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-semibold">Status</label>
                        <input
                          className="pe-input mt-1 text-sm"
                          value={form.status || ""}
                          onChange={(e) => setForm({ ...form, status: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold">Prazo</label>
                        <input
                          type="date"
                          className="pe-input mt-1 text-sm"
                          value={(form.prazo || "").slice(0, 10)}
                          onChange={(e) => setForm({ ...form, prazo: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold">Bloqueio</label>
                      <input
                        className="pe-input mt-1 text-sm"
                        value={form.bloqueio || ""}
                        onChange={(e) => setForm({ ...form, bloqueio: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold">Definição de pronto</label>
                      <textarea
                        className="pe-input mt-1 min-h-[56px] text-sm"
                        value={form.definicao_de_pronto || ""}
                        onChange={(e) => setForm({ ...form, definicao_de_pronto: e.target.value })}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3 pt-2">
                      <p className="flex items-center gap-1.5 text-[10px] text-[var(--pe-text-muted)]">
                        <Clock className="h-3.5 w-3.5" />
                        Salvar atualiza o calendário.
                      </p>
                      <button type="submit" className="pe-button !mt-0 !w-auto px-6" disabled={salvando}>
                        {salvando ? "Salvando…" : "Salvar alterações"}
                      </button>
                    </div>
                  </form>
                </details>

                {selecionada.definicao_de_pronto && (
                  <div className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3 text-xs">
                    <p className="flex items-center gap-1.5 font-semibold text-emerald-800">
                      <CheckCircle2 className="h-4 w-4" />
                      Pronto quando
                    </p>
                    <p className="mt-1 text-[var(--pe-text-muted)]">{selecionada.definicao_de_pronto}</p>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
