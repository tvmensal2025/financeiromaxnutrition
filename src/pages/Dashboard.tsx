import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { SubscriptionsList } from '@/components/dashboard/SubscriptionsList';
import { 
  Users, 
  CreditCard, 
  TrendingUp, 
  Clock,
  DollarSign,
  RefreshCw,
  ArrowUpRight
} from 'lucide-react';
import { differenceInDays } from 'date-fns';

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [customersRes, subscriptionsRes, plansRes] = await Promise.all([
        supabase.from('customers').select('id', { count: 'exact' }),
        supabase.from('subscriptions').select(`
          id,
          status,
          end_date,
          auto_renew,
          plans (price, cost)
        `),
        supabase.from('plans').select('id', { count: 'exact' }).eq('is_active', true),
      ]);

      const customers = customersRes.count || 0;
      const activePlans = plansRes.count || 0;
      const subscriptions = subscriptionsRes.data || [];

      // Active subscriptions
      const activeSubscriptions = subscriptions.filter(s => s.status === 'active');
      
      // Subscriptions expiring in 7 days
      const expiringSubscriptions = subscriptions.filter(s => {
        const daysUntilEnd = differenceInDays(new Date(s.end_date), new Date());
        return s.status === 'active' && daysUntilEnd <= 7 && daysUntilEnd >= 0;
      });

      // Calculate MRR (Monthly Recurring Revenue)
      const mrr = activeSubscriptions.reduce((sum, sub) => {
        const price = (sub.plans as any)?.price || 0;
        return sum + Number(price);
      }, 0);

      // Calculate total cost
      const totalCost = activeSubscriptions.reduce((sum, sub) => {
        const cost = (sub.plans as any)?.cost || 0;
        return sum + Number(cost);
      }, 0);

      // Calculate profit
      const profit = mrr - totalCost;
      const profitMargin = mrr > 0 ? ((profit / mrr) * 100).toFixed(1) : '0';

      // Renewal rate (subscriptions with auto_renew enabled)
      const renewalCount = activeSubscriptions.filter(s => s.auto_renew).length;
      const renewalRate = activeSubscriptions.length > 0 
        ? ((renewalCount / activeSubscriptions.length) * 100).toFixed(0)
        : '0';

      return {
        customers,
        activeSubscriptions: activeSubscriptions.length,
        expiringSubscriptions: expiringSubscriptions.length,
        activePlans,
        mrr,
        profit,
        profitMargin,
        renewalRate,
      };
    },
  });

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Visão geral do seu negócio de assinaturas
            </p>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Receita Recorrente (MRR)"
            value={`R$ ${(stats?.mrr || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={DollarSign}
            variant="success"
            trend={{ value: 12.5, isPositive: true }}
          />
          <MetricCard
            title="Lucro Estimado"
            value={`R$ ${(stats?.profit || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            subtitle={`Margem: ${stats?.profitMargin || 0}%`}
            icon={TrendingUp}
            variant="primary"
          />
          <MetricCard
            title="Assinaturas Ativas"
            value={stats?.activeSubscriptions || 0}
            subtitle={`${stats?.expiringSubscriptions || 0} expirando em breve`}
            icon={CreditCard}
            variant="default"
          />
          <MetricCard
            title="Taxa de Renovação"
            value={`${stats?.renewalRate || 0}%`}
            subtitle="Auto-renovação ativa"
            icon={RefreshCw}
            variant="success"
          />
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <MetricCard
            title="Total de Clientes"
            value={stats?.customers || 0}
            icon={Users}
          />
          <MetricCard
            title="Planos Ativos"
            value={stats?.activePlans || 0}
            icon={CreditCard}
          />
          <MetricCard
            title="Expirando em 7 dias"
            value={stats?.expiringSubscriptions || 0}
            icon={Clock}
            variant="warning"
          />
        </div>

        {/* Subscriptions List */}
        <div className="bg-card rounded-xl border border-border shadow-card animate-slide-up">
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Assinaturas Recentes
              </h2>
              <p className="text-sm text-muted-foreground">
                Acompanhe o status das suas assinaturas
              </p>
            </div>
            <a 
              href="/assinaturas" 
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Ver todas
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
          <div className="p-6">
            <SubscriptionsList />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
