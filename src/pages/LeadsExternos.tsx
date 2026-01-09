import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Users, UserCheck, TrendingUp, Download, Search, MessageCircle, ChevronRight, Mail, Phone, MapPin } from 'lucide-react';

interface LeadExterno {
  id: string;
  source: string;
  external_user_id: string | null;
  event_type: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  birth_date: string | null;
  gender: string | null;
  height_cm: number | null;
  current_weight_kg: number | null;
  target_weight_kg: number | null;
  activity_level: string | null;
  fitness_level: string | null;
  points: number | null;
  signup_date: string | null;
  raw_payload: Record<string, unknown> | null;
  received_at: string;
  converted: boolean;
  conversion_date: string | null;
  notes: string | null;
  stage: string | null;
  // New fields
  age: number | null;
  country: string | null;
  last_activity: string | null;
  cpf: string | null;
  address: string | null;
  neighborhood: string | null;
  zip_code: string | null;
  company_name: string | null;
  occupation: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
}

type LeadStage = 'new' | 'contacted' | 'interested' | 'proposal' | 'negotiation' | 'converted' | 'lost';

const stageConfig: Record<LeadStage, { label: string; color: string; bgColor: string }> = {
  new: { label: 'Novo', color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200' },
  contacted: { label: 'Contactado', color: 'text-purple-700', bgColor: 'bg-purple-50 border-purple-200' },
  interested: { label: 'Interessado', color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200' },
  proposal: { label: 'Proposta', color: 'text-orange-700', bgColor: 'bg-orange-50 border-orange-200' },
  negotiation: { label: 'Negociação', color: 'text-cyan-700', bgColor: 'bg-cyan-50 border-cyan-200' },
  converted: { label: 'Convertido', color: 'text-green-700', bgColor: 'bg-green-50 border-green-200' },
  lost: { label: 'Perdido', color: 'text-red-700', bgColor: 'bg-red-50 border-red-200' },
};

const stages: LeadStage[] = ['new', 'contacted', 'interested', 'proposal', 'negotiation', 'converted', 'lost'];

export default function LeadsExternos() {
  const { toast } = useToast();
  const { business } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [cityFilter, setCityFilter] = useState<string>('all');

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads-externos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads_externos')
        .select('*')
        .order('received_at', { ascending: false });
      
      if (error) throw error;
      return data as LeadExterno[];
    }
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: LeadStage }) => {
      const updateData: { stage: string; converted?: boolean; conversion_date?: string } = { stage };
      
      if (stage === 'converted') {
        updateData.converted = true;
        updateData.conversion_date = new Date().toISOString();
      }
      
      const { error } = await supabase
        .from('leads_externos')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads-externos'] });
      toast({ title: 'Lead atualizado!' });
    },
    onError: () => {
      toast({ title: 'Erro ao atualizar lead', variant: 'destructive' });
    }
  });

  // Converter lead externo em cliente
  const convertToCustomerMutation = useMutation({
    mutationFn: async (lead: LeadExterno) => {
      if (!business?.id) throw new Error('Business não encontrado');

      // 1. Criar cliente com TODAS as informações do lead
      // Using type assertion because new columns may not be in generated types yet
      const customerData = {
        business_id: business.id,
        name: lead.full_name || lead.first_name || 'Cliente sem nome',
        email: lead.email || null,
        phone: lead.phone || null,
        whatsapp: lead.phone || null,
        notes: `Convertido de lead externo - ${lead.source}\n${lead.notes || ''}`,
        city: lead.city,
        state: lead.state,
        birth_date: lead.birth_date,
        gender: lead.gender,
        height_cm: lead.height_cm,
        current_weight_kg: lead.current_weight_kg,
        target_weight_kg: lead.target_weight_kg,
        activity_level: lead.activity_level,
        fitness_level: lead.fitness_level,
        points: lead.points,
        source: lead.source,
        lead_data: lead.raw_payload,
        // New fields for complete data transfer
        age: lead.age,
        country: lead.country,
        last_activity: lead.last_activity,
        cpf: lead.cpf,
        address: lead.address,
        neighborhood: lead.neighborhood,
        zip_code: lead.zip_code,
        company_name: lead.company_name,
        occupation: lead.occupation,
        utm_source: lead.utm_source,
        utm_medium: lead.utm_medium,
        utm_campaign: lead.utm_campaign,
      };
      
      const { error: customerError } = await supabase
        .from('customers')
        .insert(customerData as any);
      
      if (customerError) throw customerError;

      // 2. Marcar lead como convertido
      const { error: leadError } = await supabase
        .from('leads_externos')
        .update({
          stage: 'converted',
          converted: true,
          conversion_date: new Date().toISOString()
        })
        .eq('id', lead.id);
      
      if (leadError) throw leadError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads-externos'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: 'Lead convertido em cliente com sucesso!' });
    },
    onError: () => {
      toast({ title: 'Erro ao converter lead', variant: 'destructive' });
    }
  });

  // Estatísticas
  const totalLeads = leads.length;
  const convertidos = leads.filter(l => l.stage === 'converted').length;
  const taxaConversao = totalLeads > 0 ? ((convertidos / totalLeads) * 100).toFixed(1) : '0';

  // Cidades únicas para filtro
  const cidades = [...new Set(leads.map(l => l.city).filter(Boolean))];

  // Filtrar leads
  const filteredLeads = leads.filter(lead => {
    const matchesSearch = !searchTerm || 
      lead.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.phone?.includes(searchTerm);
    
    const matchesCity = cityFilter === 'all' || lead.city === cityFilter;

    return matchesSearch && matchesCity;
  });

  // Agrupar leads por stage
  const leadsByStage = stages.reduce((acc, stage) => {
    acc[stage] = filteredLeads.filter(l => (l.stage || 'new') === stage);
    return acc;
  }, {} as Record<LeadStage, LeadExterno[]>);

  // Mover lead para próxima etapa
  const moveToNextStage = (lead: LeadExterno) => {
    const currentStage = (lead.stage || 'new') as LeadStage;
    const currentIndex = stages.indexOf(currentStage);
    if (currentIndex < stages.length - 2) { // Não passa de negotiation direto para lost
      const nextStage = stages[currentIndex + 1];
      updateStageMutation.mutate({ id: lead.id, stage: nextStage });
    }
  };

  // Exportar CSV
  const exportCSV = () => {
    const headers = ['Nome', 'Email', 'Telefone', 'Cidade', 'Estado', 'Peso Atual', 'Meta', 'Etapa', 'Data Cadastro'];
    const rows = filteredLeads.map(l => [
      l.full_name || '',
      l.email || '',
      l.phone || '',
      l.city || '',
      l.state || '',
      l.current_weight_kg?.toString() || '',
      l.target_weight_kg?.toString() || '',
      stageConfig[(l.stage || 'new') as LeadStage]?.label || 'Novo',
      l.signup_date ? format(new Date(l.signup_date), 'dd/MM/yyyy') : '',
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `leads-externos-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const openWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    navigate(`/mensagens?phone=${cleanPhone}`);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Pipeline de Leads</h1>
            <p className="text-muted-foreground">Gerencie o fluxo dos seus leads externos</p>
          </div>
          <Button onClick={exportCSV} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Leads</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalLeads}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Convertidos</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{convertidos}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{taxaConversao}%</div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder="Filtrar por cidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as cidades</SelectItem>
              {cidades.map(cidade => (
                <SelectItem key={cidade} value={cidade!}>{cidade}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Kanban Board */}
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando...</div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {stages.map((stage) => {
              const config = stageConfig[stage];
              const stageLeads = leadsByStage[stage];
              
              return (
                <div key={stage} className="flex-shrink-0 w-[300px]">
                  <div className={`rounded-lg border ${config.bgColor} p-3 mb-3`}>
                    <div className="flex items-center justify-between">
                      <h3 className={`font-semibold ${config.color}`}>{config.label}</h3>
                      <Badge variant="secondary" className="text-xs">
                        {stageLeads.length}
                      </Badge>
                    </div>
                  </div>
                  
                  <ScrollArea className="h-[calc(100vh-400px)]">
                    <div className="space-y-3 pr-2">
                      {stageLeads.map((lead) => (
                        <Card key={lead.id} className="cursor-pointer hover:shadow-md transition-shadow">
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="font-medium text-sm">
                                  {lead.full_name || 'Sem nome'}
                                </h4>
                                <p className="text-xs text-muted-foreground">
                                  {lead.source}
                                </p>
                              </div>
                              {lead.points && lead.points > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  {lead.points} pts
                                </Badge>
                              )}
                            </div>
                            
                            <div className="space-y-1 text-xs text-muted-foreground">
                              {lead.email && (
                                <div className="flex items-center gap-2">
                                  <Mail className="h-3 w-3" />
                                  <span className="truncate">{lead.email}</span>
                                </div>
                              )}
                              {lead.phone && (
                                <div className="flex items-center gap-2">
                                  <Phone className="h-3 w-3" />
                                  <span>{lead.phone}</span>
                                </div>
                              )}
                              {lead.city && (
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-3 w-3" />
                                  <span>{lead.city}, {lead.state}</span>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2 pt-2 border-t">
                              {lead.phone && (
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="flex-1 h-8 text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openWhatsApp(lead.phone!);
                                  }}
                                >
                                  <MessageCircle className="h-3 w-3 mr-1" />
                                  WhatsApp
                                </Button>
                              )}
                              {stage !== 'converted' && stage !== 'lost' && (
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="h-8 px-2"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    moveToNextStage(lead);
                                  }}
                                  disabled={updateStageMutation.isPending}
                                >
                                  <ChevronRight className="h-4 w-4" />
                                </Button>
                              )}
                            </div>

                            {stage !== 'converted' && stage !== 'lost' && (
                              <div className="flex gap-1 pt-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1 h-7 text-xs text-green-600 hover:bg-green-50"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    convertToCustomerMutation.mutate(lead);
                                  }}
                                  disabled={convertToCustomerMutation.isPending}
                                >
                                  Converter
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1 h-7 text-xs text-red-600 hover:bg-red-50"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateStageMutation.mutate({ id: lead.id, stage: 'lost' });
                                  }}
                                  disabled={updateStageMutation.isPending}
                                >
                                  Perdido
                                </Button>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                      
                      {stageLeads.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          Nenhum lead
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
