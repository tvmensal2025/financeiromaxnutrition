import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Edit, Trash2, Phone, Mail, MessageSquare, Loader2, Package, Wrench, CalendarDays, Clock, Bell } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  notes: string | null;
  created_at: string;
  interest_type?: string | null;
  interested_product_id?: string | null;
  interested_service_id?: string | null;
  interest_is_recurring?: boolean | null;
  recurring_due_date?: string | null;
  recurring_message_time?: string | null;
  recurring_reminder_days?: number | null;
  recurring_message_type?: string | null;
  recurring_reminder_template?: string | null;
  recurring_overdue_template?: string | null;
}

interface Product {
  id: string;
  name: string;
  price: number;
}

interface Service {
  id: string;
  name: string;
  price: number;
}

export default function Customers() {
  const { business } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    whatsapp: '',
    notes: '',
    interest_type: 'none',
    interested_product_id: '',
    interested_service_id: '',
    interest_is_recurring: false,
    recurring_due_date: '',
    recurring_message_time: '09:00',
    recurring_reminder_days: 3,
    recurring_message_type: 'both',
    recurring_reminder_template: 'Olá {nome}! Sua assinatura de {produto} (R$ {valor}) vence em {vencimento}. Podemos confirmar o pagamento?',
    recurring_overdue_template: 'Olá {nome}! Sua fatura de {produto} (R$ {valor}) venceu. Por favor, regularize o pagamento para continuar utilizando o serviço.',
  });

  const { data: customers, isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Customer[];
    },
  });

  // Fetch products
  const { data: products = [] } = useQuery({
    queryKey: ['products', business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price')
        .eq('business_id', business.id)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as Product[];
    },
    enabled: !!business?.id,
  });

  // Fetch services
  const { data: services = [] } = useQuery({
    queryKey: ['services', business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      const { data, error } = await supabase
        .from('services')
        .select('id, name, price')
        .eq('business_id', business.id)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as Service[];
    },
    enabled: !!business?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const insertData: any = {
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        whatsapp: data.whatsapp || null,
        notes: data.notes || null,
        business_id: business?.id,
        interest_type: data.interest_type,
        interested_product_id: data.interest_type === 'product' && data.interested_product_id ? data.interested_product_id : null,
        interested_service_id: data.interest_type === 'service' && data.interested_service_id ? data.interested_service_id : null,
        interest_is_recurring: data.interest_is_recurring,
        recurring_due_date: data.interest_is_recurring && data.recurring_due_date ? data.recurring_due_date : null,
        recurring_message_time: data.interest_is_recurring ? data.recurring_message_time : null,
        recurring_reminder_days: data.interest_is_recurring ? data.recurring_reminder_days : null,
        recurring_message_type: data.interest_is_recurring ? data.recurring_message_type : null,
        recurring_reminder_template: data.interest_is_recurring ? data.recurring_reminder_template : null,
        recurring_overdue_template: data.interest_is_recurring ? data.recurring_overdue_template : null,
      };
      const { error } = await supabase.from('customers').insert(insertData);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: 'Cliente criado com sucesso!' });
      resetForm();
    },
    onError: () => {
      toast({ title: 'Erro ao criar cliente', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const updateData: any = {
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        whatsapp: data.whatsapp || null,
        notes: data.notes || null,
        interest_type: data.interest_type,
        interested_product_id: data.interest_type === 'product' && data.interested_product_id ? data.interested_product_id : null,
        interested_service_id: data.interest_type === 'service' && data.interested_service_id ? data.interested_service_id : null,
        interest_is_recurring: data.interest_is_recurring,
        recurring_due_date: data.interest_is_recurring && data.recurring_due_date ? data.recurring_due_date : null,
        recurring_message_time: data.interest_is_recurring ? data.recurring_message_time : null,
        recurring_reminder_days: data.interest_is_recurring ? data.recurring_reminder_days : null,
        recurring_message_type: data.interest_is_recurring ? data.recurring_message_type : null,
        recurring_reminder_template: data.interest_is_recurring ? data.recurring_reminder_template : null,
        recurring_overdue_template: data.interest_is_recurring ? data.recurring_overdue_template : null,
      };
      const { error } = await supabase.from('customers').update(updateData).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: 'Cliente atualizado!' });
      resetForm();
    },
    onError: () => {
      toast({ title: 'Erro ao atualizar cliente', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: 'Cliente removido!' });
    },
    onError: () => {
      toast({ title: 'Erro ao remover cliente', variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({ 
      name: '', 
      email: '', 
      phone: '', 
      whatsapp: '', 
      notes: '',
      interest_type: 'none',
      interested_product_id: '',
      interested_service_id: '',
      interest_is_recurring: false,
      recurring_due_date: '',
      recurring_message_time: '09:00',
      recurring_reminder_days: 3,
      recurring_message_type: 'both',
      recurring_reminder_template: 'Olá {nome}! Sua assinatura de {produto} (R$ {valor}) vence em {vencimento}. Podemos confirmar o pagamento?',
      recurring_overdue_template: 'Olá {nome}! Sua fatura de {produto} (R$ {valor}) venceu. Por favor, regularize o pagamento para continuar utilizando o serviço.',
    });
    setEditingCustomer(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      email: customer.email || '',
      phone: customer.phone || '',
      whatsapp: customer.whatsapp || '',
      notes: customer.notes || '',
      interest_type: customer.interest_type || 'none',
      interested_product_id: customer.interested_product_id || '',
      interested_service_id: customer.interested_service_id || '',
      interest_is_recurring: customer.interest_is_recurring || false,
      recurring_due_date: customer.recurring_due_date || '',
      recurring_message_time: customer.recurring_message_time || '09:00',
      recurring_reminder_days: customer.recurring_reminder_days || 3,
      recurring_message_type: customer.recurring_message_type || 'both',
      recurring_reminder_template: customer.recurring_reminder_template || 'Olá {nome}! Sua assinatura de {produto} (R$ {valor}) vence em {vencimento}. Podemos confirmar o pagamento?',
      recurring_overdue_template: customer.recurring_overdue_template || 'Olá {nome}! Sua fatura de {produto} (R$ {valor}) venceu. Por favor, regularize o pagamento para continuar utilizando o serviço.',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredCustomers = customers?.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search)
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Clientes</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie sua base de clientes
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingCustomer ? 'Editar Cliente' : 'Novo Cliente'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="whatsapp">WhatsApp</Label>
                    <Input
                      id="whatsapp"
                      value={formData.whatsapp}
                      onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                  />
                </div>

                <Separator className="my-4" />

                {/* Interest Section */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Interesse em Produto/Serviço
                  </h4>
                  
                  <div className="space-y-2">
                    <Label>Tipo de interesse</Label>
                    <Select
                      value={formData.interest_type}
                      onValueChange={(v) => setFormData({ 
                        ...formData, 
                        interest_type: v,
                        interested_product_id: '',
                        interested_service_id: '',
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        <SelectItem value="product">
                          <span className="flex items-center gap-2">
                            <Package className="h-4 w-4" /> Produto
                          </span>
                        </SelectItem>
                        <SelectItem value="service">
                          <span className="flex items-center gap-2">
                            <Wrench className="h-4 w-4" /> Serviço
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.interest_type === 'product' && (
                    <div className="space-y-2">
                      <Label>Produto</Label>
                      <Select
                        value={formData.interested_product_id}
                        onValueChange={(v) => setFormData({ ...formData, interested_product_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um produto..." />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name} - R$ {p.price.toFixed(2)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {formData.interest_type === 'service' && (
                    <div className="space-y-2">
                      <Label>Serviço</Label>
                      <Select
                        value={formData.interested_service_id}
                        onValueChange={(v) => setFormData({ ...formData, interested_service_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um serviço..." />
                        </SelectTrigger>
                        <SelectContent>
                          {services.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name} - R$ {s.price.toFixed(2)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {formData.interest_type !== 'none' && (
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="recurring">Recorrente?</Label>
                        <p className="text-xs text-muted-foreground">
                          O cliente quer compra/assinatura contínua
                        </p>
                      </div>
                      <Switch
                        id="recurring"
                        checked={formData.interest_is_recurring}
                        onCheckedChange={(v) => setFormData({ ...formData, interest_is_recurring: v })}
                      />
                    </div>
                  )}

                  {/* Recurring Message Settings */}
                  {formData.interest_is_recurring && (
                    <div className="space-y-4 p-4 bg-muted/50 rounded-lg border border-border">
                      <h5 className="text-sm font-medium text-foreground flex items-center gap-2">
                        <Bell className="h-4 w-4" />
                        Configurações de Mensagem Automática
                      </h5>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="recurring_due_date" className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            Próximo Vencimento
                          </Label>
                          <Input
                            id="recurring_due_date"
                            type="date"
                            value={formData.recurring_due_date}
                            onChange={(e) => setFormData({ ...formData, recurring_due_date: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="recurring_message_time" className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Horário de Envio
                          </Label>
                          <Input
                            id="recurring_message_time"
                            type="time"
                            value={formData.recurring_message_time}
                            onChange={(e) => setFormData({ ...formData, recurring_message_time: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Lembrete com antecedência</Label>
                          <Select
                            value={formData.recurring_reminder_days.toString()}
                            onValueChange={(v) => setFormData({ ...formData, recurring_reminder_days: parseInt(v) })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1 dia antes</SelectItem>
                              <SelectItem value="2">2 dias antes</SelectItem>
                              <SelectItem value="3">3 dias antes</SelectItem>
                              <SelectItem value="5">5 dias antes</SelectItem>
                              <SelectItem value="7">7 dias antes</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Tipo de mensagem</Label>
                          <Select
                            value={formData.recurring_message_type}
                            onValueChange={(v) => setFormData({ ...formData, recurring_message_type: v })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="reminder">Lembrete antes</SelectItem>
                              <SelectItem value="overdue">Cobrança depois</SelectItem>
                              <SelectItem value="both">Ambos</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="recurring_reminder_template">
                          📩 Mensagem de Lembrete
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Use: {'{nome}'}, {'{produto}'}, {'{valor}'}, {'{vencimento}'}
                        </p>
                        <Textarea
                          id="recurring_reminder_template"
                          value={formData.recurring_reminder_template}
                          onChange={(e) => setFormData({ ...formData, recurring_reminder_template: e.target.value })}
                          rows={3}
                          className="text-sm"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="recurring_overdue_template">
                          📩 Mensagem de Cobrança
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Enviada após o vencimento caso não pague
                        </p>
                        <Textarea
                          id="recurring_overdue_template"
                          value={formData.recurring_overdue_template}
                          onChange={(e) => setFormData({ ...formData, recurring_overdue_template: e.target.value })}
                          rows={3}
                          className="text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {(createMutation.isPending || updateMutation.isPending) && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {editingCustomer ? 'Salvar' : 'Criar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar clientes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Table */}
        <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !filteredCustomers?.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground">Nenhum cliente encontrado</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Contato</th>
                  <th>WhatsApp</th>
                  <th>Criado em</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="animate-fade-in">
                    <td>
                      <div>
                        <p className="font-medium text-foreground">{customer.name}</p>
                        {customer.notes && (
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {customer.notes}
                          </p>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="space-y-1">
                        {customer.email && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {customer.email}
                          </div>
                        )}
                        {customer.phone && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {customer.phone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      {customer.whatsapp && (
                        <a
                          href={`https://wa.me/${customer.whatsapp.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-success hover:underline"
                        >
                          <MessageSquare className="h-4 w-4" />
                          {customer.whatsapp}
                        </a>
                      )}
                    </td>
                    <td className="text-muted-foreground">
                      {format(new Date(customer.created_at), "dd 'de' MMM, yyyy", { locale: ptBR })}
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(customer)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(customer.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
