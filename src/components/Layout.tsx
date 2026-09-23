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
} from "lucide-react";
import { MODULOS } from "@/lib/modulos";
import { Header } from "@/components/Header";
import { EmpresaSelector } from "@/components/EmpresaSelector";
import { PageHero } from "@/components/PageHero";

const VISÃO = [{ to: "/", label: "Painel", icon: LayoutDashboard, end: true }];

const OPERAÇÃO = [
  { to: "/crm", label: "CRM", icon: Target },
  { to: "/financeiro", label: "Financeiro", icon: Receipt },
  { to: "/calendario", label: "Calendário", icon: CalendarClock },
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
      <Icon />
      <span>{label}</span>
    </NavLink>
  );
}

export function Layout() {
  const [aberto, setAberto] = useState(false);
  const fechar = () => setAberto(false);

  const menu = (
    <>
      <div className="pe-sidebar-top">
        <div className="pe-sidebar-product-brand">
          <span className="pe-sidebar-product-mark">
            <Leaf className="h-5 w-5" />
          </span>
          <span className="pe-sidebar-product-copy">
            <strong>Helena</strong>
            <small>Ecossistema do fundador</small>
          </span>
        </div>
        <EmpresaSelector />
      </div>
      <p className="pe-sidebar-section">Visão</p>
      {VISÃO.map((item) => (
        <Item key={item.to} {...item} onClick={fechar} />
      ))}
      <p className="pe-sidebar-section">Operação</p>
      {OPERAÇÃO.map((item) => (
        <Item key={item.to} {...item} onClick={fechar} />
      ))}
      <details className="mt-2">
        <summary className="pe-sidebar-section cursor-pointer">Cadastro</summary>
        <div className="max-h-[46vh] overflow-y-auto pb-4">
          {MODULOS.map((item) => (
            <Item
              key={item.tabela}
              to={`/modulo/${item.tabela}`}
              label={item.titulo}
              icon={LayoutDashboard}
              onClick={fechar}
            />
          ))}
        </div>
      </details>
    </>
  );

  return (
    <div className="painel-elite flex min-h-screen">
      <aside className="pe-sidebar sticky top-0 hidden h-[100dvh] flex-col overflow-y-auto md:flex">{menu}</aside>
      {aberto && (
        <button
          type="button"
          aria-label="Fechar menu"
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={fechar}
        />
      )}
      <aside
        className={`pe-sidebar fixed inset-y-0 left-0 z-40 overflow-y-auto md:hidden ${aberto ? "translate-x-0" : "-translate-x-full"}`}
      >
        <button type="button" className="absolute right-3 top-3 text-[var(--pe-text)]" onClick={fechar} aria-label="Fechar">
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
        <main className="pe-page">
          <PageHero />
          <div className="pe-page-body">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
