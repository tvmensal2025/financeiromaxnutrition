import { lerPaginas } from "@/lib/leitura-paginada";
import { useState, useEffect, useMemo, useRef } from "react";
import {
  Target,
  Plus,
  Search,
  Kanban,
  Table as TableIcon,
  DollarSign,
  TrendingUp,
  UserCheck,
  Building,
  Eye,
  CheckCircle,
  FileText,
  Handshake,
  Trophy,
  XCircle,
  X,
  Layers,
  Calendar,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useBusiness } from "@/contexts/BusinessContext";
import { PremiumKanbanColumn } from "@/components/pipeline/PremiumKanbanColumn";
import { PremiumKanbanCard } from "@/components/pipeline/PremiumKanbanCard";
import { escreverRegistro } from "@/lib/escrita-protegida";
import { Link } from "react-router-dom";
import { ExecutivePageHeader } from "@/components/executive/ExecutivePageHeader";
import { ExecutiveMetricCard } from "@/components/executive/ExecutiveMetricCard";
import { ExecutiveBadge } from "@/components/executive/ExecutiveBadge";
import { ExecutiveLoadingState } from "@/components/executive/ExecutiveLoadingState";
import { ExecutiveErrorState } from "@/components/executive/ExecutiveErrorState";
import { ExecutiveEmptyState } from "@/components/executive/ExecutiveEmptyState";

export interface Oportunidade {
  row_version?: number | string;
  opportunity_id: string;
  business_id: string;
  empresa_lead: string;
  contato?: string | null;
  email_telefone?: string | null;
  origem?: string | null;
  etapa: string;
  status: string;
  responsavel?: string | null;
  proxima_acao?: string | null;
  valor_potencial?: number | string | null;
  probabilidade?: number | string | null;
  fechamento_previsto?: string | null;
  data_proxima_acao?: string | null;
  observacoes?: string | null;
}

const ETAPAS_CONFIG: Record<
  string,
  { label: string; color: string; icon: any; id: string }
> = {
  PROSPECCAO: { id: "PROSPECCAO", label: "Prospecção", color: "#3b82f6", icon: Eye },
  QUALIFICACAO: { id: "QUALIFICACAO", label: "Qualificação", color: "#8b5cf6", icon: CheckCircle },
  APRESENTACAO: { id: "APRESENTACAO", label: "Apresentação", color: "#6366f1", icon: FileText },
  PROPOSTA: { id: "PROPOSTA", label: "Proposta", color: "#f59e0b", icon: FileText },
  NEGOCIACAO: { id: "NEGOCIACAO", label: "Negociação", color: "#f97316", icon: Handshake },
  GANHO: { id: "GANHO", label: "Ganho", color: "#10b981", icon: Trophy },
  PERDIDO: { id: "PERDIDO", label: "Perdido", color: "#ef4444", icon: XCircle },
};

const ETAPAS_ORDEM = [
  "PROSPECCAO",
  "QUALIFICACAO",
  "APRESENTACAO",
  "PROPOSTA",
  "NEGOCIACAO",
  "GANHO",
  "PERDIDO",
];

function moeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function CrmPage() {
  const { empresas, currentBusiness, currentBusinessId, isConsolidated, selecionadas, rotulo } = useBusiness();
  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [termoBusca, setTermoBusca] = useState("");
  const [modoVisualizacao, setModoVisualizacao] = useState<"kanban" | "tabela">("kanban");
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Oportunidade | null>(null);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Formulário
  const [form, setForm] = useState<Partial<Oportunidade>>({
    business_id: "",
    etapa: "PROSPECCAO",
    status: "ATIVO",
    probabilidade: 30,
  });

  const leituraAtual = useRef(0);
  const selecaoKey = selecionadas.join("|");
  const carregarOportunidades = async () => {
    const leitura = ++leituraAtual.current;
    setCarregando(true);
    setErro("");
    setOportunidades([]);

    try {
      const { data, error } = await lerPaginas<Oportunidade>((inicio, fim) => {
        let query = supabase.from("crm").select("*", { count: "exact" });
        if (!isConsolidated && currentBusinessId) query = query.eq("business_id", currentBusinessId);
        else if (isConsolidated && selecionadas.length > 0) query = query.in("business_id", selecionadas);
        return query.order("opportunity_id").range(inicio, fim);
      });
      if (leitura !== leituraAtual.current) return;
      if (error) {
        setErro('Não foi possível consultar as oportunidades. Atualize a página para tentar novamente.');
      } else {
        setOportunidades((data || []) as Oportunidade[]);
      }
    } catch (e: any) {
      if (leitura === leituraAtual.current) setErro(e?.message || "Erro inesperado ao consultar oportunidades.");
    } finally {
      if (leitura === leituraAtual.current) setCarregando(false);
    }
  };

  useEffect(() => {
    carregarOportunidades();
    return () => { leituraAtual.current++; };
  }, [currentBusinessId, isConsolidated, selecaoKey]);

  // Filtragem local por busca
  const filtradas = useMemo(() => {
    return oportunidades.filter((op) => {
      const matchBusca =
        !termoBusca ||
        op.empresa_lead?.toLowerCase().includes(termoBusca.toLowerCase()) ||
        op.contato?.toLowerCase().includes(termoBusca.toLowerCase()) ||
        op.responsavel?.toLowerCase().includes(termoBusca.toLowerCase());
      return matchBusca;
    });
  }, [oportunidades, termoBusca]);

  // Métricas do Topo
  const metricas = useMemo(() => {
    let totalPipeline = 0;
    let totalPonderado = 0;
    let ativas = 0;

    for (const op of filtradas) {
      const v = typeof op.valor_potencial === "number" ? op.valor_potencial : Number(op.valor_potencial || 0);
      const prob = typeof op.probabilidade === "number" ? op.probabilidade : Number(op.probabilidade || 0);
      if (op.etapa !== "PERDIDO") {
        totalPipeline += v;
        totalPonderado += v * (prob / 100);
        ativas += 1;
      }
    }

    const ticketMedio = ativas > 0 ? totalPipeline / ativas : 0;

    return { totalPipeline, totalPonderado, ativas, ticketMedio };
  }, [filtradas]);

  const abrirModalNovo = (etapaInicial = "PROSPECCAO") => {
    setEditando(null);
    setForm({
      business_id: isConsolidated ? "" : currentBusinessId,
      etapa: etapaInicial,
      status: "ATIVO",
      probabilidade: 30,
      empresa_lead: "",
      contato: "",
      email_telefone: "",
      valor_potencial: 0,
      responsavel: "AGT-15 Victor",
      proxima_acao: "",
    });
    setModalAberto(true);
  };

  const abrirModalEditar = (op: Oportunidade) => {
    if (!isConsolidated && op.business_id && op.business_id !== currentBusinessId) {
      return;
    }
    setEditando(op);
    setForm({ ...op });
    setModalAberto(true);
  };

  const salvarOportunidade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.empresa_lead?.trim()) {
      alert("Por favor informe o Nome do Lead / Empresa.");
      return;
    }
    const businessIdAtivo = isConsolidated ? form.business_id?.trim() : currentBusinessId;
    if (!businessIdAtivo || !empresas.some((empresa) => empresa.id === businessIdAtivo)) {
      setErro("Selecione uma empresa válida antes de salvar a oportunidade.");
      return;
    }
    setErro("");
    setSalvando(true);

    const payload = {
      ...form,
      business_id: businessIdAtivo,
      valor_potencial: Number(form.valor_potencial || 0),
      probabilidade: Number(form.probabilidade || 0),
    };

    const oppId = editando?.opportunity_id || `OPP-${Date.now().toString().slice(-6)}`;
    if (editando) {
      const { error } = await escreverRegistro('crm', editando.opportunity_id, editando.row_version, payload);
      if (error) alert("Erro ao atualizar: " + error.message);
      else {
        setModalAberto(false);
        carregarOportunidades();
      }
    } else {
      const { error } = await supabase.from("crm").insert({ opportunity_id: oppId, ...payload });
      if (error) alert("Erro ao criar: " + error.message);
      else {
        setModalAberto(false);
        carregarOportunidades();
      }
    }
    setSalvando(false);
  };

  return (
    <div className="space-y-6">
      <ExecutivePageHeader
        icon={Target}
        title="CRM & Pipeline"
        description="Acompanhe oportunidades da primeira conversa ao fechamento."
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-border/70 bg-card p-0.5">
              <button
                type="button"
                onClick={() => setModoVisualizacao("kanban")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  modoVisualizacao === "kanban"
                    ? "bg-foreground text-background font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Kanban className="h-3.5 w-3.5" />
                <span>Kanban</span>
              </button>
              <button
                type="button"
                onClick={() => setModoVisualizacao("tabela")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  modoVisualizacao === "tabela"
                    ? "bg-foreground text-background font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <TableIcon className="h-3.5 w-3.5" />
                <span>Tabela</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => abrirModalNovo()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Nova oportunidade</span>
            </button>
          </div>
        }
      />

      {/* Grid de 4 Métricas Essenciais do CRM */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <ExecutiveMetricCard
          label="Pipeline"
          value={metricas.totalPipeline > 0 ? moeda(metricas.totalPipeline) : null}
          subtext={metricas.totalPipeline > 0 ? `${metricas.ativas} oportunidades ativas` : "Sem dados realizados"}
          icon={DollarSign}
        />
        <ExecutiveMetricCard
          label="Previsão ponderada"
          value={metricas.totalPonderado > 0 ? moeda(metricas.totalPonderado) : null}
          subtext={metricas.totalPonderado > 0 ? "Ajustada por probabilidade" : "Sem dados realizados"}
          icon={TrendingUp}
        />
        <ExecutiveMetricCard
          label="Ticket médio"
          value={metricas.ticketMedio > 0 ? moeda(metricas.ticketMedio) : null}
          subtext={metricas.ticketMedio > 0 ? "Por oportunidade ativa" : "Sem dados realizados"}
          icon={Building}
        />
        <ExecutiveMetricCard
          label="Oportunidades abertas"
          value={metricas.ativas > 0 ? metricas.ativas : null}
          subtext={metricas.ativas > 0 ? "No funil comercial" : "Sem dados realizados"}
          icon={UserCheck}
        />
      </div>

      {/* Barra de Busca e Filtros */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por lead, empresa, contato ou responsável…"
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
            className="w-full rounded-lg border border-border/70 bg-background py-1.5 pl-9 pr-3 text-xs placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/calendario"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Calendário comercial</span>
          </Link>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {filtradas.length} oportunidade(s)
          </span>
        </div>
      </div>

      {erro && (
        <ExecutiveErrorState
          title="Erro ao carregar oportunidades"
          message={erro}
          onRetry={carregarOportunidades}
        />
      )}

      {carregando ? (
        <ExecutiveLoadingState message="Carregando pipeline de vendas..." />
      ) : modoVisualizacao === "kanban" ? (
        <div className="relative">
          <div className="overflow-x-auto pb-6 scrollbar-thin">
            <div className="flex gap-4 min-w-max px-1">
              {ETAPAS_ORDEM.map((etapaKey) => {
                const config = ETAPAS_CONFIG[etapaKey];
                const itensEtapa = filtradas.filter(
                  (op) => (op.etapa || "PROSPECCAO").toUpperCase() === etapaKey
                );
                const totalEtapa = itensEtapa.reduce(
                  (acc, cur) => acc + Number(cur.valor_potencial || 0),
                  0
                );

                return (
                  <PremiumKanbanColumn
                    key={etapaKey}
                    title={config.label}
                    count={itensEtapa.length}
                    totalValue={totalEtapa}
                    color={config.color}
                    icon={config.icon}
                  >
                    {itensEtapa.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 px-3 text-center rounded-xl border border-dashed border-border/60 bg-muted/20">
                        <div
                          className="p-2.5 rounded-full mb-2"
                          style={{ backgroundColor: `${config.color}15` }}
                        >
                          <config.icon className="h-4 w-4" style={{ color: config.color }} />
                        </div>
                        <p className="text-xs font-medium text-foreground">
                          Nenhuma oportunidade em {config.label}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1 max-w-[200px] leading-tight">
                          Quando Victor registrar leads, eles aparecerão aqui.
                        </p>
                        <button
                          type="button"
                          onClick={() => abrirModalNovo(etapaKey)}
                          className="mt-3 inline-flex items-center gap-1 rounded-md border border-border/80 bg-card px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-muted transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                          <span>Adicionar oportunidade</span>
                        </button>
                      </div>
                    ) : (
                      itensEtapa.map((op) => {
                        const empRef = empresas.find((e) => e.id === op.business_id);
                        return (
                          <PremiumKanbanCard
                            key={op.opportunity_id}
                            title={`${op.empresa_lead}${empRef ? ` · ${empRef.sigla}` : ""}`}
                            value={Number(op.valor_potencial || 0)}
                            probability={Number(op.probabilidade || 50)}
                            customerName={op.contato || op.email_telefone || undefined}
                            expectedCloseDate={op.fechamento_previsto || undefined}
                            nextActionDate={op.data_proxima_acao || undefined}
                            onClick={() => abrirModalEditar(op)}
                          />
                        );
                      })
                    )}
                  </PremiumKanbanColumn>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Visualização TABELA ANALÍTICA */
        <div className="overflow-x-auto rounded-3xl border border-border/50 bg-card shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b border-border/50 text-muted-foreground uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-5 py-4 font-bold">Empresa</th>
                <th className="px-5 py-4 font-bold">Lead / Cliente</th>
                <th className="px-5 py-4 font-bold">Contato</th>
                <th className="px-5 py-4 font-bold">Etapa</th>
                <th className="px-5 py-4 font-bold">Valor</th>
                <th className="px-5 py-4 font-bold">Prob.</th>
                <th className="px-5 py-4 font-bold">Responsável</th>
                <th className="px-5 py-4 font-bold">Próxima Ação</th>
                <th className="px-5 py-4 text-right font-bold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filtradas.map((op) => {
                const etapaInfo = ETAPAS_CONFIG[op.etapa] || ETAPAS_CONFIG.PROSPECCAO;
                const empRef = empresas.find((empresa) => empresa.id === op.business_id);
                return (
                  <tr
                    key={op.opportunity_id}
                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => abrirModalEditar(op)}
                  >
                    <td className="px-5 py-3.5">
                      <span
                        className="rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase"
                        style={{ borderColor: empRef?.cor || "#d8ded9", color: empRef?.cor || "inherit" }}
                      >
                        {empRef?.sigla || op.business_id}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-bold text-foreground">
                      {op.empresa_lead}
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">
                      {op.contato || op.email_telefone || "-"}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className="rounded-md px-2 py-0.5 text-[10px] font-bold border"
                        style={{
                          borderColor: `${etapaInfo.color}40`,
                          color: etapaInfo.color,
                          backgroundColor: `${etapaInfo.color}15`,
                        }}
                      >
                        {etapaInfo.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-bold text-foreground">
                      {moeda(Number(op.valor_potencial || 0))}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-muted-foreground">{op.probabilidade || 0}%</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{op.responsavel || "-"}</td>
                    <td className="px-5 py-3.5 text-muted-foreground max-w-[200px] truncate">
                      {op.proxima_acao || "-"}
                    </td>
                    <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => abrirModalEditar(op)}
                        className="text-primary hover:underline font-semibold"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtradas.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-muted-foreground">
                    Nenhuma oportunidade encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal / Dialog de Criar/Editar Oportunidade */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-3xl border border-border/50 bg-card p-6 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {editando ? "Editar Oportunidade" : "Nova Oportunidade no Funil"}
                </h3>
                <p className="text-xs text-muted-foreground">Gravação oficial na tabela crm</p>
              </div>
              <button
                onClick={() => setModalAberto(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={salvarOportunidade} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">Unidade / Empresa</label>
                  {!isConsolidated ? (
                    <div className="mt-1 flex items-center gap-2 rounded-xl border border-border/50 bg-muted/40 px-3 py-2 text-xs font-bold text-foreground">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: currentBusiness?.cor || "#007A3D" }} />
                      <span className="truncate">{currentBusiness?.nome || currentBusinessId}</span>
                      <span className="ml-auto text-[10px] font-normal text-muted-foreground uppercase">(Fixada)</span>
                    </div>
                  ) : (
                    <select
                      className="mt-1 w-full rounded-xl border border-border/50 bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                      value={form.business_id || ""}
                      onChange={(e) => setForm({ ...form, business_id: e.target.value })}
                      required
                    >
                      <option value="">Selecione a empresa</option>
                      {empresas.map((empresa) => (
                        <option key={empresa.id} value={empresa.id}>
                          {empresa.nome}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground">Etapa do Funil</label>
                  <select
                    className="mt-1 w-full rounded-xl border border-border/50 bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                    value={form.etapa || "PROSPECCAO"}
                    onChange={(e) => setForm({ ...form, etapa: e.target.value })}
                  >
                    {ETAPAS_ORDEM.map((k) => (
                      <option key={k} value={k}>
                        {ETAPAS_CONFIG[k].label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Nome do Lead / Empresa *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Usina Solar Norte, Clínica Integrada, etc."
                  className="mt-1 w-full rounded-xl border border-border/50 bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                  value={form.empresa_lead || ""}
                  onChange={(e) => setForm({ ...form, empresa_lead: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">Decisor / Contato</label>
                  <input
                    type="text"
                    placeholder="Ex: Dr. Roberto"
                    className="mt-1 w-full rounded-xl border border-border/50 bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                    value={form.contato || ""}
                    onChange={(e) => setForm({ ...form, contato: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">Telefone / E-mail</label>
                  <input
                    type="text"
                    placeholder="(11) 99999-9999"
                    className="mt-1 w-full rounded-xl border border-border/50 bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                    value={form.email_telefone || ""}
                    onChange={(e) => setForm({ ...form, email_telefone: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">Valor Estimado (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="mt-1 w-full rounded-xl border border-border/50 bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                    value={form.valor_potencial || ""}
                    onChange={(e) => setForm({ ...form, valor_potencial: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">Probabilidade (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="mt-1 w-full rounded-xl border border-border/50 bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                    value={form.probabilidade || ""}
                    onChange={(e) => setForm({ ...form, probabilidade: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">Responsável</label>
                  <input
                    type="text"
                    placeholder="Ex: AGT-15 Victor"
                    className="mt-1 w-full rounded-xl border border-border/50 bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                    value={form.responsavel || ""}
                    onChange={(e) => setForm({ ...form, responsavel: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">Previsão Fechamento</label>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-xl border border-border/50 bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                    value={form.fechamento_previsto || ""}
                    onChange={(e) => setForm({ ...form, fechamento_previsto: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Data da próxima ação (calendário)</label>
                <input
                  type="date"
                  className="mt-1 w-full rounded-xl border border-border/50 bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                  value={form.data_proxima_acao || ""}
                  onChange={(e) => setForm({ ...form, data_proxima_acao: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Próxima Ação Estratégica</label>
                <input
                  type="text"
                  placeholder="Ex: Apresentar proposta comercial formalizada"
                  className="mt-1 w-full rounded-xl border border-border/50 bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                  value={form.proxima_acao || ""}
                  onChange={(e) => setForm({ ...form, proxima_acao: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2.5 border-t border-border/40 pt-4">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="rounded-xl border border-border/60 px-4 py-2 text-xs font-bold hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground shadow-glow hover:opacity-90 disabled:opacity-50"
                >
                  {salvando ? "Gravando…" : editando ? "Atualizar" : "Salvar no Pipeline"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
