import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Building2, User, Palette, Save, Loader2 } from 'lucide-react';

export default function Settings() {
  const { business, profile, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [businessData, setBusinessData] = useState({
    name: business?.name || '',
    primary_color: business?.primary_color || '#3B82F6',
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

        {/* Profile Settings */}
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
