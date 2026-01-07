import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Bot, Save, Loader2, Phone, Sparkles, Plus, X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface AISettings {
  id?: string;
  business_id: string;
  admin_phone: string;
  admin_phones: string[];
  enabled: boolean;
  auto_transcribe: boolean;
  auto_respond: boolean;
  greeting_style: string;
  default_categories: string[];
}

export function AIAssistantSettings() {
  const { business } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['ai-settings', business?.id],
    queryFn: async () => {
      if (!business?.id) return null;
      
      const { data, error } = await supabase
        .from('ai_settings')
        .select('*')
        .eq('business_id', business.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as AISettings | null;
    },
    enabled: !!business?.id,
  });

  const [formData, setFormData] = useState<Partial<AISettings>>({
    admin_phones: [],
    enabled: false,
    auto_transcribe: true,
    auto_respond: true,
    greeting_style: 'friendly',
    default_categories: ['Recebimentos', 'Vendas', 'Serviços', 'Pagamentos', 'Outros'],
  });

  const [newPhone, setNewPhone] = useState('');

  useEffect(() => {
    if (settings) {
      setFormData({
        admin_phones: settings.admin_phones || (settings.admin_phone ? [settings.admin_phone] : []),
        enabled: settings.enabled ?? false,
        auto_transcribe: settings.auto_transcribe ?? true,
        auto_respond: settings.auto_respond ?? true,
        greeting_style: settings.greeting_style || 'friendly',
        default_categories: settings.default_categories || ['Recebimentos', 'Vendas', 'Serviços', 'Pagamentos', 'Outros'],
      });
    }
  }, [settings]);

  const addPhone = () => {
    const cleanPhone = newPhone.replace(/\D/g, '');
    if (cleanPhone && cleanPhone.length >= 10 && !formData.admin_phones?.includes(cleanPhone)) {
      setFormData({
        ...formData,
        admin_phones: [...(formData.admin_phones || []), cleanPhone],
      });
      setNewPhone('');
    } else if (formData.admin_phones?.includes(cleanPhone)) {
      toast({ title: 'Número já adicionado', variant: 'destructive' });
    } else {
      toast({ title: 'Número inválido', description: 'O número deve ter pelo menos 10 dígitos', variant: 'destructive' });
    }
  };

  const removePhone = (phoneToRemove: string) => {
    setFormData({
      ...formData,
      admin_phones: formData.admin_phones?.filter(p => p !== phoneToRemove) || [],
    });
  };

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<AISettings>) => {
      if (!business?.id) throw new Error('Business not found');

      const payload = {
        business_id: business.id,
        admin_phones: data.admin_phones || [],
        admin_phone: data.admin_phones?.[0] || '', // Manter compatibilidade
        enabled: data.enabled,
        auto_transcribe: data.auto_transcribe,
        auto_respond: data.auto_respond,
        greeting_style: data.greeting_style,
        default_categories: data.default_categories,
      };

      if (settings?.id) {
        const { error } = await supabase
          .from('ai_settings')
          .update(payload)
          .eq('id', settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('ai_settings')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: 'Configurações da IA salvas!' });
      queryClient.invalidateQueries({ queryKey: ['ai-settings'] });
    },
    onError: (error) => {
      toast({ title: 'Erro ao salvar configurações', description: String(error), variant: 'destructive' });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border shadow-card p-6 space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Bot className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Assistente IA Completo</h2>
          <p className="text-sm text-muted-foreground">
            IA que gerencia todo o negócio via comandos de voz ou texto
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div className="space-y-0.5">
            <Label htmlFor="aiEnabled">Habilitar Assistente IA</Label>
            <p className="text-xs text-muted-foreground">
              Ativa a interpretação automática de áudios e textos
            </p>
          </div>
          <Switch
            id="aiEnabled"
            checked={formData.enabled}
            onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
          />
        </div>

        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Números Admin (WhatsApp)
          </Label>
          
          {/* Lista de números */}
          <div className="flex flex-wrap gap-2">
            {formData.admin_phones?.map((phone) => (
              <Badge key={phone} variant="secondary" className="flex items-center gap-1 py-1 px-3">
                {phone}
                <button
                  onClick={() => removePhone(phone)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {formData.admin_phones?.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum número adicionado</p>
            )}
          </div>

          {/* Input para adicionar novo número */}
          <div className="flex gap-2">
            <Input
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="5511999999999"
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPhone())}
            />
            <Button type="button" variant="outline" onClick={addPhone}>
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground">
            Números que podem enviar comandos para a IA. 
            Use o formato: código do país + DDD + número, sem espaços ou símbolos.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="autoTranscribe">Auto-transcrever áudios</Label>
              <p className="text-xs text-muted-foreground">
                Transcreve áudios automaticamente
              </p>
            </div>
            <Switch
              id="autoTranscribe"
              checked={formData.auto_transcribe}
              onCheckedChange={(checked) => setFormData({ ...formData, auto_transcribe: checked })}
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="autoRespond">Auto-responder</Label>
              <p className="text-xs text-muted-foreground">
                Envia resposta automática após interpretar
              </p>
            </div>
            <Switch
              id="autoRespond"
              checked={formData.auto_respond}
              onCheckedChange={(checked) => setFormData({ ...formData, auto_respond: checked })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="greetingStyle">Estilo de Resposta</Label>
          <Select
            value={formData.greeting_style}
            onValueChange={(value) => setFormData({ ...formData, greeting_style: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o estilo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="friendly">🤗 Amigável (com emojis)</SelectItem>
              <SelectItem value="formal">👔 Formal (profissional)</SelectItem>
              <SelectItem value="casual">😎 Casual (direto)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="p-4 bg-muted/50 rounded-lg space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <p className="text-sm font-medium text-foreground">Capacidades da IA:</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
          <div className="p-2 bg-background rounded border">
            <p className="font-medium">💰 Financeiro</p>
            <p className="text-muted-foreground">Receitas, despesas, cobranças</p>
          </div>
          <div className="p-2 bg-background rounded border">
            <p className="font-medium">👥 Clientes</p>
            <p className="text-muted-foreground">Cadastro, busca, atualização</p>
          </div>
          <div className="p-2 bg-background rounded border">
            <p className="font-medium">🎯 Leads</p>
            <p className="text-muted-foreground">Criar, qualificar, converter</p>
          </div>
          <div className="p-2 bg-background rounded border">
            <p className="font-medium">📊 Pipeline</p>
            <p className="text-muted-foreground">Oportunidades de venda</p>
          </div>
          <div className="p-2 bg-background rounded border">
            <p className="font-medium">📅 Agenda</p>
            <p className="text-muted-foreground">Criar, remarcar, cancelar</p>
          </div>
          <div className="p-2 bg-background rounded border">
            <p className="font-medium">📄 Faturas</p>
            <p className="text-muted-foreground">Gerar, cobrar, dar baixa</p>
          </div>
          <div className="p-2 bg-background rounded border">
            <p className="font-medium">🔄 Assinaturas</p>
            <p className="text-muted-foreground">Criar, pausar, cancelar</p>
          </div>
          <div className="p-2 bg-background rounded border">
            <p className="font-medium">📦 Catálogo</p>
            <p className="text-muted-foreground">Produtos e serviços</p>
          </div>
          <div className="p-2 bg-background rounded border">
            <p className="font-medium">🔍 Consultas</p>
            <p className="text-muted-foreground">Saldos, resumos, relatórios</p>
          </div>
        </div>
      </div>

      <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
        <p className="text-sm font-medium text-foreground">Exemplos de comandos:</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-sm text-muted-foreground">
          <p>💰 "Recebimento do José, 595 reais"</p>
          <p>👥 "Cadastrar cliente Maria, 11999999999"</p>
          <p>🎯 "Novo lead Pedro do Instagram, quente"</p>
          <p>📊 "Oportunidade pro José, 5000 do anual"</p>
          <p>📅 "Agendar Maria pra quinta 14h"</p>
          <p>📄 "Gerar fatura pro João, 1500"</p>
          <p>🔄 "Nova assinatura do Pedro, 99 mensal"</p>
          <p>🔍 "Quanto o José deve?"</p>
        </div>
      </div>

      <Button
        onClick={() => saveMutation.mutate(formData)}
        disabled={saveMutation.isPending}
      >
        {saveMutation.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Save className="mr-2 h-4 w-4" />
        )}
        Salvar Configurações
      </Button>
    </div>
  );
}
