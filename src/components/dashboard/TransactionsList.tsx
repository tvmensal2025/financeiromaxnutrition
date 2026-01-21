import { transactionQueries } from '@/factories';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowDownLeft, ArrowUpRight, User } from 'lucide-react';

interface TransactionWithCustomer {
  id: string;
  type: 'income' | 'expense';
  description: string;
  amount: number;
  category: string | null;
  status: string;
  date: string;
  customer_id: string | null;
  customers: {
    name: string;
  } | null;
}

export function TransactionsList() {
  const { data: transactions, isLoading } = transactionQueries.useEntities({
    select: `
      id,
      type,
      description,
      amount,
      category,
      status,
      date,
      customer_id,
      customers (name)
    `,
    filters: {
      orderBy: { field: 'created_at', direction: 'desc' }
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!transactions?.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Nenhuma transação registrada ainda.</p>
        <p className="text-sm mt-1">As transações serão registradas automaticamente pela IA.</p>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'received':
        return <Badge variant="default" className="bg-success/10 text-success border-success/20">Recebido</Badge>;
      case 'paid':
        return <Badge variant="default" className="bg-success/10 text-success border-success/20">Pago</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/20">Pendente</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-2">
      {transactions.map((transaction) => (
        <div
          key={transaction.id}
          className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
              transaction.type === 'income' 
                ? 'bg-success/10 text-success' 
                : 'bg-destructive/10 text-destructive'
            }`}>
              {transaction.type === 'income' ? (
                <ArrowDownLeft className="h-5 w-5" />
              ) : (
                <ArrowUpRight className="h-5 w-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-foreground">{transaction.description}</p>
                {transaction.customers?.name && (
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {transaction.customers.name}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{transaction.category || 'Sem categoria'}</span>
                <span>•</span>
                <span>
                  {format(new Date(transaction.date), 'dd/MM/yyyy', { locale: ptBR })}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {getStatusBadge(transaction.status)}
            <span className={`font-semibold ${
              transaction.type === 'income' ? 'text-success' : 'text-destructive'
            }`}>
              {transaction.type === 'income' ? '+' : '-'} R$ {Number(transaction.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
