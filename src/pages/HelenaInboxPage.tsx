import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Inbox,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  HelpCircle,
  Flame,
  Check,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useBusiness } from "@/contexts/BusinessContext";

export type InboxItem = {
  id: string;
  tipo: "DECISAO_FUNDADOR" | "TAREFA_ATRASADA" | "RISCO_CRITICO" | "INTEGRACAO_FALHOU" | "APROVACAO_NECESSARIA" | "JOB_CONCLUIDO";
  titulo: string;
  descricao: string;
  origem: string;
  data: string;
  urgencia: "CRITICA" | "ALTA" | "MEDIA" | "INFORMATIVA";
  business_id?: string;
  resolvido?: boolean;
};

const ITENS_INBOX_PADRAO: InboxItem[] = [
  {
    id: "INB-01",
    tipo: "DECISAO_FUNDADOR",
    titulo: "Homologação do Núcleo Técnico (FOC-004)",
    descricao: "Validar se a transição para o Supabase como fonte canônica e o isolamento multiempresa atendem aos requisitos do fundador.",
    origem: "Helena (CEO Virtual)",
    data: "Hoje",
    urgencia: "ALTA",
    business_id: "GRUPO",
  },
  {
    id: "INB-02",
    tipo: "RISCO_CRITICO",
    titulo: "Aquisição Comercial em iGreen Energy (BIZ-001)",
    descricao: "Risco mapeado: continuar construindo produto sem resolver aquisição massiva de clientes por assinatura.",
    origem: "Matriz de Riscos",
    data: "Recente",
    urgencia: "ALTA",
    business_id: "BIZ-001",
  },
  {
    id: "INB-03",
    tipo: "APROVACAO_NECESSARIA",
    titulo: "Ativação de FOC-002 (Caixa das Empresas)",
    descricao: "Frente de Caixa permanece em PLANEJADO aguardando a conclusão formal de FOC-004.",
    origem: "Foco Executivo",
    data: "Aguardando",
    urgencia: "MEDIA",
    business_id: "GRUPO",
  },
];

export default function HelenaInboxPage() {
  const { currentBusinessId, rotulo, isConsolidated } = useBusiness();
  const [itens, setItens] = useState<InboxItem[]>(ITENS_INBOX_PADRAO);
  const [carregando, setCarregando] = useState(false);

  // Filtra itens pelo contexto atual (ou grupo)
  const itensVisiveis = itens.filter((i) => {
    if (isConsolidated) return true;
    if (!i.business_id || i.business_id === "GRUPO") return true;
    return i.business_id === currentBusinessId;
  });

  const getBadgeTipo = (tipo: InboxItem["tipo"]) => {
    switch (tipo) {
      case "DECISAO_FUNDADOR":
        return { label: "Decisão do Fundador", cor: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30" };
      case "RISCO_CRITICO":
        return { label: "Risco Crítico", cor: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30" };
      case "APROVACAO_NECESSARIA":
        return { label: "Aprovação Necessária", cor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30" };
      case "INTEGRACAO_FALHOU":
        return { label: "Falha de Integração", cor: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30" };
      case "TAREFA_ATRASADA":
        return { label: "Tarefa Atrasada", cor: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30" };
      case "JOB_CONCLUIDO":
        return { label: "Job Concluído", cor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" };
    }
  };

  return (
    <div className="space-y-6">
      {/* Topo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Comando</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">Central de Direção</span>
          </div>
          <h1 className="pe-page-title flex items-center gap-2">
            <Inbox className="h-6 w-6 text-primary" />
            Caixa de Entrada da Helena
          </h1>
          <p className="text-xs text-muted-foreground">
            Pendências executivas, decisões pendentes do fundador, aprovações e alertas prioritários do ecossistema.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-semibold text-primary">
            {itensVisiveis.length} item(ns) na fila
          </span>
        </div>
      </div>

      {/* Lista de Itens da Inbox */}
      <div className="space-y-3.5">
        {itensVisiveis.map((item) => {
          const badge = getBadgeTipo(item.tipo);
          return (
            <div
              key={item.id}
              className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm hover:border-primary/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-2 max-w-3xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badge.cor}`}>
                    {badge.label}
                  </span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="font-mono text-[10px] font-bold text-muted-foreground">{item.id}</span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">Origem: <strong>{item.origem}</strong></span>
                  {item.business_id && item.business_id !== "GRUPO" && (
                    <span className="rounded-md bg-muted px-1.5 py-0.2 text-[10px] font-bold text-foreground">
                      {item.business_id}
                    </span>
                  )}
                </div>

                <h3 className="text-base font-bold text-foreground">{item.titulo}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.descricao}</p>
              </div>

              <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                <span className="text-[11px] text-muted-foreground">{item.data}</span>
                <Link
                  to="/"
                  className="rounded-xl border border-border/60 bg-muted/40 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-primary hover:text-primary-foreground transition-all"
                >
                  Ver no Painel
                </Link>
              </div>
            </div>
          );
        })}

        {itensVisiveis.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/60 p-12 text-center space-y-2">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
            <p className="text-sm font-bold text-foreground">Caixa de Entrada Limpa</p>
            <p className="text-xs text-muted-foreground">
              Nenhuma pendência crítica ou decisão urgente aguardando a Helena ou o fundador no momento.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
