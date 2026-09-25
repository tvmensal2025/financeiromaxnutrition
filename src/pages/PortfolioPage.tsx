import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  Flame,
  AlertTriangle,
  ArrowRight,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useBusiness } from "@/contexts/BusinessContext";

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

const CORES_PORTFOLIO: Record<string, { primario: string; bg: string; border: string }> = {
  "BIZ-001": { primario: "#007A3D", bg: "#007A3D12", border: "#007A3D35" },
  "BIZ-002": { primario: "#2563EB", bg: "#2563EB12", border: "#2563EB35" },
  "BIZ-003": { primario: "#B45309", bg: "#B4530912", border: "#B4530935" },
};

export default function PortfolioPage() {
  const { currentBusinessId, setCurrentBusiness } = useBusiness();
  const [empresas, setEmpresas] = useState<PortfolioItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      setErro(null);
      try {
        // Leitura direta e estrita de public.portfolio sem fallbacks hardcoded
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
            definicao_de_saida_do_estagio: d.definicao_de_saida_do_estagio ?? d.definicao_saida ?? "DADO A COLETAR",
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
        console.error("Erro ao carregar portfolio do Supabase:", err);
        setErro(err?.message || "Não foi possível carregar os registros da tabela public.portfolio.");
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
            <span className="text-xs text-muted-foreground">Fonte Canônica: public.portfolio</span>
          </div>
          <h1 className="pe-page-title flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Portfólio de Negócios
          </h1>
          <p className="text-xs text-muted-foreground">
            Dados operacionais extraídos estritamente do banco de dados sem enriquecimento artificial.
          </p>
        </div>

        <Link
          to="/modulo/portfolio"
          className="self-start sm:self-auto rounded-xl border border-border/60 bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-all"
        >
          Modo Avançado (Tabela) →
        </Link>
      </div>

      {erro && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {carregando ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs">Consultando empresas em public.portfolio...</p>
        </div>
      ) : empresas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
          <Building2 className="mx-auto h-8 w-8 mb-2 opacity-50" />
          <p className="text-sm font-semibold">Nenhum registro encontrado em public.portfolio.</p>
        </div>
      ) : (
        /* Grid com os Negócios Reais do Banco */
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
                      <p className="text-[11px] text-muted-foreground">{emp.modelo_de_receita}</p>
                    </div>

                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      {emp.estagio}
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
                        Critério de Saída do Estágio:
                      </span>
                      <p className="text-foreground/90 font-medium leading-relaxed">
                        {emp.definicao_de_saida_do_estagio}
                      </p>
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
                        <p className="text-foreground font-semibold text-[11px]">
                          {emp.responsavel_executivo}
                        </p>
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
      )}
    </div>
  );
}
