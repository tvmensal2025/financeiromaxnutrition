import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Database,
  Plus,
  Search,
  Filter,
  Pencil,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Layers,
  ArrowUpDown,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { COLUNAS_SISTEMA, MODULOS, SEM_EXCLUSAO } from "@/lib/modulos";
import { useBusiness } from "@/contexts/BusinessContext";
import { sincronizarTarefaNoCalendario } from "@/lib/tarefa-calendario";
import type { TarefaRow } from "@/lib/agenda-unificada";

type Campo = {
  coluna: string;
  nome_na_planilha: string | null;
  chave: string | null;
  calculado: string | null;
};

const STATUS_BLOQUEADO = new Set(["ATIVA", "ATIVO", "OPERACIONAL", "SINCRONIZADA", "SINCRONIZADO"]);

export default function Modulo() {
  const { tabela = "" } = useParams();
  const meta = MODULOS.find((item) => item.tabela === tabela) || {
    grupo: "Geral",
    tabela: tabela,
    titulo: tabela.charAt(0).toUpperCase() + tabela.slice(1).replace(/_/g, " "),
    escopo: "BUSINESS" as const,
    descricao: "Módulo operacional do Sistema Helena",
  };
  const { currentBusiness, currentBusinessId, isConsolidated, selecionadas, todasLigadas, rotulo, empresas } = useBusiness();
  const [campos, setCampos] = useState<Campo[]>([]);
  const [linhas, setLinhas] = useState<Record<string, unknown>[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [editando, setEditando] = useState<string | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [termoBusca, setTermoBusca] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [carregando, setCarregando] = useState(true);

  const chave = useMemo(() => {
    const marcada = campos.find((campo) => campo.chave === "SIM")?.coluna;
    if (marcada) return marcada;
    if (campos.some((campo) => campo.coluna === "registro_id")) return "registro_id";
    if (campos.some((campo) => campo.coluna === "ordem")) return "ordem";
    return campos[0]?.coluna || "id";
  }, [campos]);

  const editaveis = useMemo(
    () =>
      campos.filter(
        (campo) =>
          campo.calculado !== "SIM" &&
          !COLUNAS_SISTEMA.has(campo.coluna) &&
          !campo.coluna.startsWith("conferencia_") &&
          campo.coluna !== "registro_id"
      ),
    [campos]
  );

  const preferidas = [
    "fluxo",
    "valor_original",
    "status",
    "conta_id",
    "decisao",
    "frente",
    "negocio",
    "tarefa",
    "assunto",
    "ideia",
    "business_id",
    "valor_potencial",
    "etapa",
  ];

  const colunasTabela = [
    ...preferidas.filter((coluna) => editaveis.some((campo) => campo.coluna === coluna)),
    ...editaveis.map((campo) => campo.coluna).filter((coluna) => !preferidas.includes(coluna)),
  ]
    .filter((coluna) => coluna !== chave)
    .slice(0, 5);

  async function carregar() {
    setCarregando(true);
    setErro("");
    const mapa = await supabase
      .from("helena_campos")
      .select("coluna,nome_na_planilha,chave,calculado")
      .eq("tabela", tabela);
    if (mapa.error) {
      if (/permission denied|jwt|unauthorized|not allowed/i.test(mapa.error.message)) {
        setErro("");
      } else {
        setErro(mapa.error.message);
      }
      setCarregando(false);
      return;
    }
    const lista = (mapa.data || []) as Campo[];
    setCampos(lista);

    let consulta = supabase.from(tabela).select("*").limit(200);
    // Filtragem automática por escopo (GLOBAL x MISTO x BUSINESS)
    const colEmpresa = lista.find((c) => c.coluna === "business_id" || c.coluna === "business_id_area")?.coluna;
    const escopo = meta.escopo;

    if (colEmpresa && tabela !== "portfolio") {
      if (escopo === "GLOBAL") {
        // Módulos globais: nunca filtra por business_id (traz visão completa do sistema)
      } else if (escopo === "MISTO") {
        // Módulos mistos (governanca, integracoes, estado_mestre, memoria_mestre, handoffs, decisoes, etc.):
        // Registros globais (sem business_id ou 'GLOBAL') permanecem sempre visíveis, mais os da empresa ativa
        if (!isConsolidated && currentBusinessId) {
          consulta = consulta.or(`${colEmpresa}.is.null,${colEmpresa}.eq.GLOBAL,${colEmpresa}.eq.${currentBusinessId}`);
        } else if (isConsolidated && selecionadas.length > 0) {
          consulta = consulta.or(`${colEmpresa}.is.null,${colEmpresa}.eq.GLOBAL,${colEmpresa}.in.(${selecionadas.join(",")})`);
        }
      } else {
        // Módulos puramente BUSINESS (crm, financeiro, tarefas, etc.)
        if (!isConsolidated && currentBusinessId) {
          consulta = consulta.eq(colEmpresa, currentBusinessId);
        } else if (isConsolidated && selecionadas.length > 0) {
          consulta = consulta.in(colEmpresa, [...selecionadas]);
        }
      }
    }

    const { data, error } = await consulta;
    if (error) {
      if (/permission denied|jwt|unauthorized|not allowed/i.test(error.message)) {
        setErro("");
      } else {
        setErro(error.message);
      }
    } else {
      setLinhas((data || []) as Record<string, unknown>[]);
    }
    setCarregando(false);
  }

  useEffect(() => {
    setForm({});
    setEditando(null);
    setAviso("");
    setTermoBusca("");
    setModalAberto(false);
    if (tabela) carregar();
  }, [tabela, currentBusinessId, isConsolidated]);

  // Busca instantânea
  const linhasFiltradas = useMemo(() => {
    if (!termoBusca.trim()) return linhas;
    const termo = termoBusca.toLowerCase();
    return linhas.filter((linha) => {
      return Object.values(linha).some((val) =>
        String(val ?? "").toLowerCase().includes(termo)
      );
    });
  }, [linhas, termoBusca]);

  function validar(valores: Record<string, string>) {
    if (
      (tabela === "integracoes" || tabela === "automacoes") &&
      STATUS_BLOQUEADO.has((valores.status || "").toUpperCase())
    ) {
      return "Integração e automação ficam planejadas até existir teste externo.";
    }
    if (tabela === "financeiro") {
      const valor = Number(String(valores.valor_original || "").replace(",", "."));
      if (valores.valor_original && (!(valor >= 0) || Number.isNaN(valor))) {
        return "Valor precisa ser positivo. O sentido fica no fluxo.";
      }
      if (
        (valores.status === "PAGO" || valores.status === "RECEBIDO") &&
        valores.tipo_ajuste === "PARCIAL"
      ) {
        return "PAGO e RECEBIDO só valem para quitação integral.";
      }
    }
    if (
      tabela === "ideias" &&
      valores.decisao &&
      !["AGORA", "DEPOIS", "DESCARTAR", "PRECISA VALIDAR"].includes(valores.decisao)
    ) {
      return "A decisão da ideia é AGORA, DEPOIS, DESCARTAR ou PRECISA VALIDAR.";
    }
    return "";
  }

  async function salvar(event: FormEvent) {
    event.preventDefault();
    const msg = validar(form);
    if (msg) {
      setErro(msg);
      return;
    }
    const row: Record<string, string | number | null> = {};
    for (const campo of editaveis) {
      const valor = (form[campo.coluna] || "").trim();
      if (!valor) continue;
      row[campo.coluna] =
        campo.coluna.includes("valor") || campo.coluna === "ordem"
          ? Number(valor.replace(",", "."))
          : valor;
      if (typeof row[campo.coluna] === "number" && Number.isNaN(row[campo.coluna])) {
        row[campo.coluna] = valor;
      }
    }
    if (campos.some((campo) => campo.coluna === "source_system")) row.source_system = "HELENA";
    const colEmpresa = campos.find((campo) => campo.coluna === "business_id" || campo.coluna === "business_id_area")?.coluna;
    if (colEmpresa) {
      if (!isConsolidated) {
        row[colEmpresa] = currentBusinessId;
      } else if (!row[colEmpresa]) {
        row[colEmpresa] = form[colEmpresa] || selecionadas[0] || "BIZ-001";
      }
    }

    if (!editando && chave !== "registro_id" && !row[chave]) {
      setErro(`Informe ${chave}.`);
      return;
    }

    let consulta = editando
      ? supabase.from(tabela).update(row).eq(chave, editando)
      : supabase.from(tabela).insert(row);

    if (editando && colEmpresa && !isConsolidated) {
      consulta = consulta.eq(colEmpresa, currentBusinessId);
    }

    const { error } = await consulta;
    if (error) {
      setErro(error.message);
      return;
    }
    if (tabela === "tarefas") {
      const taskId = String(editando || row.task_id || form.task_id || "");
      if (taskId && row.business_id && row.tarefa) {
        await sincronizarTarefaNoCalendario({
          task_id: taskId,
          business_id: String(row.business_id),
          tarefa: String(row.tarefa),
          status: row.status ? String(row.status) : null,
          prazo: row.prazo ? String(row.prazo) : null,
          occurrence_date: row.occurrence_date ? String(row.occurrence_date) : null,
          bloqueio: row.bloqueio ? String(row.bloqueio) : null,
          prioridade: row.prioridade ? String(row.prioridade) : null,
        } as TarefaRow);
      }
    }
    setAviso(editando ? "Registro atualizado com sucesso." : "Registro gravado com sucesso.");
    setForm({});
    setEditando(null);
    setModalAberto(false);
    await carregar();
  }

  async function excluir(id: string, linha?: Record<string, unknown>) {
    if (SEM_EXCLUSAO.has(tabela)) return;
    const colEmpresa = campos.find((campo) => campo.coluna === "business_id" || campo.coluna === "business_id_area")?.coluna;
    if (colEmpresa && !isConsolidated && linha) {
      const rowBiz = linha[colEmpresa];
      if (rowBiz && rowBiz !== currentBusinessId) {
        alert("Operação bloqueada: Não é permitido excluir registro de outra empresa.");
        return;
      }
    }
    if (!confirm(`Deseja excluir o registro ${id}?`)) return;
    let qDel = supabase.from(tabela).delete().eq(chave, id);
    if (colEmpresa && !isConsolidated) {
      qDel = qDel.eq(colEmpresa, currentBusinessId);
    }
    const { error } = await qDel;
    if (error) setErro(error.message);
    else await carregar();
  }

  function editar(linha: Record<string, unknown>) {
    const colEmpresa = campos.find((campo) => campo.coluna === "business_id" || campo.coluna === "business_id_area")?.coluna;
    if (colEmpresa && !isConsolidated) {
      const rowBiz = linha[colEmpresa];
      if (rowBiz && rowBiz !== currentBusinessId) {
        alert("Operação bloqueada: Este registro pertence a outra empresa.");
        return;
      }
    }
    const next: Record<string, string> = {};
    for (const campo of editaveis) {
      const valor = linha[campo.coluna];
      if (valor !== null && valor !== undefined) next[campo.coluna] = String(valor);
    }
    setForm(next);
    setEditando(String(linha[chave]));
    setModalAberto(true);
  }

  function abrirNovo() {
    setEditando(null);
    const inicial: Record<string, string> = {};
    const colEmpresa = campos.find((c) => c.coluna === "business_id" || c.coluna === "business_id_area")?.coluna;
    if (colEmpresa) {
      inicial[colEmpresa] = !isConsolidated ? currentBusinessId : (selecionadas[0] || "BIZ-001");
    }
    setForm(inicial);
    setModalAberto(true);
  }

  const formatarValorCelula = (coluna: string, valor: unknown) => {
    if (valor === null || valor === undefined) return "-";
    const str = String(valor);

    // Formatação de valores em Reais
    if (
      coluna.includes("valor") ||
      coluna.includes("saldo") ||
      coluna.includes("custo") ||
      coluna.includes("mrr_brl") ||
      coluna.includes("receita")
    ) {
      const num = Number(str);
      if (!isNaN(num)) {
        return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      }
    }

    // Badges para Status
    if (coluna === "status" || coluna === "decisao" || coluna === "etapa") {
      const up = str.toUpperCase();
      let badgeStyle = "bg-muted text-foreground border-border/50";
      if (["ATIVA", "ATIVO", "PAGO", "RECEBIDO", "EM EXECUÇÃO", "AGORA", "GANHO"].includes(up)) {
        badgeStyle = "bg-emerald-500/10 text-emerald-500 border-emerald-500/30";
      } else if (["PENDENTE", "DEPOIS", "NEGOCIACAO", "PROPOSTA"].includes(up)) {
        badgeStyle = "bg-blue-500/10 text-blue-500 border-blue-500/30";
      } else if (["PRECISA VALIDAR", "ABERTO", "QUALIFICACAO"].includes(up)) {
        badgeStyle = "bg-amber-500/10 text-amber-500 border-amber-500/30";
      } else if (["CANCELADO", "DESCARTAR", "PERDIDO"].includes(up)) {
        badgeStyle = "bg-rose-500/10 text-rose-500 border-rose-500/30";
      }
      return (
        <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold ${badgeStyle}`}>
          {str}
        </span>
      );
    }

    return str;
  };

  if (!meta) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-muted-foreground">
          Este módulo não faz parte do Sistema Helena.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Topo do Módulo */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
              {meta.grupo}
            </span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">{rotulo}</span>
          </div>
          <h1 className="pe-page-title">{meta.titulo}</h1>
          <p className="text-xs text-muted-foreground">
            Tabela oficial: <span className="font-mono text-foreground font-semibold">{tabela}</span> ·{" "}
            {linhasFiltradas.length} registro(s) listados
          </p>
        </div>

        <button
          onClick={abrirNovo}
          className="flex items-center gap-2 self-start rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-glow hover:opacity-90 transition-all sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Novo Registro</span>
        </button>
      </div>

      {erro && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>{erro}</span>
        </div>
      )}

      {aviso && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-500">
          <CheckCircle2 className="h-4 w-4" />
          <span>{aviso}</span>
        </div>
      )}

      {/* Barra de Filtro e Busca */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/40 bg-card/60 p-2.5 backdrop-blur-md">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={`Filtrar registros em ${meta.titulo}…`}
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
            className="w-full rounded-xl border border-border/50 bg-background/80 py-2 pl-9 pr-4 text-xs placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
          />
        </div>
        <p className="text-xs text-muted-foreground pr-2 hidden sm:block">
          Mostrando <span className="font-semibold text-foreground">{linhasFiltradas.length}</span> de{" "}
          {linhas.length}
        </p>
      </div>

      {/* Tabela de Dados Limpa e Moderna */}
      <div className="overflow-x-auto rounded-2xl border border-border/50 bg-card shadow-sm">
        <table className="w-full min-w-[700px] text-left text-xs">
          <thead className="bg-muted/50 border-b border-border/50 text-muted-foreground uppercase text-[10px] tracking-wider">
            <tr>
              <th className="px-4 py-3.5 font-bold">{chave}</th>
              {colunasTabela.map((coluna) => (
                <th key={coluna} className="px-4 py-3.5 font-bold">
                  {coluna}
                </th>
              ))}
              <th className="px-4 py-3.5 text-right font-bold">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {linhasFiltradas.map((linha, index) => {
              const id = String(linha[chave] ?? index);
              return (
                <tr key={id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-foreground">{id}</td>
                  {colunasTabela.map((coluna) => (
                    <td key={coluna} className="max-w-[260px] px-4 py-3">
                      <div className="line-clamp-2">
                        {formatarValorCelula(coluna, linha[coluna])}
                      </div>
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => editar(linha)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all"
                        title="Editar registro"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {!SEM_EXCLUSAO.has(tabela) && (
                        <button
                          onClick={() => excluir(id, linha)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
                          title="Excluir registro"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {linhasFiltradas.length === 0 && (
              <tr>
                <td colSpan={colunasTabela.length + 2} className="px-4 py-12 text-center text-muted-foreground">
                  <div className="mx-auto max-w-md space-y-2">
                    <p className="text-sm font-medium text-foreground">
                      {carregando
                        ? "Carregando registros do Supabase…"
                        : termoBusca
                        ? `Nenhum registro corresponde ao filtro "${termoBusca}".`
                        : !isConsolidated && meta.escopo === "BUSINESS"
                        ? `Nenhum registro encontrado para ${rotulo} nesta tabela.`
                        : `Nenhum registro cadastrado na tabela ${tabela}.`}
                    </p>
                    {!carregando && !termoBusca && !isConsolidated && meta.escopo === "BUSINESS" && (
                      <p className="text-xs text-muted-foreground">
                        Esta unidade de negócio não possui dados registrados aqui. Se houver registros em outra empresa, alterne no seletor acima ou escolha &quot;Grupo Consolidado&quot;.
                      </p>
                    )}
                    {!carregando && !termoBusca && (isConsolidated || meta.escopo !== "BUSINESS") && (
                      <p className="text-xs text-muted-foreground">
                        Tabela canônica conectada ao Supabase e pronta para operações e diretrizes da Helena.
                      </p>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal / Dialog de Edição e Inserção */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-border/50 bg-card p-6 shadow-2xl animate-scale-in my-8">
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {editando ? `Atualizar ${editando}` : `Novo Registro em ${meta.titulo}`}
                </h3>
                <p className="text-xs text-muted-foreground">Tabela: {tabela}</p>
              </div>
              <button
                onClick={() => setModalAberto(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={salvar} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 max-h-[60vh] overflow-y-auto p-1 scrollbar-thin">
                {editaveis.map((campo) => {
                  const isBusinessCol = campo.coluna === "business_id" || campo.coluna === "business_id_area";
                  if (isBusinessCol && !isConsolidated) {
                    return (
                      <div key={campo.coluna} className="space-y-1">
                        <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                          <span>{campo.nome_na_planilha || campo.coluna}</span>
                          <span className="text-[10px] text-muted-foreground uppercase font-bold">(Empresa Ativa)</span>
                        </label>
                        <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-muted/40 px-3 py-2 text-xs font-bold text-foreground">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: currentBusiness?.cor || "#007A3D" }} />
                          <span className="truncate">{currentBusiness?.nome || currentBusinessId}</span>
                          <span className="ml-auto text-[10px] text-muted-foreground font-mono">{currentBusinessId}</span>
                        </div>
                      </div>
                    );
                  }
                  if (isBusinessCol && isConsolidated) {
                    return (
                      <div key={campo.coluna} className="space-y-1">
                        <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                          <span>{campo.nome_na_planilha || campo.coluna}</span>
                          <span className="text-[10px] text-primary font-mono font-bold">EMPRESA</span>
                        </label>
                        <select
                          className="w-full rounded-xl border border-border/50 bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                          value={form[campo.coluna] || selecionadas[0] || ""}
                          onChange={(e) => setForm({ ...form, [campo.coluna]: e.target.value })}
                        >
                          {empresas.map((emp) => (
                            <option key={emp.id} value={emp.id}>{emp.nome} ({emp.id})</option>
                          ))}
                        </select>
                      </div>
                    );
                  }
                  return (
                    <div key={campo.coluna} className="space-y-1">
                      <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                        <span>{campo.nome_na_planilha || campo.coluna}</span>
                        {campo.chave === "SIM" && (
                          <span className="text-[10px] text-primary font-mono font-bold">CHAVE</span>
                        )}
                      </label>
                      <input
                        className="w-full rounded-xl border border-border/50 bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                        value={form[campo.coluna] || ""}
                        onChange={(e) => setForm({ ...form, [campo.coluna]: e.target.value })}
                        placeholder={`Informe ${campo.coluna}…`}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end gap-2.5 border-t border-border/40 pt-4">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="rounded-xl border border-border/60 px-4 py-2 text-xs font-semibold hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow-glow hover:opacity-90"
                >
                  {editando ? "Atualizar Registro" : "Gravar Registro"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
