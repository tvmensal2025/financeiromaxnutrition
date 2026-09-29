import React, { useEffect, useState } from "react";
import { Bell, CheckCircle2, Clock3, ExternalLink, Moon, Sun, LogOut, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth";
import { useBusiness } from "@/contexts/BusinessContext";
import { supabase } from "@/lib/supabase";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeaderProps {
  onOpenSearch?: () => void;
}

export function Header({ onOpenSearch }: HeaderProps) {
  const { user, sair, role, isFounder } = useAuth();
  const { currentBusinessId, isConsolidated } = useBusiness();
  const navigate = useNavigate();
  const [alertas, setAlertas] = useState<HeaderAlert[]>([]);
  const [alertasCarregando, setAlertasCarregando] = useState(false);
  const [temaEscuro, setTemaEscuro] = useState(() =>
    document.documentElement.classList.contains("dark")
  );

  const alternarTema = () => {
    const proximo = !temaEscuro;
    setTemaEscuro(proximo);
    document.documentElement.classList.toggle("dark", proximo);
  };

  const email = user?.email || "Fundador";
  const inicial = email.charAt(0).toUpperCase();

  useEffect(() => {
    let ativo = true;
    const carregarAlertas = async () => {
      setAlertasCarregando(true);
      try {
        let consulta = supabase
          .from("agent_jobs")
          .select("job_id,business_id,objective,status,result_payload,updated_at,created_at")
          .in("status", ["WAITING_HELENA", "COMPLETED", "DRAFT"])
          .order("updated_at", { ascending: false })
          .limit(12);
        if (!isConsolidated && currentBusinessId) consulta = consulta.eq("business_id", currentBusinessId);
        const { data } = await consulta;
        if (!ativo) return;
        const itens = ((data || []) as HeaderJob[]).filter(job => {
          const payload = isObject(job.result_payload) ? job.result_payload : {};
          return job.status === "DRAFT" || job.status === "COMPLETED" || payload.review_pending === true;
        });
        setAlertas(itens.slice(0, 6).map(job => ({
          jobId: job.job_id,
          title: job.objective?.trim() || "Entrega aguardando conferência",
          status: job.status === "DRAFT" ? "Aguardando liberação" : isObject(job.result_payload) && job.result_payload.review_pending === true ? "Revisão pendente" : "Entrega disponível",
          date: job.updated_at || job.created_at,
          urgent: job.status === "WAITING_HELENA" || (isObject(job.result_payload) && job.result_payload.review_pending === true),
        })));
      } finally {
        if (ativo) setAlertasCarregando(false);
      }
    };
    void carregarAlertas();
    const timer = window.setInterval(() => void carregarAlertas(), 60_000);
    return () => { ativo = false; window.clearInterval(timer); };
  }, [currentBusinessId, isConsolidated]);

  const abrirEntrega = (jobId: string) => {
    navigate(`/entregas?job=${encodeURIComponent(jobId)}`);
  };

  return (
    <div className="flex items-center gap-3">
      {/* Botão de Busca Rápida (Command Search) */}
      {onOpenSearch && (
        <button
          type="button"
          onClick={onOpenSearch}
          className="hidden sm:inline-flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground transition-all hover:bg-muted/50 hover:text-foreground hover:border-border/80"
          style={{ boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.02)" }}
        >
          <Search className="h-3.5 w-3.5 opacity-70" />
          <span>Buscar…</span>
          <kbd className="pointer-events-none ml-1.5 inline-flex h-4 select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-90">
            <span className="text-[10px]">Ctrl</span> K
          </kbd>
        </button>
      )}

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={alertas.length ? `${alertas.length} alertas de entrega` : "Alertas de entrega"}
            className={`he-notification-trigger ${alertas.length ? "has-alerts" : ""}`}
          >
            <Bell className="h-4 w-4" />
            {alertas.length > 0 && <span className="he-notification-count">{alertas.length > 9 ? "9+" : alertas.length}</span>}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={12} className="he-notification-popover">
          <div className="he-notification-head">
            <div><p className="he-eyebrow">CENTRAL DE ALERTAS</p><h2>O que chegou para você</h2></div>
            <span className="he-notification-total">{alertas.length}</span>
          </div>
          {alertasCarregando && <p className="he-notification-empty">Consultando as entregas…</p>}
          {!alertasCarregando && !alertas.length && <div className="he-notification-empty"><CheckCircle2 className="h-5 w-5" /><span>Nenhuma entrega pendente agora.</span></div>}
          {!alertasCarregando && alertas.length > 0 && <div className="he-notification-list">{alertas.map(alerta => <button key={alerta.jobId} type="button" className="he-notification-item" onClick={() => abrirEntrega(alerta.jobId)}><span className={`he-notification-icon ${alerta.urgent ? "urgent" : ""}`}>{alerta.urgent ? <Clock3 className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}</span><span className="min-w-0 flex-1 text-left"><strong>{alerta.title}</strong><small>{alerta.status} · {formatAlertDate(alerta.date)}</small></span><ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /></button>)}</div>}
          <button type="button" className="he-notification-footer" onClick={() => navigate("/entregas")}>Ver todas as entregas <ExternalLink className="h-3.5 w-3.5" /></button>
        </PopoverContent>
      </Popover>

      {/* Indicador de Status Discreto */}
      <div className="hidden xl:inline-flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium px-2 py-1 rounded-md bg-muted/20 border border-border/40">
        <span className="h-1.5 w-1.5 rounded-full bg-[#007A3D] " />
        <span>Sessão autenticada</span>
      </div>

      {/* Alternador de Tema */}
      <button
        type="button"
        onClick={alternarTema}
        aria-label="Alternar tema"
        className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {temaEscuro ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      {/* Menu do Fundador */}
      {user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg border border-border bg-card p-1 pr-2.5 text-xs text-foreground transition-colors hover:bg-muted focus:outline-none"
            >
              <div className="grid h-6 w-6 place-items-center rounded-md bg-[#007A3D] text-[11px] font-bold text-white">
                {inicial}
              </div>
              <span className="hidden sm:inline font-medium max-w-[120px] truncate">
                {email.split("@")[0]}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-card border-border rounded-xl p-1 shadow-lg">
            <DropdownMenuLabel className="px-2.5 py-1.5">
              <p className="text-xs font-semibold text-foreground truncate">{email}</p>
              <p className="text-[10px] text-muted-foreground font-medium mt-0.5 capitalize">
                {isFounder ? "Fundador (Acesso Total)" : role || "Membro Autorizado"}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="my-1 bg-border/60" />
            <DropdownMenuItem
              onClick={() => sair()}
              className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-[#B91C1C] cursor-pointer hover:bg-[#B91C1C]/10 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sair da Central</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

type HeaderJob = { job_id: string; business_id: string; objective: string | null; status: string; result_payload: unknown; updated_at: string | null; created_at: string };
type HeaderAlert = { jobId: string; title: string; status: string; date: string | null; urgent: boolean };

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function formatAlertDate(value: string | null) {
  if (!value) return "sem data";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "agora" : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
