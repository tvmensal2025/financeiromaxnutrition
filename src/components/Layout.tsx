import { useState, type ComponentType } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  CalendarClock,
  LayoutDashboard,
  Leaf,
  Menu,
  Receipt,
  Target,
  X,
  Building2,
  Users,
  Inbox,
  Briefcase,
  ChevronDown,
  Layers,
  Shield,
  Cog,
  FileText,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { MODULOS, GRUPOS } from "@/lib/modulos";
import { Header } from "@/components/Header";
import { EmpresaSelector } from "@/components/EmpresaSelector";
import { PageHero } from "@/components/PageHero";

const ITENS_COMANDO = [
  { to: "/", label: "Painel Executivo", icon: LayoutDashboard, end: true },
  { to: "/portfolio", label: "Portfólio de Negócios", icon: Building2 },
  { to: "/inbox", label: "Caixa de Entrada", icon: Inbox },
];

const ITENS_OPERACAO = [
  { to: "/crm", label: "CRM & Vendas", icon: Target },
  { to: "/financeiro", label: "Caixa & Financeiro", icon: Receipt },
  { to: "/calendario", label: "Calendário", icon: CalendarClock },
  { to: "/equipe", label: "Equipe Digital (21)", icon: Users },
];

function Item({
  to,
  label,
  icon: Icon,
  end,
  onClick,
}: {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
  onClick?: () => void;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) => `pe-nav-item ${isActive ? "is-active" : ""}`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </NavLink>
  );
}

export function Layout() {
  const [aberto, setAberto] = useState(false);
  const fechar = () => setAberto(false);

  // Módulos agrupados por áreas funcionais (excluindo as que já têm rota direta no menu principal)
  const rotasDedicadas = new Set(["/portfolio", "/crm", "/financeiro", "/calendario", "/equipe", "/inbox"]);

  const menu = (
    <>
      <div className="pe-sidebar-top">
        <div className="pe-sidebar-product-brand">
          <span className="pe-sidebar-product-mark">
            <Leaf className="h-5 w-5" />
          </span>
          <span className="pe-sidebar-product-copy">
            <strong>Helena</strong>
            <small>CEO Virtual · Fundador</small>
          </span>
        </div>
        <EmpresaSelector />
      </div>

      <p className="pe-sidebar-section">Comando</p>
      {ITENS_COMANDO.map((item) => (
        <Item key={item.to} {...item} onClick={fechar} />
      ))}

      <p className="pe-sidebar-section">Operação Central</p>
      {ITENS_OPERACAO.map((item) => (
        <Item key={item.to} {...item} onClick={fechar} />
      ))}

      <div className="pt-2">
        <p className="pe-sidebar-section">Módulos por Área</p>
        <div className="space-y-1 pb-6">
          {GRUPOS.map((grupo) => {
            const modulosDoGrupo = MODULOS.filter(
              (m) => m.grupo === grupo && (!m.rota || !rotasDedicadas.has(m.rota))
            );
            if (modulosDoGrupo.length === 0) return null;

            return (
              <details key={grupo} className="group/det px-1">
                <summary className="flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-colors">
                  <span>{grupo}</span>
                  <span className="text-[10px] opacity-60">({modulosDoGrupo.length})</span>
                </summary>
                <div className="pl-3 py-1 space-y-0.5">
                  {modulosDoGrupo.map((mod) => (
                    <Item
                      key={mod.tabela}
                      to={mod.rota || `/modulo/${mod.tabela}`}
                      label={mod.titulo}
                      icon={Layers}
                      onClick={fechar}
                    />
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      </div>
    </>
  );

  return (
    <div className="painel-elite flex min-h-screen">
      <aside className="pe-sidebar sticky top-0 hidden h-[100dvh] flex-col overflow-y-auto md:flex scrollbar-thin">
        {menu}
      </aside>

      {aberto && (
        <button
          type="button"
          aria-label="Fechar menu"
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={fechar}
        />
      )}

      <aside
        className={`pe-sidebar fixed inset-y-0 left-0 z-40 overflow-y-auto md:hidden ${
          aberto ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          type="button"
          className="absolute right-3 top-3 text-[var(--pe-text)]"
          onClick={fechar}
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>
        {menu}
      </aside>

      <div className="min-w-0 flex-1">
        <div className="pe-topbar">
          <button type="button" className="pe-menu-mobile" onClick={() => setAberto(true)}>
            <Menu />
            <span>Menu</span>
          </button>
          <Header />
        </div>
        <main className="pe-main">
          <PageHero />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
