import React from "react";
import { Check, ChevronDown, Layers, Building2 } from "lucide-react";
import { useBusiness } from "@/contexts/BusinessContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ExecutiveBadge } from "./ExecutiveBadge";

export function ExecutiveBusinessSwitcher() {
  const {
    empresas,
    currentBusiness,
    currentBusinessId,
    isConsolidated,
    rotulo,
    setCurrentBusiness,
    ligarTodas,
  } = useBusiness();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-all hover:bg-muted/50 hover:border-border/80 focus:outline-none"
          style={{ boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.03)" }}
        >
          {isConsolidated ? (
            <div className="flex items-center gap-1.5">
              <span className="grid h-5 w-5 place-items-center rounded bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Layers className="h-3 w-3" />
              </span>
              <span className="font-semibold text-foreground">Grupo Consolidado</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: currentBusiness?.cor || "#007A3D" }}
              />
              <span className="font-semibold text-foreground truncate max-w-[140px] sm:max-w-[180px]">
                {currentBusiness?.nome || rotulo}
              </span>
              <span className="hidden sm:inline-block text-[10px] text-muted-foreground font-mono">
                {currentBusinessId}
              </span>
              {currentBusiness?.estagio && (
                <ExecutiveBadge variant="default" size="sm" className="hidden md:inline-flex text-[10px] py-0 px-1.5">
                  {currentBusiness.estagio}
                </ExecutiveBadge>
              )}
            </div>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 opacity-70 ml-0.5" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="w-72 bg-card border-border rounded-xl p-1.5 shadow-lg space-y-1"
      >
        <DropdownMenuLabel className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Unidades de Negócio
        </DropdownMenuLabel>

        {empresas.map((empresa) => {
          const isSelected = !isConsolidated && currentBusinessId === empresa.id;
          return (
            <DropdownMenuItem
              key={empresa.id}
              onClick={() => setCurrentBusiness(empresa.id)}
              className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-xs cursor-pointer transition-colors ${
                isSelected
                  ? "bg-muted font-semibold text-foreground"
                  : "text-foreground hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: empresa.cor || "#007A3D" }}
                />
                <div className="truncate">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate">{empresa.nome}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    {empresa.id}
                    {empresa.estagio && ` · ${empresa.estagio}`}
                  </div>
                </div>
              </div>
              {isSelected && <Check className="h-4 w-4 text-[#007A3D] shrink-0 ml-2" />}
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator className="my-1 bg-border/60" />

        <DropdownMenuItem
          onClick={() => ligarTodas()}
          className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-xs cursor-pointer transition-colors ${
            isConsolidated
              ? "bg-muted font-semibold text-foreground"
              : "text-foreground hover:bg-muted/50"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span className="grid h-5 w-5 place-items-center rounded bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Layers className="h-3 w-3" />
            </span>
            <div>
              <span className="font-medium">Grupo Consolidado</span>
              <div className="text-[10px] text-muted-foreground">
                {empresas.length} empresa(s) no cadastro visível
              </div>
            </div>
          </div>
          {isConsolidated && <Check className="h-4 w-4 text-[#007A3D] shrink-0 ml-2" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
