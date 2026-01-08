import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Radio, Plus, Trash2, Play, Pause, Users, Send, Calendar, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface Campaign {
  id: string;
  name: string;
  message: string;
  media_url: string | null;
  scheduled_at: string | null;
  status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'cancelled';
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
}

interface Contact {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  type: 'lead' | 'customer';
}

export default function Broadcasts() {
  const { business, profile } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [step, setStep] = useState<'details' | 'recipients' | 'review'>('details');
  const [formData, setFormData] = useState({
    name: '',
    message: '',
    scheduledAt: '',
  });
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['broadcast-campaigns', business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('broadcast_campaigns')
        .select('*')
        .eq('business_id', business?.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Campaign[];
    },
    enabled: !!business?.id,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['all-contacts', business?.id],
    queryFn: async () => {
      const [leadsRes, customersRes] = await Promise.all([
        supabase.from('leads').select('id, name, phone, whatsapp').eq('business_id', business?.id),
        supabase.from('customers').select('id, name, phone, whatsapp').eq('business_id', business?.id),
      ]);

      const leads = (leadsRes.data || []).map(l => ({ ...l, type: 'lead' as const }));
      const customers = (customersRes.data || []).map(c => ({ ...c, type: 'customer' as const }));
      
      return [...leads, ...customers].filter(c => c.phone || c.whatsapp) as Contact[];
    },
    enabled: isDialogOpen && !!business?.id,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      // Create campaign
      const { data: campaign, error: campaignError } = await supabase
        .from('broadcast_campaigns')
        .insert({
          business_id: business?.id,
          name: formData.name,
          message: formData.message,
          scheduled_at: formData.scheduledAt ? new Date(formData.scheduledAt).toISOString() : null,
          status: formData.scheduledAt ? 'scheduled' : 'draft',
          total_recipients: selectedContacts.length,
          created_by: profile?.id,
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Create recipients
      const recipients = selectedContacts.map(contactId => {
        const contact = contacts.find(c => c.id === contactId);
        return {
          campaign_id: campaign.id,
          business_id: business?.id,
          phone: contact?.phone || contact?.whatsapp || '',
          name: contact?.name,
          customer_id: contact?.type === 'customer' ? contact.id : null,
          lead_id: contact?.type === 'lead' ? contact.id : null,
        };
      });

      const { error: recipientsError } = await supabase
        .from('broadcast_recipients')
        .insert(recipients);

      if (recipientsError) throw recipientsError;

      return campaign;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcast-campaigns'] });
      setIsDialogOpen(false);
      resetForm();
      toast.success('Campanha criada');
    },
    onError: () => toast.error('Erro ao criar campanha'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('broadcast_campaigns').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcast-campaigns'] });
      toast.success('Campanha removida');
    },
    onError: () => toast.error('Erro ao remover campanha'),
  });

  const startMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('broadcast_campaigns')
        .update({ status: 'sending' })
        .eq('id', id);
      if (error) throw error;
      
      // Trigger the broadcast processing function
      await supabase.functions.invoke('process-broadcast', { body: { campaignId: id } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcast-campaigns'] });
      toast.success('Transmissão iniciada');
    },
    onError: () => toast.error('Erro ao iniciar transmissão'),
  });

  const resetForm = () => {
    setFormData({ name: '', message: '', scheduledAt: '' });
    setSelectedContacts([]);
    setStep('details');
    setSearchTerm('');
  };

  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.phone || c.whatsapp || '').includes(searchTerm)
  );

  const toggleContact = (id: string) => {
    setSelectedContacts(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedContacts.length === filteredContacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(filteredContacts.map(c => c.id));
    }
  };

  const getStatusBadge = (status: Campaign['status']) => {
    const variants: Record<Campaign['status'], { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      draft: { variant: 'outline', label: 'Rascunho' },
      scheduled: { variant: 'secondary', label: 'Agendada' },
      sending: { variant: 'default', label: 'Enviando' },
      completed: { variant: 'default', label: 'Concluída' },
      cancelled: { variant: 'destructive', label: 'Cancelada' },
    };
    return <Badge variant={variants[status].variant}>{variants[status].label}</Badge>;
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Radio className="h-6 w-6 text-primary" />
              Transmissões em Massa
            </h1>
            <p className="text-muted-foreground">Envie mensagens para múltiplos contatos</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Campanha
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {step === 'details' && 'Detalhes da Campanha'}
                  {step === 'recipients' && 'Selecionar Destinatários'}
                  {step === 'review' && 'Revisar e Criar'}
                </DialogTitle>
              </DialogHeader>

              {step === 'details' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nome da Campanha *</Label>
                    <Input
                      placeholder="Ex: Promoção de Janeiro"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Mensagem *</Label>
                    <Textarea
                      placeholder="Digite a mensagem que será enviada..."
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="min-h-[120px]"
                    />
                    <p className="text-xs text-muted-foreground">
                      Use {'{nome}'} para personalizar com o nome do contato
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Agendar Envio (opcional)</Label>
                    <Input
                      type="datetime-local"
                      value={formData.scheduledAt}
                      onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button 
                      onClick={() => setStep('recipients')}
                      disabled={!formData.name || !formData.message}
                    >
                      Próximo
                    </Button>
                  </div>
                </div>
              )}

              {step === 'recipients' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Input
                      placeholder="Buscar contatos..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="flex-1"
                    />
                    <Button variant="outline" onClick={toggleAll}>
                      {selectedContacts.length === filteredContacts.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                    </Button>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    {selectedContacts.length} de {contacts.length} contatos selecionados
                  </div>

                  <ScrollArea className="h-[300px] border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12"></TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>Telefone</TableHead>
                          <TableHead>Tipo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredContacts.map((contact) => (
                          <TableRow key={contact.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedContacts.includes(contact.id)}
                                onCheckedChange={() => toggleContact(contact.id)}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{contact.name}</TableCell>
                            <TableCell>{contact.phone || contact.whatsapp}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {contact.type === 'lead' ? 'Lead' : 'Cliente'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setStep('details')}>Voltar</Button>
                    <Button 
                      onClick={() => setStep('review')}
                      disabled={selectedContacts.length === 0}
                    >
                      Próximo
                    </Button>
                  </div>
                </div>
              )}

              {step === 'review' && (
                <div className="space-y-4">
                  <Card>
                    <CardContent className="pt-6 space-y-4">
                      <div>
                        <Label className="text-muted-foreground">Campanha</Label>
                        <p className="font-medium">{formData.name}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Mensagem</Label>
                        <p className="text-sm bg-muted p-3 rounded-lg whitespace-pre-wrap">{formData.message}</p>
                      </div>
                      <div className="flex gap-8">
                        <div>
                          <Label className="text-muted-foreground">Destinatários</Label>
                          <p className="font-medium">{selectedContacts.length}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Agendamento</Label>
                          <p className="font-medium">
                            {formData.scheduledAt 
                              ? format(new Date(formData.scheduledAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                              : 'Enviar agora'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setStep('recipients')}>Voltar</Button>
                    <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                      <Send className="h-4 w-4 mr-2" />
                      {formData.scheduledAt ? 'Agendar Campanha' : 'Criar Campanha'}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-center py-8">Carregando...</p>
        ) : campaigns.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Radio className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">Nenhuma campanha criada</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Crie campanhas para enviar mensagens em massa
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeira Campanha
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {campaigns.map((campaign) => (
              <Card key={campaign.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-base">{campaign.name}</CardTitle>
                      {getStatusBadge(campaign.status)}
                    </div>
                    <div className="flex items-center gap-2">
                      {campaign.status === 'draft' && (
                        <Button size="sm" onClick={() => startMutation.mutate(campaign.id)}>
                          <Play className="h-4 w-4 mr-1" />
                          Iniciar
                        </Button>
                      )}
                      {campaign.status !== 'sending' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => deleteMutation.mutate(campaign.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <CardDescription>
                    {campaign.scheduled_at ? (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Agendada para {format(new Date(campaign.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Criada em {format(new Date(campaign.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {campaign.total_recipients} destinatários
                      </div>
                      <div className="flex items-center gap-1 text-green-500">
                        <CheckCircle2 className="h-4 w-4" />
                        {campaign.sent_count} enviadas
                      </div>
                      {campaign.failed_count > 0 && (
                        <div className="flex items-center gap-1 text-destructive">
                          <XCircle className="h-4 w-4" />
                          {campaign.failed_count} falhas
                        </div>
                      )}
                    </div>

                    {(campaign.status === 'sending' || campaign.status === 'completed') && (
                      <div className="space-y-1">
                        <Progress 
                          value={(campaign.sent_count / campaign.total_recipients) * 100} 
                          className="h-2"
                        />
                        <p className="text-xs text-muted-foreground text-right">
                          {Math.round((campaign.sent_count / campaign.total_recipients) * 100)}% concluído
                        </p>
                      </div>
                    )}

                    <p className="text-sm text-muted-foreground line-clamp-2 bg-muted/50 p-2 rounded">
                      {campaign.message}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
