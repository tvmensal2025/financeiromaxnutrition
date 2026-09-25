import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  Bot,
  Crown,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  Clock,
  CheckCircle2,
  ExternalLink,
  Cpu,
  Loader2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

export type AgenteCompleto = {
  agent_id: string;
  agente: string;
  cargo_funcao: string;
  quando_ativar?: string | null;
  missao?: string | null;
  area?: string;
  provider: "CHATGPT" | "GROK" | "HUMAN" | "OTHER";
  external_agent_id?: string | null;
  connection_status: "CONNECTED" | "PLANNED" | "NOT_CONNECTED" | "ERROR";
  last_seen_at?: string | null;
  last_tested_at?: string | null;
  approval_policy?: string | null;
};

// Mapeamento de macroárea organizacional com base no cargo canônico
function obterAreaDoCargo(cargo: string, id: string): string {
  if (id === "AGT-01") return "Comando";
  if (id === "AGT-02") return "Fundador";
  if (id === "AGT-03") return "Estratégia";
  if (id === "AGT-04") return "Execução";
  if (id === "AGT-05") return "Finanças";
  if (id === "AGT-06") return "Governança & Risco";
  if (id === "AGT-07") return "Pessoas & Cultura";
  if (id === "AGT-08") return "Dados & BI";
  if (id === "AGT-09") return "Tecnologia & IA";
  if (id === "AGT-10") return "Produto";
  if (id === "AGT-11") return "Pesquisa & Insights";
  if (id === "AGT-12") return "Design & UX";
  if (id === "AGT-13") return "Qualidade & QA";
  if (id === "AGT-14") return "Operações";
  if (id === "AGT-15") return "Vendas";
  if (id === "AGT-16" || id === "AGT-17") return "Marketing & Marca";
  if (id === "AGT-18") return "Parcerias & Negócios";
  if (id === "AGT-19") return "Customer Success";
  if (id === "AGT-20") return "Atendimento";
  if (id === "AGT-21") return "Administração";
  return "Corporativo";
}

export default function EquipePage() {
  const [equipe, setEquipe] = useState<AgenteCompleto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtroArea, setFiltroArea] = useState<string>("TODAS");

  useEffect(() => {
    async function carregarEquipe() {
      setCarregando(true);
      setErro(null);
      try {
        // 1. Fonte canônica de identidade: public.agentes
        const { data: dadosAgentes, error: errAgentes } = await supabase
          .from("agentes")
          .select("agent_id, agente, cargo_funcao, quando_ativar, missao, status")
          .order("agent_id");

        if (errAgentes) {
          throw errAgentes;
        }

        // 2. Conexões técnicas: public.agent_connections
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
            return {
              agent_id: ag.agent_id,
              agente: ag.agente,
              cargo_funcao: ag.cargo_funcao,
              quando_ativar: ag.quando_ativar,
              missao: ag.missao,
              area: obterAreaDoCargo(ag.cargo_funcao, ag.agent_id),
              provider: (conexao?.provider || (isHelena ? "CHATGPT" : "GROK")) as any,
              external_agent_id: conexao?.external_agent_id || null,
              connection_status: (conexao?.connection_status || (isHelena ? "CONNECTED" : "PLANNED")) as any,
              last_seen_at: conexao?.last_seen_at || null,
              last_tested_at: conexao?.last_tested_at || null,
              approval_policy: conexao?.approval_policy || "STANDARD",
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

    carregarEquipe();
  }, []);

  const helena = equipe.find((m) => m.agent_id === "AGT-01");
  const especialistas = equipe.filter((m) => m.agent_id !== "AGT-01");

  const areas = ["TODAS", ...new Set(especialistas.map((m) => m.area || "Geral"))];

  const especialistasFiltrados = especialistas.filter((m) => {
    if (filtroArea === "TODAS") return true;
    return m.area === filtroArea;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Equipe</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">Fonte Canônica: public.agentes</span>
          </div>
          <h1 className="pe-page-title flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Equipe Digital do Fundador
          </h1>
          <p className="text-xs text-muted-foreground">
            Helena como CEO Virtual no ChatGPT e os 20 especialistas corporativos conectados via Supabase.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/modulo/agentes"
            className="rounded-xl border border-border/60 bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-all"
          >
            Tabela de Agentes →
          </Link>
        </div>
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
          <p className="text-xs">Consultando identidades canônicas em public.agentes...</p>
        </div>
      ) : (
        <>
          {/* Destaque da Helena — CEO Virtual */}
          {helena && (
            <section className="relative overflow-hidden rounded-3xl border-2 border-primary/40 bg-gradient-to-br from-primary/10 via-card to-background p-6 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/20 border border-primary/40 shadow-sm text-primary">
                    <Crown className="h-7 w-7" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-black text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md">
                        {helena.agent_id}
                      </span>
                      <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">
                        {helena.connection_status === "CONNECTED" ? "CONECTADA & OPERACIONAL" : helena.connection_status}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Provider: <strong>{helena.provider} Oficial</strong>
                      </span>
                    </div>
                    <h2 className="text-xl md:text-2xl font-black text-foreground">
                      {helena.agente} · {helena.cargo_funcao}
                    </h2>
                    <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
                      {helena.missao ||
                        "Define direção operacional, identifica gargalos, coordena os 20 especialistas, organiza prioridades, protege o foco (WIP=1) e leva ao fundador apenas decisões estratégicas relevantes."}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/60 bg-background/80 p-4 space-y-1 text-xs shrink-0 md:max-w-xs w-full">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Foco Executivo Ativo:</span>
                  <p className="font-semibold text-foreground leading-snug">
                    FOC-004: Homologação técnica do Sistema Helena
                  </p>
                  <p className="text-[11px] text-muted-foreground pt-1">
                    Operação e comando via ChatGPT oficial.
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Filtro por Área */}
          <div className="flex flex-wrap items-center gap-1.5 bg-card/60 p-1.5 rounded-2xl border border-border/40 backdrop-blur-md">
            {areas.map((a) => (
              <button
                key={a}
                onClick={() => setFiltroArea(a)}
                className={`rounded-xl px-3 py-1 text-xs font-semibold transition-all ${
                  filtroArea === a
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {a}
              </button>
            ))}
          </div>

          {/* Grid com os 20 Especialistas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {especialistasFiltrados.map((membro) => (
              <div
                key={membro.agent_id}
                className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm hover:border-primary/40 transition-all flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-[10px] font-bold text-muted-foreground">
                        {membro.agent_id} · {membro.area}
                      </span>
                      <h3 className="text-base font-bold text-foreground">{membro.agente}</h3>
                      <p className="text-xs text-muted-foreground">{membro.cargo_funcao}</p>
                    </div>

                    <span
                      className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase shrink-0 ${
                        membro.connection_status === "CONNECTED"
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      {membro.connection_status === "CONNECTED" ? "CONECTADO" : "NÃO CONECTADO"}
                    </span>
                  </div>

                  {membro.missao && (
                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                      {membro.missao}
                    </p>
                  )}

                  <div className="rounded-xl border border-border/40 bg-muted/30 p-2.5 space-y-1 text-xs">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Provider:</span>
                      <strong className="font-mono text-foreground">{membro.provider}</strong>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Status Técnico:</span>
                      <span className="font-semibold text-amber-600 dark:text-amber-400">
                        {membro.connection_status}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="text-[10px]">Identidade: public.agentes</span>
                  <span className="text-[10px] italic">Aguardando Grok Bot</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
