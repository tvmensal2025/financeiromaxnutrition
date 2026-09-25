import React, { useState, type ComponentType } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Inbox,
  Target,
  Building2,
  Users,
  Receipt,
  CalendarClock,
  Briefcase,
  Layers,
  Shield,
  FileText,
  Sliders,
  Menu,
  X,
  Compass,
  Zap,
  Activity,
  CheckSquare,
  HelpCircle,
  FolderOpen,
  PieChart,
  UserCheck,
  Package,
  Settings,
} from "lucide-react";
import { Header } from "@/components/Header";
import { ExecutiveLogo } from "@/components/executive/ExecutiveLogo";
import { ExecutiveBusinessSwitcher } from "@/components/executive/ExecutiveBusinessSwitcher";
import { ExecutiveCommandMenu } from "@/components/executive/ExecutiveCommandMenu";
import { useBusiness } from "@/contexts/BusinessContext";
import { MODULOS } from "@/lib/modulos";

type NavItemConfig = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  badge?: string | number;
  end?: boolean;
};

const BLOCO_CENTRAL: NavItemConfig[] = [
  { to: "/", label: "Painel", icon: LayoutDashboard, end: true },
  { to: "/execucao", label: "Central de Execução", icon: Activity },
  { to: "/inbox", label: "Inbox", icon: Inbox },
  { to: "/modulo/foco_executivo", label: "Foco Executivo", icon: Compass },
];

const BLOCO_NEGOCIOS: NavItemConfig[] = [
  { to: "/portfolio", label: "Portfólio", icon: Building2 },
  { to: "/crm", label: "CRM", icon: Target },
  { to: "/modulo/marketing", label: "Marketing", icon: Zap },
  { to: "/modulo/clientes", label: "Clientes", icon: UserCheck },
  { to: "/modulo/produto", label: "Produto", icon: Package },
];

const BLOCO_OPERACAO: NavItemConfig[] = [
  { to: "/financeiro", label: "Financeiro", icon: Receipt },
  { to: "/calendario", label: "Calendário", icon: CalendarClock },
  { to: "/modulo/projetos", label: "Projetos", icon: Briefcase },
  { to: "/modulo/tarefas", label: "Tarefas", icon: CheckSquare },
  { to: "/modulo/processos", label: "Processos", icon: Layers },
];

const BLOCO_INTELIGENCIA: NavItemConfig[] = [
  { to: "/equipe", label: "Equipe Digital", icon: Users, badge: "21" },
  { to: "/modulo/estado_mestre", label: "Estado Mestre", icon: Activity },
  { to: "/modulo/memoria_mestre", label: "Memória Mestre", icon: FileText },
  { to: "/modulo/handoffs", label: "Handoffs", icon: Layers },
];

const BLOCO_GOVERNANCA: NavItemConfig[] = [
  { to: "/modulo/riscos", label: "Riscos", icon: Shield },
  { to: "/modulo/decisoes", label: "Decisões", icon: FileText },
  { to: "/modulo/governanca", label: "Governança", icon: Shield },
  { to: "/modulo/integracoes", label: "Integrações", icon: Zap },
];

const BLOCO_ADMINISTRACAO: NavItemConfig[] = [
  { to: "/modulo/documentos", label: "Documentos", icon: FolderOpen },
  { to: "/modulo/fornecedores", label: "Fornecedores", icon: Building2 },
  { to: "/modulo/ativos", label: "Ativos", icon: Layers },
  { to: "/sistema", label: "Configurações", icon: Settings },
];

function NavItemLink({
  item,
  onClick,
}: {
  item: NavItemConfig;
  onClick?: () => void;
}) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onClick}
      className={({ isActive }) => `pe-nav-item ${isActive ? "is-active" : ""}`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate flex-1">{item.label}</span>
      {item.badge && (
        <span className="rounded-[6px] bg-muted/80 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
          {item.badge}
        </span>
      )}
    </NavLink>
  );
}

export function Layout() {
  const [mobileAberto, setMobileAberto] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const { pathname } = useLocation();
  const { currentBusiness, currentBusinessId, isConsolidated, rotulo } = useBusiness();

  const fecharMobile = () => setMobileAberto(false);

  // Calcula o breadcrumb simples e executivo
  const getBreadcrumb = () => {
    const empresaNome = isConsolidated ? "Grupo Consolidado" : (currentBusiness?.nome || "iGreen");
    if (pathname === "/") return `${empresaNome} / Painel`;
    if (pathname === "/execucao") return `${empresaNome} / Central de Execução`;
    if (pathname === "/inbox") return `${empresaNome} / Inbox`;
    if (pathname === "/portfolio") return `Sistema Helena / Portfólio`;
    if (pathname === "/equipe") return `Sistema Helena / Equipe Digital`;
    if (pathname === "/crm") return `${empresaNome} / CRM`;
    if (pathname === "/financeiro") return `${empresaNome} / Financeiro`;
    if (pathname === "/calendario") return `${empresaNome} / Calendário`;
    if (pathname === "/sistema") return `Sistema Helena / Saúde do Sistema`;

    if (pathname.startsWith("/modulo/")) {
      const tabela = pathname.replace("/modulo/", "");
      const modulo = MODULOS.find((m) => m.tabela === tabela);
      return `${empresaNome} / ${modulo?.titulo || tabela}`;
    }

    return `${empresaNome} / Central`;
  };

  const menuContent = (
    <div className="flex flex-col h-full py-4">
      {/* Topo da Sidebar com Logo Helena */}
      <div className="px-5 pb-5 pt-1">
        <ExecutiveLogo size="md" />
      </div>

      {/* Navegação por blocos ordenados */}
      <div className="flex-1 overflow-y-auto px-1 space-y-4 scrollbar-thin">
        <div>
          <p className="pe-sidebar-section">Central</p>
          <div className="space-y-0.5">
            {BLOCO_CENTRAL.map((item) => (
              <NavItemLink key={item.to} item={item} onClick={fecharMobile} />
            ))}
          </div>
        </div>

        <div>
          <p className="pe-sidebar-section">Negócios</p>
          <div className="space-y-0.5">
            {BLOCO_NEGOCIOS.map((item) => (
              <NavItemLink key={item.to} item={item} onClick={fecharMobile} />
            ))}
          </div>
        </div>

        <div>
          <p className="pe-sidebar-section">Operação</p>
          <div className="space-y-0.5">
            {BLOCO_OPERACAO.map((item) => (
              <NavItemLink key={item.to} item={item} onClick={fecharMobile} />
            ))}
          </div>
        </div>

        <div>
          <p className="pe-sidebar-section">Inteligência</p>
          <div className="space-y-0.5">
            {BLOCO_INTELIGENCIA.map((item) => (
              <NavItemLink key={item.to} item={item} onClick={fecharMobile} />
            ))}
          </div>
        </div>

        <div>
          <p className="pe-sidebar-section">Governança</p>
          <div className="space-y-0.5">
            {BLOCO_GOVERNANCA.map((item) => (
              <NavItemLink key={item.to} item={item} onClick={fecharMobile} />
            ))}
          </div>
        </div>

        <div className="pb-6">
          <p className="pe-sidebar-section">Administração</p>
          <div className="space-y-0.5">
            {BLOCO_ADMINISTRACAO.map((item) => (
              <NavItemLink key={item.to} item={item} onClick={fecharMobile} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="painel-elite flex min-h-screen bg-background text-foreground antialiased">
      {/* Sidebar Desktop */}
      <aside className="pe-sidebar sticky top-0 hidden h-[100dvh] flex-col overflow-hidden md:flex">
        {menuContent}
      </aside>

      {/* Backdrop Mobile */}
      {mobileAberto && (
        <button
          type="button"
          aria-label="Fechar menu"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={fecharMobile}
        />
      )}

      {/* Drawer Sidebar Mobile */}
      <aside
        className={`pe-sidebar fixed inset-y-0 left-0 z-50 overflow-y-auto transition-transform duration-200 md:hidden ${
          mobileAberto ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          type="button"
          className="absolute right-3 top-4 text-[#8A9690] hover:text-white"
          onClick={fecharMobile}
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>
        {menuContent}
      </aside>

      {/* Área Central de Conteúdo */}
      <div className="min-w-0 flex-1 flex flex-col">
        {/* Topbar Executiva (64px) */}
        <header className="pe-topbar">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-card text-foreground md:hidden"
              onClick={() => setMobileAberto(true)}
              aria-label="Abrir menu"
            >
              <Menu className="h-4 w-4" />
            </button>

            {/* Breadcrumb curto */}
            <div className="hidden lg:flex items-center text-xs font-medium text-muted-foreground mr-2 truncate">
              <span>{getBreadcrumb()}</span>
            </div>

            {/* Seletor Multiempresa Premium */}
            <ExecutiveBusinessSwitcher />
          </div>

          {/* Lado Direito do Topbar */}
          <Header onOpenSearch={() => setCommandOpen(true)} />
        </header>

        {/* Conteúdo Principal com Max Width Executivo */}
        <main className="pe-main flex-1 w-full">
          <Outlet />
        </main>
      </div>

      {/* Command Palette Global (Ctrl + K) */}
      <ExecutiveCommandMenu open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}
