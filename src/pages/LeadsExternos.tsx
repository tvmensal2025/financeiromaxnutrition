import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Users, UserCheck, TrendingUp, Clock, Download, CheckCircle, Search, Filter } from 'lucide-react';

interface LeadExterno {
  id: string;
  source: string;
  external_user_id: string | null;
  event_type: string | null;
  full_name: string | null;
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
}

export default function LeadsExternos() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
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

  const convertMutation = useMutation({
    mutationFn: async (leadId: string) => {
      const { error } = await supabase
        .from('leads_externos')
        .update({ 
          converted: true, 
          conversion_date: new Date().toISOString() 
        })
        .eq('id', leadId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads-externos'] });
      toast({ title: 'Lead marcado como convertido!' });
    },
    onError: () => {
      toast({ title: 'Erro ao converter lead', variant: 'destructive' });
    }
  });

  // Estatísticas
  const totalLeads = leads.length;
  const leadsHoje = leads.filter(l => {
    const today = new Date();
    const receivedDate = new Date(l.received_at);
    return receivedDate.toDateString() === today.toDateString();
  }).length;
  const convertidos = leads.filter(l => l.converted).length;
  const taxaConversao = totalLeads > 0 ? ((convertidos / totalLeads) * 100).toFixed(1) : '0';

  // Cidades únicas para filtro
  const cidades = [...new Set(leads.map(l => l.city).filter(Boolean))];

  // Filtrar leads
  const filteredLeads = leads.filter(lead => {
    const matchesSearch = !searchTerm || 
      lead.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.phone?.includes(searchTerm);
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'converted' && lead.converted) ||
      (statusFilter === 'pending' && !lead.converted);
    
    const matchesCity = cityFilter === 'all' || lead.city === cityFilter;

    return matchesSearch && matchesStatus && matchesCity;
  });

  // Exportar CSV
  const exportCSV = () => {
    const headers = ['Nome', 'Email', 'Telefone', 'Cidade', 'Estado', 'Peso Atual', 'Meta', 'Pontos', 'Data Cadastro', 'Status'];
    const rows = filteredLeads.map(l => [
      l.full_name || '',
      l.email || '',
      l.phone || '',
      l.city || '',
      l.state || '',
      l.current_weight_kg?.toString() || '',
      l.target_weight_kg?.toString() || '',
      l.points?.toString() || '',
      l.signup_date ? format(new Date(l.signup_date), 'dd/MM/yyyy') : '',
      l.converted ? 'Convertido' : 'Pendente'
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `leads-externos-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Leads Externos</h1>
            <p className="text-muted-foreground">Leads recebidos do app de saúde</p>
          </div>
          <Button onClick={exportCSV} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              <CardTitle className="text-sm font-medium">Leads Hoje</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{leadsHoje}</div>
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
        <Card>
          <CardContent className="pt-6">
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
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="converted">Convertidos</SelectItem>
                </SelectContent>
              </Select>
              <Select value={cityFilter} onValueChange={setCityFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Cidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as cidades</SelectItem>
                  {cidades.map(cidade => (
                    <SelectItem key={cidade} value={cidade!}>{cidade}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Leads */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Carregando...</div>
            ) : filteredLeads.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                Nenhum lead encontrado
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead>Peso Atual</TableHead>
                    <TableHead>Meta</TableHead>
                    <TableHead>Pontos</TableHead>
                    <TableHead>Cadastro</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">{lead.full_name || '-'}</TableCell>
                      <TableCell>{lead.email || '-'}</TableCell>
                      <TableCell>{lead.phone || '-'}</TableCell>
                      <TableCell>{lead.city ? `${lead.city}, ${lead.state}` : '-'}</TableCell>
                      <TableCell>{lead.current_weight_kg ? `${lead.current_weight_kg} kg` : '-'}</TableCell>
                      <TableCell>{lead.target_weight_kg ? `${lead.target_weight_kg} kg` : '-'}</TableCell>
                      <TableCell>{lead.points ?? 0}</TableCell>
                      <TableCell>
                        {lead.signup_date 
                          ? format(new Date(lead.signup_date), 'dd/MM/yyyy', { locale: ptBR })
                          : format(new Date(lead.received_at), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={lead.converted ? 'default' : 'secondary'}>
                          {lead.converted ? 'Convertido' : 'Pendente'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {!lead.converted && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => convertMutation.mutate(lead.id)}
                            disabled={convertMutation.isPending}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Converter
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
