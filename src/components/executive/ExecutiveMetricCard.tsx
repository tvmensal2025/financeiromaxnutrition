import React from "react";
import { LucideIcon } from "lucide-react";

interface ExecutiveMetricCardProps {
  label: string;
  value?: string | number | null;
  subtext?: string;
  icon?: LucideIcon;
  badge?: React.ReactNode;
  hasData?: boolean;
  trend?: {
    value: string | number;
    positive?: boolean;
    neutral?: boolean;
  };
  className?: string;
}

export function ExecutiveMetricCard({
  label,
  value,
  subtext,
  icon: Icon,
  badge,
  hasData = true,
  trend,
  className = "",
}: ExecutiveMetricCardProps) {
  const isAbsent = !hasData || value === null || value === undefined || value === "";

  return (
    <div
      className={`he-metric rounded-xl border border-border bg-card p-5 transition-colors hover:border-border/80 ${className}`}
      style={{
        boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.03)",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <div className="flex items-center gap-1.5">
          {badge}
          {Icon && (
            <span className="grid h-7 w-7 place-items-center rounded-md bg-muted/60 text-muted-foreground">
              <Icon className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
          {isAbsent ? "—" : value}
        </span>
        {trend && hasData && (
          <span
            className={`text-xs font-medium ${
              trend.neutral
                ? "text-muted-foreground"
                : trend.positive
                ? "text-[#007A3D] dark:text-[#22c55e]"
                : "text-[#B91C1C] dark:text-[#f87171]"
            }`}
          >
            {trend.value}
          </span>
        )}
      </div>

      <div className="mt-1.5">
        <p className="text-xs text-muted-foreground line-clamp-1">
          {isAbsent ? (subtext || "Sem dados realizados.") : subtext}
        </p>
      </div>
    </div>
  );
}
