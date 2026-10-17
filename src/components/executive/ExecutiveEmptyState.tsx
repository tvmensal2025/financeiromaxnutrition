import React from "react";
import { LucideIcon, Inbox } from "lucide-react";

interface ExecutiveEmptyStateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function ExecutiveEmptyState({
  title,
  description,
  icon: Icon = Inbox,
  actionLabel,
  onAction,
  className = "",
}: ExecutiveEmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/10 p-8 sm:p-12 text-center ${className}`}
    >
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-muted/60 text-muted-foreground mb-3">
        <Icon className="h-5 w-5 opacity-80" />
      </div>
      <h3 className="text-sm font-semibold text-foreground tracking-tight">
        {title}
      </h3>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 inline-flex items-center justify-center rounded-md bg-[#007A3D] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#006030] shadow-sm"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
