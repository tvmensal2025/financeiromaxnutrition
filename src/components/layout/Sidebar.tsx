import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, MessageSquare, Settings, LogOut, Upload, UserPlus, Package, Calendar, Receipt, Wallet, Webhook, Radio, ExternalLink, Briefcase, Building2, FileSignature } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
const navigation = [{
  name: 'Dashboard',
  href: '/',
  icon: LayoutDashboard
}, {
  name: 'Mensagens',
  href: '/mensagens',
  icon: MessageSquare,
  showBadge: true
}, {
  name: 'Fornecedores',
  href: '/fornecedores',
  icon: Building2
}, {
  name: 'Produtos/Serviços',
  href: '/produtos-servicos',
  icon: Package
}, {
  name: 'Contratos/Taxas',
  href: '/contratos',
  icon: Receipt
}, {
  name: 'Contratos Digitais',
  href: '/contratos-digitais',
  icon: FileSignature
}, {
  name: 'Transações',
  href: '/transacoes',
  icon: Wallet
}, {
  name: 'Leads',
  href: '/leads',
  icon: UserPlus
}, {
  name: 'Pipeline de Vendas',
  href: '/leads-externos',
  icon: ExternalLink
}, {
  name: 'Clientes',
  href: '/clientes',
  icon: Users
}, {
  name: 'Agendamentos',
  href: '/agendamentos',
  icon: Calendar
}, {
  name: 'Disparo em Massa',
  href: '/broadcasts',
  icon: Radio
}, {
  name: 'Webhooks',
  href: '/webhooks',
  icon: Webhook
}, {
  name: 'Importar',
  href: '/importar',
  icon: Upload
}, {
  name: 'Configurações',
  href: '/configuracoes',
  icon: Settings
}];
export function Sidebar() {
  const location = useLocation();
  const {
    business,
    signOut,
    profile
  } = useAuth();

  // Query para contar mensagens não lidas (inbound sem resposta nas últimas 24h)
  const {
    data: unreadCount = 0
  } = useQuery({
    queryKey: ['unread-messages', business?.id],
    queryFn: async () => {
      if (!business?.id) return 0;
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
      const {
        data,
        error
      } = await supabase.from('whatsapp_messages').select('phone').eq('business_id', business.id).eq('direction', 'inbound').gte('created_at', twentyFourHoursAgo.toISOString());
      if (error) return 0;

      // Conta telefones únicos com mensagens recentes
      const uniquePhones = new Set(data?.map(m => m.phone) || []);
      return uniquePhones.size;
    },
    enabled: !!business?.id,
    refetchInterval: 30000 // Atualiza a cada 30 segundos
  });
  return <div className="flex h-screen w-64 flex-col bg-sidebar">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
          <Briefcase className="h-5 w-5 text-sidebar-primary-foreground" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-sidebar-foreground">
            {business?.name || 'Maxnutrition'}
          </span>
          <span className="text-xs text-sidebar-foreground/60">
            Gestão Maxnutrition
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map(item => {
        const isActive = location.pathname === item.href;
        const showBadge = 'showBadge' in item && item.showBadge && unreadCount > 0;
        return <Link key={item.name} to={item.href} className={cn('sidebar-link relative', isActive && 'active')}>
              <item.icon className="h-5 w-5" />
              <span className="flex-1">{item.name}</span>
              {showBadge && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground px-1.5 animate-pulse">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>}
            </Link>;
      })}
      </nav>

      {/* User section */}
      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-foreground">
            {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {profile?.full_name || 'Usuário'}
            </p>
            <p className="text-xs text-sidebar-foreground/60 capitalize">
              {profile?.role || 'Admin'}
            </p>
          </div>
          <button onClick={signOut} className="p-2 rounded-lg text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>;
}