import React, { useState } from "react";
import { Moon, Sun, LogOut, Search, KeyRound } from "lucide-react";
import { useAuth } from "@/auth";
import { TrocarSenhaDialog } from "@/components/TrocarSenhaDialog";
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
  const [temaEscuro, setTemaEscuro] = useState(() =>
    document.documentElement.classList.contains("dark")
  );
  const [trocarSenhaAberto, setTrocarSenhaAberto] = useState(false);

  const alternarTema = () => {
    const proximo = !temaEscuro;
    setTemaEscuro(proximo);
    document.documentElement.classList.toggle("dark", proximo);
  };

  const email = user?.email || "Fundador";
  const inicial = email.charAt(0).toUpperCase();

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

      {/* Indicador de Status Discreto */}
      <div className="hidden xl:inline-flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium px-2 py-1 rounded-md bg-muted/20 border border-border/40">
        <span className="h-1.5 w-1.5 rounded-full bg-[#007A3D] animate-pulse" />
        <span>Sistema sincronizado</span>
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
              onSelect={() => setTrocarSenhaAberto(true)}
              className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-foreground cursor-pointer hover:bg-muted transition-colors"
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span>Trocar senha</span>
            </DropdownMenuItem>
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
      <TrocarSenhaDialog open={trocarSenhaAberto} onOpenChange={setTrocarSenhaAberto} />
    </div>
  );
}
