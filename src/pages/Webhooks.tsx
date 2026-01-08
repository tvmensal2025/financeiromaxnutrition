import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Webhook, Plus, Trash2, Copy, RefreshCw, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface WebhookType {
  id: string;
  name: string;
  url: string;
  type: 'inbound' | 'outbound';
  events: string[];
  is_active: boolean;
  secret_key: string | null;
  created_at: string;
}

interface WebhookLog {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  response_status: number | null;
  response_body: string | null;
  executed_at: string;
}

const AVAILABLE_EVENTS = [
  { value: 'message.received', label: 'Mensagem Recebida' },
  { value: 'message.sent', label: 'Mensagem Enviada' },
  { value: 'lead.created', label: 'Lead Criado' },
  { value: 'lead.converted', label: 'Lead Convertido' },
  { value: 'customer.created', label: 'Cliente Criado' },
  { value: 'invoice.created', label: 'Fatura Criada' },
  { value: 'invoice.paid', label: 'Fatura Paga' },
  { value: 'appointment.created', label: 'Agendamento Criado' },
  { value: 'appointment.confirmed', label: 'Agendamento Confirmado' },
];

export default function Webhooks() {
  const { business } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookType | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    type: 'outbound' as 'inbound' | 'outbound',
    events: [] as string[],
  });

  const { data: webhooks = [], isLoading } = useQuery({
    queryKey: ['webhooks', business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('webhooks')
        .select('*')
        .eq('business_id', business?.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as WebhookType[];
    },
    enabled: !!business?.id,
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['webhook-logs', business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('webhook_logs')
        .select('*')
        .eq('business_id', business?.id)
        .order('executed_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as WebhookLog[];
    },
    enabled: !!business?.id,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('webhooks').insert({
        business_id: business?.id,
        name: formData.name,
        url: formData.url,
        type: formData.type,
        events: formData.events,
        secret_key: crypto.randomUUID(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      setIsDialogOpen(false);
      resetForm();
      toast.success('Webhook criado');
    },
    onError: () => toast.error('Erro ao criar webhook'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('webhooks')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('webhooks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      toast.success('Webhook removido');
    },
    onError: () => toast.error('Erro ao remover webhook'),
  });

  const resetForm = () => {
    setFormData({ name: '', url: '', type: 'outbound', events: [] });
    setSelectedWebhook(null);
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('URL copiada');
  };

  const toggleEvent = (event: string) => {
    setFormData(prev => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter(e => e !== event)
        : [...prev.events, event],
    }));
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Webhook className="h-6 w-6 text-primary" />
              Webhooks
            </h1>
            <p className="text-muted-foreground">Gerencie integrações com sistemas externos</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Webhook
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Webhook</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input
                    placeholder="Ex: Integração CRM"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={formData.type} onValueChange={(v: 'inbound' | 'outbound') => setFormData({ ...formData, type: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="outbound">Outbound (Enviar dados)</SelectItem>
                      <SelectItem value="inbound">Inbound (Receber dados)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>URL *</Label>
                  <Input
                    placeholder="https://exemplo.com/webhook"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  />
                </div>

                {formData.type === 'outbound' && (
                  <div className="space-y-2">
                    <Label>Eventos</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {AVAILABLE_EVENTS.map((event) => (
                        <Button
                          key={event.value}
                          variant={formData.events.includes(event.value) ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => toggleEvent(event.value)}
                          className="justify-start text-xs"
                        >
                          {event.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                  <Button 
                    onClick={() => createMutation.mutate()} 
                    disabled={!formData.name || !formData.url || createMutation.isPending}
                  >
                    Criar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="webhooks">
          <TabsList>
            <TabsTrigger value="webhooks">Webhooks ({webhooks.length})</TabsTrigger>
            <TabsTrigger value="logs">Histórico ({logs.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="webhooks" className="space-y-4">
            {isLoading ? (
              <p className="text-muted-foreground text-center py-8">Carregando...</p>
            ) : webhooks.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Webhook className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">Nenhum webhook configurado</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Configure webhooks para integrar com outros sistemas
                  </p>
                  <Button onClick={() => setIsDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Primeiro Webhook
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {webhooks.map((webhook) => (
                  <Card key={webhook.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CardTitle className="text-base">{webhook.name}</CardTitle>
                          <Badge variant={webhook.type === 'inbound' ? 'secondary' : 'default'}>
                            {webhook.type === 'inbound' ? 'Entrada' : 'Saída'}
                          </Badge>
                          <Badge variant={webhook.is_active ? 'default' : 'outline'}>
                            {webhook.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={webhook.is_active}
                            onCheckedChange={(checked) => updateMutation.mutate({ id: webhook.id, is_active: checked })}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => deleteMutation.mutate(webhook.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <CardDescription className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-2 py-1 rounded">{webhook.url}</code>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyUrl(webhook.url)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-1">
                        {webhook.events.map((event) => (
                          <Badge key={event} variant="outline" className="text-xs">
                            {AVAILABLE_EVENTS.find(e => e.value === event)?.label || event}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="logs">
            <Card>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Webhook</TableHead>
                      <TableHead>Evento</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          Nenhum log encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      logs.map((log) => {
                        const webhook = webhooks.find(w => w.id === log.webhook_id);
                        return (
                          <TableRow key={log.id}>
                            <TableCell className="text-sm">
                              <div className="flex items-center gap-2">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                {format(new Date(log.executed_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">{webhook?.name || 'Desconhecido'}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {log.event_type}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {log.response_status && log.response_status >= 200 && log.response_status < 300 ? (
                                <div className="flex items-center gap-1 text-green-500">
                                  <CheckCircle2 className="h-4 w-4" />
                                  {log.response_status}
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 text-destructive">
                                  <XCircle className="h-4 w-4" />
                                  {log.response_status || 'Erro'}
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
