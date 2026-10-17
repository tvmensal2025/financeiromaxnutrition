import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, LayoutGrid, List, RefreshCw, SlidersHorizontal, TableProperties, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ExecutivePageHeader } from "@/components/executive/ExecutivePageHeader";
import { ExecutiveDrawer } from "@/components/executive/ExecutiveDrawer";
import {
  AgentAvatar,
  AgentCardList,
  AgentStatusBadge,
  type AgentCardVariant,
} from "@/components/executive/AgentCard";
import { getAreaVisual } from "@/lib/agentVisuals";
import {
  AREAS_OFICIAIS,
  FILTROS_AREAS,
  contarAgentesConectados,
  descricaoCabecalhoEquipe,
  mesclarAgenteComConexao,
  statusVisualDoAgente,
  type AgenteCompleto,
  type AgenteRow,
  type ConexaoRow,
} from "@/lib/equipe";
import { cn } from "@/lib/utils";

const FOCO =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007A3D] focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-[#4FD08A]";

function formatarDataHora(dataString?: string | null): string {
  if (!dataString) return "—";
  try {
    const d = new Date(dataString);
    if (isNaN(d.getTime())) return dataString;
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dataString;
  }
}

export default function EquipePage() {
  const [equipe, setEquipe] = useState<AgenteCompleto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [erroConexoes, setErroConexoes] = useState(false);
  const [filtroArea, setFiltroArea] = useState<string>("Todos");
  const [variante, setVariante] = useState<AgentCardVariant>("padrao");
  const [agenteSelecionado, setAgenteSelecionado] = useState<AgenteCompleto | null>(null);
  const [drawerAberto, setDrawerAberto] = useState(false);

  async function carregarEquipe() {
    setCarregando(true);
    setErro(null);
    setErroConexoes(false);
    try {
      const { data: dadosAgentes, error: errAgentes } = await supabase
        .from("agentes")
        .select("agent_id, agente, cargo_funcao, quando_ativar, missao, status")
        .order("agent_id");

      if (errAgentes) {
        throw errAgentes;
      }

      const { data: dadosConexoes, error: errConexoes } = await supabase
        .from("agent_connections")
        .select(
          "agent_id, provider, external_agent_id, connection_status, last_seen_at, last_tested_at, approval_policy",
        );

      const conexoesIndisponiveis = Boolean(errConexoes);
      setErroConexoes(conexoesIndisponiveis);

      const mapaConexoes = new Map<string, ConexaoRow>();
      if (!conexoesIndisponiveis && dadosConexoes) {
        dadosConexoes.forEach((c) => mapaConexoes.set(c.agent_id, c));
      }

      const listaMesclada = (dadosAgentes ?? []).map((ag: AgenteRow) =>
        mesclarAgenteComConexao(ag, conexoesIndisponiveis ? undefined : mapaConexoes.get(ag.agent_id)),
      );
      setEquipe(listaMesclada);
    } catch (err: unknown) {
      console.error("Erro ao carregar equipe:", err);
      const mensagem =
        err && typeof err === "object" && "message" in err && typeof err.message === "string"
          ? err.message
          : "Não foi possível carregar o catálogo de agentes.";
      setErro(mensagem);
      setEquipe([]);
      setErroConexoes(false);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarEquipe();
  }, []);

  const equipeFiltrada = useMemo(() => {
    if (filtroArea === "Todos") return equipe;
    return equipe.filter((m) => m.area === filtroArea);
  }, [equipe, filtroArea]);

  const cards = useMemo(
    () =>
      equipeFiltrada.map((a) => ({
        agentId: a.agent_id,
        nome: a.agente,
        cargo: a.cargo_funcao,
        status: statusVisualDoAgente(a, erroConexoes),
      })),
    [equipeFiltrada, erroConexoes],
  );

  const abrirDetalhes = (agentId: string) => {
    const membro = equipe.find((m) => m.agent_id === agentId);
    if (!membro) return;
    setAgenteSelecionado(membro);
    setDrawerAberto(true);
  };

  const conectados = contarAgentesConectados(equipe, erroConexoes);
  const descricao = descricaoCabecalhoEquipe({
    carregando,
    erroAgentes: Boolean(erro),
    erroConexoes,
    total: equipe.length,
    conectados,
  });

  const statusSelecionado = agenteSelecionado
    ? statusVisualDoAgente(agenteSelecionado, erroConexoes)
    : null;

  return (
    <div className="he-team-page space-y-6">
      <ExecutivePageHeader
        icon={Users}
        title="Equipe Digital"
        description={descricao}
        actions={
          <Link
            to="/modulo/agentes"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/70 transition-colors"
          >
            <TableProperties className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Tabela canônica</span>
          </Link>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="flex shrink-0 items-center gap-1 pl-1 text-xs text-muted-foreground">
            <SlidersHorizontal className="h-3 w-3" />
            <span>Área:</span>
          </span>
          <div className="flex items-center gap-1.5">
            {FILTROS_AREAS.map((a) => {
              const area = AREAS_OFICIAIS.find((x) => x.nome === a);
              const ativo = filtroArea === a;
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => setFiltroArea(a)}
                  aria-pressed={ativo}
                  className={cn("relative inline-flex min-h-11 min-w-11 items-center justify-center", FOCO)}
                >
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                      ativo
                        ? "bg-foreground font-semibold text-background"
                        : "border border-border/60 bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {area && (
                      <span
                        className={cn("h-1.5 w-1.5 shrink-0 rounded-[2px]", area.className.swatch)}
                        aria-hidden
                      />
                    )}
                    {a}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex shrink-0 items-center self-end rounded-lg border border-border bg-card p-0.5">
          <button
            type="button"
            onClick={() => setVariante("padrao")}
            aria-pressed={variante === "padrao"}
            aria-label="Ver em grade"
            className={cn("relative grid h-11 w-11 place-items-center text-muted-foreground transition-colors", FOCO)}
          >
            <span
              className={cn(
                "grid h-8 w-8 place-items-center rounded-md",
                variante === "padrao" && "bg-muted text-foreground",
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </span>
          </button>
          <button
            type="button"
            onClick={() => setVariante("compacto")}
            aria-pressed={variante === "compacto"}
            aria-label="Ver em lista"
            className={cn("relative grid h-11 w-11 place-items-center text-muted-foreground transition-colors", FOCO)}
          >
            <span
              className={cn(
                "grid h-8 w-8 place-items-center rounded-md",
                variante === "compacto" && "bg-muted text-foreground",
              )}
            >
              <List className="h-4 w-4" />
            </span>
          </button>
        </div>
      </div>

      {erroConexoes && !erro && !carregando && (
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#B91C1C]/10 text-[#B91C1C] dark:text-[#F87171]">
              <AlertTriangle className="h-5 w-5" aria-hidden />
            </span>
            <p className="text-sm font-semibold tracking-tight text-foreground">
              Não foi possível carregar o status de conexão dos agentes.
            </p>
          </div>
          <button
            type="button"
            onClick={carregarEquipe}
            className={cn(
              "inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-border bg-muted/40 px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted",
              FOCO,
            )}
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Tentar novamente
          </button>
        </div>
      )}

      <AgentCardList
        agentes={cards}
        variante={variante}
        carregando={carregando}
        erro={erro}
        onRetry={carregarEquipe}
        onSelect={abrirDetalhes}
        skeletons={8}
      />

      <ExecutiveDrawer
        open={drawerAberto}
        onOpenChange={setDrawerAberto}
        title={
          agenteSelecionado
            ? `${agenteSelecionado.agent_id} · ${agenteSelecionado.agente}`
            : "Detalhes do Agente"
        }
        subtitle={agenteSelecionado?.cargo_funcao}
        width="wide"
        badge={statusSelecionado ? <AgentStatusBadge status={statusSelecionado} /> : undefined}
      >
        {agenteSelecionado && (
          <div className="space-y-5 text-xs">
            <div className="flex items-start gap-3">
              <AgentAvatar
                agentId={agenteSelecionado.agent_id}
                nome={agenteSelecionado.agente}
                size={56}
                rotular
              />
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold tracking-tight text-foreground">
                  {agenteSelecionado.agente}
                </p>
                <p className="text-muted-foreground">{agenteSelecionado.cargo_funcao}</p>
                <p className={cn("text-xs font-medium", getAreaVisual(agenteSelecionado.agent_id)?.className.text)}>
                  {agenteSelecionado.area}
                </p>
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-muted-foreground">Status de conectividade:</span>
                <AgentStatusBadge status={statusSelecionado!} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-muted-foreground">Provedor técnico:</span>
                <span className="font-mono font-medium text-foreground">
                  {agenteSelecionado.provider ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-muted-foreground">Último teste validado:</span>
                <span className="text-foreground">
                  {formatarDataHora(agenteSelecionado.last_tested_at)}
                </span>
              </div>
            </div>

            {agenteSelecionado.missao && (
              <div className="space-y-1">
                <span className="font-medium text-foreground">Missão operacional:</span>
                <p className="rounded-lg border border-border/40 bg-card p-3 leading-relaxed text-muted-foreground">
                  {agenteSelecionado.missao}
                </p>
              </div>
            )}

            {agenteSelecionado.quando_ativar && (
              <div className="space-y-1">
                <span className="font-medium text-foreground">Quando ativar:</span>
                <p className="rounded-lg border border-border/40 bg-card p-3 leading-relaxed text-muted-foreground">
                  {agenteSelecionado.quando_ativar}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="space-y-1 rounded-lg border border-border/50 bg-background/50 p-3">
                <span className="font-medium text-muted-foreground">Escala para:</span>
                <p className="font-semibold text-foreground">{agenteSelecionado.escala_para}</p>
              </div>
              <div className="space-y-1 rounded-lg border border-border/50 bg-background/50 p-3">
                <span className="font-medium text-muted-foreground">Política de aprovação:</span>
                <p className="font-semibold text-foreground">
                  {agenteSelecionado.approval_policy ?? "—"}
                </p>
              </div>
            </div>

            <div className="space-y-1.5 rounded-lg border border-border/40 bg-muted/20 p-3">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="font-medium">Identificador técnico:</span>
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">Modo técnico</span>
              </div>
              <p className="select-all break-all font-mono text-xs text-foreground/90">
                {agenteSelecionado.external_agent_id ?? "—"}
              </p>
            </div>
          </div>
        )}
      </ExecutiveDrawer>
    </div>
  );
}
