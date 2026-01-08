import { useSearchParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserPlus, TrendingUp, Users } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
import { Plus, Search, Flame, Snowflake, ThermometerSun, MessageCircle, Send, Package, Wrench, Trash2, DollarSign, Calendar, Edit, Phone, Mail, Loader2, Clock, Bell, ShoppingCart, Percent } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// Import existing pages for full content
import Leads from './Leads';
import Pipeline from './Pipeline';
import Customers from './Customers';

export default function CRM() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const currentTab = searchParams.get('tab') || 'leads';

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  // Redirect to actual pages for now - they have MainLayout already
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'leads') {
      // Stay on CRM page but show leads content
    } else if (tab === 'pipeline') {
      // Stay on CRM page but show pipeline content
    } else if (tab === 'clientes') {
      // Stay on CRM page but show customers content
    }
  }, [searchParams]);

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">CRM</h1>
          <p className="text-muted-foreground">Gerencie leads, pipeline e clientes</p>
        </div>

        <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="leads" className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Leads
            </TabsTrigger>
            <TabsTrigger value="pipeline" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Pipeline
            </TabsTrigger>
            <TabsTrigger value="clientes" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Clientes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="leads" className="mt-6">
            <LeadsContent />
          </TabsContent>
          <TabsContent value="pipeline" className="mt-6">
            <PipelineContent />
          </TabsContent>
          <TabsContent value="clientes" className="mt-6">
            <CustomersContent />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

// Leads Content Component
function LeadsContent() {
  const { business } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [temperatureFilter, setTemperatureFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

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
  }

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">{leads.length} leads</span>
        </p>
        <Button onClick={() => navigate('/leads')}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Lead
        </Button>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar leads..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="new">Novo</SelectItem>
            <SelectItem value="contacted">Contactado</SelectItem>
            <SelectItem value="qualified">Qualificado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">Carregando...</div>
        ) : filteredLeads.length === 0 ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">Nenhum lead encontrado</div>
        ) : (
          filteredLeads.slice(0, 9).map((lead) => (
            <div key={lead.id} className="bg-card rounded-xl border border-border p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/leads')}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {lead.temperature && temperatureIcons[lead.temperature]}
                  <h3 className="font-semibold">{lead.name}</h3>
                </div>
                <Badge className={statusColors[lead.status]}>{statusLabels[lead.status]}</Badge>
              </div>
              {lead.company && <p className="text-sm text-muted-foreground mb-2">{lead.company}</p>}
              {lead.email && <p className="text-xs text-muted-foreground">{lead.email}</p>}
            </div>
          ))
        )}
      </div>
      {filteredLeads.length > 9 && (
        <div className="text-center">
          <Button variant="outline" onClick={() => navigate('/leads')}>
            Ver todos os {filteredLeads.length} leads
          </Button>
        </div>
      )}
    </div>
  );
}

// Pipeline Content Component
function PipelineContent() {
  const { business } = useAuth();
  const navigate = useNavigate();

  type OpportunityStage = 'prospecting' | 'qualification' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';

  interface Opportunity {
    id: string;
    title: string;
    stage: OpportunityStage;
    value: number;
    probability: number | null;
    customers?: { name: string } | null;
  }

  const stageConfig: Record<OpportunityStage, { label: string; color: string }> = {
    prospecting: { label: 'Prospecção', color: 'text-blue-600' },
    qualification: { label: 'Qualificação', color: 'text-purple-600' },
    proposal: { label: 'Proposta', color: 'text-warning' },
    negotiation: { label: 'Negociação', color: 'text-orange-600' },
    closed_won: { label: 'Ganho', color: 'text-success' },
    closed_lost: { label: 'Perdido', color: 'text-destructive' },
  };

  const { data: opportunities = [], isLoading } = useQuery({
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

  const totalValue = opportunities
    .filter((o) => o.stage !== 'closed_lost')
    .reduce((sum, o) => sum + o.value, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">{opportunities.length} oportunidades</span>
            {' · '}
            <span className="text-success font-medium">
              {totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </p>
        </div>
        <Button onClick={() => navigate('/pipeline')}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Oportunidade
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">Carregando...</div>
        ) : opportunities.length === 0 ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">Nenhuma oportunidade encontrada</div>
        ) : (
          opportunities.slice(0, 6).map((opp) => (
            <div key={opp.id} className="bg-card rounded-xl border border-border p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/pipeline')}>
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold">{opp.title}</h3>
                <Badge variant="outline" className={stageConfig[opp.stage].color}>
                  {stageConfig[opp.stage].label}
                </Badge>
              </div>
              {opp.customers?.name && <p className="text-sm text-muted-foreground mb-2">{opp.customers.name}</p>}
              <p className="text-lg font-bold text-success">
                {opp.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
          ))
        )}
      </div>
      {opportunities.length > 6 && (
        <div className="text-center">
          <Button variant="outline" onClick={() => navigate('/pipeline')}>
            Ver todo o pipeline
          </Button>
        </div>
      )}
    </div>
  );
}

// Customers Content Component
function CustomersContent() {
  const { business } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  interface Customer {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    whatsapp: string | null;
    created_at: string;
  }

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers', business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('business_id', business.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Customer[];
    },
    enabled: !!business?.id,
  });

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">{customers.length} clientes</span>
        </p>
        <Button onClick={() => navigate('/clientes')}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Cliente
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar clientes..."
          className="pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">Carregando...</div>
        ) : filteredCustomers.length === 0 ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">Nenhum cliente encontrado</div>
        ) : (
          filteredCustomers.slice(0, 9).map((customer) => (
            <div key={customer.id} className="bg-card rounded-xl border border-border p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/clientes')}>
              <h3 className="font-semibold mb-1">{customer.name}</h3>
              {customer.email && <p className="text-sm text-muted-foreground">{customer.email}</p>}
              {customer.phone && <p className="text-xs text-muted-foreground">{customer.phone}</p>}
            </div>
          ))
        )}
      </div>
      {filteredCustomers.length > 9 && (
        <div className="text-center">
          <Button variant="outline" onClick={() => navigate('/clientes')}>
            Ver todos os {filteredCustomers.length} clientes
          </Button>
        </div>
      )}
    </div>
  );
}
