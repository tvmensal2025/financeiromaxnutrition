import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format, addMonths, addWeeks, addYears } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserPlus } from 'lucide-react';
import { FormModal } from '@/components/common/FormModal';
import { formatCurrency } from '@/lib/formatters';

interface AddCustomerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phone: string;
  name?: string | null;
  email?: string | null;
  leadId?: string | null;
}

interface Plan {
  id: string;
  name: string;
  price: number;
  credits: number;
  billing_cycle: string;
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

  const [subscriptionData, setSubscriptionData] = useState({
    plan_id: '',
    quantity: 1,
    discount: 0,
  });

  // Reset subscription data when modal opens
  useEffect(() => {
    if (open) {
      setSubscriptionData({
        plan_id: '',
        quantity: 1,
        discount: 0,
      });
    }
  }, [open]);

  // Fetch products
  const { data: products } = useQuery({
    queryKey: ['products', business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price')
        .eq('business_id', business.id)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!business?.id && open,
  });

  // Fetch services
  const { data: services } = useQuery({
    queryKey: ['services', business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      const { data, error } = await supabase
        .from('services')
        .select('id, name, price')
        .eq('business_id', business.id)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!business?.id && open,
  });

  // Fetch plans
  const { data: plans } = useQuery({
    queryKey: ['plans', business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      const { data, error } = await supabase
        .from('plans')
        .select('id, name, price, credits, billing_cycle')
        .eq('business_id', business.id)
        .eq('is_active', true)
        .order('price');
      if (error) throw error;
      return data as Plan[];
    },
    enabled: !!business?.id && open,
  });

  // Calculate subscription values
  const selectedPlan = plans?.find((p) => p.id === subscriptionData.plan_id);
  const unitPrice = selectedPlan?.price || 0;
  const subtotal = unitPrice * subscriptionData.quantity;
  const totalValue = subtotal - subscriptionData.discount;
  const totalCredits = (selectedPlan?.credits || 0) * subscriptionData.quantity;

  const getEndDate = (startDate: Date, billingCycle: string) => {
    switch (billingCycle) {
      case 'weekly':
        return addWeeks(startDate, 1);
      case 'monthly':
        return addMonths(startDate, 1);
      case 'quarterly':
        return addMonths(startDate, 3);
      case 'yearly':
        return addYears(startDate, 1);
      default:
        return addMonths(startDate, 1);
    }
  };

  const mutation = useMutation({
    mutationFn: async (formData: any) => {
      if (!business?.id) throw new Error('Negócio não encontrado');

      // Create customer with interest info
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .insert({
          business_id: business.id,
          name: formData.name,
          email: formData.email || null,
          whatsapp: formData.whatsapp,
          phone: formData.phone,
          notes: formData.notes || null,
          interest_type: formData.interest_type || null,
          interested_product_id: formData.interest_type === 'product' ? formData.interested_product_id || null : null,
          interested_service_id: formData.interest_type === 'service' ? formData.interested_service_id || null : null,
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

        // Update whatsapp messages to point to customer and remove lead reference
        await supabase
          .from('whatsapp_messages')
          .update({ 
            customer_id: customer.id,
            lead_id: null,
          })
          .eq('lead_id', leadId);
      } else {
        // Update whatsapp messages for this phone
        await supabase
          .from('whatsapp_messages')
          .update({ customer_id: customer.id })
          .eq('phone', phone)
          .eq('business_id', business.id);
      }

      // Create subscription if interest_type is subscription
      if (formData.interest_type === 'subscription' && subscriptionData.plan_id && selectedPlan) {
        const startDate = new Date();
        const endDate = getEndDate(startDate, selectedPlan.billing_cycle);
        
        const { error: subscriptionError } = await supabase
          .from('subscriptions')
          .insert({
            business_id: business.id,
            customer_id: customer.id,
            plan_id: subscriptionData.plan_id,
            quantity: subscriptionData.quantity,
            unit_price: unitPrice,
            subtotal: subtotal,
            discount: subscriptionData.discount,
            total: totalValue,
            credits_total: totalCredits,
            credits_used: 0,
            start_date: format(startDate, 'yyyy-MM-dd'),
            end_date: format(endDate, 'yyyy-MM-dd'),
            status: 'active',
            auto_renew: false,
          });
        
        if (subscriptionError) throw subscriptionError;
      }

      return customer;
    },
    onSuccess: (_, formData) => {
      const message = formData.interest_type === 'subscription' && subscriptionData.plan_id
        ? `${formData.name} foi adicionado como cliente com assinatura.`
        : `${formData.name} foi adicionado como cliente.`;
      toast({
        title: leadId ? 'Lead convertido!' : 'Cliente adicionado!',
        description: message,
      });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
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

  const productOptions = products?.map(product => ({
    value: product.id,
    label: `${product.name} - ${formatCurrency(product.price)}`,
  })) || [];

  const serviceOptions = services?.map(service => ({
    value: service.id,
    label: `${service.name} - ${formatCurrency(service.price)}`,
  })) || [];

  const fields = [
    {
      name: 'name',
      label: 'Nome',
      type: 'text' as const,
      placeholder: 'Nome do cliente',
      required: true,
      defaultValue: name || '',
    },
    {
      name: 'email',
      label: 'Email',
      type: 'email' as const,
      placeholder: 'email@exemplo.com',
      defaultValue: email || '',
    },
    {
      name: 'phone',
      label: 'Telefone',
      type: 'text' as const,
      placeholder: '(11) 99999-9999',
      defaultValue: phone,
    },
    {
      name: 'whatsapp',
      label: 'WhatsApp',
      type: 'text' as const,
      placeholder: '5511999999999',
      defaultValue: phone,
    },
    {
      name: 'interest_type',
      label: 'Interesse em',
      type: 'select' as const,
      placeholder: 'Selecione o tipo de interesse (opcional)',
      options: [
        { value: 'none', label: 'Nenhum' },
        { value: 'product', label: 'Produto' },
        { value: 'service', label: 'Serviço' },
        { value: 'subscription', label: 'Assinatura' },
      ],
    },
    {
      name: 'interested_product_id',
      label: 'Produto',
      type: 'select' as const,
      placeholder: 'Selecione o produto',
      options: productOptions,
      visibleWhen: (data: any) => data.interest_type === 'product',
    },
    {
      name: 'interested_service_id',
      label: 'Serviço',
      type: 'select' as const,
      placeholder: 'Selecione o serviço',
      options: serviceOptions,
      visibleWhen: (data: any) => data.interest_type === 'service',
    },
    {
      name: 'notes',
      label: 'Observações',
      type: 'textarea' as const,
      placeholder: 'Observações sobre o cliente...',
      rows: 2,
    },
  ];

  const renderSubscriptionSection = (formData: any) => {
    if (formData.interest_type !== 'subscription' || !plans || plans.length === 0) {
      return null;
    }

    return (
      <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
        <div className="space-y-2">
          <Label>Plano *</Label>
          <Select
            value={subscriptionData.plan_id}
            onValueChange={(value) => setSubscriptionData({ ...subscriptionData, plan_id: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um plano" />
            </SelectTrigger>
            <SelectContent>
              {plans.map((plan) => (
                <SelectItem key={plan.id} value={plan.id}>
                  {plan.name} - {formatCurrency(plan.price)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {subscriptionData.plan_id && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantidade</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={subscriptionData.quantity}
                  onChange={(e) => setSubscriptionData({ 
                    ...subscriptionData, 
                    quantity: parseInt(e.target.value) || 1 
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label>Valor Unitário</Label>
                <div className="h-10 px-3 flex items-center bg-muted rounded-md text-muted-foreground text-sm">
                  {formatCurrency(unitPrice)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Subtotal</Label>
                <div className="h-10 px-3 flex items-center bg-muted rounded-md text-muted-foreground text-sm">
                  {formatCurrency(subtotal)}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="discount">Desconto (R$)</Label>
                <Input
                  id="discount"
                  type="number"
                  min="0"
                  step="0.01"
                  max={subtotal}
                  value={subscriptionData.discount}
                  onChange={(e) => setSubscriptionData({ 
                    ...subscriptionData, 
                    discount: parseFloat(e.target.value) || 0 
                  })}
                />
              </div>
            </div>

            <div className="bg-primary/5 rounded-lg p-3 flex justify-between items-center">
              <div>
                <span className="text-sm text-muted-foreground">Valor Final:</span>
                <p className="text-xs text-muted-foreground">{totalCredits} créditos</p>
              </div>
              <span className="text-xl font-bold text-primary">
                {formatCurrency(totalValue)}
              </span>
            </div>
          </>
        )}
      </div>
    );
  };

  const customValidation = (formData: any) => {
    if (formData.interest_type === 'subscription' && !subscriptionData.plan_id) {
      return { subscription: 'Selecione um plano para a assinatura' };
    }
    return {};
  };

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={leadId ? 'Converter para Cliente' : 'Adicionar Cliente'}
      description={
        leadId
          ? 'Preencha os dados para converter este lead em cliente.'
          : 'Preencha os dados para adicionar este contato como cliente.'
      }
      icon={UserPlus}
      fields={fields}
      onSubmit={mutation.mutate}
      submitLabel={leadId ? 'Converter' : 'Adicionar'}
      isLoading={mutation.isPending}
      customValidation={customValidation}
      className="sm:max-w-md max-h-[90vh] overflow-y-auto"
    >
      {renderSubscriptionSection}
    </FormModal>
  );
}
