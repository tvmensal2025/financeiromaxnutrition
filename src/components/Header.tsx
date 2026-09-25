import { Moon, Sun, LogOut } from "lucide-react";
import { useAuth } from "@/auth";
import { useState } from "react";

export function Header() {
  const { user, sair } = useAuth();
  const [temaEscuro, setTemaEscuro] = useState(() => document.documentElement.classList.contains("dark"));

  const alternarTema = () => {
    const proximo = !temaEscuro;
    setTemaEscuro(proximo);
    document.documentElement.classList.toggle("dark", proximo);
  };

  return (
    <div className="flex w-full items-center justify-end gap-2">
      <span className="mr-auto hidden truncate text-xs text-[var(--pe-text-muted)] md:inline">
        {user?.email || "Modo Público"}
      </span>
      <button type="button" className="pe-icone" onClick={alternarTema} aria-label="Alternar tema">
        {temaEscuro ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
      {user && (
        <button type="button" className="pe-icone" onClick={() => sair()} aria-label="Sair">
          <LogOut className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
