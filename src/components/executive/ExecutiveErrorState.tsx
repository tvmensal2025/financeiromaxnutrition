import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface ExecutiveErrorStateProps {
  moduleName?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ExecutiveErrorState({
  moduleName,
  message,
  onRetry,
  className = "",
}: ExecutiveErrorStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border border-border bg-card p-8 sm:p-10 text-center ${className}`}
      style={{
        boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.03)",
      }}
    >
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#B91C1C]/10 text-[#B91C1C] dark:text-[#f87171] mb-3">
        <AlertCircle className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-semibold text-foreground tracking-tight">
        {moduleName ? `Não foi possível carregar ${moduleName}` : "Falha na comunicação"}
      </h3>
      <p className="mt-1 max-w-md text-xs text-muted-foreground leading-relaxed">
        {message || "Ocorreu um erro ao consultar os dados no Supabase. Verifique sua conexão e autenticação."}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-3.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Tentar novamente</span>
        </button>
      )}
    </div>
  );
}
