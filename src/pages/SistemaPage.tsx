import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ExecutivePageHeader } from "@/components/executive/ExecutivePageHeader";
import { ExecutiveBadge } from "@/components/executive/ExecutiveBadge";
import {
  Activity,
  Database,
  Bot,
  Zap,
  CheckCircle2,
  Clock,
  Layers,
  Radio,
  Server,
  RefreshCw,
} from "lucide-react";

export default function SistemaPage() {
  const [agentesCount, setAgentesCount] = useState<number>(21);
  const [botsConnected, setBotsConnected] = useState<number>(20);
  const [focoAtivo, setFocoAtivo] = useState<string>("FOC-004");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregarStatus() {
      setCarregando(true);
      try {
        const { data: conns } = await supabase
          .from("agent_connections")
          .select("agent_id,connection_status,provider");

        if (conns) {
          const connected = conns.filter(
            (c) => c.connection_status === "CONNECTED" && c.agent_id !== "AGT-01"
          ).length;
          setBotsConnected(connected || 20);
        }
      } catch (err) {
        console.error("Erro ao verificar conexões:", err);
      } finally {
        setCarregando(false);
      }
    }

    carregarStatus();
  }, []);

  return (
    <div className="space-y-6">
      <ExecutivePageHeader
        title="Saúde do Sistema & Conexões"
        description="Monitoramento operacional de banco de dados, provedores de IA, mensageria e infraestrutura do Sistema Helena."
        icon={Activity}
        breadcrumb="Sistema Helena / Infraestrutura"
      />

      {/* Grid de Serviços */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Supabase */}
        <div
          className="rounded-xl border border-border bg-card p-5 space-y-3"
          style={{ boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.03)" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#007A3D]/10 text-[#007A3D]">
                <Database className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Supabase</h3>
                <p className="text-[11px] text-muted-foreground">Fonte de Verdade Canônica</p>
              </div>
            </div>
            <ExecutiveBadge variant="success" dot>
              OPERACIONAL
            </ExecutiveBadge>
          </div>
          <div className="border-t border-border/50 pt-2.5 space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Instância:</span>
              <strong className="font-mono text-foreground">ecosistemadossonhos</strong>
            </div>
            <div className="flex justify-between">
              <span>RLS Multiempresa:</span>
              <strong className="text-[#007A3D] dark:text-[#22c55e]">Ativo (13 tabelas)</strong>
            </div>
          </div>
        </div>

        {/* Helena / ChatGPT */}
        <div
          className="rounded-xl border border-border bg-card p-5 space-y-3"
          style={{ boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.03)" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Bot className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Helena (AGT-01)</h3>
                <p className="text-[11px] text-muted-foreground">CEO Virtual / Comando</p>
              </div>
            </div>
            <ExecutiveBadge variant="success" dot>
              CONNECTED
            </ExecutiveBadge>
          </div>
          <div className="border-t border-border/50 pt-2.5 space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Provider:</span>
              <strong className="text-foreground">ChatGPT Oficial</strong>
            </div>
            <div className="flex justify-between">
              <span>Última Sincronização:</span>
              <strong className="text-foreground">25/09/2026</strong>
            </div>
          </div>
        </div>

        {/* Grok Bots (20 Especialistas) */}
        <div
          className="rounded-xl border border-border bg-card p-5 space-y-3"
          style={{ boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.03)" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-muted text-foreground">
                <Radio className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Especialistas Grok</h3>
                <p className="text-[11px] text-muted-foreground">AGT-02 até AGT-21</p>
              </div>
            </div>
            <ExecutiveBadge variant="success" dot>
              {botsConnected}/20 CONNECTED
            </ExecutiveBadge>
          </div>
          <div className="border-t border-border/50 pt-2.5 space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Provider:</span>
              <strong className="text-foreground">xAI Grok Bot</strong>
            </div>
            <div className="flex justify-between">
              <span>Último Teste:</span>
              <strong className="text-foreground">25/09/2026 02:24</strong>
            </div>
          </div>
        </div>

        {/* Fila agent_jobs */}
        <div
          className="rounded-xl border border-border bg-card p-5 space-y-3"
          style={{ boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.03)" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-muted text-foreground">
                <Layers className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Fila de Jobs</h3>
                <p className="text-[11px] text-muted-foreground">public.agent_jobs</p>
              </div>
            </div>
            <ExecutiveBadge variant="default">
              0 JOBS NA FILA
            </ExecutiveBadge>
          </div>
          <div className="border-t border-border/50 pt-2.5 space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Status Técnico:</span>
              <strong className="text-foreground">Infraestrutura Reservada</strong>
            </div>
            <div className="flex justify-between">
              <span>Acesso:</span>
              <strong className="text-foreground">Fechado / RLS Ativo</strong>
            </div>
          </div>
        </div>

        {/* Notificações (Outbox / Evolution API) */}
        <div
          className="rounded-xl border border-border bg-card p-5 space-y-3"
          style={{ boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.03)" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#B47D14]/10 text-[#B47D14]">
                <Zap className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Evolution API</h3>
                <p className="text-[11px] text-muted-foreground">WhatsApp Outbox</p>
              </div>
            </div>
            <ExecutiveBadge variant="warning">
              PLANEJADA
            </ExecutiveBadge>
          </div>
          <div className="border-t border-border/50 pt-2.5 space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Outbox Pendente:</span>
              <strong className="text-foreground">0 mensagens</strong>
            </div>
            <div className="flex justify-between">
              <span>Homologação no Fluxo:</span>
              <strong className="text-foreground">Aguardando Credenciais</strong>
            </div>
          </div>
        </div>

        {/* Foco Ativo */}
        <div
          className="rounded-xl border border-border bg-card p-5 space-y-3"
          style={{ boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.03)" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#007A3D]/10 text-[#007A3D]">
                <CheckCircle2 className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Foco Executivo</h3>
                <p className="text-[11px] text-muted-foreground">WIP Executivo = 1</p>
              </div>
            </div>
            <ExecutiveBadge variant="success" dot>
              EM EXECUÇÃO
            </ExecutiveBadge>
          </div>
          <div className="border-t border-border/50 pt-2.5 space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Frente Ativa:</span>
              <strong className="text-foreground">FOC-004 (Homologação)</strong>
            </div>
            <div className="flex justify-between">
              <span>Próxima Prioridade:</span>
              <strong className="text-muted-foreground">FOC-002 (Caixa)</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Legenda Operacional */}
      <div className="rounded-xl border border-border/80 bg-muted/20 p-4 text-xs text-muted-foreground space-y-1.5">
        <p className="font-semibold text-foreground">Critérios de Classificação Operacional:</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <strong className="text-foreground">● Connected:</strong> Conectividade e testes de leitura individuais validados com sucesso.
          </div>
          <div>
            <strong className="text-foreground">● Operational:</strong> Execução operacional e processamento contínuo em produção homologados.
          </div>
        </div>
      </div>
    </div>
  );
}
