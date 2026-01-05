import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, DollarSign, Calendar, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type OpportunityStage = 'prospecting' | 'qualification' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';

interface Opportunity {
  id: string;
  title: string;
  description: string | null;
  stage: OpportunityStage;
  value: number;
  probability: number | null;
  expected_close_date: string | null;
  customer_id: string | null;
  lead_id: string | null;
  created_at: string;
  customers?: { name: string } | null;
  leads?: { name: string } | null;
}

const stageConfig: Record<OpportunityStage, { label: string; color: string; bgColor: string }> = {
  prospecting: { label: 'Prospecção', color: 'text-blue-600', bgColor: 'bg-blue-50 border-blue-200' },
  qualification: { label: 'Qualificação', color: 'text-purple-600', bgColor: 'bg-purple-50 border-purple-200' },
  proposal: { label: 'Proposta', color: 'text-warning', bgColor: 'bg-amber-50 border-amber-200' },
  negotiation: { label: 'Negociação', color: 'text-orange-600', bgColor: 'bg-orange-50 border-orange-200' },
  closed_won: { label: 'Fechado (Ganho)', color: 'text-success', bgColor: 'bg-green-50 border-green-200' },
  closed_lost: { label: 'Fechado (Perdido)', color: 'text-destructive', bgColor: 'bg-red-50 border-red-200' },
};

const stages: OpportunityStage[] = ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];

export default function Pipeline() {
  const { business } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOpportunity, setEditingOpportunity] = useState<Opportunity | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    stage: 'prospecting' as OpportunityStage,
    value: '',
    probability: '50',
    expected_close_date: '',
    customer_id: '',
  });

  const { data: opportunities = [], isLoading } = useQuery({
    queryKey: ['opportunities', business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      const { data, error } = await supabase
        .from('opportunities')
        .select('*, customers(name), leads(name)')
        .eq('business_id', business.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Opportunity[];
    },
    enabled: !!business?.id,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers', business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      const { data, error } = await supabase
        .from('customers')
        .select('id, name')
        .eq('business_id', business.id)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from('opportunities').insert({
        business_id: business!.id,
        title: data.title,
        description: data.description || null,
        stage: data.stage,
        value: parseFloat(data.value) || 0,
        probability: parseInt(data.probability) || 50,
        expected_close_date: data.expected_close_date || null,
        customer_id: data.customer_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      toast({ title: 'Oportunidade criada com sucesso!' });
      resetForm();
    },
    onError: () => {
      toast({ title: 'Erro ao criar oportunidade', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from('opportunities')
        .update({
          title: data.title,
          description: data.description || null,
          stage: data.stage,
          value: parseFloat(data.value) || 0,
          probability: parseInt(data.probability) || 50,
          expected_close_date: data.expected_close_date || null,
          customer_id: data.customer_id || null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      toast({ title: 'Oportunidade atualizada!' });
      resetForm();
    },
    onError: () => {
      toast({ title: 'Erro ao atualizar oportunidade', variant: 'destructive' });
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: OpportunityStage }) => {
      const { error } = await supabase
        .from('opportunities')
        .update({ stage, closed_at: stage.startsWith('closed_') ? new Date().toISOString() : null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      toast({ title: 'Estágio atualizado!' });
    },
  });

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      stage: 'prospecting',
      value: '',
      probability: '50',
      expected_close_date: '',
      customer_id: '',
    });
    setEditingOpportunity(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (opp: Opportunity) => {
    setEditingOpportunity(opp);
    setFormData({
      title: opp.title,
      description: opp.description || '',
      stage: opp.stage,
      value: opp.value.toString(),
      probability: (opp.probability || 50).toString(),
      expected_close_date: opp.expected_close_date || '',
      customer_id: opp.customer_id || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingOpportunity) {
      updateMutation.mutate({ id: editingOpportunity.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getOpportunitiesByStage = (stage: OpportunityStage) =>
    opportunities.filter((opp) => opp.stage === stage);

  const totalValue = opportunities
    .filter((o) => o.stage !== 'closed_lost')
    .reduce((sum, o) => sum + o.value, 0);

  const weightedValue = opportunities
    .filter((o) => !o.stage.startsWith('closed_'))
    .reduce((sum, o) => sum + o.value * ((o.probability || 50) / 100), 0);

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Pipeline de Vendas</h1>
            <p className="text-muted-foreground">Acompanhe suas oportunidades de negócio</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Oportunidade
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingOpportunity ? 'Editar Oportunidade' : 'Nova Oportunidade'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer_id">Cliente</Label>
                  <Select
                    value={formData.customer_id}
                    onValueChange={(v) => setFormData({ ...formData, customer_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="value">Valor (R$)</Label>
                    <Input
                      id="value"
                      type="number"
                      step="0.01"
                      value={formData.value}
                      onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="probability">Probabilidade (%)</Label>
                    <Input
                      id="probability"
                      type="number"
                      min="0"
                      max="100"
                      value={formData.probability}
                      onChange={(e) => setFormData({ ...formData, probability: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Estágio</Label>
                    <Select
                      value={formData.stage}
                      onValueChange={(v) => setFormData({ ...formData, stage: v as OpportunityStage })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {stages.map((s) => (
                          <SelectItem key={s} value={s}>
                            {stageConfig[s].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expected_close_date">Data Prevista</Label>
                    <Input
                      id="expected_close_date"
                      type="date"
                      value={formData.expected_close_date}
                      onChange={(e) => setFormData({ ...formData, expected_close_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingOpportunity ? 'Salvar Alterações' : 'Criar Oportunidade'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="metric-card">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Oportunidades Ativas</p>
                <p className="text-2xl font-bold">{opportunities.filter((o) => !o.stage.startsWith('closed_')).length}</p>
              </div>
            </div>
          </div>
          <div className="metric-card">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <DollarSign className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Valor Total</p>
                <p className="text-2xl font-bold">
                  {totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
            </div>
          </div>
          <div className="metric-card">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <Calendar className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Valor Ponderado</p>
                <p className="text-2xl font-bold">
                  {weightedValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Kanban Board */}
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {stages.map((stage) => {
              const stageOpps = getOpportunitiesByStage(stage);
              const stageValue = stageOpps.reduce((sum, o) => sum + o.value, 0);

              return (
                <div
                  key={stage}
                  className={`w-72 rounded-xl border p-4 ${stageConfig[stage].bgColor}`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className={`font-semibold ${stageConfig[stage].color}`}>
                      {stageConfig[stage].label}
                    </h3>
                    <span className="text-xs text-muted-foreground bg-background px-2 py-1 rounded-full">
                      {stageOpps.length}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    {stageValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>

                  <div className="space-y-3">
                    {stageOpps.map((opp) => (
                      <div
                        key={opp.id}
                        className="bg-card rounded-lg border border-border p-3 cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => handleEdit(opp)}
                      >
                        <h4 className="font-medium text-sm mb-1">{opp.title}</h4>
                        {opp.customers?.name && (
                          <p className="text-xs text-muted-foreground mb-2">{opp.customers.name}</p>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-success">
                            {opp.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                          <span className="text-xs text-muted-foreground">{opp.probability}%</span>
                        </div>
                        {opp.expected_close_date && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Previsão: {format(new Date(opp.expected_close_date), 'dd MMM', { locale: ptBR })}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
