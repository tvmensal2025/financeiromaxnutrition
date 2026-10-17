import { lerPaginas } from "@/lib/leitura-paginada";
import { useEffect, useMemo, useRef, useState } from "react";
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
  Search,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useBusiness } from "@/contexts/BusinessContext";
import { ExecutivePageHeader } from "@/components/executive/ExecutivePageHeader";
import { ExecutiveBadge } from "@/components/executive/ExecutiveBadge";
import { ExecutiveLoadingState } from "@/components/executive/ExecutiveLoadingState";
import { ExecutiveErrorState } from "@/components/executive/ExecutiveErrorState";
import { ExecutiveEmptyState } from "@/components/executive/ExecutiveEmptyState";
import { SeloOrigemDados } from "@/components/executive/SeloOrigemDados";

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

type OrdemPortfolio = "id" | "nome" | "estagio";
const SEM_ESTAGIO = "__SEM_ESTAGIO__";
const estagioDe = (item: PortfolioItem) => {
  const valor = (item.estagio ?? "").trim();
  return !valor || valor === "DADO A COLETAR" ? SEM_ESTAGIO : valor;
};
const ehAtiva = (item: PortfolioItem) => !item.ativo || ["SIM", "TRUE", "ATIVO"].includes(String(item.ativo).toUpperCase());
const normalizar = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Valor lido do banco; "DADO A COLETAR" é um marcador de lacuna, mostrado de forma discreta. */
function Dado({ valor, vazio = "Sem registro" }: { valor?: string | null; vazio?: string }) {
  if (!valor) return <span className="text-muted-foreground">{vazio}</span>;
  if (valor === "DADO A COLETAR") return <span className="font-normal italic text-muted-foreground">A coletar</span>;
  return <>{valor}</>;
}

export default function PortfolioPage() {
  const navigate = useNavigate();
  const { currentBusinessId, setCurrentBusiness } = useBusiness();
  const request = useRef(0);
  const [empresas, setEmpresas] = useState<PortfolioItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroEstagio, setFiltroEstagio] = useState("TODOS");
  const [ordem, setOrdem] = useState<OrdemPortfolio>("id");
  const [soAtivas, setSoAtivas] = useState(false);

  const estagios = useMemo(() => [...new Set(empresas.map(estagioDe))].sort((a, b) => a.localeCompare(b, "pt-BR")), [empresas]);
  const inativas = useMemo(() => empresas.filter((item) => !ehAtiva(item)).length, [empresas]);
  const visiveis = useMemo(() => {
    const termo = normalizar(busca.trim());
    const lista = empresas.filter((item) => {
      if (soAtivas && !ehAtiva(item)) return false;
      if (filtroEstagio !== "TODOS" && estagioDe(item) !== filtroEstagio) return false;
      if (!termo) return true;
      return [item.business_id, item.negocio, item.estagio, item.principal_gargalo, item.objetivo_atual, item.kpi_principal, item.responsavel_executivo, item.modelo_de_receita]
        .some((campo) => normalizar(campo ?? "").includes(termo));
    });
    return [...lista].sort((a, b) => {
      if (ordem === "nome") return a.negocio.localeCompare(b.negocio, "pt-BR");
      if (ordem === "estagio") return estagioDe(a).localeCompare(estagioDe(b), "pt-BR") || a.business_id.localeCompare(b.business_id);
      return a.business_id.localeCompare(b.business_id);
    });
  }, [empresas, busca, filtroEstagio, ordem, soAtivas]);
  const filtrando = Boolean(busca.trim()) || filtroEstagio !== "TODOS" || soAtivas;
  const limparFiltros = () => { setBusca(""); setFiltroEstagio("TODOS"); setSoAtivas(false); };

  async function carregar() {
    const atual = ++request.current;
    setCarregando(true);
    setErro(null);
    setEmpresas([]);
    try {
      const { data, error } = await lerPaginas<PortfolioItem>((inicio, fim) => supabase
        .from("portfolio")
        .select("business_id,negocio,ativo,estagio,objetivo_atual,marco_atual,definicao_de_saida_do_estagio,principal_gargalo,kpi_principal,proximas_decisoes,riscos,proxima_entrega,responsavel_executivo,publico,modelo_de_receita", { count: "exact" })
        .order("business_id").range(inicio, fim));

      if (error) {
        throw error;
      }

      if (atual !== request.current) return;
      if (data && data.length > 0) {
        const itensReais: PortfolioItem[] = data.map((d: PortfolioItem) => ({
          business_id: d.business_id,
          negocio: d.negocio || d.business_id,
          ativo: d.ativo ?? null,
          estagio: d.estagio ?? "DADO A COLETAR",
          objetivo_atual: d.objetivo_atual ?? "DADO A COLETAR",
          marco_atual: d.marco_atual ?? "DADO A COLETAR",
          definicao_de_saida_do_estagio:
            d.definicao_de_saida_do_estagio ?? "DADO A COLETAR",
          principal_gargalo: d.principal_gargalo ?? "DADO A COLETAR",
          kpi_principal: d.kpi_principal ?? "DADO A COLETAR",
          proximas_decisoes: d.proximas_decisoes ?? null,
          riscos: d.riscos ?? null,
          proxima_entrega: d.proxima_entrega ?? null,
          responsavel_executivo: d.responsavel_executivo ?? "DADO A COLETAR",
          publico: d.publico ?? "DADO A COLETAR",
          modelo_de_receita: d.modelo_de_receita ?? "DADO A COLETAR",
        }));
        setEmpresas(itensReais);
      } else {
        setEmpresas([]);
      }
    } catch (err: unknown) {
      if (atual !== request.current) return;
      setErro(err instanceof Error ? err.message : "Não foi possível carregar os registros de portfólio.");
    } finally {
      if (atual === request.current) setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
    return () => { request.current++; };
  }, []);

  const handleAbrirEmpresa = (businessId: string) => {
    setCurrentBusiness(businessId);
    navigate("/indicadores");
  };

  return (
    <div className="he-portfolio-page space-y-6">
      <ExecutivePageHeader
        icon={Briefcase}
        title="Portfólio"
        description={`${empresas.length > 0 ? `${empresas.length} negócios no portfólio` : "Visão estratégica das empresas sob gestão"}`}
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

      <SeloOrigemDados
        fontes={["portfolio"]}
        escopo="Todas as empresas visíveis ao seu acesso"
        registros={carregando || erro ? null : empresas.length}
        unidade={empresas.length === 1 ? "empresa" : "empresas"}
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
      ) : erro ? null : empresas.length === 0 ? (
        <ExecutiveEmptyState
          icon={Briefcase}
          title="Nenhum negócio no portfólio"
          description="Nenhum registro de empresa foi encontrado na tabela portfolio para o seu acesso. Se esperava ver empresas aqui, confira a permissão com o fundador; a tela só lê, não cadastra."
        />
      ) : (
        <div className="space-y-4">
          <div role="search" aria-label="Filtrar e ordenar empresas" className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative w-full min-w-0 sm:max-w-xs sm:flex-1">
              <Search aria-hidden="true" className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="search"
                aria-label="Buscar empresa"
                placeholder="Buscar por nome, ID, gargalo, KPI…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full rounded-lg border border-border/60 bg-background py-1.5 pl-8 pr-3 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <select
              aria-label="Filtrar por estágio"
              value={filtroEstagio}
              onChange={(e) => setFiltroEstagio(e.target.value)}
              className="min-h-9 rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="TODOS">Todos os estágios</option>
              {estagios.map((estagio) => (
                <option key={estagio} value={estagio}>{estagio === SEM_ESTAGIO ? "Sem estágio informado" : estagio}</option>
              ))}
            </select>
            <select
              aria-label="Ordenar empresas"
              value={ordem}
              onChange={(e) => setOrdem(e.target.value as OrdemPortfolio)}
              className="min-h-9 rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="id">Ordem: ID da empresa</option>
              <option value="nome">Ordem: nome (A–Z)</option>
              <option value="estagio">Ordem: estágio</option>
            </select>
            {inativas > 0 && (
              <label className="inline-flex min-h-9 items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={soAtivas} onChange={(e) => setSoAtivas(e.target.checked)} />
                Ocultar inativas ({inativas})
              </label>
            )}
            <span className="text-xs text-muted-foreground sm:ml-auto" aria-live="polite">
              {filtrando ? `${visiveis.length} de ${empresas.length} empresas` : `${empresas.length} ${empresas.length === 1 ? "empresa" : "empresas"}`}
            </span>
          </div>

          {visiveis.length === 0 && (
            <ExecutiveEmptyState
              icon={Search}
              title="Nenhuma empresa corresponde aos filtros"
              description="Ajuste a busca ou o estágio para ver as empresas do portfólio."
              actionLabel="Limpar filtros"
              onAction={limparFiltros}
            />
          )}

          {visiveis.map((emp) => {
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
                      {estagioDe(emp) === SEM_ESTAGIO ? "Sem estágio" : emp.estagio}
                    </ExecutiveBadge>
                    {emp.ativo && !["SIM", "TRUE", "ATIVO"].includes(String(emp.ativo).toUpperCase()) && <span className="rounded border px-2 py-0.5 text-xs text-muted-foreground">Inativa</span>}
                    {isAtiva && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Empresa ativa no contexto
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/identidade?empresa=${encodeURIComponent(emp.business_id)}`} className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted">Identidade da marca</Link>
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
                    <Dado valor={emp.modelo_de_receita} />
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
                      <Dado valor={emp.principal_gargalo} />
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/50 bg-background/50 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <Target className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="font-medium">Objetivo Atual</span>
                    </div>
                    <p className="text-xs text-foreground font-medium line-clamp-3">
                      <Dado valor={emp.objetivo_atual} />
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/50 bg-background/50 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <TrendingUp className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span className="font-medium">KPI Principal</span>
                    </div>
                    <p className="text-xs text-foreground font-medium line-clamp-3">
                      <Dado valor={emp.kpi_principal} />
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/50 bg-background/50 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <UserCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium">Responsável</span>
                    </div>
                    <p className="text-xs text-foreground font-medium">
                      <Dado valor={emp.responsavel_executivo} />
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/50 bg-background/50 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                      <span className="font-medium">Risco Mapeado</span>
                    </div>
                    <p className="text-xs text-foreground font-medium line-clamp-3">
                      {emp.riscos || <span className="font-normal text-muted-foreground">Nenhum risco registrado no portfólio</span>}
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
