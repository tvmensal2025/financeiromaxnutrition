import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Edit, Trash2, Loader2, RefreshCw } from 'lucide-react';
import { format, differenceInDays, addMonths, addDays, addWeeks, addYears } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface Subscription {
  id: string;
  status: string;
  credits_used: number;
  credits_total: number;
  start_date: string;
  end_date: string;
  auto_renew: boolean;
  customer_id: string;
  plan_id: string;
  customers: {
    name: string;
    email: string | null;
  } | null;
  plans: {
    name: string;
    price: number;
    billing_cycle: string;
  } | null;
}

interface Customer {
  id: string;
  name: string;
}

interface Plan {
  id: string;
  name: string;
  price: number;
  credits: number;
  billing_cycle: string;
}

export default function Subscriptions() {
  const { business } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [formData, setFormData] = useState({
    customer_id: '',
    plan_id: '',
    auto_renew: true,
    credits_used: '0',
  });

  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select(`
          *,
          customers (name, email),
          plans (name, price, billing_cycle)
        `)
        .order('end_date', { ascending: true });

      if (error) throw error;
      return data as Subscription[];
    },
  });

  const { data: customers } = useQuery({
    queryKey: ['customers-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name')
        .order('name');

      if (error) throw error;
      return data as Customer[];
    },
  });

  const { data: plans } = useQuery({
    queryKey: ['plans-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plans')
        .select('id, name, price, credits, billing_cycle')
        .eq('is_active', true)
        .order('price');

      if (error) throw error;
      return data as Plan[];
    },
  });

  const getEndDate = (startDate: Date, billingCycle: string) => {
    switch (billingCycle) {
      case 'weekly':
        return addWeeks(startDate, 1);
      case 'monthly':
        return addMonths(startDate, 1);
      case 'quarterly':
        return addMonths(startDate, 3);
      case 'yearly':
        return addYears(startDate, 1);
      default:
        return addMonths(startDate, 1);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const plan = plans?.find((p) => p.id === data.plan_id);
      if (!plan) throw new Error('Plano não encontrado');

      const startDate = new Date();
      const endDate = getEndDate(startDate, plan.billing_cycle);

      const { error } = await supabase.from('subscriptions').insert({
        customer_id: data.customer_id,
        plan_id: data.plan_id,
        auto_renew: data.auto_renew,
        credits_used: parseInt(data.credits_used) || 0,
        credits_total: plan.credits,
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        status: 'active',
        business_id: business?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast({ title: 'Assinatura criada com sucesso!' });
      resetForm();
    },
    onError: () => {
      toast({ title: 'Erro ao criar assinatura', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Subscription> }) => {
      const { error } = await supabase.from('subscriptions').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast({ title: 'Assinatura atualizada!' });
      resetForm();
    },
    onError: () => {
      toast({ title: 'Erro ao atualizar assinatura', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('subscriptions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast({ title: 'Assinatura removida!' });
    },
    onError: () => {
      toast({ title: 'Erro ao remover assinatura', variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({
      customer_id: '',
      plan_id: '',
      auto_renew: true,
      credits_used: '0',
    });
    setEditingSubscription(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (subscription: Subscription) => {
    setEditingSubscription(subscription);
    setFormData({
      customer_id: subscription.customer_id,
      plan_id: subscription.plan_id,
      auto_renew: subscription.auto_renew,
      credits_used: subscription.credits_used.toString(),
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSubscription) {
      updateMutation.mutate({
        id: editingSubscription.id,
        data: {
          auto_renew: formData.auto_renew,
          credits_used: parseInt(formData.credits_used) || 0,
        },
      });
    } else {
      createMutation.mutate(formData);
    }
  };

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

  const filteredSubscriptions = subscriptions?.filter((s) => {
    const matchesSearch =
      s.customers?.name.toLowerCase().includes(search.toLowerCase()) ||
      s.plans?.name.toLowerCase().includes(search.toLowerCase());

    if (statusFilter === 'all') return matchesSearch;
    if (statusFilter === 'expiring') {
      const daysUntilEnd = differenceInDays(new Date(s.end_date), new Date());
      return matchesSearch && daysUntilEnd <= 7 && daysUntilEnd >= 0;
    }
    return matchesSearch && s.status === statusFilter;
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Assinaturas</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie as assinaturas dos seus clientes
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Assinatura
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingSubscription ? 'Editar Assinatura' : 'Nova Assinatura'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                {!editingSubscription && (
                  <>
                    <div className="space-y-2">
                      <Label>Cliente *</Label>
                      <Select
                        value={formData.customer_id}
                        onValueChange={(value) => setFormData({ ...formData, customer_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um cliente" />
                        </SelectTrigger>
                        <SelectContent>
                          {customers?.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {customer.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Plano *</Label>
                      <Select
                        value={formData.plan_id}
                        onValueChange={(value) => setFormData({ ...formData, plan_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um plano" />
                        </SelectTrigger>
                        <SelectContent>
                          {plans?.map((plan) => (
                            <SelectItem key={plan.id} value={plan.id}>
                              {plan.name} - R$ {plan.price.toFixed(2)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
                {editingSubscription && (
                  <div className="space-y-2">
                    <Label htmlFor="credits_used">Créditos Utilizados</Label>
                    <Input
                      id="credits_used"
                      type="number"
                      min="0"
                      max={editingSubscription.credits_total}
                      value={formData.credits_used}
                      onChange={(e) => setFormData({ ...formData, credits_used: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Total disponível: {editingSubscription.credits_total}
                    </p>
                  </div>
                )}
                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label htmlFor="auto_renew">Renovação Automática</Label>
                    <p className="text-xs text-muted-foreground">
                      Renovar automaticamente ao vencer
                    </p>
                  </div>
                  <Switch
                    id="auto_renew"
                    checked={formData.auto_renew}
                    onCheckedChange={(checked) => setFormData({ ...formData, auto_renew: checked })}
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {(createMutation.isPending || updateMutation.isPending) && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {editingSubscription ? 'Salvar' : 'Criar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar assinaturas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativas</SelectItem>
              <SelectItem value="expiring">Expirando</SelectItem>
              <SelectItem value="expired">Expiradas</SelectItem>
              <SelectItem value="cancelled">Canceladas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !filteredSubscriptions?.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground">Nenhuma assinatura encontrada</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Plano</th>
                  <th>Consumo</th>
                  <th>Período</th>
                  <th>Renovação</th>
                  <th>Status</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubscriptions.map((sub) => {
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
                      <td className="text-muted-foreground text-sm">
                        <div>
                          {format(new Date(sub.start_date), "dd/MM/yy", { locale: ptBR })}
                          {' - '}
                          {format(new Date(sub.end_date), "dd/MM/yy", { locale: ptBR })}
                        </div>
                      </td>
                      <td>
                        {sub.auto_renew ? (
                          <Badge variant="outline" className="text-success border-success/20">
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Auto
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Manual
                          </Badge>
                        )}
                      </td>
                      <td>
                        <span className={cn('status-badge', statusInfo.className)}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(sub)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(sub.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
