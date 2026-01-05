import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Building2, User, Palette, Save, Loader2, Webhook, Bell, Play } from 'lucide-react';

export default function Settings() {
  const { business, profile, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isTestingReminders, setIsTestingReminders] = useState(false);

  const [businessData, setBusinessData] = useState({
    name: business?.name || '',
    primary_color: business?.primary_color || '#3B82F6',
    n8n_webhook_url: business?.n8n_webhook_url || '',
    reminder_days_before: (business as any)?.reminder_days_before ?? 3,
    low_credits_threshold: (business as any)?.low_credits_threshold ?? 20,
    auto_reminders_enabled: (business as any)?.auto_reminders_enabled ?? false,
  });

  const [profileData, setProfileData] = useState({
    full_name: profile?.full_name || '',
  });

  const updateBusinessMutation = useMutation({
    mutationFn: async (data: typeof businessData) => {
      if (!business?.id) throw new Error('Negócio não encontrado');
      const { error } = await supabase
        .from('businesses')
        .update(data)
        .eq('id', business.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Configurações do negócio atualizadas!' });
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
    onError: () => {
      toast({ title: 'Erro ao atualizar configurações', variant: 'destructive' });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof profileData) => {
      if (!user?.id) throw new Error('Usuário não encontrado');
      const { error } = await supabase
        .from('profiles')
        .update(data)
        .eq('id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Perfil atualizado!' });
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
    onError: () => {
      toast({ title: 'Erro ao atualizar perfil', variant: 'destructive' });
    },
  });

  const testRemindersMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('auto-reminders');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({ 
        title: 'Verificação executada!',
        description: `Lembretes: ${data.results?.renewalReminders || 0}, Créditos baixos: ${data.results?.lowCreditsAlerts || 0}, Expirados: ${data.results?.expirationAlerts || 0}`,
      });
    },
    onError: (error) => {
      toast({ title: 'Erro ao executar verificação', description: String(error), variant: 'destructive' });
    },
  });

  return (
    <MainLayout>
      <div className="max-w-2xl space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie as configurações do seu negócio
          </p>
        </div>

        {/* Business Settings */}
        <div className="bg-card rounded-xl border border-border shadow-card p-6 space-y-6 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Negócio</h2>
              <p className="text-sm text-muted-foreground">
                Informações do seu negócio
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="businessName">Nome do Negócio</Label>
              <Input
                id="businessName"
                value={businessData.name}
                onChange={(e) => setBusinessData({ ...businessData, name: e.target.value })}
                placeholder="Nome da sua empresa"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="primaryColor">Cor Principal</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="primaryColor"
                  type="color"
                  value={businessData.primary_color}
                  onChange={(e) => setBusinessData({ ...businessData, primary_color: e.target.value })}
                  className="w-16 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={businessData.primary_color}
                  onChange={(e) => setBusinessData({ ...businessData, primary_color: e.target.value })}
                  placeholder="#3B82F6"
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Cor usada para white-label do sistema
              </p>
            </div>
          </div>
          
          <Button
            onClick={() => updateBusinessMutation.mutate(businessData)}
            disabled={updateBusinessMutation.isPending}
          >
            {updateBusinessMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar Negócio
          </Button>
        </div>

        {/* n8n Integration */}
        <div className="bg-card rounded-xl border border-border shadow-card p-6 space-y-6 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <Webhook className="h-5 w-5 text-success" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Integração n8n</h2>
              <p className="text-sm text-muted-foreground">
                Automação de envio de mensagens
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="n8nWebhook">URL do Webhook n8n</Label>
              <Input
                id="n8nWebhook"
                value={businessData.n8n_webhook_url}
                onChange={(e) => setBusinessData({ ...businessData, n8n_webhook_url: e.target.value })}
                placeholder="https://seu-n8n.com/webhook/..."
              />
              <p className="text-xs text-muted-foreground">
                Configure um workflow no n8n com trigger Webhook e cole a URL aqui para envio automático de mensagens WhatsApp
              </p>
            </div>
          </div>

          <div className="p-4 bg-muted/50 rounded-lg space-y-2">
            <p className="text-sm font-medium text-foreground">Como configurar:</p>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Crie um workflow no n8n com trigger "Webhook"</li>
              <li>Adicione nós para integrar com WhatsApp Business API ou Evolution API</li>
              <li>Copie a URL do webhook e cole acima</li>
              <li>As mensagens serão enviadas automaticamente pelo n8n</li>
            </ol>
          </div>

          <Button
            onClick={() => updateBusinessMutation.mutate(businessData)}
            disabled={updateBusinessMutation.isPending}
          >
            {updateBusinessMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar Integração
          </Button>
        </div>

        {/* Auto Reminders Settings */}
        <div className="bg-card rounded-xl border border-border shadow-card p-6 space-y-6 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
              <Bell className="h-5 w-5 text-warning" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Lembretes Automáticos</h2>
              <p className="text-sm text-muted-foreground">
                Notificações automáticas via WhatsApp
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="autoReminders">Habilitar Lembretes</Label>
                <p className="text-xs text-muted-foreground">
                  Enviar notificações automáticas para clientes
                </p>
              </div>
              <Switch
                id="autoReminders"
                checked={businessData.auto_reminders_enabled}
                onCheckedChange={(checked) => 
                  setBusinessData({ ...businessData, auto_reminders_enabled: checked })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reminderDays">Dias de Antecedência</Label>
              <Input
                id="reminderDays"
                type="number"
                min={1}
                max={30}
                value={businessData.reminder_days_before}
                onChange={(e) => setBusinessData({ 
                  ...businessData, 
                  reminder_days_before: parseInt(e.target.value) || 3 
                })}
              />
              <p className="text-xs text-muted-foreground">
                Enviar lembrete X dias antes da assinatura vencer
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lowCredits">Alerta de Créditos Baixos (%)</Label>
              <Input
                id="lowCredits"
                type="number"
                min={5}
                max={50}
                value={businessData.low_credits_threshold}
                onChange={(e) => setBusinessData({ 
                  ...businessData, 
                  low_credits_threshold: parseInt(e.target.value) || 20 
                })}
              />
              <p className="text-xs text-muted-foreground">
                Enviar alerta quando o cliente tiver menos de X% dos créditos
              </p>
            </div>
          </div>

          <div className="p-4 bg-muted/50 rounded-lg space-y-2">
            <p className="text-sm font-medium text-foreground">Tipos de notificação:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• <strong>Renovação:</strong> X dias antes da assinatura vencer</li>
              <li>• <strong>Créditos baixos:</strong> Quando restarem menos de X%</li>
              <li>• <strong>Expiração:</strong> Quando a assinatura expirar</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={() => updateBusinessMutation.mutate(businessData)}
              disabled={updateBusinessMutation.isPending}
            >
              {updateBusinessMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Salvar Configurações
            </Button>
            
            <Button
              variant="outline"
              onClick={() => testRemindersMutation.mutate()}
              disabled={testRemindersMutation.isPending || !businessData.auto_reminders_enabled}
            >
              {testRemindersMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Executar Agora
            </Button>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border shadow-card p-6 space-y-6 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Perfil</h2>
              <p className="text-sm text-muted-foreground">
                Suas informações pessoais
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={user?.email || ''}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                O email não pode ser alterado
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">Nome Completo</Label>
              <Input
                id="fullName"
                value={profileData.full_name}
                onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                placeholder="Seu nome"
              />
            </div>
          </div>

          <Button
            onClick={() => updateProfileMutation.mutate(profileData)}
            disabled={updateProfileMutation.isPending}
          >
            {updateProfileMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar Perfil
          </Button>
        </div>

        {/* White-label Info */}
        <div className="bg-card rounded-xl border border-border shadow-card p-6 space-y-4 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Palette className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">White-Label</h2>
              <p className="text-sm text-muted-foreground">
                Personalização para múltiplos negócios
              </p>
            </div>
          </div>

          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              O sistema está preparado para operar em modo white-label, permitindo que 
              cada negócio tenha sua própria identidade visual, logo e cores personalizadas.
            </p>
            <ul className="mt-3 text-sm text-muted-foreground space-y-1">
              <li>• Cada cadastro cria um negócio isolado</li>
              <li>• Dados completamente separados entre negócios</li>
              <li>• Personalização de cores e branding</li>
              <li>• Estrutura pronta para domínios personalizados</li>
            </ul>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
