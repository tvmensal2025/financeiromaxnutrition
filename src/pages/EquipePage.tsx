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
} from "lucide-react";
import { supabase } from "@/lib/supabase";

export type AgenteMembro = {
  agent_id: string;
  nome: string;
  funcao: string;
  area: string;
  provider: "CHATGPT" | "GROK" | "HUMAN" | "OTHER";
  connection_status: "CONNECTED" | "PLANNED" | "NOT_CONNECTED";
  status_organizacional: string;
  trabalhando_em?: string;
  tarefas_pendentes: number;
  tarefas_concluidas: number;
  bloqueios?: string;
};

const EQUIPE_OFICIAL: AgenteMembro[] = [
  {
    agent_id: "AGT-01",
    nome: "Helena",
    funcao: "CEO Virtual / Central de Comando",
    area: "Comando & Estratégia",
    provider: "CHATGPT",
    connection_status: "CONNECTED",
    status_organizacional: "OPERACIONAL ATIVA",
    trabalhando_em: "Homologação técnica do Sistema Helena (FOC-004) e alinhamento do portfólio",
    tarefas_pendentes: 1,
    tarefas_concluidas: 14,
  },
  {
    agent_id: "AGT-02",
    nome: "Amanda",
    funcao: "Gestão Financeira & Caixa",
    area: "Finanças",
    provider: "GROK",
    connection_status: "PLANNED",
    status_organizacional: "DEFINIDO — NÃO CONECTADO",
    tarefas_pendentes: 0,
    tarefas_concluidas: 0,
  },
  {
    agent_id: "AGT-03",
    nome: "Bruno",
    funcao: "Controladoria & DRE",
    area: "Finanças",
    provider: "GROK",
    connection_status: "PLANNED",
    status_organizacional: "DEFINIDO — NÃO CONECTADO",
    tarefas_pendentes: 0,
    tarefas_concluidas: 0,
  },
  {
    agent_id: "AGT-04",
    nome: "Camila",
    funcao: "Contratos & Jurídico",
    area: "Jurídico & Compliance",
    provider: "GROK",
    connection_status: "PLANNED",
    status_organizacional: "DEFINIDO — NÃO CONECTADO",
    tarefas_pendentes: 0,
    tarefas_concluidas: 0,
  },
  {
    agent_id: "AGT-05",
    nome: "Diego",
    funcao: "CRM & Operações Comerciais",
    area: "Vendas",
    provider: "GROK",
    connection_status: "PLANNED",
    status_organizacional: "DEFINIDO — NÃO CONECTADO",
    tarefas_pendentes: 0,
    tarefas_concluidas: 0,
  },
  {
    agent_id: "AGT-06",
    nome: "Eduardo",
    funcao: "Pré-Vendas & Qualificação (SDR)",
    area: "Vendas",
    provider: "GROK",
    connection_status: "PLANNED",
    status_organizacional: "DEFINIDO — NÃO CONECTADO",
    tarefas_pendentes: 0,
    tarefas_concluidas: 0,
  },
  {
    agent_id: "AGT-07",
    nome: "Fernanda",
    funcao: "Sucesso do Cliente (CS) & Retenção",
    area: "Atendimento",
    provider: "GROK",
    connection_status: "PLANNED",
    status_organizacional: "DEFINIDO — NÃO CONECTADO",
    tarefas_pendentes: 0,
    tarefas_concluidas: 0,
  },
  {
    agent_id: "AGT-08",
    nome: "Gabriel",
    funcao: "Atendimento & Suporte Técnico",
    area: "Atendimento",
    provider: "GROK",
    connection_status: "PLANNED",
    status_organizacional: "DEFINIDO — NÃO CONECTADO",
    tarefas_pendentes: 0,
    tarefas_concluidas: 0,
  },
  {
    agent_id: "AGT-09",
    nome: "Henrique",
    funcao: "Tráfego Pago & Performance",
    area: "Marketing",
    provider: "GROK",
    connection_status: "PLANNED",
    status_organizacional: "DEFINIDO — NÃO CONECTADO",
    tarefas_pendentes: 0,
    tarefas_concluidas: 0,
  },
  {
    agent_id: "AGT-10",
    nome: "Isabela",
    funcao: "Conteúdo, Copywriting & Comunicação",
    area: "Marketing",
    provider: "GROK",
    connection_status: "PLANNED",
    status_organizacional: "DEFINIDO — NÃO CONECTADO",
    tarefas_pendentes: 0,
    tarefas_concluidas: 0,
  },
  {
    agent_id: "AGT-11",
    nome: "João",
    funcao: "Gestão de Produto & Backlog",
    area: "Produto",
    provider: "GROK",
    connection_status: "PLANNED",
    status_organizacional: "DEFINIDO — NÃO CONECTADO",
    tarefas_pendentes: 0,
    tarefas_concluidas: 0,
  },
  {
    agent_id: "AGT-12",
    nome: "Larissa",
    funcao: "UX/UI & Experiência Digital",
    area: "Produto",
    provider: "GROK",
    connection_status: "PLANNED",
    status_organizacional: "DEFINIDO — NÃO CONECTADO",
    tarefas_pendentes: 0,
    tarefas_concluidas: 0,
  },
  {
    agent_id: "AGT-13",
    nome: "Marcelo",
    funcao: "Arquitetura de Software & Banco de Dados",
    area: "Tecnologia",
    provider: "GROK",
    connection_status: "PLANNED",
    status_organizacional: "DEFINIDO — NÃO CONECTADO",
    tarefas_pendentes: 0,
    tarefas_concluidas: 0,
  },
  {
    agent_id: "AGT-14",
    nome: "Natália",
    funcao: "QA, Testes & Homologação",
    area: "Tecnologia",
    provider: "GROK",
    connection_status: "PLANNED",
    status_organizacional: "DEFINIDO — NÃO CONECTADO",
    tarefas_pendentes: 0,
    tarefas_concluidas: 0,
  },
  {
    agent_id: "AGT-15",
    nome: "Victor",
    funcao: "Automações & Integrações Técnicas",
    area: "Tecnologia",
    provider: "GROK",
    connection_status: "PLANNED",
    status_organizacional: "DEFINIDO — NÃO CONECTADO",
    tarefas_pendentes: 0,
    tarefas_concluidas: 0,
  },
  {
    agent_id: "AGT-16",
    nome: "Paula",
    funcao: "Governança, Risco & Auditoria",
    area: "Governança",
    provider: "GROK",
    connection_status: "PLANNED",
    status_organizacional: "DEFINIDO — NÃO CONECTADO",
    tarefas_pendentes: 0,
    tarefas_concluidas: 0,
  },
  {
    agent_id: "AGT-17",
    nome: "Rafael",
    funcao: "Gestão de Projetos & Prazos",
    area: "Execução",
    provider: "GROK",
    connection_status: "PLANNED",
    status_organizacional: "DEFINIDO — NÃO CONECTADO",
    tarefas_pendentes: 0,
    tarefas_concluidas: 0,
  },
  {
    agent_id: "AGT-18",
    nome: "Sofia",
    funcao: "Suprimentos & Fornecedores",
    area: "Operação",
    provider: "GROK",
    connection_status: "PLANNED",
    status_organizacional: "DEFINIDO — NÃO CONECTADO",
    tarefas_pendentes: 0,
    tarefas_concluidas: 0,
  },
  {
    agent_id: "AGT-19",
    nome: "Tiago",
    funcao: "Inteligência de Mercado & Benchmarking",
    area: "Estratégia",
    provider: "GROK",
    connection_status: "PLANNED",
    status_organizacional: "DEFINIDO — NÃO CONECTADO",
    tarefas_pendentes: 0,
    tarefas_concluidas: 0,
  },
  {
    agent_id: "AGT-20",
    nome: "Vanessa",
    funcao: "Parcerias & Afiliados (Humano Digital)",
    area: "Crescimento",
    provider: "GROK",
    connection_status: "PLANNED",
    status_organizacional: "DEFINIDO — NÃO CONECTADO",
    tarefas_pendentes: 0,
    tarefas_concluidas: 0,
  },
  {
    agent_id: "AGT-21",
    nome: "William",
    funcao: "Segurança da Informação & LGPD",
    area: "Segurança",
    provider: "GROK",
    connection_status: "PLANNED",
    status_organizacional: "DEFINIDO — NÃO CONECTADO",
    tarefas_pendentes: 0,
    tarefas_concluidas: 0,
  },
];

export default function EquipePage() {
  const [equipe, setEquipe] = useState<AgenteMembro[]>(EQUIPE_OFICIAL);
  const [filtroArea, setFiltroArea] = useState<string>("TODAS");

  const areas = ["TODAS", ...new Set(EQUIPE_OFICIAL.map((m) => m.area))];

  const filtrados = equipe.filter((m) => {
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
            <span className="text-xs text-muted-foreground">21 Funções Corporativas</span>
          </div>
          <h1 className="pe-page-title flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Equipe Digital do Fundador
          </h1>
          <p className="text-xs text-muted-foreground">
            Helena como CEO Virtual no ChatGPT e os 20 especialistas corporativos planejados para o Grok Bot.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/modulo/agentes"
            className="rounded-xl border border-border/60 bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-all"
          >
            Catálogo de Agentes →
          </Link>
        </div>
      </div>

      {/* Destaque da Helena — CEO Virtual */}
      <section className="relative overflow-hidden rounded-3xl border-2 border-primary/40 bg-gradient-to-br from-primary/10 via-card to-background p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/20 border border-primary/40 shadow-sm text-primary">
              <Crown className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-black text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md">
                  AGT-01
                </span>
                <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">
                  CONECTADA & OPERACIONAL
                </span>
                <span className="text-xs text-muted-foreground">Provider: <strong>ChatGPT Oficial</strong></span>
              </div>
              <h2 className="text-xl md:text-2xl font-black text-foreground">
                Helena · CEO Virtual / Central de Comando
              </h2>
              <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
                Define direção operacional, identifica gargalos, coordena os 20 especialistas, organiza prioridades, protege o foco (WIP=1) e leva ao fundador apenas decisões estratégicas relevantes.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-background/80 p-4 space-y-1 text-xs shrink-0 md:max-w-xs w-full">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Missão em Andamento:</span>
            <p className="font-semibold text-foreground leading-snug">
              Homologação técnica do Sistema Helena (FOC-004)
            </p>
            <p className="text-[11px] text-muted-foreground pt-1">
              Interação ativa pelo ChatGPT oficial da Helena.
            </p>
          </div>
        </div>
      </section>

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
        {filtrados
          .filter((m) => m.agent_id !== "AGT-01")
          .map((membro) => (
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
                    <h3 className="text-base font-bold text-foreground">{membro.nome}</h3>
                    <p className="text-xs text-muted-foreground">{membro.funcao}</p>
                  </div>

                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold uppercase text-amber-600 dark:text-amber-400 shrink-0">
                    NÃO CONECTADO
                  </span>
                </div>

                <div className="rounded-xl border border-border/40 bg-muted/30 p-2.5 space-y-1 text-xs">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Provider Previsto:</span>
                    <strong className="font-mono text-foreground">{membro.provider} BOT</strong>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Status de Conexão:</span>
                    <span className="font-semibold text-amber-600 dark:text-amber-400">PLANNED</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>0 jobs pendentes</span>
                <span className="text-[10px] italic">Aguardando Grok Bot</span>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
