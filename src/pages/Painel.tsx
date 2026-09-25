import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Compass,
  ArrowRight,
  Shield,
  Inbox,
  Target,
  Receipt,
  Building2,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Flame,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useBusiness } from "@/contexts/BusinessContext";
import { ExecutiveBadge } from "@/components/executive/ExecutiveBadge";
import { ExecutiveMetricCard } from "@/components/executive/ExecutiveMetricCard";
import { ExecutiveLoadingState } from "@/components/executive/ExecutiveLoadingState";

type FocoItem = {
  foco_id?: string;
  id?: string;
  frente: string;
  status: string;
  objetivo?: string;
  ordem?: number;
  responsavel?: string;
  criterio_de_saida?: string;
};

type NegocioPortfolio = {
  business_id: string;
  negocio: string;
  estagio?: string | null;
  principal_gargalo?: string | null;
  objetivo_atual?: string | null;
  kpi_principal?: string | null;
  proxima_entrega?: string | null;
  responsavel_executivo?: string | null;
};

type OportunidadeCrm = {
  opportunity_id: string;
  business_id: string;
  etapa: string;
  status: string;
  valor_potencial?: number | string | null;
  probabilidade?: number | string | null;
};

type LancamentoFin = {
  business_id: string;
  fluxo: string;
  status: string;
  valor_original: number | string;
  vencimento?: string | null;
  liquidacao?: string | null;
};

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function Painel() {
  const navigate = useNavigate();
  const { currentBusiness, currentBusinessId, isConsolidated, rotulo } = useBusiness();

  const [focoAtivo, setFocoAtivo] = useState<FocoItem>({
    foco_id: "FOC-004",
    frente: "Homologação técnica do Sistema Helena",
    status: "EM EXECUÇÃO",
    responsavel: "Helena (CEO Virtual)",
    criterio_de_saida: "Bateria reproduzível de validação técnica, catálogo oficial, RLS multiempresa e segurança comprovada.",
  });

  const [proximoFoco, setProximoFoco] = useState<FocoItem>({
    foco_id: "FOC-002",
    frente: "Caixa das Empresas",
    status: "AGUARDANDO",
    responsavel: "Helena & Caio",
  });

  const [negocioInfo, setNegocioInfo] = useState<NegocioPortfolio | null>(null);
  const [oportunidades, setOportunidades] = useState<OportunidadeCrm[]>([]);
  const [lancamentos, setLancamentos] = useState<LancamentoFin[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Saudação executiva baseada no horário local
  const saudacao = useMemo(() => {
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) return "Bom dia";
    if (hora >= 12 && hora < 18) return "Boa tarde";
    return "Boa noite";
  }, []);

  useEffect(() => {
    async function carregarDados() {
      setCarregando(true);
      try {
        // 1. Foco Executivo
        const { data: focos } = await supabase
          .from("foco_executivo")
          .select("*")
          .order("ordem", { ascending: true });

        if (focos && focos.length > 0) {
          const ativo = focos.find(
            (f) => String(f.status).toUpperCase() === "EM EXECUÇÃO"
          );
          if (ativo) {
            setFocoAtivo({
              foco_id: ativo.foco_id || ativo.id || "FOC-004",
              frente: ativo.frente,
              status: ativo.status,
              responsavel: ativo.responsavel || "Helena (CEO Virtual)",
              criterio_de_saida:
                ativo.criterio_de_saida ||
                "Bateria reproduzível de validação técnica e governança concluída.",
            });
          }

          const planejado = focos.find(
            (f) =>
              String(f.status).toUpperCase().includes("PLANEJADO") ||
              String(f.status).toUpperCase().includes("AGUARDANDO")
          );
          if (planejado) {
            setProximoFoco({
              foco_id: planejado.foco_id || planejado.id || "FOC-002",
              frente: planejado.frente,
              status: "AGUARDANDO",
              responsavel: planejado.responsavel || "Helena & Caio",
            });
          }
        }

        // 2. Portfólio / Contexto da Empresa
        const { data: portf } = await supabase.from("portfolio").select("*");
        if (portf && portf.length > 0) {
          if (!isConsolidated && currentBusinessId) {
            const biz = portf.find((p) => p.business_id === currentBusinessId);
            if (biz) setNegocioInfo(biz);
          } else {
            const biz1 = portf.find((p) => p.business_id === "BIZ-001");
            if (biz1) setNegocioInfo(biz1);
          }
        }

        // 3. CRM Oportunidades
        let qCrm = supabase.from("crm").select("opportunity_id, business_id, etapa, status, valor_potencial, probabilidade");
        if (!isConsolidated && currentBusinessId) {
          qCrm = qCrm.eq("business_id", currentBusinessId);
        }
        const { data: crmData } = await qCrm;
        setOportunidades((crmData || []) as OportunidadeCrm[]);

        // 4. Lançamentos Financeiros
        let qFin = supabase.from("financeiro").select("business_id, fluxo, status, valor_original, vencimento, liquidacao");
        if (!isConsolidated && currentBusinessId) {
          qFin = qFin.eq("business_id", currentBusinessId);
        }
        const { data: finData } = await qFin;
        setLancamentos((finData || []) as LancamentoFin[]);
      } catch (err) {
        console.error("Erro ao carregar dados do Painel Executivo:", err);
      } finally {
        setCarregando(false);
      }
    }

    carregarDados();
  }, [currentBusinessId, isConsolidated]);

  // Cálculos das Métricas Essenciais (com separação rigorosa de "Sem dados" vs "Zero")
  const metricas = useMemo(() => {
    // 1. Caixa Realizado (lançamentos liquidados: ENTRADA - SAÍDA)
    const lancamentosLiquidados = lancamentos.filter(
      (l) => l.status === "RECEBIDO" || l.status === "PAGO" || l.status === "LIQUIDADO"
    );

    let caixaRealizadoStr: string | null = null;
    let temCaixaRealizado = false;

    if (lancamentosLiquidados.length > 0) {
      temCaixaRealizado = true;
      const saldo = lancamentosLiquidados.reduce((acc, l) => {
        const val = Number(l.valor_original) || 0;
        return l.fluxo === "ENTRADA" ? acc + val : acc - val;
      }, 0);
      caixaRealizadoStr = formatarMoeda(saldo);
    }

    // 2. Pipeline Comercial (negociações ativas que não estão GANHO ou PERDIDO)
    const abertas = oportunidades.filter(
      (o) => o.etapa !== "PERDIDO" && o.status !== "CANCELADO"
    );

    let pipelineStr: string | null = null;
    let previsaoStr: string | null = null;
    let temPipeline = false;

    if (abertas.length > 0) {
      temPipeline = true;
      const totalPipeline = abertas.reduce((acc, o) => acc + (Number(o.valor_potencial) || 0), 0);
      const totalPrevisao = abertas.reduce((acc, o) => {
        const val = Number(o.valor_potencial) || 0;
        const prob = (Number(o.probabilidade) || 50) / 100;
        return acc + val * prob;
      }, 0);

      pipelineStr = formatarMoeda(totalPipeline);
      previsaoStr = formatarMoeda(totalPrevisao);
    }

    // 3. Receita do mês (entradas liquidadas no mês atual)
    const mesAtual = new Date().toISOString().slice(0, 7);
    const entradasMes = lancamentos.filter(
      (l) =>
        l.fluxo === "ENTRADA" &&
        (l.status === "RECEBIDO" || l.status === "LIQUIDADO") &&
        (l.liquidacao?.startsWith(mesAtual) || l.vencimento?.startsWith(mesAtual))
    );

    let receitaMesStr: string | null = null;
    let temReceitaMes = false;

    if (entradasMes.length > 0) {
      temReceitaMes = true;
      const totalReceita = entradasMes.reduce(
        (acc, l) => acc + (Number(l.valor_original) || 0),
        0
      );
      receitaMesStr = formatarMoeda(totalReceita);
    }

    return {
      caixa: { valor: caixaRealizadoStr, hasData: temCaixaRealizado },
      pipeline: { valor: pipelineStr, hasData: temPipeline, count: abertas.length },
      previsao: { valor: previsaoStr, hasData: temPipeline },
      receitaMes: { valor: receitaMesStr, hasData: temReceitaMes },
    };
  }, [lancamentos, oportunidades]);

  if (carregando) {
    return <ExecutiveLoadingState type="cards" rows={4} />;
  }

  return (
    <div className="space-y-7 pb-8">
      {/* ======================================================================
          NÍVEL 1 — COMANDO DO DIA (Hero Executivo Sóbrio)
          ====================================================================== */}
      <section
        className="rounded-2xl border border-border bg-card p-6 sm:p-7 shadow-sm transition-all"
        style={{ boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.03)" }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          {/* Lado Esquerdo: Saudação & Foco Executivo Ativo */}
          <div className="space-y-3.5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-foreground">{saudacao}, Fundador.</span>
              <span className="text-muted-foreground/60">·</span>
              <span className="font-medium text-muted-foreground">
                {isConsolidated ? "Grupo Consolidado" : currentBusiness?.nome || "iGreen"}
              </span>
              {!isConsolidated && currentBusiness?.estagio && (
                <>
                  <span className="text-muted-foreground/60">·</span>
                  <ExecutiveBadge variant="default" size="sm">
                    {currentBusiness.estagio}
                  </ExecutiveBadge>
                </>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#007A3D]">
                  Foco Executivo Ativo
                </span>
                <span className="text-xs text-muted-foreground">({focoAtivo.foco_id})</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
                {focoAtivo.frente}
              </h2>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Critério de Saída:</strong>{" "}
              {focoAtivo.criterio_de_saida}
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-1">
              <div className="flex items-center gap-2">
                <ExecutiveBadge variant="success" dot size="sm">
                  EM EXECUÇÃO
                </ExecutiveBadge>
                <span className="text-xs text-muted-foreground">
                  Responsável: <strong className="text-foreground">{focoAtivo.responsavel}</strong>
                </span>
              </div>

              <Link
                to="/modulo/foco_executivo"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#007A3D] hover:underline"
              >
                <span>Ver foco executivo</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Lado Direito: Próxima Prioridade (WIP = 1 protegido) */}
          <div className="lg:w-72 shrink-0 rounded-xl border border-border/70 bg-muted/20 p-4 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Próxima Prioridade
            </span>
            <div>
              <h4 className="text-sm font-semibold text-foreground">
                {proximoFoco.foco_id} · {proximoFoco.frente}
              </h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Responsável: {proximoFoco.responsavel}
              </p>
            </div>
            <div className="pt-1">
              <ExecutiveBadge variant="default" size="sm">
                AGUARDANDO CONCLUSÃO DE FOC-004
              </ExecutiveBadge>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================================
          NÍVEL 2 — NÚMEROS ESSENCIAIS
          Distinção estrita: Ausência de dados = "—", nunca R$ 0,00 fictício
          ====================================================================== */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Números Essenciais · {isConsolidated ? "Grupo Consolidado" : currentBusiness?.nome || "iGreen"}
          </h3>
          <span className="text-[11px] text-muted-foreground">Fonte: Supabase Operacional</span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ExecutiveMetricCard
            label="Caixa Realizado"
            value={metricas.caixa.valor}
            hasData={metricas.caixa.hasData}
            subtext="Saldo líquido em contas conciliadas."
            icon={Receipt}
          />
          <ExecutiveMetricCard
            label="Pipeline Comercial"
            value={metricas.pipeline.valor}
            hasData={metricas.pipeline.hasData}
            subtext={
              metricas.pipeline.hasData
                ? `${metricas.pipeline.count} oportunidade(s) abertas.`
                : "Sem oportunidades ativas registradas."
            }
            icon={Target}
          />
          <ExecutiveMetricCard
            label="Previsão Ponderada"
            value={metricas.previsao.valor}
            hasData={metricas.previsao.hasData}
            subtext="Calculado pela probabilidade do funil."
            icon={Compass}
          />
          <ExecutiveMetricCard
            label="Receita do Mês"
            value={metricas.receitaMes.valor}
            hasData={metricas.receitaMes.hasData}
            subtext="Entradas liquidadas no mês corrente."
            icon={Building2}
          />
        </div>
      </section>

      {/* ======================================================================
          NÍVEL 3 — ATENÇÃO EXECUTIVA (Layout 2/3 + 1/3)
          ====================================================================== */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Esquerda: 2/3 Pendências Executivas / Inbox */}
        <div
          className="lg:col-span-2 rounded-xl border border-border bg-card p-5 space-y-4"
          style={{ boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.03)" }}
        >
          <div className="flex items-center justify-between border-b border-border/50 pb-3">
            <div className="flex items-center gap-2">
              <Inbox className="h-4 w-4 text-[#007A3D]" />
              <h3 className="text-sm font-semibold text-foreground">
                Caixa de Decisões & Pendências
              </h3>
            </div>
            <Link
              to="/inbox"
              className="text-xs font-semibold text-[#007A3D] hover:underline inline-flex items-center gap-1"
            >
              <span>Abrir Inbox</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {/* Item 1 */}
            <div className="flex items-start justify-between gap-3 rounded-lg border-l-2 border-l-purple-500 bg-muted/20 p-3.5 text-xs transition-colors hover:bg-muted/40">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">
                    Homologação Técnica do Núcleo
                  </span>
                  <ExecutiveBadge variant="purple" size="sm">
                    Decisão
                  </ExecutiveBadge>
                </div>
                <p className="text-muted-foreground line-clamp-1">
                  Validar encerramento formal de FOC-004 e transição segura para frente de Caixa.
                </p>
                <div className="text-[10px] text-muted-foreground">
                  Origem: <strong>Helena (CEO Virtual)</strong> · Prazo: <strong>Hoje</strong>
                </div>
              </div>
              <Link
                to="/modulo/foco_executivo"
                className="shrink-0 rounded border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-muted"
              >
                Auditar
              </Link>
            </div>

            {/* Item 2 */}
            <div className="flex items-start justify-between gap-3 rounded-lg border-l-2 border-l-[#B47D14] bg-muted/20 p-3.5 text-xs transition-colors hover:bg-muted/40">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">
                    Aquisição Comercial em iGreen
                  </span>
                  <ExecutiveBadge variant="warning" size="sm">
                    Gargalo
                  </ExecutiveBadge>
                </div>
                <p className="text-muted-foreground line-clamp-1">
                  Destravar prospecção ativa de clientes e registro de leads no pipeline CRM.
                </p>
                <div className="text-[10px] text-muted-foreground">
                  Empresa: <strong>BIZ-001</strong> · Responsável: <strong>Victor (Vendas)</strong>
                </div>
              </div>
              <Link
                to="/crm"
                className="shrink-0 rounded border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-muted"
              >
                Ver CRM
              </Link>
            </div>

            {/* Item 3 */}
            <div className="flex items-start justify-between gap-3 rounded-lg border-l-2 border-l-[#007A3D] bg-muted/20 p-3.5 text-xs transition-colors hover:bg-muted/40">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">
                    Conexão dos 20 Especialistas Grok
                  </span>
                  <ExecutiveBadge variant="success" size="sm">
                    Equipe
                  </ExecutiveBadge>
                </div>
                <p className="text-muted-foreground line-clamp-1">
                  20/20 Bots validados no Grok com External Agent IDs registrados no Supabase.
                </p>
                <div className="text-[10px] text-muted-foreground">
                  Responsável: <strong>Theo (Tecnologia & IA)</strong> · Status: <strong>Connected</strong>
                </div>
              </div>
              <Link
                to="/equipe"
                className="shrink-0 rounded border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-muted"
              >
                Ver Equipe
              </Link>
            </div>
          </div>
        </div>

        {/* Direita: 1/3 Riscos & Próximas Decisões */}
        <div
          className="rounded-xl border border-border bg-card p-5 space-y-4"
          style={{ boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.03)" }}
        >
          <div className="flex items-center justify-between border-b border-border/50 pb-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-[#B91C1C]" />
              <h3 className="text-sm font-semibold text-foreground">
                Riscos & Decisões
              </h3>
            </div>
            <Link
              to="/modulo/riscos"
              className="text-xs font-semibold text-[#007A3D] hover:underline"
            >
              Ver todos
            </Link>
          </div>

          <div className="space-y-3">
            <div className="rounded-lg border border-border/60 bg-muted/10 p-3 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">Aquisição Comercial</span>
                <ExecutiveBadge variant="danger" size="sm">
                  ALTO
                </ExecutiveBadge>
              </div>
              <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                Risco de manter foco em refinamento técnico sem validar tração comercial em escala.
              </p>
              <div className="text-[10px] text-muted-foreground pt-1">
                Contexto: <strong>iGreen (BIZ-001)</strong>
              </div>
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/10 p-3 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">Escopo de Produto</span>
                <ExecutiveBadge variant="warning" size="sm">
                  MÉDIO
                </ExecutiveBadge>
              </div>
              <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                Necessidade de fechar escopo mínimo antes de desenvolvimento de novas features.
              </p>
              <div className="text-[10px] text-muted-foreground pt-1">
                Contexto: <strong>Saúde (BIZ-002)</strong>
              </div>
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/10 p-3 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">Validação de Comissionamento</span>
                <ExecutiveBadge variant="default" size="sm">
                  VALIDAÇÃO
                </ExecutiveBadge>
              </div>
              <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                Rastreamento confiável de comissões até a liquidação bancária.
              </p>
              <div className="text-[10px] text-muted-foreground pt-1">
                Contexto: <strong>Humano Digital (BIZ-003)</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================================
          NÍVEL 4 — CONTEXTO ESTRATÉGICO DA EMPRESA
          Composição visual unificada (sem dezenas de cards soltos)
          ====================================================================== */}
      <section
        className="rounded-2xl border border-border bg-card p-6 shadow-sm"
        style={{ boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.03)" }}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-4">
          <div className="flex items-center gap-3">
            <span
              className="h-3 w-3 rounded-full shrink-0"
              style={{ backgroundColor: currentBusiness?.cor || "#007A3D" }}
            />
            <div>
              <h3 className="text-base font-semibold text-foreground">
                {isConsolidated ? "Grupo Consolidado" : currentBusiness?.nome || "iGreen Energy"}
              </h3>
              <p className="text-xs text-muted-foreground">
                {isConsolidated ? "Visão integrada do portfólio" : `Unidade ${currentBusinessId} · Diretriz Estratégica`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isConsolidated && currentBusiness?.estagio && (
              <ExecutiveBadge variant="default">
                ESTÁGIO: {currentBusiness.estagio}
              </ExecutiveBadge>
            )}
            <Link
              to="/portfolio"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
            >
              <span>Abrir Portfólio</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Grade Estruturada da Empresa */}
        <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-3">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Principal Gargalo
            </span>
            <p className="text-xs font-medium text-foreground leading-relaxed">
              {negocioInfo?.principal_gargalo || "Comercial / conseguir clientes massivamente."}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Objetivo Atual
            </span>
            <p className="text-xs font-medium text-foreground leading-relaxed">
              {negocioInfo?.objetivo_atual || "Validar e destravar aquisição de clientes por assinatura."}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              KPI Principal
            </span>
            <p className="text-xs font-medium text-foreground leading-relaxed">
              {negocioInfo?.kpi_principal || "Leads → conversas → propostas → vendas."}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
