import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface SubscriptionWithDetails {
  id: string;
  status: string;
  credits_used: number;
  credits_total: number;
  start_date: string;
  end_date: string;
  customers: {
    name: string;
    email: string | null;
  } | null;
  plans: {
    name: string;
    price: number;
  } | null;
}

export function SubscriptionsList() {
  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ['dashboard-subscriptions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select(`
          id,
          status,
          credits_used,
          credits_total,
          start_date,
          end_date,
          customers (name, email),
          plans (name, price)
        `)
        .order('end_date', { ascending: true })
        .limit(10);

      if (error) throw error;
      return data as SubscriptionWithDetails[];
    },
  });

  const getStatusInfo = (status: string, endDate: string) => {
    const daysUntilEnd = differenceInDays(new Date(endDate), new Date());
    
    if (status === 'cancelled') {
      return { label: 'Cancelada', className: 'status-expired' };
    }
    if (status === 'expired') {
      return { label: 'Expirada', className: 'status-expired' };
    }
    if (daysUntilEnd <= 7 && daysUntilEnd >= 0) {
      return { label: 'Expirando', className: 'status-expiring' };
    }
    if (daysUntilEnd < 0) {
      return { label: 'Vencida', className: 'status-expired' };
    }
    return { label: 'Ativa', className: 'status-active' };
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!subscriptions?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">Nenhuma assinatura encontrada</p>
        <p className="text-sm text-muted-foreground/60 mt-1">
          Crie um cliente e adicione uma assinatura para começar
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Plano</th>
            <th>Consumo</th>
            <th>Vencimento</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {subscriptions.map((sub) => {
            const statusInfo = getStatusInfo(sub.status, sub.end_date);
            const consumePercent = Math.round((sub.credits_used / sub.credits_total) * 100);
            
            return (
              <tr key={sub.id} className="animate-fade-in">
                <td>
                  <div>
                    <p className="font-medium text-foreground">
                      {sub.customers?.name || 'Cliente'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {sub.customers?.email || '-'}
                    </p>
                  </div>
                </td>
                <td>
                  <p className="font-medium text-foreground">
                    {sub.plans?.name || 'Plano'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    R$ {sub.plans?.price?.toFixed(2) || '0,00'}
                  </p>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden max-w-[100px]">
                      <div 
                        className={cn(
                          'h-full rounded-full transition-all',
                          consumePercent >= 90 ? 'bg-destructive' :
                          consumePercent >= 70 ? 'bg-warning' : 'bg-success'
                        )}
                        style={{ width: `${consumePercent}%` }}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {sub.credits_used}/{sub.credits_total}
                    </span>
                  </div>
                </td>
                <td className="text-muted-foreground">
                  {format(new Date(sub.end_date), "dd 'de' MMM", { locale: ptBR })}
                </td>
                <td>
                  <span className={cn('status-badge', statusInfo.className)}>
                    {statusInfo.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
