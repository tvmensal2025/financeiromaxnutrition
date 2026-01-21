import { MainLayout } from '@/components/layout/MainLayout';
import { StatsGrid } from '@/components/dashboard/StatsGrid';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { SalesDonutChart } from '@/components/dashboard/SalesDonutChart';
import { ConversionFunnel } from '@/components/dashboard/ConversionFunnel';
import { Users, TrendingUp, DollarSign, ShoppingCart } from 'lucide-react';

// Dados de exemplo - substitua com dados reais da sua API
const statsData = [
  {
    label: 'Receita Total',
    value: 'R$ 125.430',
    change: 12.5,
    icon: DollarSign,
    color: 'success' as const,
  },
  {
    label: 'Novos Clientes',
    value: '248',
    change: 8.2,
    icon: Users,
    color: 'primary' as const,
  },
  {
    label: 'Taxa de Conversão',
    value: '3.24%',
    change: -2.1,
    icon: TrendingUp,
    color: 'warning' as const,
  },
  {
    label: 'Vendas Hoje',
    value: '42',
    change: 15.3,
    icon: ShoppingCart,
    color: 'primary' as const,
  },
];

const revenueData = [
  { month: 'Jan', revenue: 45000, expenses: 32000 },
  { month: 'Fev', revenue: 52000, expenses: 35000 },
  { month: 'Mar', revenue: 48000, expenses: 33000 },
  { month: 'Abr', revenue: 61000, expenses: 38000 },
  { month: 'Mai', revenue: 55000, expenses: 36000 },
  { month: 'Jun', revenue: 67000, expenses: 40000 },
];

const salesByCategory = [
  { name: 'Produtos', value: 45000, color: 'hsl(221, 83%, 53%)' },
  { name: 'Serviços', value: 32000, color: 'hsl(142, 76%, 36%)' },
  { name: 'Assinaturas', value: 28000, color: 'hsl(38, 92%, 50%)' },
  { name: 'Outros', value: 15000, color: 'hsl(262, 83%, 58%)' },
];

const funnelStages = [
  { name: 'Visitantes', value: 5000, color: 'hsl(221, 83%, 53%)' },
  { name: 'Leads', value: 1200, color: 'hsl(262, 83%, 58%)' },
  { name: 'Qualificados', value: 450, color: 'hsl(38, 92%, 50%)' },
  { name: 'Propostas', value: 180, color: 'hsl(25, 95%, 53%)' },
  { name: 'Fechados', value: 85, color: 'hsl(142, 76%, 36%)' },
];

export default function DashboardPremium() {
  return (
    <MainLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard Premium</h1>
          <p className="text-muted-foreground mt-1">
            Visão completa do seu negócio com métricas em tempo real
          </p>
        </div>

        {/* Stats Grid */}
        <StatsGrid stats={statsData} />

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RevenueChart data={revenueData} />
          <SalesDonutChart data={salesByCategory} />
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ConversionFunnel stages={funnelStages} />
          </div>
          
          {/* Quick Actions Card */}
          <div className="premium-card p-6">
            <h3 className="font-semibold mb-4">Ações Rápidas</h3>
            <div className="space-y-3">
              {[
                { label: 'Nova Venda', color: 'bg-success' },
                { label: 'Adicionar Cliente', color: 'bg-primary' },
                { label: 'Criar Oportunidade', color: 'bg-warning' },
                { label: 'Gerar Relatório', color: 'bg-purple-500' },
              ].map((action, i) => (
                <button
                  key={i}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 transition-all duration-200 hover:shadow-md group"
                >
                  <div className={`h-2 w-2 rounded-full ${action.color} group-hover:scale-125 transition-transform`} />
                  <span className="text-sm font-medium">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
