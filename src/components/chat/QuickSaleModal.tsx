import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, ShoppingCart, Check, ArrowRight } from 'lucide-react';

interface QuickSaleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phone: string;
  name?: string | null;
  email?: string | null;
  leadId?: string | null;
  customerId?: string | null;
}

export function QuickSaleModal({
  open,
  onOpenChange,
  phone,
  name,
  email,
  leadId,
  customerId,
}: QuickSaleModalProps) {
  const { business } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    customerName: name || '',
    customerEmail: email || '',
    interest_type: '' as 'product' | 'service' | '',
    interested_product_id: '',
    interested_service_id: '',
    value: '',
    notes: '',
    createInvoice: false,
  });

  useEffect(() => {
    if (open) {
      setFormData({
        customerName: name || '',
        customerEmail: email || '',
        interest_type: '',
        interested_product_id: '',
        interested_service_id: '',
        value: '',
        notes: '',
        createInvoice: false,
      });
    }
  }, [open, name, email]);

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

  // Get selected item price
  const getSelectedPrice = () => {
    if (formData.interest_type === 'product' && formData.interested_product_id) {
      const product = products?.find(p => p.id === formData.interested_product_id);
      return product?.price || 0;
    }
    if (formData.interest_type === 'service' && formData.interested_service_id) {
      const service = services?.find(s => s.id === formData.interested_service_id);
      return service?.price || 0;
    }
    return 0;
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!business?.id) throw new Error('Negócio não encontrado');

      let customerIdToUse = customerId;
      const value = parseFloat(formData.value) || getSelectedPrice();

      // Step 1: Create customer if needed (converting from lead or new)
      if (!customerIdToUse) {
        const { data: customer, error: customerError } = await supabase
          .from('customers')
          .insert({
            business_id: business.id,
            name: formData.customerName,
            email: formData.customerEmail || null,
            whatsapp: phone,
            phone: phone,
            notes: formData.notes || null,
            interest_type: formData.interest_type || null,
            interested_product_id: formData.interest_type === 'product' ? formData.interested_product_id || null : null,
            interested_service_id: formData.interest_type === 'service' ? formData.interested_service_id || null : null,
          })
          .select()
          .single();

        if (customerError) throw customerError;
        customerIdToUse = customer.id;

        // Update lead if converting
        if (leadId) {
          await supabase
            .from('leads')
            .update({
              converted_customer_id: customer.id,
              status: 'converted',
            })
            .eq('id', leadId);

          await supabase
            .from('whatsapp_messages')
            .update({
              customer_id: customer.id,
              lead_id: null,
            })
            .eq('lead_id', leadId);
        } else {
          await supabase
            .from('whatsapp_messages')
            .update({ customer_id: customer.id })
            .eq('phone', phone)
            .eq('business_id', business.id);
        }
      }

      // Step 2: Create opportunity as closed_won
      const selectedItem = formData.interest_type === 'product'
        ? products?.find(p => p.id === formData.interested_product_id)
        : services?.find(s => s.id === formData.interested_service_id);

      const { data: opportunity, error: oppError } = await supabase
        .from('opportunities')
        .insert({
          business_id: business.id,
          customer_id: customerIdToUse,
          title: selectedItem ? `Venda - ${selectedItem.name}` : `Venda - ${formData.customerName}`,
          value: value,
          stage: 'closed_won',
          probability: 100,
          closed_at: new Date().toISOString(),
          description: formData.notes || null,
        })
        .select()
        .single();

      if (oppError) throw oppError;

      // Step 3: Create invoice if requested
      if (formData.createInvoice && value > 0) {
        const invoiceNumber = `INV-${Date.now()}`;
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 7);

        const { data: invoice, error: invError } = await supabase
          .from('invoices')
          .insert({
            business_id: business.id,
            customer_id: customerIdToUse!,
            opportunity_id: opportunity.id,
            invoice_number: invoiceNumber,
            subtotal: value,
            total: value,
            discount: 0,
            due_date: dueDate.toISOString().split('T')[0],
            status: 'pending',
          })
          .select()
          .single();

        if (invError) throw invError;

        // Add invoice item
        await supabase
          .from('invoice_items')
          .insert({
            invoice_id: invoice.id,
            description: selectedItem?.name || 'Venda',
            quantity: 1,
            unit_price: value,
            total: value,
            product_id: formData.interest_type === 'product' ? formData.interested_product_id || null : null,
            service_id: formData.interest_type === 'service' ? formData.interested_service_id || null : null,
          });
      }

      return { opportunity };
    },
    onSuccess: () => {
      toast({
        title: 'Venda registrada com sucesso!',
        description: formData.createInvoice 
          ? 'Cliente, oportunidade e fatura foram criados.'
          : 'Cliente e oportunidade foram criados.',
      });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Quick sale error:', error);
      toast({
        title: 'Erro ao registrar venda',
        description: error instanceof Error ? error.message : 'Tente novamente',
        variant: 'destructive',
      });
    },
  });

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  const selectedPrice = getSelectedPrice();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-success" />
            Venda Rápida
          </DialogTitle>
          <DialogDescription>
            Registre a venda e converta o contato para cliente automaticamente.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="space-y-4"
        >
          {/* Steps indicator */}
          <div className="flex items-center justify-center gap-2 py-2">
            <div className="flex items-center gap-1">
              <div className="h-6 w-6 rounded-full bg-success/20 text-success flex items-center justify-center text-xs font-medium">
                <Check className="h-3 w-3" />
              </div>
              <span className="text-xs text-muted-foreground">Cliente</span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <div className="flex items-center gap-1">
              <div className="h-6 w-6 rounded-full bg-warning/20 text-warning flex items-center justify-center text-xs font-medium">2</div>
              <span className="text-xs text-muted-foreground">Venda</span>
            </div>
            {formData.createInvoice && (
              <>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div className="flex items-center gap-1">
                  <div className="h-6 w-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-medium">3</div>
                  <span className="text-xs text-muted-foreground">Fatura</span>
                </div>
              </>
            )}
          </div>

          {/* Customer name */}
          {!customerId && (
            <div className="space-y-2">
              <Label htmlFor="customerName">Nome do cliente *</Label>
              <Input
                id="customerName"
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                placeholder="Nome do cliente"
                required
              />
            </div>
          )}

          {/* Product/Service Selection */}
          <div className="space-y-2">
            <Label>O que foi vendido?</Label>
            <Select
              value={formData.interest_type}
              onValueChange={(value) => setFormData({
                ...formData,
                interest_type: value as 'product' | 'service' | '',
                interested_product_id: '',
                interested_service_id: '',
                value: '',
              })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="product">Produto</SelectItem>
                <SelectItem value="service">Serviço</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Product Selection */}
          {formData.interest_type === 'product' && products && products.length > 0 && (
            <div className="space-y-2">
              <Label>Produto</Label>
              <Select
                value={formData.interested_product_id}
                onValueChange={(value) => {
                  const product = products.find(p => p.id === value);
                  setFormData({ 
                    ...formData, 
                    interested_product_id: value,
                    value: product?.price?.toString() || '',
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o produto" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} - {formatPrice(product.price)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Service Selection */}
          {formData.interest_type === 'service' && services && services.length > 0 && (
            <div className="space-y-2">
              <Label>Serviço</Label>
              <Select
                value={formData.interested_service_id}
                onValueChange={(value) => {
                  const service = services.find(s => s.id === value);
                  setFormData({ 
                    ...formData, 
                    interested_service_id: value,
                    value: service?.price?.toString() || '',
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o serviço" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name} - {formatPrice(service.price)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Value */}
          <div className="space-y-2">
            <Label htmlFor="value">Valor (R$)</Label>
            <Input
              id="value"
              type="number"
              min="0"
              step="0.01"
              value={formData.value || selectedPrice || ''}
              onChange={(e) => setFormData({ ...formData, value: e.target.value })}
              placeholder={selectedPrice ? formatPrice(selectedPrice) : "0,00"}
            />
          </div>

          {/* Create invoice toggle */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="createInvoice" className="text-sm font-medium">
                Criar cobrança
              </Label>
              <p className="text-xs text-muted-foreground">
                Gera uma fatura automaticamente
              </p>
            </div>
            <Switch
              id="createInvoice"
              checked={formData.createInvoice}
              onCheckedChange={(checked) => setFormData({ ...formData, createInvoice: checked })}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Notas sobre a venda..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={mutation.isPending || (!customerId && !formData.customerName)}
              className="bg-success hover:bg-success/90"
            >
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar Venda
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}