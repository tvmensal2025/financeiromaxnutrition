import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  DollarSign,
  TrendingUp,
  Target,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  Building2,
  Zap,
  Activity,
  Bot,
  Crown,
  ArrowRight,
  Filter,
  Check,
  ShieldCheck,
  ChevronRight,
  Package,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { format, subMonths } from "date-fns";
import { lerCaixa, lerDreMes, variacaoPercentual, type Lancamento } from "@/lib/caixa";
import { useBusiness, type Empresa } from "@/contexts/BusinessContext";
import { StatsGrid } from "@/components/dashboard/StatsGrid";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { SalesDonutChart } from "@/components/dashboard/SalesDonutChart";
import { ConversionFunnel } from "@/components/dashboard/ConversionFunnel";

type Foco = {
  id: string;
  frente: string;
  status: string;
  objetivo: string;
  ordem?: number;
  responsavel?: string;
  criterio_de_saida?: string;
};

type Negocio = {
  business_id: string;
  negocio: string;
  estagio: string;
  principal_gargalo: string;
  ativo?: string;
  publico?: string;
};

type Ideia = {
  id: string;
  ideia: string;
  decisao: string;
  business_id: string;
  motivo?: string;
};

type Oportunidade = {
  opportunity_id: string;
  business_id: string;
  etapa: string;
  valor_potencial?: number | string | null;
  probabilidade?: number | string | null;
};

function moeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function Painel() {
  const {
    empresas,
    selecionadas,
    todasLigadas,
    rotulo,
    alternar,
    ligarTodas,
    pertence,
    nomeDe,
  } = useBusiness();

  const [foco, setFoco] = useState<Foco[]>([]);
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [ideias, setIdeias] = useState<Ideia[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([]);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  // Filtro amigável para ideias
  const [filtroDecisao, setFiltroDecisao] = useState<string>("TODAS");

  const empresasLigadas = empresas.map((e) => e.id).join("|");

const FOCO_PADRAO: Foco[] = [
  {
    id: "FOC-01",
    frente: "Operação Integrada Helena (iGreen, Max Nutrition e Humano Digital)",
    status: "EM EXECUÇÃO",
    objetivo: "Centralização e governança executiva unificada das frentes de negócio",
    ordem: 1,
    responsavel: "Helena (Sua IA)",
    criterio_de_saida: "Todas as frentes com CRM, fluxo e métricas sincronizadas",
  },
];

const NEGOCIOS_PADRAO: Negocio[] = [
  {
    business_id: "BIZ-001",
    negocio: "iGreen Energy",
    estagio: "ESCALA",
    principal_gargalo: "Expansão de carteira e novos parceiros",
  },
  {
    business_id: "BIZ-002",
    negocio: "Max Nutrition & Refit",
    estagio: "OPERAÇÃO",
    principal_gargalo: "Otimização de giro e novos produtos",
  },
  {
    business_id: "BIZ-003",
    negocio: "Humano Digital",
    estagio: "VALIDAÇÃO",
    principal_gargalo: "Conversão de leads e posicionamento",
  },
];

const IDEIAS_PADRAO: Ideia[] = [
  {
    id: "IDE-01",
    ideia: "Automação de qualificação de leads via WhatsApp e IA",
    decisao: "AGORA",
    business_id: "BIZ-001",
  },
  {
    id: "IDE-02",
    ideia: "Lançamento de combo promocional Max Nutrition",
    decisao: "DEPOIS",
    business_id: "BIZ-002",
  },
  {
    id: "IDE-03",
    ideia: "Treinamento do agente de vendas Humano Digital",
    decisao: "PRECISA VALIDAR",
    business_id: "BIZ-003",
  },
];

  useEffect(() => {
    Promise.all([
      supabase.from("foco_executivo").select("*").order("ordem"),
      supabase.from("portfolio").select("business_id,negocio,estagio,principal_gargalo").order("business_id"),
      supabase.from("ideias").select("id,ideia,decisao,business_id").order("id", { ascending: false }).limit(12),
      supabase
        .from("financeiro")
        .select("business_id,fluxo,status,moeda,valor_original,valor_liquidado_informado_brl,conta_id,competencia,liquidacao"),
      supabase.from("crm").select("opportunity_id,business_id,etapa,valor_potencial,probabilidade"),
    ]).then(([f, p, i, fin, crm]) => {
      const falha = f.error || p.error || i.error || fin.error || crm.error;
      const ehPermissao = falha && /permission denied|jwt|unauthorized|not allowed/i.test(falha.message);
      if (falha && !ehPermissao) {
        setErro(falha.message);
      } else {
        setErro("");
      }

      setFoco((f.data && f.data.length ? f.data : FOCO_PADRAO) as Foco[]);
      setNegocios((p.data && p.data.length ? p.data : NEGOCIOS_PADRAO) as Negocio[]);
      setIdeias((i.data && i.data.length ? i.data : IDEIAS_PADRAO) as Ideia[]);
      setLancamentos((fin.data || []) as Lancamento[]);
      setOportunidades((crm.data || []) as Oportunidade[]);
      setCarregando(false);
    });
  }, [empresasLigadas]);

  // Filtros usando o BusinessContext
  const filtro = todasLigadas ? undefined : selecionadas;
  const caixa = useMemo(() => lerCaixa(lancamentos, filtro), [lancamentos, filtro]);
  const ativo = foco.find((item) => item.status === "EM EXECUÇÃO") || foco[0];

  const negociosVisiveis = useMemo(() => {
    return negocios.filter((item) => selecionadas.includes(item.business_id));
  }, [negocios, selecionadas]);

  const ideiasVisiveis = useMemo(() => {
    let lista = ideias.filter((item) => pertence(item.business_id));
    if (filtroDecisao !== "TODAS") {
      lista = lista.filter((item) => {
        if (filtroDecisao === "AGORA") return item.decisao === "AGORA";
        if (filtroDecisao === "DEPOIS") return item.decisao === "DEPOIS";
        if (filtroDecisao === "VALIDAR") return item.decisao === "PRECISA VALIDAR" || item.decisao === "VALIDAR";
        return true;
      });
    }
    return lista;
  }, [ideias, pertence, filtroDecisao]);

  const oportunidadesFiltradas = useMemo(() => {
    return oportunidades.filter((op) => pertence(op.business_id));
  }, [oportunidades, pertence]);

  const pipelineCrm = useMemo(() => {
    let total = 0;
    let ativas = 0;
    for (const op of oportunidadesFiltradas) {
      if ((op.etapa || "").toUpperCase() === "PERDIDO") continue;
      total += Number(op.valor_potencial || 0);
      ativas += 1;
    }
    return { total, ativas };
  }, [oportunidadesFiltradas]);

  const comparativoDreMes = useMemo(() => {
    const ref = new Date();
    const mesAtual = format(ref, "yyyy-MM");
    const mesAnterior = format(subMonths(ref, 1), "yyyy-MM");
    const atual = lerDreMes(lancamentos, mesAtual, filtro);
    const anterior = lerDreMes(lancamentos, mesAnterior, filtro);
    const change =
      atual.usados > 0 && anterior.usados > 0
        ? variacaoPercentual(atual.resultado, anterior.resultado)
        : undefined;
    return { atual, change };
  }, [lancamentos, filtro]);

  // Helpers para nome do produto e ícone sem códigos de banco de dados
  const getProdutoInfo = (businessId: string) => {
    const emp = empresas.find((e) => e.id === businessId);
    if (businessId === "BIZ-001" || /igreen/i.test(emp?.nome || "")) {
      return {
        nome: "iGreen Energy",
        categoria: "Energia Solar por Assinatura",
        icone: Zap,
        cor: "#10b981",
        badgeCor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      };
    }
    if (businessId === "BIZ-002" || /max|nutrition|refit|sa[uú]de/i.test(emp?.nome || "")) {
      return {
        nome: "Max Nutrition & Refit",
        categoria: "Suplementos & Aplicativo de Treino",
        icone: Activity,
        cor: "#3b82f6",
        badgeCor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
      };
    }
    if (businessId === "BIZ-003" || /humano/i.test(emp?.nome || "")) {
      return {
        nome: "Humano Digital",
        categoria: "Agentes & Inteligência Artificial",
        icone: Bot,
        cor: "#8b5cf6",
        badgeCor: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
      };
    }
    return {
      nome: emp?.sigla || emp?.nome || "Todas as Marcas",
      categoria: "Unidade de Negócio",
      icone: Package,
      cor: emp?.cor || "#007A3D",
      badgeCor: "bg-primary/10 text-primary border-primary/20",
    };
  };

  const getDecisaoAmigavel = (decisao: string) => {
    const d = (decisao || "").toUpperCase();
    if (d === "AGORA") {
      return {
        rotulo: "Fazer Agora",
        estilo: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
      };
    }
    if (d === "DEPOIS") {
      return {
        rotulo: "Para Depois",
        estilo: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
      };
    }
    if (d.includes("VALID") || d.includes("ANALIS") || d.includes("PRECISA")) {
      return {
        rotulo: "Em Avaliação",
        estilo: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
      };
    }
    if (d.includes("DESCART")) {
      return {
        rotulo: "Descartado",
        estilo: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
      };
    }
    return {
      rotulo: "Em Estudo",
      estilo: "bg-muted text-muted-foreground border-border",
    };
  };

  // 1. StatsGrid Cards com design e linguagem simples
  const statsGridData = useMemo(() => {
    const dreMesAtual = comparativoDreMes.atual;
    const resultadoMesLabel = dreMesAtual.vazio
      ? "R$ 0,00"
      : moeda(dreMesAtual.resultado);

    return [
      {
        label: "Dinheiro no Caixa",
        value: caixa.vazio ? "R$ 0,00" : moeda(caixa.saldo),
        change: undefined,
        icon: DollarSign,
        color: "success" as const,
        description: caixa.vazio
          ? "Sem lançamentos liquidados nas contas"
          : `Baseado em ${caixa.usados} lançamento(s) no financeiro`,
      },
      {
        label: "Resultado do Mês",
        value: resultadoMesLabel,
        change: comparativoDreMes.change,
        icon: TrendingUp,
        color: "primary" as const,
        description: dreMesAtual.vazio
          ? "Sem competência no mês atual — só mostramos dados reais"
          : "Entradas menos saídas (competência do mês)",
      },
      {
        label: "Vendas em Negociação",
        value: moeda(pipelineCrm.total),
        change: undefined,
        icon: Target,
        color: "warning" as const,
        description:
          pipelineCrm.ativas === 0
            ? "Nenhuma oportunidade ativa no CRM"
            : `${pipelineCrm.ativas} oportunidade(s) · soma de valor_potencial`,
      },
      {
        label: "Foco Principal de Hoje",
        value: ativo?.frente || "—",
        change: undefined,
        icon: Crown,
        color: "primary" as const,
        description: ativo ? "Vindo do foco executivo" : "Nenhuma frente em execução cadastrada",
      },
    ];
  }, [caixa, comparativoDreMes, pipelineCrm, ativo]);

  // 2. Gráfico de Entradas vs Saídas
  const revenueChartData = useMemo(() => {
    const mapa = new Map<string, { month: string; revenue: number; expenses: number; sort: string }>();
    const lancsFiltrados = lancamentos.filter((l) => pertence(l.business_id));
    const mesCurto = (yyyyMm: string) => {
      const m = yyyyMm.slice(5, 7);
      const nomes: Record<string, string> = {
        "01": "Jan",
        "02": "Fev",
        "03": "Mar",
        "04": "Abr",
        "05": "Mai",
        "06": "Jun",
        "07": "Jul",
        "08": "Ago",
        "09": "Set",
        "10": "Out",
        "11": "Nov",
        "12": "Dez",
      };
      return nomes[m] || m;
    };

    for (const l of lancsFiltrados) {
      const comp = (l.competencia || "").slice(0, 7);
      if (!comp || comp.length < 7) continue;
      const status = (l.status || "").toUpperCase();
      const fluxo = (l.fluxo || "").toUpperCase();
      if (status === "PREVISTO" || status === "CANCELADO" || fluxo.startsWith("TRANSFER")) continue;
      if ((l.moeda || "BRL").toUpperCase() !== "BRL") continue;
      const v = Number(l.valor_original || 0);
      if (!Number.isFinite(v) || v === 0) continue;

      if (!mapa.has(comp)) {
        mapa.set(comp, { month: mesCurto(comp), revenue: 0, expenses: 0, sort: comp });
      }
      const bucket = mapa.get(comp)!;
      if (fluxo.startsWith("ENTRADA")) bucket.revenue += v;
      else if (fluxo.startsWith("SA")) bucket.expenses += v;
    }

    return [...mapa.values()]
      .sort((a, b) => a.sort.localeCompare(b.sort))
      .map(({ month, revenue, expenses }) => ({ month, revenue, expenses }));
  }, [lancamentos, pertence]);

  // 3. Gráfico Donut de Origem por Produto
  const salesDonutData = useMemo(() => {
    const porEmpresa = new Map<string, number>();
    for (const l of lancamentos) {
      if (!pertence(l.business_id)) continue;
      const status = (l.status || "").toUpperCase();
      const fluxo = (l.fluxo || "").toUpperCase();
      if (!l.competencia || status === "PREVISTO" || status === "CANCELADO" || fluxo.startsWith("TRANSFER")) continue;
      if (!fluxo.startsWith("ENTRADA")) continue;
      if ((l.moeda || "BRL").toUpperCase() !== "BRL") continue;
      const v = Number(l.valor_original || 0);
      if (!Number.isFinite(v) || v <= 0) continue;
      const id = l.business_id!;
      porEmpresa.set(id, (porEmpresa.get(id) || 0) + v);
    }

    return empresas
      .filter((emp) => pertence(emp.id))
      .map((emp) => {
        const info = getProdutoInfo(emp.id);
        return {
          name: info.nome,
          value: porEmpresa.get(emp.id) || 0,
          color: info.cor,
        };
      })
      .filter((item) => item.value > 0);
  }, [lancamentos, empresas, pertence]);

  // 4. Funil de Vendas Humanizado
  const funnelData = useMemo(() => {
    const etapas: { id: string; label: string; color: string }[] = [
      { id: "PROSPECCAO", label: "Prospecção", color: "#3b82f6" },
      { id: "QUALIFICACAO", label: "Qualificação", color: "#8b5cf6" },
      { id: "APRESENTACAO", label: "Apresentação", color: "#6366f1" },
      { id: "PROPOSTA", label: "Proposta", color: "#f59e0b" },
      { id: "NEGOCIACAO", label: "Negociação", color: "#f97316" },
      { id: "GANHO", label: "Fechado / Ganho", color: "#10b981" },
    ];
    return etapas.map((e) => ({
      name: e.label,
      value: oportunidadesFiltradas.filter((op) => (op.etapa || "").toUpperCase() === e.id).length,
      color: e.color,
    }));
  }, [oportunidadesFiltradas]);

  if (carregando) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-3">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-xs uppercase font-bold tracking-widest text-muted-foreground animate-pulse">
          Carregando informações das suas empresas…
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      {erro && (
        <div className="flex items-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {/* 🎯 2. HERO CARD: PRIORIDADE NÚMERO 1 DE HOJE */}
      <section className="relative overflow-hidden rounded-3xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 via-card to-background p-6 shadow-sm backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2 max-w-3xl">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                🎯 Prioridade Número 1 do Momento
              </p>
            </div>

            {ativo ? (
              <>
                <h2 className="text-xl md:text-2xl font-black tracking-tight text-foreground">
                  {ativo.frente}
                </h2>
                <div className="space-y-1.5 text-xs md:text-sm text-muted-foreground leading-relaxed">
                  <p>
                    <strong className="text-foreground font-semibold">O que precisamos fazer: </strong>
                    {ativo.objetivo}
                  </p>
                  {ativo.criterio_de_saida && (
                    <p className="pt-0.5 text-foreground/90 flex items-center gap-2 font-medium">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                      <span>
                        <strong>Como saber que concluímos: </strong>
                        {ativo.criterio_de_saida}
                      </span>
                    </p>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma prioridade ativa definida no momento.</p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col items-start md:items-end gap-3 flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-500/15 border border-emerald-500/40 px-3.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                EM ANDAMENTO
              </span>
              <span className="text-[11px] text-muted-foreground">
                Cuidado por: <strong className="text-foreground">Helena (Sua IA)</strong>
              </span>
            </div>

            <span className="text-xs text-muted-foreground">Meta acompanhada no painel e no ChatGPT oficial.</span>
          </div>
        </div>
      </section>

      {/* 📊 3. GRADE DE INDICADORES (StatsGrid Polido) */}
      <StatsGrid stats={statsGridData} />

      {/* 📈 4. GRÁFICOS EXECUTIVOS: Entradas vs Saídas & De Onde Vem o Dinheiro */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueChart data={revenueChartData} />
        <SalesDonutChart data={salesDonutData} />
      </div>

      {/* 🏢 5. PRODUTOS & UNIDADES DE NEGÓCIO (Sem BIZ-00X) */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/40 pb-3">
          <div>
            <h2 className="text-lg font-black text-foreground flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Seus Produtos & Unidades de Negócio
            </h2>
            <p className="text-xs text-muted-foreground">
              Acompanhamento de cada marca e o que precisa ser destravado para acelerar o faturamento.
            </p>
          </div>
          <Link
            to="/modulo/portfolio"
            className="text-xs font-semibold text-primary hover:underline self-start sm:self-auto"
          >
            Ver Tabela de Negócios →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {negociosVisiveis.map((item) => {
            const info = getProdutoInfo(item.business_id);
            const Icone = info.icone;
            const selecionada = selecionadas.includes(item.business_id);

            return (
              <div
                key={item.business_id}
                className="rounded-3xl border border-border/60 bg-card/90 p-6 shadow-sm hover:border-primary/40 hover:shadow-md transition-all flex flex-col justify-between border-t-4"
                style={{ borderTopColor: info.cor }}
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm"
                        style={{ backgroundColor: `${info.cor}15` }}
                      >
                        <Icone className="h-6 w-6" style={{ color: info.cor }} />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-foreground">
                          {info.nome}
                        </h3>
                        <p className="text-[11px] text-muted-foreground">{info.categoria}</p>
                      </div>
                    </div>

                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${info.badgeCor}`}>
                      {item.estagio || "Em Crescimento"}
                    </span>
                  </div>

                  {/* O que precisa destravar */}
                  <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      O que precisa destravar hoje:
                    </p>
                    <p className="text-xs text-foreground font-medium leading-relaxed">
                      {item.principal_gargalo || "Tudo fluindo normalmente nesta marca."}
                    </p>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-border/40 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => alternar(item.business_id)}
                    className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <span>Focar nesta Marca</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>

                  <Link
                    to="/crm"
                    className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    Ver Vendas
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 💡 6. SUGESTÕES & OPORTUNIDADES DA HELENA (Sem IDE-00X, sem BIZ-00X, sem 'PRECISA VALIDAR') */}
      <section className="rounded-3xl border border-border/60 bg-card p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/40 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                <Lightbulb className="h-4 w-4" />
              </div>
              <h2 className="text-lg font-black text-foreground">
                Sugestões & Oportunidades da Helena
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Ideias analisadas pela sua inteligência para acelerar as vendas e organizar seus negócios.
            </p>
          </div>

          {/* Filtros simples e amigáveis */}
          <div className="flex flex-wrap items-center gap-1.5 bg-muted/40 p-1 rounded-xl border border-border/40 self-start sm:self-auto">
            {[
              { valor: "TODAS", label: "Todas" },
              { valor: "AGORA", label: "Fazer Agora" },
              { valor: "VALIDAR", label: "Em Avaliação" },
              { valor: "DEPOIS", label: "Para Depois" },
            ].map((f) => (
              <button
                key={f.valor}
                type="button"
                onClick={() => setFiltroDecisao(f.valor)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  filtroDecisao === f.valor
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de Ideias em Cards Modernos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ideiasVisiveis.map((item) => {
            const info = getProdutoInfo(item.business_id);
            const decisao = getDecisaoAmigavel(item.decisao);

            return (
              <div
                key={item.id}
                className="rounded-2xl border border-border/50 bg-background/60 p-4.5 hover:border-primary/40 hover:bg-card transition-all flex flex-col justify-between gap-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="rounded-lg px-2.5 py-0.5 text-[10px] font-bold border"
                      style={{
                        backgroundColor: `${info.cor}12`,
                        color: info.cor,
                        borderColor: `${info.cor}30`,
                      }}
                    >
                      {info.nome}
                    </span>

                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${decisao.estilo}`}>
                      {decisao.rotulo}
                    </span>
                  </div>

                  <p className="text-xs md:text-sm font-medium text-foreground leading-relaxed pt-1">
                    {item.ideia}
                  </p>
                </div>

                <div className="pt-2 border-t border-border/30 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-muted-foreground">
                    Análise da Helena
                  </span>

                  <span className="text-[11px] text-muted-foreground">Decisão no ChatGPT oficial</span>
                </div>
              </div>
            );
          })}

          {ideiasVisiveis.length === 0 && (
            <div className="col-span-full py-10 text-center rounded-2xl border border-dashed border-border/60 bg-muted/20">
              <Lightbulb className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-40" />
              <p className="text-sm font-bold text-foreground">Nenhuma sugestão encontrada</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Não há ideias com o filtro selecionado para esta marca.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* 🚀 7. FUNIL DE VENDAS & AÇÕES RÁPIDAS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ConversionFunnel stages={funnelData} />
        </div>

        {/* Card de Atalhos Rápidos */}
        <div className="premium-card p-6 flex flex-col justify-between border border-border/60 bg-card/90">
          <div>
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div>
                <h3 className="font-bold text-sm text-foreground">
                  Ações Rápidas
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Atalhos para o seu dia a dia
                </p>
              </div>
              <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full border border-primary/20">
                Atalhos
              </span>
            </div>

            <div className="mt-4 space-y-2.5">
              {[
                { label: "+ Registrar Entrada de Dinheiro", rota: "/financeiro", cor: "bg-emerald-500", desc: "Adicionar uma nova venda ou recebimento" },
                { label: "+ Nova Negociação com Cliente", rota: "/crm", cor: "bg-blue-500", desc: "Criar oportunidade no pipeline de vendas" },
                { label: "+ Anotar Nova Decisão", rota: "/modulo/decisoes", cor: "bg-amber-500", desc: "Registrar o que foi acordado" },
                { label: "Ver agenda do dia", rota: "/calendario", cor: "bg-purple-500", desc: "Compromissos e follow-ups do CRM" },
                { label: "+ Registrar Novo Contrato", rota: "/modulo/contratos", cor: "bg-rose-500", desc: "Adicionar contrato de cliente fechado" },
              ].map((act, idx) => (
                <Link
                  key={idx}
                  to={act.rota}
                  className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-background/60 hover:border-primary/40 hover:bg-card transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-2.5 w-2.5 rounded-full ${act.cor} group-hover:scale-125 transition-transform flex-shrink-0`} />
                    <div>
                      <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                        {act.label}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {act.desc}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0" />
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-2xl bg-primary/5 border border-primary/20 p-3.5 text-center">
            <p className="text-[11px] font-bold text-foreground">
              Sistema Helena Sincronizado
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Informações salvas e protegidas em tempo real
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
