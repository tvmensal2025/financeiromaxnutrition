import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Flame, Snowflake, ThermometerSun, UserPlus, MessageCircle, Trash2, Users } from 'lucide-react';

// Import utilities and hooks
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useLeads, type Lead, type LeadStatus, type LeadTemperature } from '@/hooks/queries/useLeads';
import { useProducts } from '@/hooks/queries/useProducts';
import { useServices } from '@/hooks/queries/useServices';
import { useCreateLead, useUpdateLead, useDeleteLead } from '@/hooks/mutations/useLeadMutations';
import { useConvertLead, useSendLeadMessage } from '@/hooks/mutations/useLeadSpecificMutations';
import { DataTable, type Column } from '@/components/common/DataTable';
import { LoadingState } from '@/components/common/LoadingState';
import { EmptyState } from '@/components/common/EmptyState';
import { LeadFormDialog, type LeadFormData, LeadChatDialog } from '@/components/leads';

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
  const [chatLead, setChatLead] = useState<Lead | null>(null);

  // Use custom hooks instead of inline queries
  const { data: leads = [], isLoading } = useLeads();
  const { data: products = [] } = useProducts();
  const { data: services = [] } = useServices();

  // Query messages for the selected lead - moved to LeadChatDialog component

  // Use custom mutation hooks instead of inline mutations
  const createLead = useCreateLead();
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();
  const convertLead = useConvertLead();
  const sendLeadMessage = useSendLeadMessage();

  const resetForm = () => {
    setEditingLead(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (lead: Lead) => {
    setEditingLead(lead);
    setIsDialogOpen(true);
  };

  const handleFormSubmit = (data: LeadFormData) => {
    const leadData = {
      name: data.name,
      email: data.email || undefined,
      phone: data.phone || undefined,
      whatsapp: data.whatsapp || undefined,
      company: data.company || undefined,
      source: data.source || undefined,
      status: data.status,
      temperature: data.temperature,
      notes: data.notes || undefined,
      interest_type: data.interest_type,
      interested_product_id: data.interest_type === 'product' && data.interested_product_id ? data.interested_product_id : undefined,
      interested_service_id: data.interest_type === 'service' && data.interested_service_id ? data.interested_service_id : undefined,
      interest_is_recurring: data.interest_is_recurring,
      recurring_due_date: data.interest_is_recurring && data.recurring_due_date ? data.recurring_due_date : undefined,
      recurring_message_time: data.interest_is_recurring ? data.recurring_message_time : undefined,
      recurring_reminder_days: data.interest_is_recurring ? data.recurring_reminder_days : undefined,
      recurring_message_type: data.interest_is_recurring ? data.recurring_message_type : undefined,
      recurring_reminder_template: data.interest_is_recurring ? data.recurring_reminder_template || undefined : undefined,
      recurring_overdue_template: data.interest_is_recurring ? data.recurring_overdue_template || undefined : undefined,
    };

    if (editingLead) {
      updateLead.mutate({ id: editingLead.id, data: leadData }, {
        onSuccess: () => resetForm(),
      });
    } else {
      createLead.mutate(leadData, {
        onSuccess: () => resetForm(),
      });
    }
  };

  const handleSendMessage = (lead: Lead, message: string) => {
    sendLeadMessage.mutate({
      leadId: lead.id,
      phone: lead.whatsapp!,
      message,
    });
  };

  const handleConvertLead = (lead: Lead) => {
    convertLead.mutate(lead, {
      onSuccess: (customer) => {
        // Redirect to subscriptions page with customer pre-selected
        navigate(`/assinaturas?customer_id=${customer.id}`);
      },
    });
  };

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

  // DataTable columns configuration
  const columns: Column<Lead>[] = [
    {
      key: 'name',
      header: 'Nome',
      accessor: 'name',
      render: (value) => <span className="font-medium">{value}</span>,
    },
    {
      key: 'contact',
      header: 'Contato',
      accessor: (lead) => ({ email: lead.email, whatsapp: lead.whatsapp }),
      render: (value: any) => (
        <div className="text-sm">
          {value.email && <div>{value.email}</div>}
          {value.whatsapp && <div className="text-muted-foreground">{value.whatsapp}</div>}
        </div>
      ),
    },
    {
      key: 'company',
      header: 'Empresa',
      accessor: 'company',
      render: (value) => value || '-',
    },
    {
      key: 'source',
      header: 'Origem',
      accessor: 'source',
      render: (value: string | null) => {
        if (!value) return '-';
        const sourceInfo = sourceLabels[value.toLowerCase()];
        return (
          <Badge 
            className={sourceInfo?.color || 'bg-muted text-muted-foreground'} 
            variant="secondary"
          >
            {sourceInfo?.label || value}
          </Badge>
        );
      },
    },
    {
      key: 'temperature',
      header: 'Temperatura',
      accessor: 'temperature',
      render: (value: LeadTemperature | null) => value ? temperatureIcons[value] : null,
    },
    {
      key: 'status',
      header: 'Status',
      accessor: 'status',
      render: (value: LeadStatus) => (
        <Badge className={statusColors[value]} variant="secondary">
          {statusLabels[value]}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      header: 'Criado em',
      accessor: 'created_at',
      render: (value: string) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(value)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Ações',
      accessor: (lead) => lead,
      render: (_, lead: Lead) => (
        <div className="flex items-center gap-2">
          {lead.whatsapp && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setChatLead(lead)}
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
              onClick={() => handleConvertLead(lead)}
              disabled={convertLead.isPending}
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
                  onClick={() => deleteLead.mutate(lead.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ),
    },
  ];

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
          <LeadFormDialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}
            editingLead={editingLead}
            products={products}
            services={services}
            onSubmit={handleFormSubmit}
            isLoading={createLead.isPending || updateLead.isPending}
          />
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
          <DataTable
            columns={columns}
            data={filteredLeads}
            isLoading={isLoading}
            rowKey="id"
            emptyState={{
              icon: Users,
              title: 'Nenhum lead encontrado',
              description: 'Não há leads que correspondam aos filtros selecionados.',
            }}
          />
        </div>

        {/* Chat Dialog */}
        <LeadChatDialog
          lead={chatLead}
          onClose={() => setChatLead(null)}
          onSendMessage={handleSendMessage}
          isSending={sendLeadMessage.isPending}
        />
      </div>
    </MainLayout>
  );
}
