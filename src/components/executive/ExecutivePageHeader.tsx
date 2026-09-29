import React from "react";
import { LucideIcon } from "lucide-react";

interface ExecutivePageHeaderProps {
  title: string;
  description?: string;
  subtitle?: string;
  icon?: LucideIcon;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  action?: React.ReactNode;
  breadcrumb?: string;
  className?: string;
}

export function ExecutivePageHeader({
  title,
  description,
  subtitle,
  icon: Icon,
  badge,
  actions,
  action,
  breadcrumb,
  className = "",
}: ExecutivePageHeaderProps) {
  return (
    <div
      className={`he-page-heading flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <div className="space-y-1">
        {breadcrumb && (
          <p className="text-[11px] font-medium text-muted-foreground/80">
            {breadcrumb}
          </p>
        )}
        <div className="flex items-center gap-2.5">
          {Icon && (
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-muted/70 text-foreground">
              <Icon className="h-4 w-4" />
            </span>
          )}
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {badge}
        </div>
        {(description || subtitle) && (
          <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
            {description || subtitle}
          </p>
        )}
      </div>

      {(actions || action) && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {actions || action}
        </div>
      )}
    </div>
  );
}
