import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { PremiumKanbanColumn } from '@/components/pipeline/PremiumKanbanColumn';
import { PremiumKanbanCard } from '@/components/pipeline/PremiumKanbanCard';
import { StatsGrid } from '@/components/dashboard/StatsGrid';
import { 
  Eye, 
  CheckCircle, 
  FileText, 
  Handshake, 
  Trophy, 
  XCircle,
  TrendingUp,
  DollarSign,
  Target,
  Calendar
} from 'lucide-react';

type OpportunityStage = 'prospecting' | 'qualification' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';

interface Opportunity {
  id: string;
  title: string;
  stage: OpportunityStage;
  value: number;
  probability: number | null;
  expected_close_date: string | null;
  customers?: { name: string } | null;
}

const stageConfig: Record<OpportunityStage, { label: string; color: string; icon: any }> = {
  prospecting: { label: 'Prospecção', color: '#3b82f6', icon: Eye },
  qualification: { label: 'Qualificação', color: '#8b5cf6', icon: CheckCircle },
  proposal: { label: 'Proposta', color: '#f59e0b', icon: FileText },
  negotiation: { label: 'Negociação', color: '#f97316', icon: Handshake },
  closed_won: { label: 'Ganho', color: '#10b981', icon: Trophy },
  closed_lost: { label: 'Perdido', color: '#ef4444', icon: XCircle },
};

const stages: OpportunityStage[] = ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];

export default function PipelinePremium() {
  const { business } = useAuth();
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);

  const { data: opportunities = [] } = useQuery({
    queryKey: ['opportunities', business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      const { data, error } = await supabase
        .from('opportunities')
        .select('*, customers(name)')
        .eq('business_id', business.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Opportunity[];
    },
    enabled: !!business?.id,
  });

  const activeOpportunities = opportunities.filter((o) => !o.stage.startsWith('closed_'));
  const totalValue = activeOpportunities.reduce((sum, o) => sum + o.value, 0);
  const weightedValue = activeOpportunities.reduce(
    (sum, o) => sum + o.value * ((o.probability || 50) / 100),
    0
  );
  const wonOpportunities = opportunities.filter((o) => o.stage === 'closed_won');
  const wonValue = wonOpportunities.reduce((sum, o) => sum + o.value, 0);

  const statsData = [
    {
      label: 'Oportunidades Ativas',
      value: activeOpportunities.length,
      icon: Target,
      color: 'primary' as const,
    },
    {
      label: 'Valor Total',
      value: totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      icon: DollarSign,
      color: 'success' as const,
    },
    {
      label: 'Valor Ponderado',
      value: weightedValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      icon: TrendingUp,
      color: 'warning' as const,
    },
    {
      label: 'Vendas Fechadas',
      value: wonValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      icon: Trophy,
      color: 'success' as const,
    },
  ];

  const getOpportunitiesByStage = (stage: OpportunityStage) =>
    opportunities.filter((opp) => opp.stage === stage);

  return (
    <MainLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pipeline Premium</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie suas oportunidades com visão completa do funil de vendas
          </p>
        </div>

        {/* Stats */}
        <StatsGrid stats={statsData} />

        {/* Kanban Board */}
        <div className="relative">
          <div className="overflow-x-auto pb-6">
            <div className="flex gap-6 min-w-max px-1">
              {stages.map((stage) => {
                const stageOpps = getOpportunitiesByStage(stage);
                const stageValue = stageOpps.reduce((sum, o) => sum + o.value, 0);
                const config = stageConfig[stage];

                return (
                  <PremiumKanbanColumn
                    key={stage}
                    title={config.label}
                    count={stageOpps.length}
                    totalValue={stageValue}
                    color={config.color}
                    icon={config.icon}
                  >
                    {stageOpps.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div
                          className="p-4 rounded-full mb-3"
                          style={{ backgroundColor: `${config.color}15` }}
                        >
                          <config.icon className="h-8 w-8" style={{ color: config.color }} />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Nenhuma oportunidade
                        </p>
                      </div>
                    ) : (
                      stageOpps.map((opp) => (
                        <PremiumKanbanCard
                          key={opp.id}
                          title={opp.title}
                          value={opp.value}
                          probability={opp.probability || 50}
                          customerName={opp.customers?.name}
                          expectedCloseDate={opp.expected_close_date || undefined}
                          onClick={() => setSelectedOpportunity(opp)}
                        />
                      ))
                    )}
                  </PremiumKanbanColumn>
                );
              })}
            </div>
          </div>

          {/* Gradient Fade on Edges */}
          <div className="absolute top-0 left-0 bottom-6 w-8 bg-gradient-to-r from-background to-transparent pointer-events-none" />
          <div className="absolute top-0 right-0 bottom-6 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none" />
        </div>
      </div>
    </MainLayout>
  );
}
