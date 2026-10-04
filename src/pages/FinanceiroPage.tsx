import React, { useEffect, useMemo, useState } from "react";
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Scale,
  CalendarClock,
  Clock,
  Layers,
  TableProperties,
  Plus,
  Search,
  Filter,
  Download,
  Edit3,
  CheckCircle,
  Landmark,
  Target,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { lerCaixa, lerDre, type Lancamento } from "@/lib/caixa";
import { escreverRegistro } from "@/lib/escrita-protegida";
import { useBusiness } from "@/contexts/BusinessContext";
import { ExecutivePageHeader } from "@/components/executive/ExecutivePageHeader";
import { ExecutiveMetricCard } from "@/components/executive/ExecutiveMetricCard";
import { ExecutiveBadge } from "@/components/executive/ExecutiveBadge";
import { ExecutiveLoadingState } from "@/components/executive/ExecutiveLoadingState";
import { ExecutiveErrorState } from "@/components/executive/ExecutiveErrorState";
import { ExecutiveEmptyState } from "@/components/executive/ExecutiveEmptyState";
import { LancamentoModal, type LancamentoEditavel } from "@/components/financeiro/LancamentoModal";
import { OrcamentoModal } from "@/components/financeiro/OrcamentoModal";

type Recorrencia = {
  recurrence_id: string;
  business_id: string;
  nome: string;
  valor?: string | number | null;
  equivalente_mensal_brl?: string | number | null;
  frequencia?: string | null;
  proxima_ocorrencia?: string | null;
  status?: string | null;
};

type Fluxo = {
  periodo_inicio?: string | null;
  periodo_fim?: string | null;
  entradas_liquidadas_brl?: string | number | null;
  saidas_liquidadas_brl?: string | number | null;
  fluxo_liquido_brl?: string | number | null;
  a_receber_aberto_brl?: string | number | null;
  a_pagar_aberto_brl?: string | number | null;
};

type PlanoConta = {
  plano_conta_id: string;
  codigo?: string | null;
  nome_conta?: string | null;
  tipo?: string | null;
  categoria_macro?: string | null;
  descricao?: string | null;
};

type ContaFinanceira = {
  conta_id: string;
  business_id?: string | null;
  nome?: string | null;
  instituicao?: string | null;
  moeda?: string | null;
  saldo_atual_brl?: number | string | null;
  saldo_inicial_brl?: number | string | null;
  ativa?: string | null;
};

type OrcamentoItem = {
  budget_id: string;
  business_id?: string | null;
  periodo_inicio?: string | null;
  periodo_fim?: string | null;
  plano_conta_id?: string | null;
  valor_orcado_brl?: number | string | null;
  valor_realizado_brl?: number | string | null;
  desvio_brl?: number | string | null;
  responsavel?: string | null;
  status?: string | null;
  observacoes?: string | null;
};

export type LancamentoCompleto = Lancamento & {
  finance_id?: string;
  descricao?: string | null;
  contraparte?: string | null;
  vencimento?: string | null;
  valor_brl?: number | string | null;
  categoria?: string | null;
  plano_conta_id?: string | null;
  row_version?: number | string;
};

function moeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

type TabFinanceiro =
  | "visao_geral"
  | "lancamentos"
  | "fluxo_caixa"
  | "dre"
  | "orcamento"
  | "recorrencias"
  | "plano_contas"
  | "contas_bancarias";

const TABS: { id: TabFinanceiro; label: string; icon: any }[] = [
  { id: "visao_geral", label: "Visão Geral", icon: Wallet },
  { id: "lancamentos", label: "Lançamentos", icon: TableProperties },
  { id: "fluxo_caixa", label: "Fluxo de Caixa", icon: ArrowDownLeft },
  { id: "dre", label: "DRE", icon: Scale },
  { id: "orcamento", label: "Orçamento", icon: Target },
  { id: "recorrencias", label: "Recorrências", icon: CalendarClock },
  { id: "plano_contas", label: "Plano de Contas", icon: Layers },
  { id: "contas_bancarias", label: "Contas Bancárias", icon: Landmark },
];

export default function FinanceiroPage() {
  const { currentBusinessId, isConsolidated, selecionadas, todasLigadas, nomeDe } = useBusiness();
  const [aba, setAba] = useState<TabFinanceiro>("visao_geral");
  const [lancamentos, setLancamentos] = useState<LancamentoCompleto[]>([]);
  const [recorrencias, setRecorrencias] = useState<Recorrencia[]>([]);
  const [fluxos, setFluxos] = useState<Fluxo[]>([]);
  const [planoContas, setPlanoContas] = useState<PlanoConta[]>([]);
  const [contasFinanceiras, setContasFinanceiras] = useState<ContaFinanceira[]>([]);
  const [orcamentos, setOrcamentos] = useState<OrcamentoItem[]>([]);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  // Modais de Cadastro / Edição
  const [modalLancamentoAberto, setModalLancamentoAberto] = useState(false);
  const [lancamentoParaEditar, setLancamentoParaEditar] = useState<LancamentoEditavel | null>(null);
  const [modalOrcamentoAberto, setModalOrcamentoAberto] = useState(false);

  // Filtros da aba de Lançamentos
  const [buscaTexto, setBuscaTexto] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("TODOS");
  const [filtroFluxo, setFiltroFluxo] = useState<string>("TODOS");

  const filtro = todasLigadas ? undefined : selecionadas;

  async function carregarDados() {
    setCarregando(true);
    setErro("");

    try {
      let qFin = supabase.from("financeiro").select("*").order("vencimento", { ascending: false }).limit(200);
      let qRec = supabase.from("recorrencias").select("*").order("proxima_ocorrencia");
      let qFluxo = supabase.from("fluxo_caixa").select("*").order("periodo_inicio", { ascending: false }).limit(12);
      let qPlano = supabase.from("plano_contas").select("*").order("plano_conta_id");
      let qContas = supabase.from("contas_financeiras").select("*").order("conta_id");
      let qOrcamento = supabase.from("orcamento").select("*").order("periodo_inicio", { ascending: false });

      if (!isConsolidated && currentBusinessId) {
        qFin = qFin.eq("business_id", currentBusinessId);
        qRec = qRec.eq("business_id", currentBusinessId);
        qFluxo = qFluxo.eq("business_id", currentBusinessId);
        qContas = qContas.eq("business_id", currentBusinessId);
        qOrcamento = qOrcamento.eq("business_id", currentBusinessId);
      } else if (isConsolidated && selecionadas.length) {
        qFin = qFin.in("business_id", selecionadas);
        qRec = qRec.in("business_id", selecionadas);
        qFluxo = qFluxo.in("business_id", selecionadas);
        qContas = qContas.in("business_id", selecionadas);
        qOrcamento = qOrcamento.in("business_id", selecionadas);
      }

      const [fin, rec, flux, plano, contas, orc] = await Promise.all([
        qFin,
        qRec,
        qFluxo,
        qPlano,
        qContas,
        qOrcamento,
      ]);

      const falha = fin.error || rec.error || flux.error || plano.error || contas.error || orc.error;
      if (falha) {
        setErro(falha.message);
      }

      setLancamentos((fin.data || []) as LancamentoCompleto[]);
      setRecorrencias((rec.data || []) as Recorrencia[]);
      setFluxos((flux.data || []) as Fluxo[]);
      setPlanoContas((plano.data || []) as PlanoConta[]);
      setContasFinanceiras((contas.data || []) as ContaFinanceira[]);
      setOrcamentos((orc.data || []) as OrcamentoItem[]);
    } catch (err: any) {
      setErro(err?.message || "Não foi possível carregar os dados financeiros.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarDados();
  }, [currentBusinessId, isConsolidated]);

  const caixa = useMemo(() => lerCaixa(lancamentos, filtro), [lancamentos, filtro]);
  const dre = useMemo(() => lerDre(lancamentos, filtro), [lancamentos, filtro]);

  // Cálculos do Cockpit Financeiro
  const cockpit = useMemo(() => {
    let entradas = 0;
    let saidas = 0;
    let aReceber = 0;
    let aPagar = 0;
    let temLiquidados = false;

    for (const l of lancamentos) {
      if (!todasLigadas && l.business_id && !selecionadas.includes(l.business_id)) continue;
      const st = (l.status || "").toUpperCase();
      const fl = (l.fluxo || "").toUpperCase();
      const val = num(l.valor_brl || l.valor_original);

      if (st === "RECEBIDO" || st === "PAGO" || st === "LIQUIDADO") {
        temLiquidados = true;
        if (fl.startsWith("ENTRADA") || fl.includes("RECEITA")) {
          entradas += val;
        } else if (fl.startsWith("SAIDA") || fl.startsWith("SAÍDA") || fl.includes("DESPESA")) {
          saidas += val;
        }
      } else if (st === "ABERTO" || st === "PENDENTE" || st === "PREVISTO") {
        if (fl.startsWith("ENTRADA") || fl.includes("RECEITA")) {
          aReceber += val;
        } else if (fl.startsWith("SAIDA") || fl.startsWith("SAÍDA") || fl.includes("DESPESA")) {
          aPagar += val;
        }
      }
    }

    return {
      temLiquidados,
      caixaRealizado: caixa.vazio ? null : caixa.saldo,
      entradas: temLiquidados ? entradas : null,
      saidas: temLiquidados ? saidas : null,
      resultado: dre.vazio ? null : dre.resultado,
      aReceber: aReceber > 0 ? aReceber : null,
      aPagar: aPagar > 0 ? aPagar : null,
    };
  }, [lancamentos, caixa, dre, todasLigadas, selecionadas]);

  // Lançamentos filtrados
  const lancamentosFiltrados = useMemo(() => {
    return lancamentos.filter((l) => {
      if (filtro && l.business_id && !filtro.includes(l.business_id)) return false;

      // Busca texto
      if (buscaTexto.trim()) {
        const termo = buscaTexto.toLowerCase();
        const textoDesc = (l.descricao || "").toLowerCase();
        const textoContra = (l.contraparte || "").toLowerCase();
        const textoConta = (l.conta_id || "").toLowerCase();
        const textoCat = (l.categoria || "").toLowerCase();
        if (
          !textoDesc.includes(termo) &&
          !textoContra.includes(termo) &&
          !textoConta.includes(termo) &&
          !textoCat.includes(termo)
        ) {
          return false;
        }
      }

      // Filtro de Fluxo
      if (filtroFluxo !== "TODOS") {
        const fl = (l.fluxo || "").toUpperCase();
        if (filtroFluxo === "ENTRADA" && !fl.startsWith("ENTRADA") && !fl.includes("RECEITA")) return false;
        if (filtroFluxo === "SAIDA" && !fl.startsWith("SA") && !fl.includes("DESPESA")) return false;
      }

      // Filtro de Status
      if (filtroStatus !== "TODOS") {
        const st = (l.status || "").toUpperCase();
        if (filtroStatus === "LIQUIDADO" && !st.includes("PAGO") && !st.includes("RECEB")) return false;
        if (filtroStatus === "ABERTO" && !st.includes("ABERT") && !st.includes("PEND")) return false;
        if (filtroStatus === "PREVISTO" && !st.includes("PREV")) return false;
      }

      return true;
    });
  }, [lancamentos, filtro, buscaTexto, filtroFluxo, filtroStatus]);

  // Função para dar baixa rápida / liquidar um lançamento aberto
  async function liquidarRapido(l: LancamentoCompleto) {
    if (!l.finance_id) return;
    const isEntrada = (l.fluxo || "").toUpperCase().startsWith("ENTRADA");
    const novoStatus = isEntrada ? "RECEBIDO" : "PAGO";
    const hoje = new Date().toISOString().slice(0, 10);

    const payload = {
      status: novoStatus,
      liquidacao: hoje,
    };

    if (l.row_version) {
      await escreverRegistro("financeiro", l.finance_id, l.row_version, payload);
    } else {
      await supabase.from("financeiro").update(payload).eq("finance_id", l.finance_id);
    }
    carregarDados();
  }

  // Exportar Lançamentos para CSV
  function exportarCsv() {
    if (!lancamentosFiltrados.length) return;
    const headers = ["ID", "Empresa", "Data", "Descricao", "Contraparte", "Conta", "Fluxo", "Status", "Competencia", "Valor_BRL"];
    const rows = lancamentosFiltrados.map((l) => [
      l.finance_id || "",
      l.business_id || "",
      l.vencimento || l.liquidacao || "",
      `"${(l.descricao || "").replace(/"/g, '""')}"`,
      `"${(l.contraparte || "").replace(/"/g, '""')}"`,
      l.conta_id || "",
      l.fluxo || "",
      l.status || "",
      l.competencia || "",
      num(l.valor_brl || l.valor_original).toFixed(2),
    ]);

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `lancamentos_financeiros_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-6">
      {/* Header Executivo */}
      <ExecutivePageHeader
        icon={Wallet}
        title="Financeiro"
        description="Cockpit de caixa, competência, fluxo e gestão orçamentária"
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setLancamentoParaEditar(null);
                setModalLancamentoAberto(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-foreground text-background px-3.5 py-1.5 text-xs font-semibold hover:opacity-90 transition-opacity shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Novo Lançamento</span>
            </button>
            <button
              type="button"
              onClick={() => setAba("lancamentos")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/70 transition-colors"
            >
              <TableProperties className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Ver lançamentos</span>
            </button>
          </div>
        }
      />

      {/* Tabs Oficiais */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-border/50">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setAba(t.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                aba === t.id
                  ? "bg-foreground text-background font-semibold shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {erro && (
        <ExecutiveErrorState
          title="Erro ao carregar registros financeiros"
          message={erro}
          onRetry={carregarDados}
        />
      )}

      {carregando ? (
        <ExecutiveLoadingState message="Consultando lançamentos e demonstrativos..." />
      ) : (
        <>
          {/* TAB 1: VISÃO GERAL */}
          {aba === "visao_geral" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <ExecutiveMetricCard
                  label="Caixa realizado"
                  value={cockpit.caixaRealizado !== null ? moeda(cockpit.caixaRealizado) : null}
                  subtext={cockpit.caixaRealizado !== null ? "Lançamentos liquidados" : "Sem lançamentos liquidados"}
                  icon={Wallet}
                />
                <ExecutiveMetricCard
                  label="Entradas"
                  value={cockpit.entradas !== null ? moeda(cockpit.entradas) : null}
                  subtext={cockpit.entradas !== null ? "Liquidadas no período" : "Sem dados realizados"}
                  icon={ArrowDownLeft}
                />
                <ExecutiveMetricCard
                  label="Saídas"
                  value={cockpit.saidas !== null ? moeda(cockpit.saidas) : null}
                  subtext={cockpit.saidas !== null ? "Liquidadas no período" : "Sem dados realizados"}
                  icon={ArrowUpRight}
                />
                <ExecutiveMetricCard
                  label="Resultado"
                  value={cockpit.resultado !== null ? moeda(cockpit.resultado) : null}
                  subtext={cockpit.resultado !== null ? "DRE de competência" : "Sem competência na DRE"}
                  icon={Scale}
                />
                <ExecutiveMetricCard
                  label="A receber"
                  value={cockpit.aReceber !== null ? moeda(cockpit.aReceber) : null}
                  subtext={cockpit.aReceber !== null ? "Previsão aberta" : "Sem valores em aberto"}
                  icon={CalendarClock}
                />
                <ExecutiveMetricCard
                  label="A pagar"
                  value={cockpit.aPagar !== null ? moeda(cockpit.aPagar) : null}
                  subtext={cockpit.aPagar !== null ? "Obrigações abertas" : "Sem valores em aberto"}
                  icon={Clock}
                />
              </div>

              {!erro && !lancamentos.length && !fluxos.length && (
                <section className="he-finance-start">
                  <div>
                    <span className="hc-eyebrow">BASE FINANCEIRA</span>
                    <h2>
                      Uma visão de caixa começa
                      <br />
                      com registros confiáveis.
                    </h2>
                    <p>
                      Sem lançamentos visíveis neste recorte. Registre o primeiro lançamento ou consulte
                      as previsões, as obrigações e a estrutura de contas.
                    </p>
                  </div>
                  <div>
                    <button
                      onClick={() => {
                        setLancamentoParaEditar(null);
                        setModalLancamentoAberto(true);
                      }}
                    >
                      Cadastrar Lançamento <Plus size={18} />
                    </button>
                    <button onClick={() => setAba("recorrencias")}>
                      Consultar recorrências <CalendarClock size={18} />
                    </button>
                    <button onClick={() => setAba("orcamento")}>
                      Ver orçamento <ArrowUpRight size={18} />
                    </button>
                  </div>
                </section>
              )}

              {/* Fluxo de Caixa Consolidado */}
              {fluxos.length > 0 && (
                <div className="rounded-xl border border-border/70 bg-card p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Fluxo de Caixa Consolidado</h3>
                      <p className="text-xs text-muted-foreground">
                        Período: {fluxos[0].periodo_inicio || "—"} até {fluxos[0].periodo_fim || "—"}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div className="rounded-lg border border-border/50 bg-background/50 p-3">
                      <span className="text-xs text-muted-foreground">Entradas Liquidadas:</span>
                      <p className="text-sm font-semibold text-foreground mt-0.5">
                        {moeda(num(fluxos[0].entradas_liquidadas_brl))}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-background/50 p-3">
                      <span className="text-xs text-muted-foreground">Saídas Liquidadas:</span>
                      <p className="text-sm font-semibold text-foreground mt-0.5">
                        {moeda(num(fluxos[0].saidas_liquidadas_brl))}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-background/50 p-3">
                      <span className="text-xs text-muted-foreground">Fluxo Líquido:</span>
                      <p className="text-sm font-semibold text-foreground mt-0.5">
                        {moeda(num(fluxos[0].fluxo_liquido_brl))}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: LANÇAMENTOS */}
          {aba === "lancamentos" && (
            <div className="space-y-4">
              {/* Barra de Filtros e Busca */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-3">
                <div className="flex flex-1 items-center gap-2">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Buscar por descrição, cliente, fornecedor ou conta..."
                      value={buscaTexto}
                      onChange={(e) => setBuscaTexto(e.target.value)}
                      className="w-full rounded-lg border border-border/60 bg-background pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  {/* Filtro de Tipo/Fluxo */}
                  <select
                    aria-label="Filtro de Fluxo"
                    value={filtroFluxo}
                    onChange={(e) => setFiltroFluxo(e.target.value)}
                    className="rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="TODOS">Todos os Fluxos</option>
                    <option value="ENTRADA">Receitas / Entradas</option>
                    <option value="SAIDA">Despesas / Saídas</option>
                  </select>

                  {/* Filtro de Status */}
                  <select
                    aria-label="Filtro de Status"
                    value={filtroStatus}
                    onChange={(e) => setFiltroStatus(e.target.value)}
                    className="rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="TODOS">Todos os Status</option>
                    <option value="LIQUIDADO">Liquidados (Pago/Recebido)</option>
                    <option value="ABERTO">Abertos / Pendentes</option>
                    <option value="PREVISTO">Previstos</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={exportarCsv}
                    disabled={!lancamentosFiltrados.length}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/60 disabled:opacity-50 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Exportar CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLancamentoParaEditar(null);
                      setModalLancamentoAberto(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-foreground text-background px-3.5 py-1.5 text-xs font-semibold hover:opacity-90 transition-opacity shadow-sm"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Novo Lançamento</span>
                  </button>
                </div>
              </div>

              {lancamentosFiltrados.length === 0 ? (
                <ExecutiveEmptyState
                  icon={Wallet}
                  title="Nenhum lançamento encontrado"
                  description={
                    buscaTexto || filtroFluxo !== "TODOS" || filtroStatus !== "TODOS"
                      ? "Nenhum lançamento corresponde aos filtros selecionados."
                      : "Ainda não existem lançamentos financeiros registrados para o recorte atual."
                  }
                />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border/70 bg-card shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground text-[11px] font-medium">
                      <tr>
                        <th className="px-4 py-3">Data</th>
                        <th className="px-4 py-3">Descrição</th>
                        <th className="px-4 py-3">Empresa</th>
                        <th className="px-4 py-3">Conta</th>
                        <th className="px-4 py-3">Tipo</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Competência</th>
                        <th className="px-4 py-3 text-right">Valor</th>
                        <th className="px-4 py-3 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {lancamentosFiltrados.map((l, idx) => {
                        const isEntrada = (l.fluxo || "").toUpperCase().startsWith("ENTRADA");
                        const val = num(l.valor_brl || l.valor_original);
                        const isAberto = (l.status || "").toUpperCase() === "ABERTO" || (l.status || "").toUpperCase() === "PENDENTE";

                        return (
                          <tr key={l.finance_id || idx} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                              {l.vencimento || l.liquidacao || "—"}
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-medium text-foreground max-w-[240px] truncate">
                                {l.descricao || "Lançamento financeiro"}
                              </p>
                              {l.contraparte && (
                                <p className="text-[10px] text-muted-foreground truncate">{l.contraparte}</p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {l.business_id ? nomeDe(l.business_id) : "—"}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {l.conta_id || "—"}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-[11px] font-medium ${isEntrada ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>
                                {l.fluxo || "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <ExecutiveBadge
                                variant={
                                  l.status?.toLowerCase().includes("pago") || l.status?.toLowerCase().includes("receb")
                                    ? "success"
                                    : l.status?.toLowerCase().includes("pend") || l.status?.toLowerCase().includes("abert")
                                    ? "warning"
                                    : "neutral"
                                }
                              >
                                {l.status || "—"}
                              </ExecutiveBadge>
                            </td>
                            <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                              {l.competencia || "—"}
                            </td>
                            <td
                              className={`px-4 py-3 text-right font-medium font-mono whitespace-nowrap ${
                                isEntrada ? "text-emerald-700 dark:text-emerald-400 font-semibold" : "text-foreground"
                              }`}
                            >
                              {moeda(val)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {isAberto && (
                                  <button
                                    type="button"
                                    title="Quitar / Liquidar Lançamento"
                                    onClick={() => liquidarRapido(l)}
                                    className="rounded p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-colors"
                                  >
                                    <CheckCircle className="h-3.5 w-3.5" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  title="Editar Lançamento"
                                  onClick={() => {
                                    setLancamentoParaEditar(l);
                                    setModalLancamentoAberto(true);
                                  }}
                                  className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: FLUXO DE CAIXA */}
          {aba === "fluxo_caixa" && (
            <div className="space-y-4">
              {fluxos.length === 0 ? (
                <ExecutiveEmptyState
                  icon={Wallet}
                  title="Nenhum registro de fluxo de caixa"
                  description="Ainda não há consolidação de fluxo de caixa para a empresa selecionada."
                />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border/70 bg-card shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground text-[11px] font-medium">
                      <tr>
                        <th className="px-4 py-3">Período Início</th>
                        <th className="px-4 py-3">Período Fim</th>
                        <th className="px-4 py-3 text-right">Entradas</th>
                        <th className="px-4 py-3 text-right">Saídas</th>
                        <th className="px-4 py-3 text-right">Fluxo Líquido</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {fluxos.map((f, i) => (
                        <tr key={i} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-mono">{f.periodo_inicio || "—"}</td>
                          <td className="px-4 py-3 font-mono">{f.periodo_fim || "—"}</td>
                          <td className="px-4 py-3 text-right font-mono">{moeda(num(f.entradas_liquidadas_brl))}</td>
                          <td className="px-4 py-3 text-right font-mono">{moeda(num(f.saidas_liquidadas_brl))}</td>
                          <td className="px-4 py-3 text-right font-mono font-semibold">{moeda(num(f.fluxo_liquido_brl))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: DRE */}
          {aba === "dre" && (
            <div className="rounded-xl border border-border/70 bg-card p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-border/40 pb-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Demonstração do Resultado (Regime de Competência)</h3>
                  <p className="text-xs text-muted-foreground">Apuração de receitas e despesas vinculadas ao período contábil</p>
                </div>
              </div>
              {dre.vazio ? (
                <p className="text-xs text-muted-foreground">
                  Nenhum lançamento com competência registrada para apuração de DRE.
                </p>
              ) : (
                <div className="space-y-3 text-xs max-w-lg">
                  <div className="flex justify-between py-2 border-b border-border/30">
                    <span className="text-muted-foreground">Total de Receitas Operacionais:</span>
                    <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">{moeda(dre.entradas)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border/30">
                    <span className="text-muted-foreground">Total de Despesas Operacionais:</span>
                    <span className="font-mono font-medium text-rose-600 dark:text-rose-400">{moeda(dre.saidas)}</span>
                  </div>
                  <div className="flex justify-between py-2.5 border-t border-border/60 bg-muted/20 px-2 rounded-lg">
                    <span className="font-semibold text-foreground">Resultado Líquido do Período:</span>
                    <span className={`font-mono font-bold ${dre.resultado >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                      {moeda(dre.resultado)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: ORÇAMENTO */}
          {aba === "orcamento" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-border/70 bg-card p-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Planejamento Orçamentário</h3>
                  <p className="text-xs text-muted-foreground">
                    Acompanhamento de metas de despesas e limites por centro de custo
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setModalOrcamentoAberto(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-foreground text-background px-3.5 py-1.5 text-xs font-semibold hover:opacity-90 transition-opacity"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Nova Meta Orçamentária</span>
                </button>
              </div>

              {orcamentos.length === 0 ? (
                <ExecutiveEmptyState
                  icon={Target}
                  title="Nenhum orçamento cadastrado"
                  description="Defina metas e limites para os centros de custo da empresa para acompanhar desvios orçamentários."
                />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border/70 bg-card shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground text-[11px] font-medium">
                      <tr>
                        <th className="px-4 py-3">Período</th>
                        <th className="px-4 py-3">Centro de Custo / Conta</th>
                        <th className="px-4 py-3">Responsável</th>
                        <th className="px-4 py-3 text-right">Valor Orçado</th>
                        <th className="px-4 py-3 text-right">Valor Realizado</th>
                        <th className="px-4 py-3 text-right">Desvio</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {orcamentos.map((o) => {
                        const orcado = num(o.valor_orcado_brl);
                        const realizado = num(o.valor_realizado_brl);
                        const desvio = orcado - realizado;
                        const pct = orcado > 0 ? Math.min(100, Math.round((realizado / orcado) * 100)) : 0;

                        return (
                          <tr key={o.budget_id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                              {o.periodo_inicio || "—"} até {o.periodo_fim || "—"}
                            </td>
                            <td className="px-4 py-3 font-medium text-foreground">
                              {o.plano_conta_id || "Geral"}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {o.responsavel || "—"}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-medium">
                              {moeda(orcado)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                              {moeda(realizado)}
                              <div className="mt-1 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${pct > 100 ? "bg-rose-500" : "bg-primary"}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </td>
                            <td className={`px-4 py-3 text-right font-mono font-semibold ${desvio >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                              {moeda(desvio)}
                            </td>
                            <td className="px-4 py-3">
                              <ExecutiveBadge variant="neutral">{o.status || "Ativo"}</ExecutiveBadge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: RECORRÊNCIAS */}
          {aba === "recorrencias" && (
            <div className="space-y-4">
              {recorrencias.length === 0 ? (
                <ExecutiveEmptyState
                  icon={CalendarClock}
                  title="Nenhuma recorrência ativa"
                  description="Não há assinaturas, contratos ou despesas recorrentes registradas."
                />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border/70 bg-card shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground text-[11px] font-medium">
                      <tr>
                        <th className="px-4 py-3">Nome</th>
                        <th className="px-4 py-3">Frequência</th>
                        <th className="px-4 py-3">Próxima Ocorrência</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Equivalente Mensal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {recorrencias.map((r) => (
                        <tr key={r.recurrence_id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-medium text-foreground">{r.nome}</td>
                          <td className="px-4 py-3 text-muted-foreground">{r.frequencia || "Mensal"}</td>
                          <td className="px-4 py-3 font-mono">{r.proxima_ocorrencia || "—"}</td>
                          <td className="px-4 py-3">
                            <ExecutiveBadge variant="neutral">{r.status || "Ativo"}</ExecutiveBadge>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-medium">
                            {moeda(num(r.equivalente_mensal_brl || r.valor))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 7: PLANO DE CONTAS */}
          {aba === "plano_contas" && (
            <div className="space-y-4">
              {planoContas.length === 0 ? (
                <ExecutiveEmptyState
                  icon={Layers}
                  title="Plano de contas vazio"
                  description="Nenhuma categoria contábil encontrada."
                />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border/70 bg-card shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground text-[11px] font-medium">
                      <tr>
                        <th className="px-4 py-3">ID</th>
                        <th className="px-4 py-3">Código</th>
                        <th className="px-4 py-3">Nome da Conta</th>
                        <th className="px-4 py-3">Tipo</th>
                        <th className="px-4 py-3">Categoria Macro</th>
                        <th className="px-4 py-3">Descrição</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {planoContas.map((p) => (
                        <tr key={p.plano_conta_id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">{p.plano_conta_id}</td>
                          <td className="px-4 py-3 font-mono">{p.codigo || "—"}</td>
                          <td className="px-4 py-3 font-medium text-foreground">{p.nome_conta || "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{p.tipo || "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{p.categoria_macro || "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{p.descricao || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 8: CONTAS BANCÁRIAS */}
          {aba === "contas_bancarias" && (
            <div className="space-y-4">
              {contasFinanceiras.length === 0 ? (
                <ExecutiveEmptyState
                  icon={Landmark}
                  title="Nenhuma conta bancária cadastrada"
                  description="Contas correntes, carteiras e gateways cadastrados aparecerão aqui."
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {contasFinanceiras.map((c) => (
                    <div key={c.conta_id} className="rounded-xl border border-border/70 bg-card p-5 space-y-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                            <Landmark className="h-4 w-4" />
                          </span>
                          <div>
                            <h4 className="text-sm font-semibold text-foreground">{c.nome || c.conta_id}</h4>
                            <p className="text-[11px] text-muted-foreground">{c.instituicao || "Instituição Financeira"}</p>
                          </div>
                        </div>
                        <ExecutiveBadge variant={c.ativa === "NÃO" ? "neutral" : "success"}>
                          {c.ativa === "NÃO" ? "Inativa" : "Ativa"}
                        </ExecutiveBadge>
                      </div>

                      <div className="border-t border-border/40 pt-3">
                        <span className="text-[11px] text-muted-foreground">Saldo Atual Estimado:</span>
                        <p className="text-lg font-bold font-mono text-foreground mt-0.5">
                          {moeda(num(c.saldo_atual_brl ?? c.saldo_inicial_brl ?? 0))}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modais */}
      <LancamentoModal
        aberto={modalLancamentoAberto}
        onFechar={() => {
          setModalLancamentoAberto(false);
          setLancamentoParaEditar(null);
        }}
        onSalvo={carregarDados}
        lancamentoParaEditar={lancamentoParaEditar}
        contasDisponiveis={contasFinanceiras}
        planosDisponiveis={planoContas}
      />

      <OrcamentoModal
        aberto={modalOrcamentoAberto}
        onFechar={() => setModalOrcamentoAberto(false)}
        onSalvo={carregarDados}
        planosDisponiveis={planoContas}
      />
    </div>
  );
}
