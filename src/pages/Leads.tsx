import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Flame, Snowflake, ThermometerSun, UserPlus, MessageCircle, Send, Package, Wrench, Trash2 } from 'lucide-react';

type LeadStatus = 'new' | 'contacted' | 'qualified' | 'unqualified' | 'converted';
type LeadTemperature = 'cold' | 'warm' | 'hot';

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  company: string | null;
  source: string | null;
  status: LeadStatus;
  temperature: LeadTemperature | null;
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

interface WhatsAppMessage {
  id: string;
  message: string;
  direction: 'inbound' | 'outbound';
  created_at: string;
  sender_name: string | null;
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

const sourceLabels: Record<string, { label: string; color: string }> = {
  whatsapp: { label: 'WhatsApp', color: 'bg-green-500/10 text-green-600' },
  instagram: { label: 'Instagram', color: 'bg-pink-500/10 text-pink-600' },
  facebook: { label: 'Facebook', color: 'bg-blue-500/10 text-blue-600' },
  indicacao: { label: 'Indicação', color: 'bg-purple-500/10 text-purple-600' },
  site: { label: 'Site', color: 'bg-orange-500/10 text-orange-600' },
};

const statusLabels: Record<LeadStatus, string> = {
  new: 'Novo',
  contacted: 'Contactado',
  qualified: 'Qualificado',
  unqualified: 'Não Qualificado',
  converted: 'Convertido',
};

const statusColors: Record<LeadStatus, string> = {
  new: 'bg-primary/10 text-primary',
  contacted: 'bg-warning/10 text-warning',
  qualified: 'bg-success/10 text-success',
  unqualified: 'bg-destructive/10 text-destructive',
  converted: 'bg-success/10 text-success',
};

const temperatureIcons: Record<LeadTemperature, React.ReactNode> = {
  cold: <Snowflake className="h-4 w-4 text-blue-500" />,
  warm: <ThermometerSun className="h-4 w-4 text-warning" />,
  hot: <Flame className="h-4 w-4 text-destructive" />,
};

export default function Leads() {
  const { business } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [temperatureFilter, setTemperatureFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [chatLeadId, setChatLeadId] = useState<string | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    whatsapp: '',
    company: '',
    source: '',
    status: 'new' as LeadStatus,
    temperature: 'cold' as LeadTemperature,
    notes: '',
    interest_type: 'none',
    interested_product_id: '',
    interested_service_id: '',
    interest_is_recurring: false,
    recurring_due_date: '',
    recurring_message_time: '09:00',
    recurring_reminder_days: 3,
    recurring_message_type: 'both',
    recurring_reminder_template: '',
    recurring_overdue_template: '',
  });

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads', business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('business_id', business.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Lead[];
    },
    enabled: !!business?.id,
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

  // Query messages for the selected lead
  const { data: leadMessages = [] } = useQuery({
    queryKey: ['whatsapp-messages', chatLeadId],
    queryFn: async () => {
      if (!chatLeadId || !business?.id) return [];
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('lead_id', chatLeadId)
        .eq('business_id', business.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as WhatsAppMessage[];
    },
    enabled: !!chatLeadId && !!business?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const insertData: any = {
        business_id: business!.id,
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        whatsapp: data.whatsapp || null,
        company: data.company || null,
        source: data.source || null,
        status: data.status,
        temperature: data.temperature,
        notes: data.notes || null,
        interest_type: data.interest_type,
        interested_product_id: data.interest_type === 'product' && data.interested_product_id ? data.interested_product_id : null,
        interested_service_id: data.interest_type === 'service' && data.interested_service_id ? data.interested_service_id : null,
        interest_is_recurring: data.interest_is_recurring,
        recurring_due_date: data.interest_is_recurring && data.recurring_due_date ? data.recurring_due_date : null,
        recurring_message_time: data.interest_is_recurring ? data.recurring_message_time : null,
        recurring_reminder_days: data.interest_is_recurring ? data.recurring_reminder_days : null,
        recurring_message_type: data.interest_is_recurring ? data.recurring_message_type : null,
        recurring_reminder_template: data.interest_is_recurring ? data.recurring_reminder_template || null : null,
        recurring_overdue_template: data.interest_is_recurring ? data.recurring_overdue_template || null : null,
      };
      const { error } = await supabase.from('leads').insert(insertData);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({ title: 'Lead criado com sucesso!' });
      resetForm();
    },
    onError: () => {
      toast({ title: 'Erro ao criar lead', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const updateData: any = {
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        whatsapp: data.whatsapp || null,
        company: data.company || null,
        source: data.source || null,
        status: data.status,
        temperature: data.temperature,
        notes: data.notes || null,
        interest_type: data.interest_type,
        interested_product_id: data.interest_type === 'product' && data.interested_product_id ? data.interested_product_id : null,
        interested_service_id: data.interest_type === 'service' && data.interested_service_id ? data.interested_service_id : null,
        interest_is_recurring: data.interest_is_recurring,
        recurring_due_date: data.interest_is_recurring && data.recurring_due_date ? data.recurring_due_date : null,
        recurring_message_time: data.interest_is_recurring ? data.recurring_message_time : null,
        recurring_reminder_days: data.interest_is_recurring ? data.recurring_reminder_days : null,
        recurring_message_type: data.interest_is_recurring ? data.recurring_message_type : null,
        recurring_reminder_template: data.interest_is_recurring ? data.recurring_reminder_template || null : null,
        recurring_overdue_template: data.interest_is_recurring ? data.recurring_overdue_template || null : null,
      };
      const { error } = await supabase.from('leads').update(updateData).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({ title: 'Lead atualizado com sucesso!' });
      resetForm();
    },
    onError: () => {
      toast({ title: 'Erro ao atualizar lead', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('leads').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({ title: 'Lead excluído com sucesso!' });
    },
    onError: () => {
      toast({ title: 'Erro ao excluir lead', variant: 'destructive' });
    },
  });

  const convertMutation = useMutation({
    mutationFn: async (lead: Lead) => {
      // Create customer from lead
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .insert({
          business_id: business!.id,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          whatsapp: lead.whatsapp,
          notes: lead.notes,
        })
        .select()
        .single();
      if (customerError) throw customerError;

      // Update lead status
      const { error: leadError } = await supabase
        .from('leads')
        .update({ status: 'converted', converted_customer_id: customer.id })
        .eq('id', lead.id);
      if (leadError) throw leadError;
      
      return customer;
    },
    onSuccess: (customer) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: 'Lead convertido em cliente!' });
      // Redirect to subscriptions page with customer pre-selected
      navigate(`/assinaturas?customer_id=${customer.id}`);
    },
    onError: () => {
      toast({ title: 'Erro ao converter lead', variant: 'destructive' });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ leadId, phone, message }: { leadId: string; phone: string; message: string }) => {
      const { data, error } = await supabase.functions.invoke('send-evolution-message', {
        body: {
          phone,
          message,
          business_id: business!.id,
          lead_id: leadId,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', chatLeadId] });
      setChatMessage('');
      toast({ title: 'Mensagem enviada!' });
    },
    onError: () => {
      toast({ title: 'Erro ao enviar mensagem', variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      whatsapp: '',
      company: '',
      source: '',
      status: 'new',
      temperature: 'cold',
      notes: '',
      interest_type: 'none',
      interested_product_id: '',
      interested_service_id: '',
      interest_is_recurring: false,
      recurring_due_date: '',
      recurring_message_time: '09:00',
      recurring_reminder_days: 3,
      recurring_message_type: 'both',
      recurring_reminder_template: '',
      recurring_overdue_template: '',
    });
    setEditingLead(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (lead: Lead) => {
    setEditingLead(lead);
    setFormData({
      name: lead.name,
      email: lead.email || '',
      phone: lead.phone || '',
      whatsapp: lead.whatsapp || '',
      company: lead.company || '',
      source: lead.source || '',
      status: lead.status,
      temperature: lead.temperature || 'cold',
      notes: lead.notes || '',
      interest_type: lead.interest_type || 'none',
      interested_product_id: lead.interested_product_id || '',
      interested_service_id: lead.interested_service_id || '',
      interest_is_recurring: lead.interest_is_recurring || false,
      recurring_due_date: lead.recurring_due_date || '',
      recurring_message_time: lead.recurring_message_time || '09:00',
      recurring_reminder_days: lead.recurring_reminder_days || 3,
      recurring_message_type: lead.recurring_message_type || 'both',
      recurring_reminder_template: lead.recurring_reminder_template || '',
      recurring_overdue_template: lead.recurring_overdue_template || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingLead) {
      updateMutation.mutate({ id: editingLead.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleSendMessage = (lead: Lead) => {
    if (!chatMessage.trim() || !lead.whatsapp) return;
    sendMessageMutation.mutate({
      leadId: lead.id,
      phone: lead.whatsapp,
      message: chatMessage,
    });
  };

  const chatLead = leads.find((l) => l.id === chatLeadId);

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.company?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSource = sourceFilter === 'all' || lead.source?.toLowerCase() === sourceFilter;
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    const matchesTemperature = temperatureFilter === 'all' || lead.temperature === temperatureFilter;
    return matchesSearch && matchesSource && matchesStatus && matchesTemperature;
  });

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Leads</h1>
            <p className="text-muted-foreground">
              Gerencie seus potenciais clientes · <span className="font-medium text-foreground">{leads.length} leads</span>
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Lead
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingLead ? 'Editar Lead' : 'Novo Lead'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="whatsapp">WhatsApp</Label>
                    <Input
                      id="whatsapp"
                      value={formData.whatsapp}
                      onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company">Empresa</Label>
                    <Input
                      id="company"
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="source">Origem</Label>
                    <Input
                      id="source"
                      placeholder="Ex: Instagram, Indicação"
                      value={formData.source}
                      onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Temperatura</Label>
                    <Select
                      value={formData.temperature}
                      onValueChange={(v) => setFormData({ ...formData, temperature: v as LeadTemperature })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cold">🥶 Frio</SelectItem>
                        <SelectItem value="warm">🌡️ Morno</SelectItem>
                        <SelectItem value="hot">🔥 Quente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(v) => setFormData({ ...formData, status: v as LeadStatus })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">Novo</SelectItem>
                      <SelectItem value="contacted">Contactado</SelectItem>
                      <SelectItem value="qualified">Qualificado</SelectItem>
                      <SelectItem value="unqualified">Não Qualificado</SelectItem>
                    </SelectContent>
                  </Select>
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
                    <>
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

                      {/* Recurring message settings */}
                      {formData.interest_is_recurring && (
                        <div className="space-y-4 p-4 bg-muted/50 rounded-lg border">
                          <h5 className="text-sm font-medium text-foreground">Configurações de Mensagem Automática</h5>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="recurring_due_date">Próximo Vencimento</Label>
                              <Input
                                id="recurring_due_date"
                                type="date"
                                value={formData.recurring_due_date}
                                onChange={(e) => setFormData({ ...formData, recurring_due_date: e.target.value })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="recurring_message_time">Horário de Envio</Label>
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
                                value={String(formData.recurring_reminder_days)}
                                onValueChange={(v) => setFormData({ ...formData, recurring_reminder_days: Number(v) })}
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
                                  <SelectItem value="reminder">Só lembrete antes</SelectItem>
                                  <SelectItem value="overdue">Só cobrança depois</SelectItem>
                                  <SelectItem value="both">Ambos</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {(formData.recurring_message_type === 'reminder' || formData.recurring_message_type === 'both') && (
                            <div className="space-y-2">
                              <Label htmlFor="recurring_reminder_template">Mensagem de Lembrete</Label>
                              <Textarea
                                id="recurring_reminder_template"
                                placeholder="Olá {nome}! Sua assinatura de {produto} no valor de {valor} vence em {vencimento}."
                                value={formData.recurring_reminder_template}
                                onChange={(e) => setFormData({ ...formData, recurring_reminder_template: e.target.value })}
                                rows={3}
                              />
                              <p className="text-xs text-muted-foreground">
                                Use: {'{nome}'}, {'{produto}'}, {'{valor}'}, {'{vencimento}'}
                              </p>
                            </div>
                          )}

                          {(formData.recurring_message_type === 'overdue' || formData.recurring_message_type === 'both') && (
                            <div className="space-y-2">
                              <Label htmlFor="recurring_overdue_template">Mensagem de Cobrança</Label>
                              <Textarea
                                id="recurring_overdue_template"
                                placeholder="Olá {nome}! Sua fatura de {produto} no valor de {valor} venceu em {vencimento}."
                                value={formData.recurring_overdue_template}
                                onChange={(e) => setFormData({ ...formData, recurring_overdue_template: e.target.value })}
                                rows={3}
                              />
                              <p className="text-xs text-muted-foreground">
                                Use: {'{nome}'}, {'{produto}'}, {'{valor}'}, {'{vencimento}'}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingLead ? 'Salvar Alterações' : 'Criar Lead'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar leads..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas origens</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="facebook">Facebook</SelectItem>
              <SelectItem value="indicacao">Indicação</SelectItem>
              <SelectItem value="site">Site</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="new">Novo</SelectItem>
              <SelectItem value="contacted">Contactado</SelectItem>
              <SelectItem value="qualified">Qualificado</SelectItem>
              <SelectItem value="unqualified">Não Qualificado</SelectItem>
              <SelectItem value="converted">Convertido</SelectItem>
            </SelectContent>
          </Select>
          <Select value={temperatureFilter} onValueChange={setTemperatureFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Temperatura" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas temperaturas</SelectItem>
              <SelectItem value="cold">🥶 Frio</SelectItem>
              <SelectItem value="warm">🌡️ Morno</SelectItem>
              <SelectItem value="hot">🔥 Quente</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Contato</th>
                <th>Empresa</th>
                <th>Origem</th>
                <th>Temperatura</th>
                <th>Status</th>
                <th>Criado em</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </td>
                </tr>
              ) : filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhum lead encontrado
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr key={lead.id}>
                    <td className="font-medium">{lead.name}</td>
                    <td>
                      <div className="text-sm">
                        {lead.email && <div>{lead.email}</div>}
                        {lead.whatsapp && <div className="text-muted-foreground">{lead.whatsapp}</div>}
                      </div>
                    </td>
                    <td>{lead.company || '-'}</td>
                    <td>
                      {lead.source ? (
                        <Badge 
                          className={sourceLabels[lead.source.toLowerCase()]?.color || 'bg-muted text-muted-foreground'} 
                          variant="secondary"
                        >
                          {sourceLabels[lead.source.toLowerCase()]?.label || lead.source}
                        </Badge>
                      ) : '-'}
                    </td>
                    <td>
                      {lead.temperature && temperatureIcons[lead.temperature]}
                    </td>
                    <td>
                      <Badge className={statusColors[lead.status]} variant="secondary">
                        {statusLabels[lead.status]}
                      </Badge>
                    </td>
                    <td className="text-sm text-muted-foreground">
                      {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        {lead.whatsapp && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setChatLeadId(lead.id)}
                            title="Abrir chat"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(lead)}>
                          Editar
                        </Button>
                        {lead.status !== 'converted' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => convertMutation.mutate(lead)}
                            disabled={convertMutation.isPending}
                          >
                            <UserPlus className="h-4 w-4 mr-1" />
                            Converter
                          </Button>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir Lead</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir o lead "{lead.name}"? Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(lead.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Chat Dialog */}
        <Dialog open={!!chatLeadId} onOpenChange={(open) => !open && setChatLeadId(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-green-500" />
                Chat com {chatLead?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col h-[400px]">
              <ScrollArea className="flex-1 p-4 border rounded-lg mb-4">
                {leadMessages.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma mensagem ainda
                  </p>
                ) : (
                  <div className="space-y-3">
                    {leadMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] p-3 rounded-lg ${
                            msg.direction === 'outbound'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <p className="text-sm">{msg.message}</p>
                          <p className="text-xs opacity-70 mt-1">
                            {new Date(msg.created_at).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
              <div className="flex gap-2">
                <Input
                  placeholder="Digite sua mensagem..."
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && chatLead) {
                      e.preventDefault();
                      handleSendMessage(chatLead);
                    }
                  }}
                />
                <Button
                  onClick={() => chatLead && handleSendMessage(chatLead)}
                  disabled={!chatMessage.trim() || sendMessageMutation.isPending}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
