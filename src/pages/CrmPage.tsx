import { useState, useEffect, useMemo } from "react";
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
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useBusiness } from "@/contexts/BusinessContext";
import { PremiumKanbanColumn } from "@/components/pipeline/PremiumKanbanColumn";
import { PremiumKanbanCard } from "@/components/pipeline/PremiumKanbanCard";
import { sincronizarEventosCrm } from "@/lib/crm-calendario";
import { Link } from "react-router-dom";

export interface Oportunidade {
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
  GANHO: { id: "GANHO", label: "Fechado / Ganho", color: "#10b981", icon: Trophy },
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
  const { empresas, selecionadas, rotulo } = useBusiness();
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

  const carregarOportunidades = async () => {
    setCarregando(true);
    setErro("");
    if (selecionadas.length === 0) {
      setOportunidades([]);
      setCarregando(false);
      return;
    }
    let query = supabase.from("crm").select("*").in("business_id", selecionadas);
    const { data, error } = await query;
    if (error) {
      if (/permission denied|jwt|unauthorized|not allowed/i.test(error.message)) {
        setErro("");
        setOportunidades([]);
      } else {
        setErro(error.message);
      }
    } else {
      setOportunidades((data || []) as Oportunidade[]);
    }
    setCarregando(false);
  };

  useEffect(() => {
    carregarOportunidades();
  }, [selecionadas.join("|")]);

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
      business_id: selecionadas[0] || empresas[0]?.id || "",
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
    setSalvando(true);

    const payload = {
      ...form,
      valor_potencial: Number(form.valor_potencial || 0),
      probabilidade: Number(form.probabilidade || 0),
    };

    const oppId = editando?.opportunity_id || `OPP-${Date.now().toString().slice(-6)}`;
    if (editando) {
      const { error } = await supabase.from("crm").update(payload).eq("opportunity_id", editando.opportunity_id);
      if (error) alert("Erro ao atualizar: " + error.message);
      else {
        await sincronizarEventosCrm({
          ...payload,
          opportunity_id: oppId,
          business_id: String(payload.business_id || selecionadas[0] || ""),
          empresa_lead: form.empresa_lead || "",
        });
        setModalAberto(false);
        carregarOportunidades();
      }
    } else {
      const { error } = await supabase.from("crm").insert({ opportunity_id: oppId, ...payload });
      if (error) alert("Erro ao criar: " + error.message);
      else {
        await sincronizarEventosCrm({
          ...payload,
          opportunity_id: oppId,
          business_id: String(payload.business_id || selecionadas[0] || ""),
          empresa_lead: form.empresa_lead || "",
        });
        setModalAberto(false);
        carregarOportunidades();
      }
    }
    setSalvando(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2.5">
        <Link to="/calendario" className="pe-tab">Abrir calendário</Link>
          <div className="flex rounded-xl border border-border/50 bg-card/60 p-1">
            <button
              onClick={() => setModoVisualizacao("kanban")}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                modoVisualizacao === "kanban"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Kanban className="h-3.5 w-3.5" />
              <span>Kanban</span>
            </button>
            <button
              onClick={() => setModoVisualizacao("tabela")}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                modoVisualizacao === "tabela"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <TableIcon className="h-3.5 w-3.5" />
              <span>Tabela</span>
            </button>
          </div>

          <button
            onClick={() => abrirModalNovo()}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-glow transition-all hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            <span>Nova Oportunidade</span>
          </button>
        </div>

      {/* Grid de Métricas do Funil */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="metric-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Pipeline Total
            </p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-foreground">
            {metricas.ativas === 0 ? "Nenhuma oportunidade" : moeda(metricas.totalPipeline)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {metricas.ativas === 0 ? "O pipeline vazio não é saldo." : `${metricas.ativas} oportunidades ativas`}
          </p>
        </div>

        <div className="metric-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Previsão Ponderada
            </p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-foreground">
            {metricas.ativas === 0 ? "Sem previsão" : moeda(metricas.totalPonderado)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Ajustada por probabilidade
          </p>
        </div>

        <div className="metric-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Ticket Médio
            </p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500">
              <Building className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-foreground">
            {metricas.ativas === 0 ? "Sem ticket" : moeda(metricas.ticketMedio)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Por oportunidade</p>
        </div>

        <div className="metric-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Holding Ativa
            </p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
              <UserCheck className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-lg font-black text-foreground truncate">
            {rotulo}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground truncate">
            Empresas ligadas no topo
          </p>
        </div>
      </div>

      {/* Barra de Filtro e Busca */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-card/60 p-3 backdrop-blur-md">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por lead, empresa, contato ou responsável…"
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
            className="w-full rounded-xl border border-border/50 bg-background/80 py-2.5 pl-10 pr-4 text-xs placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
          />
        </div>
        <p className="text-xs text-muted-foreground pr-2 hidden sm:block">
          Mostrando <span className="font-bold text-foreground">{filtradas.length}</span> lead(s)
        </p>
      </div>

      {erro && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive">
          {erro}
        </div>
      )}

      {/* Visualização KANBAN com os componentes PremiumKanbanColumn e PremiumKanbanCard */}
      {modoVisualizacao === "kanban" ? (
        <div className="relative">
          <div className="overflow-x-auto pb-6 scrollbar-thin">
            <div className="flex gap-5 min-w-max px-1">
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
                      <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl border border-dashed border-border/40">
                        <div
                          className="p-3.5 rounded-full mb-2"
                          style={{ backgroundColor: `${config.color}15` }}
                        >
                          <config.icon className="h-6 w-6" style={{ color: config.color }} />
                        </div>
                        <p className="text-xs text-muted-foreground">Sem oportunidades</p>
                        <button
                          onClick={() => abrirModalNovo(etapaKey)}
                          className="mt-2 text-[10px] text-primary hover:underline font-semibold"
                        >
                          + Adicionar lead
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
                  <select
                    className="mt-1 w-full rounded-xl border border-border/50 bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                    value={form.business_id || selecionadas[0] || ""}
                    onChange={(e) => setForm({ ...form, business_id: e.target.value })}
                  >
                    {empresas.map((empresa) => (
                      <option key={empresa.id} value={empresa.id}>
                        {empresa.nome}
                      </option>
                    ))}
                  </select>
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
