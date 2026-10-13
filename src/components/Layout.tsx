import { PageBoundary } from "@/components/executive/PageBoundary";
import React, { useState, type ComponentType } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Target,
  Building2,
  Users,
  Receipt,
  CalendarClock,
  Briefcase,
  Layers,
  Shield,
  FileText,
  ChevronDown,
  CircleDollarSign,
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
  MessageSquare,
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
  { to: "/", label: "Sala de comando", icon: LayoutDashboard, end: true },
  { to: "/financeiro", label: "Cockpit Financeiro", icon: Receipt, badge: "8 Abas" },
  { to: "/conversa", label: "Conversa com Helena", icon: MessageSquare },
  { to: "/supervisao", label: "Supervisão da Helena", icon: Shield },
  { to: "/empresas", label: "Operação por empresa", icon: Building2 },
  { to: "/consumo", label: "Consumo e rotinas", icon: CircleDollarSign },
  { to: "/execucao", label: "Central de Execução", icon: Activity },
  { to: "/entregas", label: "Entregas da equipe", icon: FileText },
  ...(import.meta.env.VITE_HELENA_V2_HABILITADA === 'true'
    ? [{ to: "/cards-v2", label: "Cards v2", icon: Layers }]
    : []),
  { to: "/identidade", label: "Identidade da empresa", icon: Package },
  { to: "/modulo/foco_executivo", label: "Foco Executivo", icon: Compass },
];

const BLOCO_NEGOCIOS: NavItemConfig[] = [
  { to: "/portfolio", label: "Portfólio", icon: Building2 },
  { to: "/indicadores", label: "Indicadores de negócio", icon: LayoutDashboard },
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
  { to: "/equipe", label: "Equipe Digital", icon: Users },
  { to: "/modulo/estado_mestre", label: "Estado Mestre", icon: Activity },
  { to: "/modulo/memoria_mestre", label: "Memória Mestre", icon: FileText },
  { to: "/modulo/handoffs", label: "Handoffs", icon: Layers },
];

const BLOCO_GOVERNANCA: NavItemConfig[] = [
  { to: "/modulo/riscos", label: "Riscos", icon: Shield },
  { to: "/modulo/decisoes", label: "Decisões", icon: FileText },
  { to: "/modulo/governanca", label: "Governança", icon: Shield },
  { to: "/integracoes", label: "Central de Integrações", icon: Zap },
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
  const { currentBusiness, isConsolidated, error: businessError } = useBusiness();
  const [gruposAbertos, setGruposAbertos] = useState<Record<string, boolean>>({});

  const fecharMobile = () => setMobileAberto(false);

  // Calcula o breadcrumb simples e executivo
  const getBreadcrumb = () => {
    const empresaNome = isConsolidated ? "Grupo Consolidado" : (currentBusiness?.nome || "iGreen");
    if (pathname === "/") return `${empresaNome} / Sala de comando`;
    if (pathname === "/supervisao") return `${empresaNome} / Supervisão`;
    if (pathname === "/empresas") return `${empresaNome} / Operação por empresa`;
    if (pathname === "/consumo") return `${empresaNome} / Consumo e rotinas`;
    if (pathname === "/indicadores") return `${empresaNome} / Indicadores de negócio`;
    if (pathname === "/comando") return `${empresaNome} / Sala de comando`;
    if (pathname === "/execucao") return `${empresaNome} / Central de Execução`;
    if (pathname === "/entregas") return `${empresaNome} / Entregas da equipe`;
    if (pathname === "/cards-v2") return `Sistema Helena / Cards v2`;
    if (pathname === "/inbox") return `${empresaNome} / Inbox`;
    if (pathname === "/portfolio") return `Sistema Helena / Portfólio`;
    if (pathname === "/identidade") return `${empresaNome} / Identidade da empresa`;
    if (pathname === "/equipe") return `Sistema Helena / Equipe Digital`;
    if (pathname === "/crm") return `${empresaNome} / CRM`;
    if (pathname === "/financeiro") return `${empresaNome} / Financeiro`;
    if (pathname === "/calendario") return `${empresaNome} / Calendário`;
    if (pathname === "/sistema") return `Sistema Helena / Saúde do Sistema`;
    if (pathname === "/integracoes" || pathname === "/central-integracoes") return `Sistema Helena / Central de Canais e Voz`;

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

        {[
          { titulo: 'Negócios', itens: BLOCO_NEGOCIOS },
          { titulo: 'Operação', itens: BLOCO_OPERACAO },
          { titulo: 'Inteligência', itens: BLOCO_INTELIGENCIA },
          { titulo: 'Governança', itens: BLOCO_GOVERNANCA },
          { titulo: 'Administração', itens: BLOCO_ADMINISTRACAO },
        ].map(grupo => {
          const ativa = grupo.itens.some(i => pathname === i.to);
          const aberta = gruposAbertos[grupo.titulo] ?? ativa;
          return <div key={grupo.titulo} className="he-nav-group">
            <button className="he-nav-group-toggle" aria-expanded={aberta} onClick={() => setGruposAbertos(g => ({...g, [grupo.titulo]: !aberta}))}><span>{grupo.titulo}</span><ChevronDown size={14} className={aberta ? 'rotate-180' : ''}/></button>
            {aberta && <div className="space-y-0.5">{grupo.itens.map(item => <NavItemLink key={item.to} item={item} onClick={fecharMobile}/>)}</div>}
          </div>;
        })}
        <div className="he-sidebar-signature"><span>HELENA HUB</span><p>Direção clara.<br/>Execução verificável.</p></div>
      </div>
    </div>
  );

  return (
    <div className="painel-elite he-studio flex min-h-screen bg-background text-foreground antialiased">
      <a className="he-skip-link" href="#conteudo-principal">Ir para o conteúdo</a>
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
          mobileAberto ? "translate-x-0" : "hidden"
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
            <div className="he-topbar-breadcrumb hidden xl:flex items-center text-xs font-medium text-muted-foreground mr-2 truncate">
              <span>{getBreadcrumb()}</span>
            </div>

            {/* Seletor Multiempresa Premium */}
            <ExecutiveBusinessSwitcher />
          </div>

          {/* Lado Direito do Topbar */}
          <Header onOpenSearch={() => setCommandOpen(true)} />
        </header>

        {/* Conteúdo Principal com Max Width Executivo */}
        <main id="conteudo-principal" tabIndex={-1} className="pe-main flex-1 w-full">
          {businessError && <div className="hc-warning" role="alert">Cadastro de empresas indisponível. Atualize a página para tentar novamente.</div>}
          <PageBoundary><Outlet /></PageBoundary>
        </main>
      </div>

      {/* Command Palette Global (Ctrl + K) */}
      <ExecutiveCommandMenu open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}
