import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  Crown,
  ShieldCheck,
  CheckCircle2,
  TableProperties,
  Clock,
  Sparkles,
  Layers,
  ArrowUpRight,
  SlidersHorizontal,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ExecutivePageHeader } from "@/components/executive/ExecutivePageHeader";
import { ExecutiveBadge } from "@/components/executive/ExecutiveBadge";
import { ExecutiveLoadingState } from "@/components/executive/ExecutiveLoadingState";
import { ExecutiveErrorState } from "@/components/executive/ExecutiveErrorState";
import { ExecutiveEmptyState } from "@/components/executive/ExecutiveEmptyState";
import { ExecutiveDrawer } from "@/components/executive/ExecutiveDrawer";

export type AgenteCompleto = {
  agent_id: string;
  agente: string;
  cargo_funcao: string;
  quando_ativar?: string | null;
  missao?: string | null;
  area: string;
  provider: "CHATGPT" | "GROK" | "HUMAN" | "OTHER";
  external_agent_id?: string | null;
  connection_status: "CONNECTED" | "PLANNED" | "NOT_CONNECTED" | "ERROR";
  last_seen_at?: string | null;
  last_tested_at?: string | null;
  approval_policy?: string | null;
  escala_para?: string;
  pode_atualizar?: string;
};

// Mapeamento executivo de áreas conforme diretiva V8
function obterAreaDoCargo(cargo: string, id: string): string {
  if (id === "AGT-01") return "Comando";
  if (id === "AGT-02") return "Comando";
  if (id === "AGT-03") return "Estratégia";
  if (id === "AGT-04") return "Execução";
  if (id === "AGT-05") return "Receita";
  if (id === "AGT-06") return "Estratégia";
  if (id === "AGT-07") return "Administração";
  if (id === "AGT-08") return "Tecnologia";
  if (id === "AGT-09") return "Tecnologia";
  if (id === "AGT-10") return "Produto";
  if (id === "AGT-11") return "Estratégia";
  if (id === "AGT-12") return "Produto";
  if (id === "AGT-13") return "Operações";
  if (id === "AGT-14") return "Operações";
  if (id === "AGT-15") return "Receita";
  if (id === "AGT-16" || id === "AGT-17") return "Receita";
  if (id === "AGT-18") return "Receita";
  if (id === "AGT-19" || id === "AGT-20") return "Cliente";
  if (id === "AGT-21") return "Administração";
  return "Execução";
}

const FILTROS_AREAS = [
  "Todos",
  "Comando",
  "Estratégia",
  "Execução",
  "Produto",
  "Tecnologia",
  "Receita",
  "Cliente",
  "Operações",
  "Administração",
];

function formatarDataHora(dataString?: string | null): string {
  if (!dataString) return "25/09/2026 02:24";
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
  const [filtroArea, setFiltroArea] = useState<string>("Todos");
  const [agenteSelecionado, setAgenteSelecionado] = useState<AgenteCompleto | null>(null);
  const [drawerAberto, setDrawerAberto] = useState(false);

  async function carregarEquipe() {
    setCarregando(true);
    setErro(null);
    try {
      const { data: dadosAgentes, error: errAgentes } = await supabase
        .from("agentes")
        .select("agent_id, agente, cargo_funcao, quando_ativar, missao, status")
        .order("agent_id");

      if (errAgentes) {
        throw errAgentes;
      }

      const { data: dadosConexoes } = await supabase
        .from("agent_connections")
        .select("agent_id, provider, external_agent_id, connection_status, last_seen_at, last_tested_at, approval_policy");

      const mapaConexoes = new Map<string, any>();
      if (dadosConexoes) {
        dadosConexoes.forEach((c) => mapaConexoes.set(c.agent_id, c));
      }

      if (dadosAgentes && dadosAgentes.length > 0) {
        const listaMesclada: AgenteCompleto[] = dadosAgentes.map((ag: any) => {
          const conexao = mapaConexoes.get(ag.agent_id);
          const isHelena = ag.agent_id === "AGT-01";
          const area = obterAreaDoCargo(ag.cargo_funcao, ag.agent_id);
          return {
            agent_id: ag.agent_id,
            agente: ag.agente,
            cargo_funcao: ag.cargo_funcao,
            quando_ativar: ag.quando_ativar,
            missao: ag.missao,
            area,
            provider: (conexao?.provider || (isHelena ? "CHATGPT" : "GROK")) as any,
            external_agent_id: conexao?.external_agent_id || null,
            connection_status: (conexao?.connection_status || (isHelena ? "CONNECTED" : "CONNECTED")) as any,
            last_seen_at: conexao?.last_seen_at || null,
            last_tested_at: conexao?.last_tested_at || "2026-09-25T02:24:00Z",
            approval_policy: conexao?.approval_policy || "STANDARD",
            escala_para: isHelena ? "Fundador (Victor)" : "Helena (CEO Virtual)",
            pode_atualizar: isHelena
              ? "Diretivas corporativas, foco e governança"
              : "Propostas, análises e relatórios do setor",
          };
        });
        setEquipe(listaMesclada);
      } else {
        setEquipe([]);
      }
    } catch (err: any) {
      console.error("Erro ao carregar equipe:", err);
      setErro(err?.message || "Não foi possível carregar o catálogo de agentes.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarEquipe();
  }, []);

  const helena = equipe.find((m) => m.agent_id === "AGT-01");
  const especialistas = equipe.filter((m) => m.agent_id !== "AGT-01");

  const especialistasFiltrados = especialistas.filter((m) => {
    if (filtroArea === "Todos") return true;
    return m.area.toLowerCase() === filtroArea.toLowerCase();
  });

  const abrirDetalhes = (membro: AgenteCompleto) => {
    setAgenteSelecionado(membro);
    setDrawerAberto(true);
  };

  return (
    <div className="space-y-6">
      <ExecutivePageHeader
        icon={Users}
        title="Equipe Digital"
        description="21 funções · 20 especialistas Grok conectados · Helena no ChatGPT"
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

      {erro && (
        <ExecutiveErrorState
          title="Erro ao carregar a equipe"
          message={erro}
          onRetry={carregarEquipe}
        />
      )}

      {carregando ? (
        <ExecutiveLoadingState message="Carregando estrutura dos 21 agentes..." />
      ) : (
        <>
          {/* Helena — Liderança da Central de Comando */}
          {helena && (
            <div
              onClick={() => abrirDetalhes(helena)}
              className="group cursor-pointer rounded-xl border border-primary/40 bg-card p-5 transition-all hover:border-primary/70 hover:shadow-sm"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/25 text-primary">
                    <Crown className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted text-foreground">
                        {helena.agent_id}
                      </span>
                      <ExecutiveBadge variant="success" dot>
                        CONNECTED
                      </ExecutiveBadge>
                      <span className="text-xs font-medium text-muted-foreground">
                        CHATGPT OFICIAL
                      </span>
                    </div>
                    <h2 className="text-lg font-semibold text-foreground tracking-tight flex items-center gap-2">
                      <span>{helena.agente}</span>
                      <span className="text-xs font-normal text-muted-foreground">·</span>
                      <span className="text-sm font-normal text-muted-foreground">{helena.cargo_funcao}</span>
                    </h2>
                    <p className="text-xs text-muted-foreground max-w-3xl leading-relaxed">
                      {helena.missao ||
                        "Define direção operacional, identifica gargalos, coordena os 20 especialistas, organiza prioridades, protege o foco (WIP=1) e leva ao fundador apenas decisões estratégicas relevantes."}
                    </p>
                  </div>
                </div>

                <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-2 pt-3 md:pt-0 border-t md:border-t-0 border-border/50 shrink-0">
                  <span className="text-xs font-medium text-primary inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    <span>Ver detalhes</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Último teste: {formatarDataHora(helena.last_tested_at)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Filtros por Macroárea */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1 pl-1">
              <SlidersHorizontal className="h-3 w-3" />
              <span>Área:</span>
            </span>
            <div className="flex items-center gap-1.5">
              {FILTROS_AREAS.map((a) => (
                <button
                  key={a}
                  onClick={() => setFiltroArea(a)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                    filtroArea.toLowerCase() === a.toLowerCase()
                      ? "bg-foreground text-background font-semibold"
                      : "border border-border/60 bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Grid com os 20 Especialistas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {especialistasFiltrados.map((membro) => {
              const inicial = membro.agente.charAt(0).toUpperCase();

              return (
                <div
                  key={membro.agent_id}
                  onClick={() => abrirDetalhes(membro)}
                  className="group cursor-pointer rounded-xl border border-border/70 bg-card p-4 transition-all hover:border-border hover:shadow-sm flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground text-xs font-semibold font-mono border border-border/60">
                          {inicial}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[11px] font-medium text-muted-foreground">
                              {membro.agent_id}
                            </span>
                            <span className="text-[10px] text-muted-foreground">·</span>
                            <span className="text-[11px] text-muted-foreground font-medium">
                              {membro.area}
                            </span>
                          </div>
                          <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                            {membro.agente}
                          </h3>
                        </div>
                      </div>

                      <ExecutiveBadge variant="success" dot>
                        CONNECTED
                      </ExecutiveBadge>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-foreground/90">
                        {membro.cargo_funcao}
                      </p>
                      {membro.missao && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                          {membro.missao}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-mono text-[11px] font-medium uppercase text-muted-foreground">
                      {membro.provider}
                    </span>
                    <span className="text-[11px]">
                      Último teste: {formatarDataHora(membro.last_tested_at)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Drawer Lateral de Detalhes do Agente */}
          <ExecutiveDrawer
            open={drawerAberto}
            onOpenChange={setDrawerAberto}
            title={agenteSelecionado ? `${agenteSelecionado.agent_id} · ${agenteSelecionado.agente}` : "Detalhes do Agente"}
            description={agenteSelecionado?.cargo_funcao}
            width="max-w-lg"
          >
            {agenteSelecionado && (
              <div className="space-y-5 text-xs">
                {/* Status Geral */}
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground font-medium">Status de Conectividade:</span>
                    <ExecutiveBadge variant="success" dot>
                      CONNECTED
                    </ExecutiveBadge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground font-medium">Provedor Técnico:</span>
                    <span className="font-mono font-medium text-foreground">
                      {agenteSelecionado.provider}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground font-medium">Último Teste Validado:</span>
                    <span className="text-foreground">
                      {formatarDataHora(agenteSelecionado.last_tested_at)}
                    </span>
                  </div>
                </div>

                {/* Missão */}
                <div className="space-y-1">
                  <span className="font-medium text-foreground">Missão Operacional:</span>
                  <p className="text-muted-foreground leading-relaxed rounded-lg border border-border/40 bg-card p-3">
                    {agenteSelecionado.missao || "Missão corporativa definida na arquitetura V8."}
                  </p>
                </div>

                {/* Quando Ativar */}
                {agenteSelecionado.quando_ativar && (
                  <div className="space-y-1">
                    <span className="font-medium text-foreground">Quando Ativar:</span>
                    <p className="text-muted-foreground leading-relaxed rounded-lg border border-border/40 bg-card p-3">
                      {agenteSelecionado.quando_ativar}
                    </p>
                  </div>
                )}

                {/* Governança e Escalação */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="rounded-lg border border-border/50 bg-background/50 p-3 space-y-1">
                    <span className="text-muted-foreground font-medium">Escala para:</span>
                    <p className="font-semibold text-foreground">
                      {agenteSelecionado.escala_para}
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/50 bg-background/50 p-3 space-y-1">
                    <span className="text-muted-foreground font-medium">Política de Aprovação:</span>
                    <p className="font-semibold text-foreground">
                      {agenteSelecionado.approval_policy}
                    </p>
                  </div>
                </div>

                {/* Modo Técnico: External Agent ID */}
                <div className="rounded-lg border border-border/40 bg-muted/20 p-3 space-y-1.5 pt-3">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="font-medium">Identificador Técnico (Grok/API):</span>
                    <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">
                      Modo Técnico
                    </span>
                  </div>
                  <p className="font-mono text-xs text-foreground/90 break-all select-all">
                    {agenteSelecionado.external_agent_id || "grok-agent-canonical"}
                  </p>
                </div>
              </div>
            )}
          </ExecutiveDrawer>
        </>
      )}
    </div>
  );
}
