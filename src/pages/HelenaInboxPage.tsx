import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Inbox,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  ArrowRight,
  Filter,
  Check,
  Building2,
  FileText,
  Compass,
} from "lucide-react";
import { useBusiness } from "@/contexts/BusinessContext";
import { ExecutivePageHeader } from "@/components/executive/ExecutivePageHeader";
import { ExecutiveBadge } from "@/components/executive/ExecutiveBadge";
import { ExecutiveEmptyState } from "@/components/executive/ExecutiveEmptyState";

export type InboxItem = {
  id: string;
  tipo: "DECISAO" | "APROVACAO" | "RISCO" | "BLOQUEIO";
  titulo: string;
  descricao: string;
  business_id: string;
  origem: string;
  data: string;
  prioridade: "CRITICA" | "ALTA" | "MEDIA";
  status: "PENDENTE" | "RESOLVIDO";
  ctaUrl: string;
  ctaLabel: string;
};

const ITENS_INBOX: InboxItem[] = [
  {
    id: "INB-001",
    tipo: "DECISAO",
    titulo: "Homologação do Núcleo Técnico (FOC-004)",
    descricao: "Validar se a transição para o Supabase como fonte canônica e o isolamento multiempresa atendem integralmente aos requisitos do fundador.",
    business_id: "GRUPO",
    origem: "Helena (CEO Virtual)",
    data: "Hoje",
    prioridade: "ALTA",
    status: "PENDENTE",
    ctaUrl: "/modulo/foco_executivo",
    ctaLabel: "Auditar foco",
  },
  {
    id: "INB-002",
    tipo: "RISCO",
    titulo: "Aquisição Comercial — iGreen",
    descricao: "Continuar construindo produto e refinamento sem resolver aquisição massiva de clientes por assinatura gera descompasso de tração.",
    business_id: "BIZ-001",
    origem: "Victor (Vendas)",
    data: "Hoje",
    prioridade: "ALTA",
    status: "PENDENTE",
    ctaUrl: "/crm",
    ctaLabel: "Ver pipeline",
  },
  {
    id: "INB-003",
    tipo: "APROVACAO",
    titulo: "Ativação de FOC-002 (Caixa das Empresas)",
    descricao: "A frente de Caixa permanece em PLANEJADO/AGUARDANDO e não deve ser iniciada até a deliberação formal de conclusão de FOC-004.",
    business_id: "GRUPO",
    origem: "Caio (CFO) & Helena",
    data: "Hoje",
    prioridade: "MEDIA",
    status: "PENDENTE",
    ctaUrl: "/modulo/foco_executivo",
    ctaLabel: "Ver planejamento",
  },
  {
    id: "INB-004",
    tipo: "BLOQUEIO",
    titulo: "Definição de Escopo de Produto em Saúde",
    descricao: "Escopo amplo de funcionalidades precisa ser delimitado para entrega do MVP da unidade de saúde.",
    business_id: "BIZ-002",
    origem: "Nina (Produto)",
    data: "Ontem",
    prioridade: "ALTA",
    status: "PENDENTE",
    ctaUrl: "/portfolio",
    ctaLabel: "Ver negócio",
  },
];

export default function HelenaInboxPage() {
  const { currentBusinessId, isConsolidated } = useBusiness();
  const [filtroTipo, setFiltroTipo] = useState<string>("TODOS");
  const [itens, setItens] = useState<InboxItem[]>(ITENS_INBOX);

  // Filtragem por contexto de empresa e tipo
  const itensFiltrados = itens.filter((item) => {
    // 1. Contexto de empresa
    if (!isConsolidated && currentBusinessId) {
      if (item.business_id !== "GRUPO" && item.business_id !== currentBusinessId) {
        return false;
      }
    }
    // 2. Filtro de tipo
    if (filtroTipo === "DECISOES") return item.tipo === "DECISAO";
    if (filtroTipo === "APROVACOES") return item.tipo === "APROVACAO";
    if (filtroTipo === "RISCOS") return item.tipo === "RISCO";
    if (filtroTipo === "BLOQUEIOS") return item.tipo === "BLOQUEIO";
    return true;
  });

  // Métricas do resumo da fila
  const total = itens.length;
  const criticos = itens.filter((i) => i.prioridade === "CRITICA" || i.prioridade === "ALTA").length;
  const aguardandoFundador = itens.filter((i) => i.tipo === "DECISAO" || i.tipo === "APROVACAO").length;
  const hoje = itens.filter((i) => i.data === "Hoje").length;

  const getBorderColor = (tipo: InboxItem["tipo"]) => {
    switch (tipo) {
      case "DECISAO":
        return "border-l-purple-500";
      case "APROVACAO":
        return "border-l-[#B47D14]";
      case "RISCO":
        return "border-l-[#B91C1C]";
      case "BLOQUEIO":
        return "border-l-rose-600";
    }
  };

  const getBadge = (tipo: InboxItem["tipo"]) => {
    switch (tipo) {
      case "DECISAO":
        return <ExecutiveBadge variant="purple" size="sm">DECISÃO</ExecutiveBadge>;
      case "APROVACAO":
        return <ExecutiveBadge variant="warning" size="sm">APROVAÇÃO</ExecutiveBadge>;
      case "RISCO":
        return <ExecutiveBadge variant="danger" size="sm">RISCO</ExecutiveBadge>;
      case "BLOQUEIO":
        return <ExecutiveBadge variant="danger" size="sm">BLOQUEIO</ExecutiveBadge>;
    }
  };

  return (
    <div className="space-y-6">
      <ExecutivePageHeader
        title="Caixa de Decisões da Helena"
        description="Fila executiva de deliberações, aprovações necessárias, riscos críticos e bloqueios do fundador."
        icon={Inbox}
        breadcrumb="Central / Inbox da Helena"
      />

      {/* Filtros no Topo */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border/60 pb-3">
        {[
          { id: "TODOS", label: "Todos" },
          { id: "DECISOES", label: "Decisões" },
          { id: "APROVACOES", label: "Aprovações" },
          { id: "RISCOS", label: "Riscos" },
          { id: "BLOQUEIOS", label: "Bloqueios" },
        ].map((tab) => {
          const ativo = filtroTipo === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFiltroTipo(tab.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                ativo
                  ? "bg-foreground text-background shadow-sm"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Layout Desktop: 70% Coluna Principal + 30% Painel Lateral */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-10">
        {/* Coluna Principal: 70% (7 colunas de 10) */}
        <div className="lg:col-span-7 space-y-3">
          {itensFiltrados.length === 0 ? (
            <ExecutiveEmptyState
              title="Nenhuma pendência encontrada"
              description="Não há itens com os filtros selecionados para o contexto de negócio ativo."
            />
          ) : (
            itensFiltrados.map((item) => (
              <div
                key={item.id}
                className={`rounded-xl border border-border bg-card p-5 border-l-4 ${getBorderColor(
                  item.tipo
                )} transition-colors hover:border-border/90`}
                style={{ boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.03)" }}
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {getBadge(item.tipo)}
                      <span className="text-xs font-mono text-muted-foreground">
                        {item.business_id}
                      </span>
                      <span className="text-muted-foreground/60">·</span>
                      <span className="text-xs text-muted-foreground">
                        {item.origem}
                      </span>
                    </div>

                    <h3 className="text-sm sm:text-base font-semibold text-foreground tracking-tight">
                      {item.titulo}
                    </h3>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {item.descricao}
                    </p>

                    <div className="flex items-center gap-3 pt-2 text-[11px] text-muted-foreground">
                      <span>Prazo: <strong className="text-foreground">{item.data}</strong></span>
                      <span>·</span>
                      <span>
                        Prioridade:{" "}
                        <strong
                          className={
                            item.prioridade === "CRITICA" || item.prioridade === "ALTA"
                              ? "text-[#B91C1C] dark:text-[#f87171]"
                              : "text-muted-foreground"
                          }
                        >
                          {item.prioridade}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 pt-1">
                    <Link
                      to={item.ctaUrl}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                    >
                      <span>{item.ctaLabel}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Painel Lateral: 30% (3 colunas de 10) */}
        <div className="lg:col-span-3 space-y-4">
          <div
            className="rounded-xl border border-border bg-card p-5 space-y-4"
            style={{ boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.03)" }}
          >
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/50 pb-2.5">
              Resumo da Fila
            </h4>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Total de Pendências:</span>
                <strong className="text-foreground text-sm font-semibold">{total}</strong>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Crítico / Alta:</span>
                <strong className="text-[#B91C1C] text-sm font-semibold">{criticos}</strong>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Aguardando Fundador:</span>
                <strong className="text-purple-600 dark:text-purple-400 text-sm font-semibold">
                  {aguardandoFundador}
                </strong>
              </div>

              <div className="flex items-center justify-between text-xs border-t border-border/50 pt-2.5">
                <span className="text-muted-foreground">Para Hoje:</span>
                <strong className="text-foreground text-sm font-semibold">{hoje}</strong>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-2">
            <span className="text-[11px] font-semibold text-foreground">
              Diretriz de Decisão:
            </span>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Itens da Inbox são triados pela Helena (CEO Virtual) e escalados para o Fundador apenas quando exigem deliberação soberana ou validação de marcos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
