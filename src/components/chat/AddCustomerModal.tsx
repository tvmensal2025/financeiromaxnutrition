import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, UserPlus } from 'lucide-react';

interface AddCustomerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phone: string;
  name?: string | null;
  email?: string | null;
  leadId?: string | null;
}

export function AddCustomerModal({
  open,
  onOpenChange,
  phone,
  name,
  email,
  leadId,
}: AddCustomerModalProps) {
  const { business } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: name || '',
    email: email || '',
    whatsapp: phone,
    phone: phone,
    notes: '',
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!business?.id) throw new Error('Negócio não encontrado');

      // Create customer
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .insert({
          business_id: business.id,
          name: formData.name,
          email: formData.email || null,
          whatsapp: formData.whatsapp,
          phone: formData.phone,
          notes: formData.notes || null,
        })
        .select()
        .single();

      if (customerError) throw customerError;

      // If converting from lead, update the lead
      if (leadId) {
        await supabase
          .from('leads')
          .update({ 
            converted_customer_id: customer.id,
            status: 'converted',
          })
          .eq('id', leadId);

        // Update whatsapp messages to point to customer
        await supabase
          .from('whatsapp_messages')
          .update({ customer_id: customer.id })
          .eq('lead_id', leadId);
      } else {
        // Update whatsapp messages for this phone
        await supabase
          .from('whatsapp_messages')
          .update({ customer_id: customer.id })
          .eq('phone', phone)
          .eq('business_id', business.id);
      }

      return customer;
    },
    onSuccess: () => {
      toast({
        title: leadId ? 'Lead convertido!' : 'Cliente adicionado!',
        description: `${formData.name} foi adicionado como cliente.`,
      });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] });
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Add customer error:', error);
      toast({
        title: 'Erro ao adicionar cliente',
        description: error instanceof Error ? error.message : 'Tente novamente',
        variant: 'destructive',
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            {leadId ? 'Converter para Cliente' : 'Adicionar Cliente'}
          </DialogTitle>
          <DialogDescription>
            {leadId
              ? 'Preencha os dados para converter este lead em cliente.'
              : 'Preencha os dados para adicionar este contato como cliente.'}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Nome do cliente"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="email@exemplo.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(11) 99999-9999"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                value={formData.whatsapp}
                onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                placeholder="5511999999999"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Observações sobre o cliente..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending || !formData.name}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {leadId ? 'Converter' : 'Adicionar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
