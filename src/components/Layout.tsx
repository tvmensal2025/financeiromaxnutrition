import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, Layers, LogOut, Settings } from "lucide-react";
import { PageBoundary } from "@/components/executive/PageBoundary";
import { ExecutiveLogo } from "@/components/executive/ExecutiveLogo";
import { useAuth } from "@/auth";

/**
 * Casca do app da v2: painel, cards, configuração do fundador e saída.
 * A empresa não é um seletor global: ela é um campo do card, escolhido no pedido.
 */
export function Layout() {
  const { isFounder, user, sair } = useAuth();
  const classe = ({ isActive }: { isActive: boolean }) =>
    `he-nav-link min-h-11 min-w-0 flex-1 justify-center !gap-1 !px-1.5 text-xs sm:!px-3 lg:flex-none ${isActive ? "is-active" : ""}`;

  return (
    <div className="he-app flex min-h-[100dvh] flex-col bg-background text-foreground antialiased">
      <a className="he-skip-link" href="#conteudo-principal">Ir para o conteúdo</a>

      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 sm:px-6">
          <ExecutiveLogo size="md" />

          <nav aria-label="Seções do Sistema Helena" className="order-3 flex w-full min-w-0 items-center gap-1 border-t border-border/60 pt-1 lg:order-none lg:w-auto lg:flex-1 lg:border-0 lg:pt-0">
            <NavLink to="/" end className={classe}>
              <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">Visão geral</span>
            </NavLink>
            <NavLink to="/cards" className={classe}>
              <Layers className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">Cards</span>
            </NavLink>
            {isFounder && (
              <NavLink to="/configuracoes" className={classe}>
                <Settings className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">Configuração</span>
              </NavLink>
            )}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-3">
            {user?.email && <span className="hidden max-w-[22ch] truncate text-xs text-muted-foreground sm:inline" title={user.email}>{user.email}</span>}
            <button
              type="button"
              onClick={() => void sair()}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground hover:bg-muted"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </header>

      <main id="conteudo-principal" tabIndex={-1} className="mx-auto w-full max-w-[1400px] flex-1 px-0 pb-12 sm:px-2">
        <PageBoundary><Outlet /></PageBoundary>
      </main>
    </div>
  );
}
