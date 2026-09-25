import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Briefcase,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Target,
  UserCheck,
  CheckCircle2,
  TableProperties,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useBusiness } from "@/contexts/BusinessContext";
import { ExecutivePageHeader } from "@/components/executive/ExecutivePageHeader";
import { ExecutiveBadge } from "@/components/executive/ExecutiveBadge";
import { ExecutiveLoadingState } from "@/components/executive/ExecutiveLoadingState";
import { ExecutiveErrorState } from "@/components/executive/ExecutiveErrorState";
import { ExecutiveEmptyState } from "@/components/executive/ExecutiveEmptyState";

export type PortfolioItem = {
  business_id: string;
  negocio: string;
  ativo?: string | null;
  estagio?: string | null;
  objetivo_atual?: string | null;
  marco_atual?: string | null;
  definicao_de_saida_do_estagio?: string | null;
  principal_gargalo?: string | null;
  kpi_principal?: string | null;
  proximas_decisoes?: string | null;
  riscos?: string | null;
  proxima_entrega?: string | null;
  responsavel_executivo?: string | null;
  publico?: string | null;
  modelo_de_receita?: string | null;
};

export default function PortfolioPage() {
  const navigate = useNavigate();
  const { currentBusinessId, setCurrentBusiness } = useBusiness();
  const [empresas, setEmpresas] = useState<PortfolioItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const { data, error } = await supabase
        .from("portfolio")
        .select("*")
        .order("business_id");

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        const itensReais: PortfolioItem[] = data.map((d: any) => ({
          business_id: d.business_id,
          negocio: d.negocio || d.nome || d.business_id,
          ativo: d.ativo ?? "SIM",
          estagio: d.estagio ?? "DADO A COLETAR",
          objetivo_atual: d.objetivo_atual ?? d.objetivo ?? "DADO A COLETAR",
          marco_atual: d.marco_atual ?? d.marco ?? "DADO A COLETAR",
          definicao_de_saida_do_estagio:
            d.definicao_de_saida_do_estagio ?? d.definicao_saida ?? "DADO A COLETAR",
          principal_gargalo: d.principal_gargalo ?? d.gargalo ?? "DADO A COLETAR",
          kpi_principal: d.kpi_principal ?? d.kpi ?? "DADO A COLETAR",
          proximas_decisoes: d.proximas_decisoes ?? d.proxima_decisao ?? null,
          riscos: d.riscos ?? d.risco_principal ?? null,
          proxima_entrega: d.proxima_entrega ?? null,
          responsavel_executivo: d.responsavel_executivo ?? "DADO A COLETAR",
          publico: d.publico ?? "DADO A COLETAR",
          modelo_de_receita: d.modelo_de_receita ?? d.modelo_receita ?? "DADO A COLETAR",
        }));
        setEmpresas(itensReais);
      } else {
        setEmpresas([]);
      }
    } catch (err: any) {
      console.error("Erro ao carregar portfolio:", err);
      setErro(err?.message || "Não foi possível carregar os registros de portfólio.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  const handleAbrirEmpresa = (businessId: string) => {
    setCurrentBusiness(businessId);
    navigate("/");
  };

  return (
    <div className="space-y-6">
      <ExecutivePageHeader
        icon={Briefcase}
        title="Portfólio"
        description={`${empresas.length > 0 ? `${empresas.length} negócios ativos` : "Visão estratégica das empresas sob gestão"}`}
        actions={
          <Link
            to="/modulo/portfolio"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/70 transition-colors"
          >
            <TableProperties className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Tabela detalhada</span>
          </Link>
        }
      />

      {erro && (
        <ExecutiveErrorState
          title="Erro ao carregar o portfólio"
          message={erro}
          onRetry={carregar}
        />
      )}

      {carregando ? (
        <ExecutiveLoadingState message="Carregando estrutura dos negócios..." />
      ) : empresas.length === 0 ? (
        <ExecutiveEmptyState
          icon={Briefcase}
          title="Nenhum negócio no portfólio"
          description="Nenhum registro de empresa foi encontrado no banco de dados."
        />
      ) : (
        <div className="space-y-4">
          {empresas.map((emp) => {
            const isAtiva = currentBusinessId === emp.business_id;

            return (
              <div
                key={emp.business_id}
                className={`group rounded-xl border bg-card p-5 transition-all ${
                  isAtiva
                    ? "border-primary/50 shadow-sm ring-1 ring-primary/20"
                    : "border-border/70 hover:border-border"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-border/50">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                      {emp.business_id}
                    </span>
                    <h2 className="text-base font-semibold text-foreground tracking-tight">
                      {emp.negocio}
                    </h2>
                    <ExecutiveBadge
                      variant={
                        emp.estagio?.toLowerCase().includes("venda")
                          ? "success"
                          : emp.estagio?.toLowerCase().includes("valida")
                          ? "warning"
                          : "neutral"
                      }
                      dot
                    >
                      {emp.estagio}
                    </ExecutiveBadge>
                    {isAtiva && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Empresa ativa no contexto
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAbrirEmpresa(emp.business_id)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                        isAtiva
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : "border border-border/80 bg-background text-foreground hover:bg-muted"
                      }`}
                    >
                      <span>{isAtiva ? "Acessar Painel" : "Abrir empresa"}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Linha do Modelo de Receita */}
                <div className="pt-3 pb-2 text-xs text-muted-foreground flex items-center gap-2">
                  <span className="font-medium text-foreground/80">Modelo de receita:</span>
                  <span className="font-mono text-xs bg-muted/40 px-2 py-0.5 rounded border border-border/40">
                    {emp.modelo_de_receita}
                  </span>
                </div>

                {/* Grid Executivo das Informações do Negócio */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 pt-3">
                  <div className="rounded-lg border border-border/50 bg-background/50 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span className="font-medium">Principal Gargalo</span>
                    </div>
                    <p className="text-xs text-foreground font-medium line-clamp-3">
                      {emp.principal_gargalo}
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/50 bg-background/50 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <Target className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="font-medium">Objetivo Atual</span>
                    </div>
                    <p className="text-xs text-foreground font-medium line-clamp-3">
                      {emp.objetivo_atual}
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/50 bg-background/50 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <TrendingUp className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span className="font-medium">KPI Principal</span>
                    </div>
                    <p className="text-xs text-foreground font-medium line-clamp-3">
                      {emp.kpi_principal}
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/50 bg-background/50 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <UserCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium">Responsável</span>
                    </div>
                    <p className="text-xs text-foreground font-medium">
                      {emp.responsavel_executivo}
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/50 bg-background/50 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                      <span className="font-medium">Risco Mapeado</span>
                    </div>
                    <p className="text-xs text-foreground font-medium line-clamp-3">
                      {emp.riscos || "Nenhum risco crítico associado"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
