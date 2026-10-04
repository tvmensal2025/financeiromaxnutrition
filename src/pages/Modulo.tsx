import * as RecordDialog from "@radix-ui/react-dialog";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Database,
  Plus,
  Search,
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
  X,
  Layers,
  Calendar,
  Clock,
  UserCheck,
  CheckCircle2,
  TableProperties,
  ArrowRight,
  ShieldCheck,
  Cpu,
  Building2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { escreverRegistro, TABELAS_PROTEGIDAS } from '@/lib/escrita-protegida';
import { COLUNAS_SISTEMA, MODULOS, SEM_EXCLUSAO } from "@/lib/modulos";
import { useBusiness } from "@/contexts/BusinessContext";
import { sincronizarTarefaNoCalendario } from "@/lib/tarefa-calendario";
import type { TarefaRow } from "@/lib/agenda-unificada";
import { ExecutivePageHeader } from "@/components/executive/ExecutivePageHeader";
import { ExecutiveBadge } from "@/components/executive/ExecutiveBadge";
import { ExecutiveLoadingState } from "@/components/executive/ExecutiveLoadingState";
import { ExecutiveErrorState } from "@/components/executive/ExecutiveErrorState";
import { ExecutiveEmptyState } from "@/components/executive/ExecutiveEmptyState";
import { ExecutiveDrawer } from "@/components/executive/ExecutiveDrawer";
import { ExecutiveConfirmDialog } from "@/components/executive/ExecutiveConfirmDialog";

type Campo = {
  coluna: string;
  nome_na_planilha: string | null;
  chave: string | null;
  calculado: string | null;
};

export default function Modulo() {
  const { tabela = "" } = useParams();
  const meta = MODULOS.find((item) => item.tabela === tabela) || {
    grupo: "Geral",
    tabela: tabela,
    titulo: tabela.charAt(0).toUpperCase() + tabela.slice(1).replace(/_/g, " "),
    escopo: "BUSINESS" as const,
    descricao: "Módulo operacional do Sistema Helena",
  };
  const { currentBusiness, currentBusinessId, isConsolidated, selecionadas, rotulo, empresas } = useBusiness();
  const [campos, setCampos] = useState<Campo[]>([]);
  const [linhas, setLinhas] = useState<Record<string, unknown>[]>([]);
  const [pagina, setPagina] = useState(0);
  const [total, setTotal] = useState<number | null>(null);
  const sequenciaLeitura = useRef(0);
  const [form, setForm] = useState<Record<string, string>>({});
  const [editando, setEditando] = useState<string | null>(null);
  const [versaoEdicao, setVersaoEdicao] = useState<unknown>(null);
  const [versaoExclusao, setVersaoExclusao] = useState<unknown>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const origemEditor = useRef<HTMLElement | null>(null);
  const [drawerLinha, setDrawerLinha] = useState<Record<string, unknown> | null>(null);
  const [drawerAberto, setDrawerAberto] = useState(false);
  const [excluirId, setExcluirId] = useState<string | null>(null);
  const [dialogExcluirAberto, setDialogExcluirAberto] = useState(false);
  const [termoBusca, setTermoBusca] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [modoVisualizacao, setModoVisualizacao] = useState<"cards" | "tabela">("cards");
  const [ignorarFiltroEmpresa, setIgnorarFiltroEmpresa] = useState(false);
  const [mostrarTabelaFoco, setMostrarTabelaFoco] = useState(false);

  const isGovernanca = tabela.toLowerCase() === "governanca";
  const isIntegracoes = tabela.toLowerCase() === "integracoes";
  const isFoco = tabela === "foco_executivo";
  const rotuloCampo = (coluna: string) => ({business_id:'Empresa',business_id_area:'Empresa ou escopo',project_id:'Projeto',event_id:'Identificador do evento',task_id:'Identificador da tarefa',recurrence_id:'Recorrência',occurrence_date:'Data da ocorrência',execution_id:'Execução vinculada',lembrete_min:'Lembrete (minutos)'} as Record<string,string>)[coluna] || campos.find(c => c.coluna === coluna)?.nome_na_planilha || coluna.replace(/_/g, " ");

  const chave = useMemo(() => {
    const marcada = campos.find((campo) => campo.chave === "SIM")?.coluna;
    if (marcada) return marcada;
    if (campos.some((campo) => campo.coluna === "governance_id")) return "governance_id";
    if (campos.some((campo) => campo.coluna === "integration_id")) return "integration_id";
    if (campos.some((campo) => campo.coluna === "risk_id")) return "risk_id";
    if (campos.some((campo) => campo.coluna === "decision_id")) return "decision_id";
    if (campos.some((campo) => campo.coluna === "registro_id")) return "registro_id";
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

  const preferidas = isGovernanca
    ? ["ritual", "escopo", "cadencia", "dono", "participantes", "pauta_fixa", "entrega_esperada", "status"]
    : [
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

  const colunasTabela = useMemo(() => {
    return [
      ...preferidas.filter((coluna) => editaveis.some((campo) => campo.coluna === coluna)),
      ...editaveis
        .map((campo) => campo.coluna)
        .filter((coluna) => !preferidas.includes(coluna) && (!isGovernanca || coluna !== "business_id")),
    ]
      .filter((coluna) => coluna !== chave && (!isGovernanca || coluna !== "business_id"))
      .slice(0, 6);
  }, [editaveis, preferidas, isGovernanca, chave]);

  async function carregar() {
    const sequencia = ++sequenciaLeitura.current;
    setCarregando(true);
    setErro("");
    const isGov = tabela.toLowerCase() === "governanca";

    try {
      const mapa = await supabase
        .from("helena_campos")
        .select("coluna,nome_na_planilha,chave,calculado")
        .eq("tabela", tabela);

      if (sequencia !== sequenciaLeitura.current) return;

      let lista: Campo[] = [];
      if (!mapa.error && mapa.data) {
        lista = (mapa.data as Campo[]).filter(
          (c) => !isGov || (c.coluna !== "business_id" && c.coluna !== "business_id_area")
        );
        setCampos(lista);
      }

      let consulta = supabase.from(tabela).select("*", { count: "exact" }).range(pagina * 200, pagina * 200 + 199);
      const chaveOrdenacao = lista.find(campo => campo.chave === "SIM")?.coluna;
      if (chaveOrdenacao) consulta = consulta.order(chaveOrdenacao);

      if (isGov) {
        consulta = consulta.order("governance_id", { ascending: true });
      } else if (isIntegracoes) {
        consulta = consulta.order("integration_id", { ascending: true });
      } else {
        const colEmpresa = lista.find(
          (c) => c.coluna === "business_id" || c.coluna === "business_id_area"
        )?.coluna;
        const escopo = meta.escopo;

        if (tabela !== "portfolio" && colEmpresa && escopo !== "GLOBAL" && tabela !== "integracoes" && !ignorarFiltroEmpresa) {
          if (escopo === "MISTO") {
            if (!isConsolidated && currentBusinessId) {
              consulta = consulta.or(
                `${colEmpresa}.is.null,${colEmpresa}.eq.,${colEmpresa}.eq.GLOBAL,${colEmpresa}.eq.GRUPO,${colEmpresa}.eq.DADO A COLETAR,${colEmpresa}.eq.${currentBusinessId}`
              );
            } else if (isConsolidated && selecionadas.length > 0) {
              consulta = consulta.or(
                `${colEmpresa}.is.null,${colEmpresa}.eq.,${colEmpresa}.eq.GLOBAL,${colEmpresa}.eq.GRUPO,${colEmpresa}.eq.DADO A COLETAR,${colEmpresa}.in.(${selecionadas.join(",")})`
              );
            }
          } else {
            if (!isConsolidated && currentBusinessId) {
              consulta = consulta.eq(colEmpresa, currentBusinessId);
            } else if (isConsolidated && selecionadas.length > 0) {
              consulta = consulta.in(colEmpresa, [...selecionadas]);
            }
          }
        }
      }

      const { data, error, count } = await consulta;
      if (sequencia !== sequenciaLeitura.current) return;
      setTotal(error ? null : count);
      if (error) {
        setErro(error.message);
      } else {
        const rows = (data || []) as Record<string, unknown>[];
        setLinhas(rows);
        if (lista.length === 0 && rows.length > 0) {
          const colunasDetectadas: Campo[] = Object.keys(rows[0])
            .filter((col) => !isGov || (col !== "business_id" && col !== "business_id_area"))
            .map((col) => ({
              coluna: col,
              nome_na_planilha: col,
              chave:
                col === "governance_id" ||
                col === "integration_id" ||
                col === "id" ||
                col === "registro_id" ||
                col.endsWith("_id")
                  ? "SIM"
                  : "NAO",
              calculado: "NAO",
            }));
          setCampos(colunasDetectadas);
        }
      }
    } catch (err: any) {
      if (sequencia === sequenciaLeitura.current) {
        setTotal(null);
        setErro(err?.message || `Não foi possível carregar os registros de ${meta.titulo}.`);
      }
    } finally {
      if (sequencia === sequenciaLeitura.current) setCarregando(false);
    }
  }

  useEffect(() => { setPagina(0); setTermoBusca(""); }, [tabela, currentBusinessId, isConsolidated, ignorarFiltroEmpresa]);
  useEffect(() => {
    carregar();
    return () => { sequenciaLeitura.current++; };
  }, [tabela, currentBusinessId, isConsolidated, pagina, ignorarFiltroEmpresa]);

  const linhasFiltradas = useMemo(() => {
    if (!termoBusca) return linhas;
    const termo = termoBusca.toLowerCase();
    return linhas.filter((linha) =>
      Object.values(linha).some((val) => String(val ?? "").toLowerCase().includes(termo))
    );
  }, [linhas, termoBusca]);

  function abrirDrawer(linha: Record<string, unknown>) {
    setDrawerLinha(linha);
    setDrawerAberto(true);
  }

  function abrirEditar(linha: Record<string, unknown>) {
    const next: Record<string, string> = {};
    for (const campo of editaveis) {
      const valor = linha[campo.coluna];
      if (valor !== null && valor !== undefined) next[campo.coluna] = String(valor);
    }
    setForm(next);
    setEditando(String(linha[chave]));
    setVersaoEdicao(linha.row_version);
    setModalAberto(true);
  }

  function solicitarExcluir(id: string) {
    setVersaoExclusao(linhas.find(l => String(l[chave]) === id)?.row_version);
    setExcluirId(id);
    setDialogExcluirAberto(true);
  }

  async function confirmarExclusao() {
    if (!excluirId) return;
    try {
      const { error } = TABELAS_PROTEGIDAS.has(tabela)
        ? await escreverRegistro(tabela, excluirId, versaoExclusao, {}, true)
        : await supabase.from(tabela).delete().eq(chave, excluirId);
      if (error) {
        setErro(error.message);
      } else {
        setAviso("Registro excluído com sucesso.");
        await carregar();
      }
    } catch (err: any) {
      setErro(err?.message || "Erro ao excluir registro.");
    } finally {
      setDialogExcluirAberto(false);
      setExcluirId(null);
    }
  }

  async function salvar(event: FormEvent) {
    event.preventDefault();
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
    const colEmpresa = !isGovernanca
      ? campos.find((campo) => campo.coluna === "business_id" || campo.coluna === "business_id_area")?.coluna
      : undefined;
    if (colEmpresa) {
      if (!isConsolidated) {
        row[colEmpresa] = currentBusinessId;
      } else if (!editando && meta.escopo !== "GLOBAL" && !row[colEmpresa]) {
        setErro("Escolha a empresa ou o escopo do registro antes de salvar.");
        return;
      }
    }

    const { error } = editando
      ? TABELAS_PROTEGIDAS.has(tabela)
        ? await escreverRegistro(tabela, editando, versaoEdicao, row)
        : await supabase.from(tabela).update(row).eq(chave, editando)
      : await supabase.from(tabela).insert(row);
    if (error) {
      setErro(error.message);
      return;
    }

    setAviso(editando ? "Registro atualizado com sucesso." : "Registro gravado com sucesso.");
    setForm({});
    setEditando(null);
    setModalAberto(false);
    await carregar();
  }

  function abrirNovo() {
    setEditando(null);
    const inicial: Record<string, string> = {};
    const colEmpresa = !isGovernanca
      ? campos.find((c) => c.coluna === "business_id" || c.coluna === "business_id_area")?.coluna
      : undefined;
    if (colEmpresa) {
      inicial[colEmpresa] = isConsolidated ? "" : currentBusinessId;
    }
    setForm(inicial);
    setModalAberto(true);
  }

  const formatarValorCelula = (coluna: string, valor: unknown) => {
    if (valor === null || valor === undefined) return "—";
    const str = String(valor);

    if (
      coluna.includes("valor") ||
      coluna.includes("saldo") ||
      coluna.includes("custo") ||
      coluna.includes("receita")
    ) {
      const num = Number(str);
      if (!isNaN(num)) {
        return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      }
    }

    if (coluna === "status" || coluna === "decisao" || coluna === "etapa") {
      const up = str.toUpperCase();
      let variant: "success" | "warning" | "danger" | "info" | "neutral" = "neutral";
      if (["ATIVA", "ATIVO", "PAGO", "RECEBIDO", "EM EXECUÇÃO", "AGORA", "GANHO", "CONECTADO", "CONNECTED"].includes(up)) {
        variant = "success";
      } else if (["PENDENTE", "DEPOIS", "NEGOCIACAO", "PROPOSTA", "PLANEJADA", "PLANNED"].includes(up)) {
        variant = "warning";
      } else if (["CANCELADO", "DESCARTAR", "PERDIDO", "CRÍTICO", "ALTO"].includes(up)) {
        variant = "danger";
      }
      return <ExecutiveBadge variant={variant}>{str}</ExecutiveBadge>;
    }

    return str;
  };

  return (
    <div className="space-y-6">
      <ExecutivePageHeader
        icon={isGovernanca ? ShieldCheck : isIntegracoes ? Cpu : Layers}
        title={meta.titulo}
        description={
          isGovernanca
            ? "Rituais de acompanhamento e alinhamento do fundador com a equipe digital"
            : isIntegracoes
            ? "Serviços externos e automações conectadas à arquitetura do Sistema Helena"
            : meta.descricao
        }
        actions={
          <div className="flex items-center gap-2">
            {(isGovernanca || isIntegracoes) && (
              <div className="flex rounded-lg border border-border/70 bg-card p-0.5">
                <button
                  type="button"
                  onClick={() => setModoVisualizacao("cards")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    modoVisualizacao === "cards"
                      ? "bg-foreground text-background font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Rituais
                </button>
                <button
                  type="button"
                  onClick={() => setModoVisualizacao("tabela")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    modoVisualizacao === "tabela"
                      ? "bg-foreground text-background font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Tabela
                </button>
              </div>
            )}

            {meta.escopo !== "GLOBAL" && (
              <button
                type="button"
                onClick={() => setIgnorarFiltroEmpresa(v => !v)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors shadow-sm ${
                  ignorarFiltroEmpresa
                    ? "bg-emerald-800 text-white border-emerald-900"
                    : "border-border/70 bg-card text-foreground hover:bg-muted"
                }`}
                title={ignorarFiltroEmpresa ? "Clique para filtrar pela empresa ativa" : "Clique para ver registros de todas as empresas"}
              >
                <Building2 className="h-3.5 w-3.5" />
                <span>{ignorarFiltroEmpresa ? "Todas as Empresas" : (currentBusiness?.sigla || "Empresa Ativa")}</span>
              </button>
            )}

            {!meta.somenteLeitura && <button
              type="button"
              onClick={abrirNovo}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Novo registro</span>
            </button>}
          </div>
        }
      />

      {erro && (
        <ExecutiveErrorState
          title={`Acesso aos dados de ${meta.titulo}`}
          message={
            erro.includes("42501") || erro.toLowerCase().includes("permission denied")
              ? "Esta tabela está protegida pela política RLS do Supabase. Certifique-se de estar autenticado com credenciais autorizadas de Fundador ou Administrador."
              : erro
          }
          onRetry={carregar}
        />
      )}

      {/* RITUAIS DE GOVERNANÇA (CARD VIEW) */}
      {isGovernanca && modoVisualizacao === "cards" && !carregando && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {linhas.map((row) => {
            const id = String(row.governance_id || "");
            const ritual = String(row.ritual || "");
            const cadencia = String(row.cadencia || "");
            const dono = String(row.dono || "");
            const participantes = String(row.participantes || "");
            const pauta = String(row.pauta_fixa || row.pauta || "");
            const status = String(row.status || "ATIVO");

            return (
              <div
                key={id}
                onClick={() => abrirDrawer(row)}
                className="group cursor-pointer rounded-xl border border-border/70 bg-card p-5 space-y-4 hover:border-primary/40 hover:shadow-sm transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted text-foreground">
                      {id}
                    </span>
                    <ExecutiveBadge variant="success" dot>
                      {status}
                    </ExecutiveBadge>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                      {ritual}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                      <Clock className="h-3 w-3" />
                      <span>Cadência: {cadencia}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs pt-2 border-t border-border/40">
                    <div>
                      <span className="text-muted-foreground font-medium">Dono:</span>{" "}
                      <span className="text-foreground font-semibold">{dono}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground font-medium">Participantes:</span>{" "}
                      <span className="text-foreground">{participantes}</span>
                    </div>
                    {pauta && (
                      <div className="pt-1">
                        <span className="text-muted-foreground font-medium">Pauta fixa:</span>
                        <p className="text-foreground/90 line-clamp-2 mt-0.5 leading-relaxed">
                          {pauta}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-border/40 flex items-center justify-between text-xs text-primary font-medium">
                  <span>Ver detalhes</span>
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* INTEGRAÇÕES (CARD VIEW) */}
      {isIntegracoes && modoVisualizacao === "cards" && !carregando && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              id: "INT-0001",
              nome: "Google Drive",
              status: "PLANEJADA",
              tipo: "Armazenamento & Documentos",
              descricao: "Repositório canônico de planilhas e relatórios executivos.",
            },
            {
              id: "INT-0002",
              nome: "Gmail",
              status: "PLANEJADA",
              tipo: "Comunicação Externa",
              descricao: "Recebimento e envio estruturado de e-mails corporativos.",
            },
            {
              id: "INT-0003",
              nome: "Google Calendar",
              status: "PLANEJADA",
              tipo: "Agenda & Rituais",
              descricao: "Sincronização bidirecional de eventos e reuniões.",
            },
            {
              id: "INT-0004",
              nome: "Automação de Recorrências",
              status: "PLANEJADA",
              tipo: "Finanças & Assinaturas",
              descricao: "Geração periódica automática de obrigações e cobranças.",
            },
          ].map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-border/70 bg-card p-5 space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-muted-foreground">
                    {item.id}
                  </span>
                  <ExecutiveBadge variant="warning">{item.status}</ExecutiveBadge>
                </div>
                <h3 className="text-sm font-semibold text-foreground">{item.nome}</h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {item.descricao}
                </p>
              </div>
              <div className="pt-2 border-t border-border/40 text-[11px] text-muted-foreground font-mono">
                {item.tipo}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* BARRA DE BUSCA */}
      {(!isGovernanca && !isIntegracoes || modoVisualizacao === "tabela") && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={`Filtrar nesta página de ${meta.titulo}…`}
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
              className="w-full rounded-lg border border-border/70 bg-background py-1.5 pl-9 pr-3 text-xs placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
            />
          </div>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {linhasFiltradas.length} registro(s)
          </span>
        </div>
      )}

      {/* TABELA DE DADOS PADRONIZADA (48-52px de altura) */}
      {isFoco && !carregando && <>
        <div className="he-focus-grid" aria-label="Frentes de trabalho">
          {linhasFiltradas.map((linha, index) => <button key={String(linha[chave] ?? index)} className={`he-focus-card ${String(linha.status).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase() === 'EM EXECUCAO' ? 'is-current' : ''}`} onClick={() => abrirDrawer(linha)}>
            <div><small>PRIORIDADE {String(linha.ordem || index + 1)}</small>{formatarValorCelula('status', linha.status)}</div>
            <h2>{String(linha.frente || 'Frente de trabalho')}</h2>
            <p>{String(linha.objetivo || 'Abra os detalhes para conhecer esta frente.')}</p>
            <footer><span>{String(linha.responsavel || 'Responsável a definir')}</span><span>Ver detalhes →</span></footer>
          </button>)}
        </div>
        {!linhasFiltradas.length && <ExecutiveEmptyState icon={Layers} title="Nenhuma frente encontrada" description="Ajuste sua busca ou cadastre uma frente de trabalho."/>}
        <button className="hc-button" aria-expanded={mostrarTabelaFoco} onClick={() => setMostrarTabelaFoco(v => !v)}><TableProperties size={16}/>{mostrarTabelaFoco ? 'Ocultar tabela completa' : 'Ver tabela completa'}</button>
      </>}
      {total !== null && <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground" aria-label="Paginação dos registros">
        <span>{total ? `${pagina * 200 + 1}–${Math.min((pagina + 1) * 200, total)}` : "0"} de {total} registros autorizados. A busca filtra esta página.</span>
        <div className="flex gap-2">
          <button className="rounded border px-3 py-2 disabled:opacity-40" disabled={carregando || pagina === 0} onClick={() => setPagina(p => p - 1)}>Página anterior</button>
          <button className="rounded border px-3 py-2 disabled:opacity-40" disabled={carregando || (pagina + 1) * 200 >= total} onClick={() => setPagina(p => p + 1)}>Próxima página</button>
        </div>
      </div>}
      {(!isGovernanca && !isIntegracoes || modoVisualizacao === "tabela") && (!isFoco || mostrarTabelaFoco || carregando) && (
        carregando ? (
          <ExecutiveLoadingState message={`Carregando registros de ${meta.titulo}...`} />
        ) : linhasFiltradas.length === 0 ? (
          <div className="space-y-3">
            <ExecutiveEmptyState
              icon={Layers}
              title={`Nenhum registro em ${meta.titulo}`}
              description={
                termoBusca
                  ? `Nenhum resultado corresponde à busca "${termoBusca}".`
                  : `Ainda não há registros cadastrados para ${ignorarFiltroEmpresa ? "o sistema global" : (currentBusiness?.sigla || "este contexto")}.`
              }
            />
            {!ignorarFiltroEmpresa && meta.escopo !== "GLOBAL" && (
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setIgnorarFiltroEmpresa(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted shadow-sm transition-colors"
                >
                  <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Ver registros de todas as empresas do grupo</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/70 bg-card shadow-sm">
            <table className="w-full min-w-[700px] text-left text-xs">
              <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground text-[11px] font-medium uppercase tracking-wider">
                <tr className="h-10">
                  <th className="px-4 font-semibold">Referência</th>
                  {colunasTabela.map((coluna) => (
                    <th key={coluna} className="px-4 font-semibold">
                      {rotuloCampo(coluna)}
                    </th>
                  ))}
                  <th className="px-4 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {linhasFiltradas.map((linha, index) => {
                  const id = String(linha[chave] ?? index);
                  return (
                    <tr
                      key={id}
                      onClick={() => abrirDrawer(linha)}
                      className="h-12 hover:bg-muted/30 transition-colors cursor-pointer"
                    >
                      <td className="px-4 font-mono font-medium text-foreground">{id}</td>
                      {colunasTabela.map((coluna) => (
                        <td key={coluna} className="max-w-[240px] px-4 truncate">
                          {formatarValorCelula(coluna, linha[coluna])}
                        </td>
                      ))}
                      <td className="px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => abrirDrawer(linha)}
                            className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            title="Ver detalhes"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          {!meta.somenteLeitura && <button
                            type="button"
                            onClick={() => abrirEditar(linha)}
                            className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            title="Editar registro"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>}
                          {!meta.somenteLeitura && !SEM_EXCLUSAO.has(tabela) && (
                            <button
                              type="button"
                              onClick={() => solicitarExcluir(id)}
                              className="p-1.5 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
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
              </tbody>
            </table>
          </div>
        )
      )}

      {/* DRAWER LATERAL DE DETALHES */}
      <ExecutiveDrawer
        open={drawerAberto}
        onOpenChange={setDrawerAberto}
        title={drawerLinha ? `${String(drawerLinha[chave] || "Registro")}` : "Detalhes"}
        description={`${meta.titulo} · Informações do registro`}
        width="max-w-lg"
      >
        {drawerLinha && (
          <div className="space-y-4 text-xs">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3.5 space-y-2">
              <span className="font-semibold text-foreground text-xs uppercase tracking-wide">
                Identificador: {String(drawerLinha[chave])}
              </span>
            </div>

            <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1 scrollbar-thin">
              {Object.entries(drawerLinha).map(([col, val]) => (
                <div key={col} className="rounded-md border border-border/40 bg-background/50 p-2.5 space-y-0.5">
                  <span className="text-[11px] font-medium text-muted-foreground capitalize">{rotuloCampo(col)}</span>
                  <p className="text-xs text-foreground font-mono break-all">
                    {val === null || val === undefined ? "—" : String(val)}
                  </p>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-border/40 flex justify-end gap-2">
              {!meta.somenteLeitura && <button
                type="button"
                onClick={() => {
                  setDrawerAberto(false);
                  abrirEditar(drawerLinha);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span>Editar</span>
              </button>}
            </div>
          </div>
        )}
      </ExecutiveDrawer>

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      <ExecutiveConfirmDialog
        open={dialogExcluirAberto}
        onOpenChange={setDialogExcluirAberto}
        title="Excluir registro?"
        description={`Tem certeza que deseja excluir o registro "${excluirId}"? Esta ação removerá a linha da base de dados.`}
        confirmText="Excluir registro"
        onConfirm={confirmarExclusao}
        danger
      />

      {/* MODAL DE EDIÇÃO / INSERÇÃO */}
      <RecordDialog.Root open={modalAberto} onOpenChange={setModalAberto}>
        <RecordDialog.Portal>
          <RecordDialog.Overlay className="he-record-overlay"/>
          <RecordDialog.Content className="he-record-editor" onInteractOutside={e=>e.preventDefault()} onOpenAutoFocus={()=>{origemEditor.current=document.activeElement as HTMLElement;}} onCloseAutoFocus={e=>{e.preventDefault();origemEditor.current?.focus();}}>
            <header><span className="he-page-kicker">{meta.titulo}</span><RecordDialog.Title>{editando ? 'Editar registro' : 'Um novo registro.'}</RecordDialog.Title><RecordDialog.Description>Preencha as informações abaixo. Revise antes de salvar.</RecordDialog.Description><RecordDialog.Close aria-label="Fechar formulário"><X size={18}/></RecordDialog.Close></header>
            <form onSubmit={salvar} className="mt-4 space-y-4">
              {erro && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 max-h-[60vh] overflow-y-auto p-1 scrollbar-thin">
                {editaveis.map((campo) => (
                  <div key={campo.coluna} className="space-y-1">
                    <label htmlFor={`registro-${campo.coluna}`} className="text-[11px] font-medium text-foreground flex items-center justify-between">
                      <span>{rotuloCampo(campo.coluna)}</span>
                      {campo.chave === "SIM" && (
                        <span className="text-[10px] text-primary font-mono font-bold">Identificador</span>
                      )}
                    </label>
                    {isConsolidated && !editando && meta.escopo !== "GLOBAL" &&
                      (campo.coluna === "business_id" || campo.coluna === "business_id_area") ? (
                      <select
                        id={`registro-${campo.coluna}`}
                        className="w-full rounded-lg border border-border/70 bg-background px-3 py-1.5 text-xs focus:border-primary focus:outline-none"
                        value={form[campo.coluna] || ""}
                        onChange={(e) => setForm({ ...form, [campo.coluna]: e.target.value })}
                        required
                      >
                        <option value="">Selecione a empresa ou escopo</option>
                        {empresas.map((empresa) => <option key={empresa.id} value={empresa.id}>{empresa.nome}</option>)}
                        {(meta.escopo === "MISTO" || tabela === "tarefas") && <>
                          <option value="GRUPO">Grupo</option>
                          <option value="Sistema">Sistema</option>
                        </>}
                      </select>
                    ) : (
                      <input
                        className="w-full rounded-lg border border-border/70 bg-background px-3 py-1.5 text-xs focus:border-primary focus:outline-none"
                        value={form[campo.coluna] || ""}
                        onChange={(e) => setForm({ ...form, [campo.coluna]: e.target.value })}
                        id={`registro-${campo.coluna}`}
                        placeholder={`Informe ${rotuloCampo(campo.coluna).toLocaleLowerCase("pt-BR")}…`}
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 border-t border-border/50 pt-3">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="rounded-lg border border-border/70 px-3 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 shadow-sm"
                >
                  {editando ? "Atualizar" : "Salvar"}
                </button>
              </div>
            </form>
          </RecordDialog.Content>
        </RecordDialog.Portal>
      </RecordDialog.Root>
    </div>
  );
}
