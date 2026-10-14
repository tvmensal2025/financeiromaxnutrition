import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface ExecutiveLoadingStateProps {
  message?: string;
  rows?: number;
  type?: "table" | "cards" | "details";
  className?: string;
}

export function ExecutiveLoadingState({
  message = "Carregando registros",
  rows = 4,
  type = "table",
  className = "",
}: ExecutiveLoadingStateProps) {
  if (type === "cards") {
    return (
      <div role="status" aria-label={message} className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 ${className}`}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3">
            <div className="flex justify-between items-center">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-6 rounded-md" />
            </div>
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-3 w-36" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div role="status" aria-label={message} className={`space-y-3 rounded-xl border border-border bg-card p-5 ${className}`}>
      <div className="flex items-center justify-between pb-3 border-b border-border/50">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>
      <div className="space-y-2.5 pt-1">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}
