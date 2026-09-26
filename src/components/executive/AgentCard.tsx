/**
 * Card, avatar e lista dos agentes.
 * React + Tailwind 3.4 (darkMode: ["class"]) + tokens do repo (bg-card, border-border, text-muted-foreground).
 * Sem dependências novas: usa lucide-react e cn() de @/lib/utils.
 *
 * Fonte dos dados: public.agentes (lidos pela página, não por este componente).
 *   - agentId ← public.agentes.agent_id
 *   - nome    ← public.agentes.agente
 *   - cargo   ← public.agentes.cargo_funcao
 *   - status  ← statusVisualFromDb(public.agentes.status, public.agent_connections.connection_status)
 * O visual (área, cores, glifo) fica no mapa AGENT_VISUALS, chaveado por agent_id.
 */

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  HelpCircle,
  PauseCircle,
  Power,
  RefreshCw,
  Unplug,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AREA_VISUALS,
  STATUS_VISUALS,
  getAgentVisual,
  type AgentStatusVisual,
  type GlyphEl,
} from "@/lib/agentVisuals";

export type AgentCardVariant = "padrao" | "compacto";

export interface AgentCardProps {
  /** public.agentes.agent_id (ex.: "AGT-01"). Única chave do mapa visual AGENT_VISUALS. */
  agentId: string;
  /** public.agentes.agente */
  nome: string;
  /** public.agentes.cargo_funcao */
  cargo: string;
  /** Estado visual. Use statusVisualFromDb(agentes.status, agent_connections.connection_status). Omitido = sem selo. */
  status?: AgentStatusVisual;
  /** "padrao" (grade) ou "compacto" (lista). */
  variante?: AgentCardVariant;
  /** Se presente, o card vira <button> (alvo ≥ 44px, foco visível). */
  onClick?: () => void;
  /** Mostra o esqueleto no lugar do card. */
  loading?: boolean;
  /** Força o avatar de fallback (monograma), ex.: quando o SVG estático falhou ao carregar. */
  avatarIndisponivel?: boolean;
  className?: string;
}

const STATUS_ICON: Record<AgentStatusVisual, LucideIcon> = {
  conectado: CheckCircle2,
  planejado: Clock3,
  nao_conectado: Unplug,
  erro: AlertTriangle,
  pausado: PauseCircle,
  desativado: Power,
  desconhecido: HelpCircle,
};

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007A3D] focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-[#4FD08A]";

/* ------------------------------------------------------------------ avatar */

function renderGlyph(el: GlyphEl, i: number) {
  const fill = el.f ? "currentColor" : undefined;
  if (el.t === "circle") return <circle key={i} cx={el.cx} cy={el.cy} r={el.r} fill={fill} />;
  if (el.t === "rect")
    return (
      <rect
        key={i}
        x={el.x}
        y={el.y}
        width={el.w}
        height={el.h}
        rx={el.rx}
        fill={fill}
        transform={el.rot ? `rotate(${el.rot.join(" ")})` : undefined}
      />
    );
  return <path key={i} d={el.d} fill={fill} />;
}

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
}

export interface AgentAvatarProps {
  agentId: string;
  nome: string;
  /** px: 40 (lista), 56 (grade), 72 (detalhe) */
  size?: number;
  indisponivel?: boolean;
  /** true quando o avatar aparece sozinho (sem nome ao lado) → vira role="img" com rótulo */
  rotular?: boolean;
  className?: string;
}

export function AgentAvatar({ agentId, nome, size = 56, indisponivel, rotular, className }: AgentAvatarProps) {
  const visual = getAgentVisual(agentId);
  const a11y = rotular
    ? { role: "img" as const, "aria-label": `Avatar de ${nome} (${agentId})` }
    : { "aria-hidden": true as const };
  const radius = size >= 56 ? "rounded-[14px]" : "rounded-[10px]";

  if (!visual || indisponivel) {
    // Fallback: monograma neutro, sem cor de área (não sugere área errada)
    return (
      <span
        {...a11y}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}
        className={cn(
          "grid shrink-0 select-none place-items-center font-semibold tracking-tight",
          "bg-[#ECEFED] text-[#3F4643] dark:bg-[#232926] dark:text-[#C9D1CD]",
          radius,
          className,
        )}
      >
        {iniciais(nome)}
      </span>
    );
  }

  const area = AREA_VISUALS[visual.area];
  return (
    <svg
      {...a11y}
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={cn("shrink-0", area.className.text, radius, className)}
      data-agent={visual.agentId}
    >
      <rect width="64" height="64" rx="16" className={area.className.fillTone} />
      <g fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        {visual.glyph.map(renderGlyph)}
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ status */

export function AgentStatusBadge({ status, className }: { status: AgentStatusVisual; className?: string }) {
  const s = STATUS_VISUALS[status];
  const Icon = STATUS_ICON[status];
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4",
        s.className,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span title={s.label}>{s.label}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ card */

export function AgentCard({
  agentId,
  nome,
  cargo,
  status,
  variante = "padrao",
  onClick,
  loading,
  avatarIndisponivel,
  className,
}: AgentCardProps) {
  if (loading) return <AgentCardSkeleton variante={variante} className={className} />;

  const visual = getAgentVisual(agentId);
  const area = visual ? AREA_VISUALS[visual.area] : undefined;
  const isHelena = agentId === "AGT-01";
  const desativado = status === "desativado";
  const statusLabel = status ? STATUS_VISUALS[status].label : undefined;

  const ariaLabel = [nome, cargo, agentId, area?.nome, statusLabel ? `status: ${statusLabel}` : null]
    .filter(Boolean)
    .join(", ") + (onClick ? ". Abrir detalhes" : "");

  const Root: "button" | "article" = onClick ? "button" : "article";
  const rootProps = onClick
    ? { type: "button" as const, onClick, "aria-label": ariaLabel }
    : { "aria-label": ariaLabel };

  const base = cn(
    "group relative w-full text-left text-card-foreground transition-[border-color,background-color] duration-150 motion-reduce:transition-none",
    "border bg-card shadow-[0_1px_2px_0_rgba(0,0,0,0.03)]",
    isHelena
      ? "border-[#007A3D]/30 bg-[linear-gradient(135deg,rgba(0,122,61,0.045),transparent_60%)] dark:border-[#4FD08A]/25 dark:bg-[linear-gradient(135deg,rgba(79,208,138,0.06),transparent_60%)]"
      : "border-border",
    onClick && cn("cursor-pointer hover:border-foreground/20 hover:shadow-[0_4px_12px_0_rgba(0,0,0,0.06)]", FOCUS),
    className,
  );

  const avatar = (
    <AgentAvatar
      agentId={agentId}
      nome={nome}
      size={variante === "compacto" ? 40 : 56}
      indisponivel={avatarIndisponivel}
      className={cn(desativado && "opacity-60 grayscale", isHelena && cn("ring-2 ring-[#007A3D]/25 ring-offset-card dark:ring-[#4FD08A]/30", variante === "compacto" ? "ring-offset-1" : "ring-offset-2"))}
    />
  );

  const idChip = (
    <span className="shrink-0 rounded-md border border-border px-1.5 py-px text-[11px] font-medium leading-4 tabular-nums tracking-wide text-muted-foreground">
      {agentId}
    </span>
  );

  const areaLabel = area ? (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5 text-xs font-medium", area.className.text)}>
      <span className={cn("h-2 w-2 shrink-0 rounded-[3px]", area.className.swatch)} aria-hidden />
      <span className="truncate">{area.nome}</span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
      <span className="h-2 w-2 shrink-0 rounded-[3px] border border-muted-foreground" aria-hidden />
      Área não mapeada
    </span>
  );

  if (variante === "compacto") {
    return (
      <Root {...rootProps} className={cn(base, "flex min-h-[56px] items-start gap-3 rounded-xl px-3 py-2")}>
        {avatar}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="line-clamp-2 break-words text-sm font-semibold tracking-tight text-foreground">{nome}</span>
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs leading-5 text-muted-foreground">
            {idChip}
            <span className="min-w-0 truncate">{cargo}</span>
          </span>
        </span>
        <span className="hidden shrink-0 self-center md:inline-flex">{areaLabel}</span>
        {status && <AgentStatusBadge status={status} className="shrink-0 self-center" />}
      </Root>
    );
  }

  return (
    <Root {...rootProps} className={cn(base, "flex min-h-[156px] flex-col gap-4 rounded-2xl p-5")}>
      <span className="flex items-start gap-4">
        {avatar}
        <span className="flex min-w-0 flex-1 flex-col pt-0.5">
          <span className="flex min-w-0 items-start justify-between gap-2">
            <span className="min-w-0 flex-1 line-clamp-2 break-words text-base font-semibold leading-6 tracking-tight text-foreground">
              {nome}
            </span>
            {idChip}
          </span>
          <span className="mt-0.5 line-clamp-2 text-[13px] leading-5 text-muted-foreground">{cargo}</span>
        </span>
      </span>
      <span className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border pt-3">
        {areaLabel}
        {status && <AgentStatusBadge status={status} className="shrink-0" />}
      </span>
    </Root>
  );
}

/* ------------------------------------------------------------------ estados */

export function AgentCardSkeleton({ variante = "padrao", className }: { variante?: AgentCardVariant; className?: string }) {
  const pulse = "animate-pulse motion-reduce:animate-none bg-foreground/[0.07]";
  if (variante === "compacto") {
    return (
      <div aria-hidden className={cn("flex min-h-[56px] items-center gap-3 rounded-xl border border-border bg-card px-3 py-2", className)}>
        <div className={cn("h-10 w-10 shrink-0 rounded-[10px]", pulse)} />
        <div className="flex-1 space-y-2">
          <div className={cn("h-3.5 w-28 rounded", pulse)} />
          <div className={cn("h-3 w-44 max-w-full rounded", pulse)} />
        </div>
        <div className={cn("h-5 w-20 rounded-full", pulse)} />
      </div>
    );
  }
  return (
    <div aria-hidden className={cn("flex min-h-[156px] flex-col rounded-2xl border border-border bg-card p-5", className)}>
      <div className="flex items-start gap-4">
        <div className={cn("h-14 w-14 shrink-0 rounded-[14px]", pulse)} />
        <div className="flex-1 space-y-2.5 pt-1">
          <div className="flex justify-between gap-2">
            <div className={cn("h-4 w-24 rounded", pulse)} />
            <div className={cn("h-4 w-12 rounded", pulse)} />
          </div>
          <div className={cn("h-3 w-full rounded", pulse)} />
          <div className={cn("h-3 w-2/3 rounded", pulse)} />
        </div>
      </div>
      <div className="mt-auto flex items-center justify-between border-t border-border pt-3">
        <div className={cn("h-3 w-28 rounded", pulse)} />
        <div className={cn("h-5 w-20 rounded-full", pulse)} />
      </div>
    </div>
  );
}

export interface AgentCardData {
  agentId: string;
  nome: string;
  cargo: string;
  status?: AgentStatusVisual;
}

export interface AgentCardListProps {
  agentes: AgentCardData[];
  variante?: AgentCardVariant;
  carregando?: boolean;
  /** Mensagem de erro de carregamento (mostra estado de erro) */
  erro?: string | null;
  onRetry?: () => void;
  onSelect?: (agentId: string) => void;
  /** Quantos esqueletos mostrar ao carregar (padrão 6) */
  skeletons?: number;
  className?: string;
}

/** Lista/grade com todos os estados: carregando, erro, vazio e sucesso. Helena (AGT-01) sempre primeiro. */
export function AgentCardList({
  agentes,
  variante = "padrao",
  carregando,
  erro,
  onRetry,
  onSelect,
  skeletons = 6,
  className,
}: AgentCardListProps) {
  const layout =
    variante === "padrao"
      ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
      : "flex flex-col gap-2";

  if (carregando) {
    return (
      <div className={cn(layout, className)} aria-busy="true">
        <span className="sr-only" role="status">Carregando agentes…</span>
        {Array.from({ length: skeletons }).map((_, i) => (
          <AgentCardSkeleton key={i} variante={variante} />
        ))}
      </div>
    );
  }

  if (erro) {
    return (
      <div role="alert" className={cn("flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-8 text-center", className)}>
        <span className="mb-3 grid h-10 w-10 place-items-center rounded-lg bg-[#B91C1C]/10 text-[#B91C1C] dark:text-[#F87171]">
          <AlertTriangle className="h-5 w-5" aria-hidden />
        </span>
        <p className="text-sm font-semibold tracking-tight text-foreground">Não foi possível carregar os agentes</p>
        <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">{erro}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className={cn("mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-border bg-muted/40 px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted", FOCUS)}
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Tentar novamente
          </button>
        )}
      </div>
    );
  }

  if (agentes.length === 0) {
    return (
      <div role="status" className={cn("flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center", className)}>
        <span className="mb-3 grid h-10 w-10 place-items-center rounded-lg bg-muted text-muted-foreground">
          <Users className="h-5 w-5" aria-hidden />
        </span>
        <p className="text-sm font-semibold tracking-tight text-foreground">Nenhum agente encontrado</p>
        <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
          A tabela de agentes não retornou registros para este filtro. Ajuste o filtro ou verifique a conexão com o Supabase.
        </p>
      </div>
    );
  }

  const ordenados = [...agentes].sort((a, b) =>
    a.agentId === "AGT-01" ? -1 : b.agentId === "AGT-01" ? 1 : a.agentId.localeCompare(b.agentId),
  );

  return (
    <ul className={cn(layout, className)} aria-label="Agentes do Sistema Helena">
      {ordenados.map((ag) => (
        <li key={ag.agentId} className="flex">
          <AgentCard
            {...ag}
            variante={variante}
            onClick={onSelect ? () => onSelect(ag.agentId) : undefined}
          />
        </li>
      ))}
    </ul>
  );
}

export default AgentCard;
