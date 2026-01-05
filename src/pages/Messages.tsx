import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
import { Plus, MessageSquare, Send, Loader2, ExternalLink, Clock, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface Message {
  id: string;
  content: string;
  status: string;
  message_type: string;
  sent_at: string | null;
  created_at: string;
  customer_id: string;
  customers: {
    name: string;
    whatsapp: string | null;
  } | null;
}

interface Customer {
  id: string;
  name: string;
  whatsapp: string | null;
}

export default function Messages() {
  const { business } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    customer_id: '',
    content: '',
  });

  const { data: messages, isLoading } = useQuery({
    queryKey: ['messages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          customers (name, whatsapp)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as Message[];
    },
  });

  const { data: customers } = useQuery({
    queryKey: ['customers-with-whatsapp'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, whatsapp')
        .not('whatsapp', 'is', null)
        .order('name');

      if (error) throw error;
      return data as Customer[];
    },
  });

  const sendMessageFn = async (customerId: string, content: string) => {
    const customer = customers?.find((c) => c.id === customerId);
    const webhookUrl = business?.n8n_webhook_url;
    
    // Se tem webhook configurado, usar edge function
    if (webhookUrl) {
      const response = await supabase.functions.invoke('send-whatsapp', {
        body: {
          customer_id: customerId,
          content: content,
          business_id: business?.id,
          webhook_url: webhookUrl,
        },
      });

      if (response.error) throw response.error;
      return { viaWebhook: true, data: response.data };
    }

    // Caso contrário, registrar e abrir WhatsApp manualmente
    const { error } = await supabase.from('messages').insert({
      customer_id: customerId,
      content: content,
      message_type: 'whatsapp',
      status: 'pending',
      business_id: business?.id,
    });
    if (error) throw error;

    // Open WhatsApp with the message
    if (customer?.whatsapp) {
      const phone = customer.whatsapp.replace(/\D/g, '');
      const encodedMessage = encodeURIComponent(content);
      window.open(`https://wa.me/${phone}?text=${encodedMessage}`, '_blank');
    }
    return { viaWebhook: false };
  };

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return sendMessageFn(data.customer_id, data.content);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      if (result?.viaWebhook) {
        toast({ title: 'Mensagem enviada!', description: 'Enviada automaticamente via n8n.' });
      } else {
        toast({ title: 'Mensagem registrada!', description: 'WhatsApp aberto para envio.' });
      }
      resetForm();
    },
    onError: () => {
      toast({ title: 'Erro ao enviar mensagem', variant: 'destructive' });
    },
  });

  const resendMutation = useMutation({
    mutationFn: async (message: Message) => {
      const customer = customers?.find((c) => c.id === message.customer_id);
      const webhookUrl = business?.n8n_webhook_url;
      
      // Open WhatsApp directly with the message content
      if (customer?.whatsapp) {
        const phone = customer.whatsapp.replace(/\D/g, '');
        const encodedMessage = encodeURIComponent(message.content);
        window.open(`https://wa.me/${phone}?text=${encodedMessage}`, '_blank');
      }
      
      return { viaWebhook: !!webhookUrl };
    },
    onSuccess: () => {
      toast({ title: 'WhatsApp aberto!', description: 'Reenvie a mensagem pelo app.' });
    },
    onError: () => {
      toast({ title: 'Erro ao reenviar mensagem', variant: 'destructive' });
    },
  });

  const markAsSentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('messages')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      toast({ title: 'Mensagem marcada como enviada!' });
    },
  });

  const resetForm = () => {
    setFormData({ customer_id: '', content: '' });
    setIsDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'sent':
        return { label: 'Enviada', icon: CheckCircle, className: 'text-success' };
      case 'failed':
        return { label: 'Falhou', icon: XCircle, className: 'text-destructive' };
      default:
        return { label: 'Pendente', icon: Clock, className: 'text-warning' };
    }
  };

  const selectedCustomer = customers?.find((c) => c.id === formData.customer_id);

  // Message templates
  const templates = [
    { label: 'Lembrete de Renovação', content: 'Olá! Sua assinatura está próxima do vencimento. Entre em contato conosco para renovar e continuar aproveitando todos os benefícios!' },
    { label: 'Boas-vindas', content: 'Bem-vindo(a)! Estamos felizes em tê-lo(a) conosco. Qualquer dúvida, estamos à disposição!' },
    { label: 'Créditos Baixos', content: 'Olá! Notamos que seus créditos estão acabando. Que tal renovar sua assinatura para continuar aproveitando nossos serviços?' },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Mensagens</h1>
            <p className="text-muted-foreground mt-1">
              Envie mensagens por WhatsApp para seus clientes
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Mensagem
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Nova Mensagem WhatsApp</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
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
                          <div className="flex items-center gap-2">
                            <span>{customer.name}</span>
                            <span className="text-muted-foreground text-xs">
                              {customer.whatsapp}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!customers?.length && (
                    <p className="text-xs text-muted-foreground">
                      Nenhum cliente com WhatsApp cadastrado
                    </p>
                  )}
                </div>

                {/* Templates */}
                <div className="space-y-2">
                  <Label>Modelos Rápidos</Label>
                  <div className="flex flex-wrap gap-2">
                    {templates.map((template) => (
                      <Button
                        key={template.label}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setFormData({ ...formData, content: template.content })}
                      >
                        {template.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content">Mensagem *</Label>
                  <Textarea
                    id="content"
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="Digite sua mensagem..."
                    rows={5}
                    required
                  />
                </div>

                {selectedCustomer && (
                  <div className="p-3 bg-muted rounded-lg text-sm">
                    <p className="text-muted-foreground">
                      Ao enviar, o WhatsApp será aberto com a mensagem para:
                    </p>
                    <p className="font-medium text-foreground mt-1">
                      {selectedCustomer.name} ({selectedCustomer.whatsapp})
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending || !formData.customer_id || !formData.content}
                  >
                    {createMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    Enviar pelo WhatsApp
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Messages List */}
        <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !messages?.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhuma mensagem enviada</p>
              <p className="text-sm text-muted-foreground/60 mt-1">
                Envie sua primeira mensagem pelo WhatsApp
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {messages.map((message) => {
                const statusInfo = getStatusInfo(message.status);
                const StatusIcon = statusInfo.icon;

                return (
                  <div key={message.id} className="p-4 hover:bg-muted/30 transition-colors animate-fade-in">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-foreground">
                            {message.customers?.name || 'Cliente'}
                          </span>
                          {message.customers?.whatsapp && (
                            <a
                              href={`https://wa.me/${message.customers.whatsapp.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-success hover:underline flex items-center gap-1"
                            >
                              <MessageSquare className="h-3 w-3" />
                              {message.customers.whatsapp}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {message.content}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span>
                            Criada em {format(new Date(message.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                          </span>
                          {message.sent_at && (
                            <span>
                              Enviada em {format(new Date(message.sent_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn('flex items-center gap-1', statusInfo.className)}>
                          <StatusIcon className="h-3 w-3" />
                          {statusInfo.label}
                        </Badge>
                        {message.status === 'pending' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => markAsSentMutation.mutate(message.id)}
                          >
                            Marcar Enviada
                          </Button>
                        )}
                        {message.status === 'sent' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => resendMutation.mutate(message)}
                            disabled={resendMutation.isPending}
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Reenviar
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
