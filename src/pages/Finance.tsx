import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wallet, Receipt, FileText, Plus, Search, ArrowDownLeft, ArrowUpRight, CheckCircle, Clock, AlertTriangle, DollarSign } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export default function Finance() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'transacoes';

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Financeiro</h1>
          <p className="text-muted-foreground">Gerencie transações, faturas e assinaturas</p>
        </div>

        <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="transacoes" className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Transações
            </TabsTrigger>
            <TabsTrigger value="faturas" className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Faturas
            </TabsTrigger>
            <TabsTrigger value="assinaturas" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Assinaturas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transacoes" className="mt-6">
            <TransactionsContent />
          </TabsContent>
          <TabsContent value="faturas" className="mt-6">
            <InvoicesContent />
          </TabsContent>
          <TabsContent value="assinaturas" className="mt-6">
            <SubscriptionsContent />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

function TransactionsContent() {
  const { business } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  interface Transaction {
    id: string;
    type: 'income' | 'expense';
    description: string;
    amount: number;
    status: string;
    transaction_date: string;
    customers: { name: string } | null;
  }

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions', business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      const { data, error } = await supabase
        .from('transactions')
        .select('id, type, description, amount, status, transaction_date, customers (name)')
        .eq('business_id', business.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as Transaction[];
    },
    enabled: !!business?.id,
  });

  const totals = transactions.reduce(
    (acc, t) => {
      if (t.type === 'income') {
        if (t.status === 'received') acc.received += Number(t.amount);
        else acc.pending += Number(t.amount);
      } else {
        acc.expenses += Number(t.amount);
      }
      return acc;
    },
    { received: 0, pending: 0, expenses: 0 }
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">Recebido</p>
          <p className="text-2xl font-bold text-success">
            R$ {totals.received.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">A Receber</p>
          <p className="text-2xl font-bold text-warning">
            R$ {totals.pending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">Despesas</p>
          <p className="text-2xl font-bold text-destructive">
            R$ {totals.expenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar transações..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button onClick={() => navigate('/transacoes')}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Transação
        </Button>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-border">
            <tr>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Tipo</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Descrição</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Data</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
              <th className="text-right p-4 text-sm font-medium text-muted-foreground">Valor</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</td></tr>
            ) : transactions.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma transação encontrada</td></tr>
            ) : (
              transactions.slice(0, 10).map((t) => (
                <tr key={t.id} className="border-b border-border hover:bg-muted/50 cursor-pointer" onClick={() => navigate('/transacoes')}>
                  <td className="p-4">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                      t.type === 'income' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                    }`}>
                      {t.type === 'income' ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                    </div>
                  </td>
                  <td className="p-4 font-medium">{t.description}</td>
                  <td className="p-4 text-muted-foreground">{format(new Date(t.transaction_date), 'dd/MM/yyyy')}</td>
                  <td className="p-4">
                    <Badge className={t.status === 'received' || t.status === 'paid' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}>
                      {t.status === 'received' ? 'Recebido' : t.status === 'paid' ? 'Pago' : 'Pendente'}
                    </Badge>
                  </td>
                  <td className={`p-4 text-right font-semibold ${t.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                    {t.type === 'income' ? '+' : '-'} R$ {Number(t.amount).toFixed(2)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {transactions.length > 10 && (
        <div className="text-center">
          <Button variant="outline" onClick={() => navigate('/transacoes')}>Ver todas as transações</Button>
        </div>
      )}
    </div>
  );
}

function InvoicesContent() {
  const { business } = useAuth();
  const navigate = useNavigate();

  type InvoiceStatus = 'draft' | 'pending' | 'paid' | 'overdue' | 'cancelled';

  interface Invoice {
    id: string;
    invoice_number: string;
    status: InvoiceStatus;
    total: number;
    due_date: string;
    customers: { name: string };
  }

  const statusConfig: Record<InvoiceStatus, { label: string; icon: React.ReactNode }> = {
    draft: { label: 'Rascunho', icon: <FileText className="h-4 w-4" /> },
    pending: { label: 'Pendente', icon: <Clock className="h-4 w-4" /> },
    paid: { label: 'Pago', icon: <CheckCircle className="h-4 w-4" /> },
    overdue: { label: 'Vencida', icon: <AlertTriangle className="h-4 w-4" /> },
    cancelled: { label: 'Cancelada', icon: <FileText className="h-4 w-4" /> },
  };

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices', business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, status, total, due_date, customers(name)')
        .eq('business_id', business.id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as Invoice[];
    },
    enabled: !!business?.id,
  });

  const totalPending = invoices.filter((i) => i.status === 'pending').reduce((sum, i) => sum + i.total, 0);
  const totalPaid = invoices.filter((i) => i.status === 'paid').reduce((sum, i) => sum + i.total, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-warning/10">
            <Clock className="h-5 w-5 text-warning" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Pendente</p>
            <p className="text-2xl font-bold">{totalPending.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-success/10">
            <DollarSign className="h-5 w-5 text-success" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Recebido</p>
            <p className="text-2xl font-bold">{totalPaid.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end">
        <Button onClick={() => navigate('/faturas')}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Fatura
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">Carregando...</div>
        ) : invoices.length === 0 ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">Nenhuma fatura encontrada</div>
        ) : (
          invoices.map((invoice) => (
            <div key={invoice.id} className="bg-card rounded-xl border border-border p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/faturas')}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold">{invoice.invoice_number}</p>
                  <p className="text-sm text-muted-foreground">{invoice.customers?.name}</p>
                </div>
                <Badge variant="outline">{statusConfig[invoice.status].label}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-lg font-bold text-success">
                  {invoice.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
                <p className="text-sm text-muted-foreground">
                  Venc: {format(new Date(invoice.due_date), 'dd/MM/yyyy')}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
      {invoices.length > 0 && (
        <div className="text-center">
          <Button variant="outline" onClick={() => navigate('/faturas')}>Ver todas as faturas</Button>
        </div>
      )}
    </div>
  );
}

function SubscriptionsContent() {
  const { business } = useAuth();
  const navigate = useNavigate();

  interface Subscription {
    id: string;
    status: string;
    credits_used: number;
    credits_total: number;
    end_date: string;
    customers: { name: string } | null;
    plans: { name: string; price: number } | null;
  }

  const { data: subscriptions = [], isLoading } = useQuery({
    queryKey: ['subscriptions', business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      const { data, error } = await supabase
        .from('subscriptions')
        .select('id, status, credits_used, credits_total, end_date, customers(name), plans(name, price)')
        .eq('business_id', business.id)
        .order('end_date', { ascending: true })
        .limit(10);
      if (error) throw error;
      return data as Subscription[];
    },
    enabled: !!business?.id,
  });

  const getStatusInfo = (status: string, endDate: string) => {
    const daysUntilEnd = differenceInDays(new Date(endDate), new Date());
    if (status === 'cancelled') return { label: 'Cancelada', className: 'bg-destructive/10 text-destructive' };
    if (daysUntilEnd < 0) return { label: 'Vencida', className: 'bg-destructive/10 text-destructive' };
    if (daysUntilEnd <= 7) return { label: 'Expirando', className: 'bg-warning/10 text-warning' };
    return { label: 'Ativa', className: 'bg-success/10 text-success' };
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">{subscriptions.length} assinaturas</span>
        </p>
        <Button onClick={() => navigate('/assinaturas')}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Assinatura
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">Carregando...</div>
        ) : subscriptions.length === 0 ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">Nenhuma assinatura encontrada</div>
        ) : (
          subscriptions.map((sub) => {
            const statusInfo = getStatusInfo(sub.status, sub.end_date);
            return (
              <div key={sub.id} className="bg-card rounded-xl border border-border p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/assinaturas')}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold">{sub.customers?.name}</p>
                    <p className="text-sm text-muted-foreground">{sub.plans?.name}</p>
                  </div>
                  <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-lg font-bold">
                    {sub.plans?.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {sub.credits_used}/{sub.credits_total} créditos
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
      {subscriptions.length > 0 && (
        <div className="text-center">
          <Button variant="outline" onClick={() => navigate('/assinaturas')}>Ver todas as assinaturas</Button>
        </div>
      )}
    </div>
  );
}
