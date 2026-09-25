import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  Target,
  Flame,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Crown,
  Activity,
  UserCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useBusiness } from "@/contexts/BusinessContext";

type PortfolioItem = {
  business_id: string;
  negocio: string;
  ativo?: string | null;
  estagio?: string | null;
  objetivo_atual?: string | null;
  marco_atual?: string | null;
  definicao_saida?: string | null;
  principal_gargalo?: string | null;
  kpi_principal?: string | null;
  proxima_decisao?: string | null;
  riscos?: string | null;
  proxima_entrega?: string | null;
  responsavel_executivo?: string | null;
  publico?: string | null;
  modelo_receita?: string | null;
};

const NEGOCIOS_BASE: PortfolioItem[] = [
  {
    business_id: "BIZ-001",
    negocio: "iGreen Energy",
    ativo: "SIM",
    estagio: "VENDAS",
    objetivo_atual: "Expansão da carteira comercial de energia solar por assinatura e atração de clientes recorrentes.",
    marco_atual: "Esteira de qualificação e fechamento ativa.",
    definicao_saida: "Meta de contratos ativos atingida com faturamento previsível.",
    principal_gargalo: "Comercial / conseguir clientes.",
    kpi_principal: "Novos contratos assinados / mês & MRR adicionado.",
    proxima_decisao: "Alocação de canais de aquisição pagos vs orgânicos.",
    riscos: "Continuar construindo produto sem resolver aquisição de clientes.",
    proxima_entrega: "Campanha comercial de energia por assinatura.",
    responsavel_executivo: "Comercial & Helena (CEO Virtual)",
    publico: "Pessoas físicas e empresas com conta de energia alta.",
    modelo_receita: "Assinatura e comissões sobre faturas de energia.",
  },
  {
    business_id: "BIZ-002",
    negocio: "Ecossistema de Saúde",
    ativo: "SIM",
    estagio: "PRODUTO",
    objetivo_atual: "Consolidação da linha de produtos de suplementação e nutrição integrada.",
    marco_atual: "Definição de portfólio essencial e fornecedores homologados.",
    definicao_saida: "Escopo consolidado com esteira de produção e vendas pronta.",
    principal_gargalo: "Escopo amplo ainda não consolidado.",
    kpi_principal: "Margem bruta por produto & taxa de recompra.",
    proxima_decisao: "Fechamento de fornecedores exclusivos de formulação.",
    riscos: "Dispersão em excesso de SKUs antes de validar os carros-chefe.",
    proxima_entrega: "Linha principal de produtos lançada.",
    responsavel_executivo: "Produto & Helena (CEO Virtual)",
    publico: "Praticantes de atividade física e pessoas em busca de longevidade.",
    modelo_receita: "Venda direta (D2C) e recorrência de suplementos.",
  },
  {
    business_id: "BIZ-003",
    negocio: "Humano Digital",
    ativo: "SIM",
    estagio: "VALIDAÇÃO",
    objetivo_atual: "Validação do modelo de ativação de pessoas e afiliados com rastreamento ponta a ponta.",
    marco_atual: "Teste de comissionamento e jornada de integração.",
    definicao_saida: "Aquisição e ativação de pessoas com rastreamento confiável até a comissão recebida.",
    principal_gargalo: "Aquisição e ativação de pessoas com rastreamento confiável até a comissão recebida.",
    kpi_principal: "Taxa de ativação de novos membros & comissões liquidadas.",
    proxima_decisao: "Validação da esteira de onboarding com o primeiro grupo piloto.",
    riscos: "Falta de tração inicial ou atrito no cadastro de afiliados.",
    proxima_entrega: "Piloto com 50 pessoas ativas.",
    responsavel_executivo: "Growth & Helena (CEO Virtual)",
    publico: "Empreendedores digitais, criadores de conteúdo e profissionais liberais.",
    modelo_receita: "Comissionamento sobre vendas de produtos e serviços parceiros.",
  },
];

const CORES_PORTFOLIO: Record<string, { primario: string; bg: string; border: string }> = {
  "BIZ-001": { primario: "#007A3D", bg: "#007A3D12", border: "#007A3D35" },
  "BIZ-002": { primario: "#2563EB", bg: "#2563EB12", border: "#2563EB35" },
  "BIZ-003": { primario: "#B45309", bg: "#B4530912", border: "#B4530935" },
};

export default function PortfolioPage() {
  const { currentBusinessId, setCurrentBusiness } = useBusiness();
  const [empresas, setEmpresas] = useState<PortfolioItem[]>(NEGOCIOS_BASE);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      try {
        const { data, error } = await supabase
          .from("portfolio")
          .select("*")
          .order("business_id");

        if (!error && data && data.length > 0) {
          // Normaliza campos do banco
          const mapeados = data.map((d: any) => ({
            business_id: d.business_id,
            negocio: d.negocio || d.nome || d.business_id,
            ativo: d.ativo || "SIM",
            estagio: d.estagio || "EM OPERAÇÃO",
            objetivo_atual: d.objetivo_atual || d.objetivo || "Expansão e tração operacional.",
            marco_atual: d.marco_atual || d.marco || "Estruturação em andamento.",
            definicao_saida: d.definicao_saida || d.criterio_saida || "Meta de crescimento atingida.",
            principal_gargalo: d.principal_gargalo || d.gargalo || "Acompanhamento comercial contínuo.",
            kpi_principal: d.kpi_principal || d.kpi || "Receita e retenção.",
            proxima_decisao: d.proxima_decisao || "Priorização de canais.",
            riscos: d.riscos || d.risco_principal || "Competição e conversão.",
            proxima_entrega: d.proxima_entrega || "Próximo ciclo de melhoria.",
            responsavel_executivo: d.responsavel_executivo || "Helena (CEO Virtual)",
            publico: d.publico || "Público-alvo qualificado.",
            modelo_receita: d.modelo_receita || "Recorrência e vendas diretas.",
          }));
          setEmpresas(mapeados);
        }
      } catch {
        // Fallback robusto para os 3 negócios oficiais
        setEmpresas(NEGOCIOS_BASE);
      } finally {
        setCarregando(false);
      }
    }

    carregar();
  }, []);

  return (
    <div className="space-y-6">
      {/* Topo do Portfólio */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Comando</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">Visão Executiva do Fundador</span>
          </div>
          <h1 className="pe-page-title flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Portfólio de Negócios
          </h1>
          <p className="text-xs text-muted-foreground">
            As 3 empresas do ecossistema com seus objetivos, gargalos específicos e critérios de saída.
          </p>
        </div>

        <Link
          to="/modulo/portfolio"
          className="self-start sm:self-auto rounded-xl border border-border/60 bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-all"
        >
          Modo Avançado (Tabela) →
        </Link>
      </div>

      {/* Grid com os 3 Negócios Oficiais da V8 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {empresas.map((emp) => {
          const cor = CORES_PORTFOLIO[emp.business_id] || {
            primario: "#4F46E5",
            bg: "#4F46E512",
            border: "#4F46E535",
          };
          const isAtiva = currentBusinessId === emp.business_id;

          return (
            <div
              key={emp.business_id}
              className={`rounded-3xl border bg-card p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-5 border-t-4 ${
                isAtiva ? "ring-2 ring-primary/30 shadow-md" : "border-border/60"
              }`}
              style={{ borderTopColor: cor.primario }}
            >
              <div className="space-y-4">
                {/* Header do Card */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span
                      className="inline-block rounded-md px-2 py-0.5 text-[10px] font-mono font-bold"
                      style={{ backgroundColor: cor.bg, color: cor.primario }}
                    >
                      {emp.business_id}
                    </span>
                    <h2 className="text-lg font-black text-foreground mt-1">{emp.negocio}</h2>
                    <p className="text-[11px] text-muted-foreground">{emp.modelo_receita}</p>
                  </div>

                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    {emp.estagio || "EM OPERAÇÃO"}
                  </span>
                </div>

                {/* Gargalo Principal */}
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3.5 space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                    <Flame className="h-4 w-4 shrink-0" />
                    <p className="text-[10px] font-black uppercase tracking-wider">Principal Gargalo</p>
                  </div>
                  <p className="text-xs font-semibold text-foreground leading-relaxed">
                    {emp.principal_gargalo}
                  </p>
                </div>

                {/* Informações Executivas */}
                <div className="space-y-2.5 text-xs">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Objetivo Atual:
                    </span>
                    <p className="text-foreground/90 font-medium leading-relaxed">{emp.objetivo_atual}</p>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Marco Atual:
                    </span>
                    <p className="text-foreground/90 font-medium leading-relaxed">{emp.marco_atual}</p>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Critério de Saída:
                    </span>
                    <p className="text-foreground/90 font-medium leading-relaxed">{emp.definicao_saida}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        KPI Principal:
                      </span>
                      <p className="text-foreground font-semibold text-[11px]">{emp.kpi_principal}</p>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Responsável:
                      </span>
                      <p className="text-foreground font-semibold text-[11px]">{emp.responsavel_executivo}</p>
                    </div>
                  </div>

                  {emp.riscos && (
                    <div className="pt-2 border-t border-border/40">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Risco Mapeado:
                      </span>
                      <p className="text-xs text-muted-foreground mt-0.5">{emp.riscos}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Ações do Card */}
              <div className="pt-4 border-t border-border/40 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentBusiness(emp.business_id)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                    isAtiva
                      ? "bg-primary text-primary-foreground shadow-glow"
                      : "border border-border/60 bg-muted/50 text-foreground hover:bg-primary/10 hover:text-primary"
                  }`}
                >
                  {isAtiva ? "Empresa Ativa" : "Definir como Ativa"}
                </button>

                <Link
                  to="/crm"
                  onClick={() => setCurrentBusiness(emp.business_id)}
                  className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                >
                  <span>Ver Vendas</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
