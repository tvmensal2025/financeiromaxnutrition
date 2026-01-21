import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Package, Wrench, CalendarDays, Clock, Bell, ShoppingCart, Plus, Trash2, Percent } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

interface Product {
  id: string;
  name: string;
  price: number;
}

interface Service {
  id: string;
  name: string;
  price: number;
}

interface SaleItem {
  type: 'product' | 'service';
  item_id: string;
  quantity: number;
}

export interface CustomerFormData {
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  notes: string;
  interest_type: string;
  interested_product_id: string;
  interested_service_id: string;
  interest_is_recurring: boolean;
  recurring_due_date: string;
  recurring_message_time: string;
  recurring_reminder_days: number;
  recurring_message_type: string;
  recurring_reminder_template: string;
  recurring_overdue_template: string;
}

export interface CustomerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingCustomer: any | null;
  formData: CustomerFormData;
  onFormDataChange: (data: CustomerFormData) => void;
  products: Product[];
  services: Service[];
  saleItems: SaleItem[];
  onSaleItemsChange: (items: SaleItem[]) => void;
  saleDiscount: number;
  onSaleDiscountChange: (discount: number) => void;
  showSaleSection: boolean;
  onShowSaleSectionChange: (show: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
}

export function CustomerFormDialog({
  open,
  onOpenChange,
  editingCustomer,
  formData,
  onFormDataChange,
  products,
  services,
  saleItems,
  onSaleItemsChange,
  saleDiscount,
  onSaleDiscountChange,
  showSaleSection,
  onShowSaleSectionChange,
  onSubmit,
  isLoading,
}: CustomerFormDialogProps) {
  const updateFormData = (updates: Partial<CustomerFormData>) => {
    onFormDataChange({ ...formData, ...updates });
  };

  const addSaleItem = () => {
    onSaleItemsChange([...saleItems, { type: 'product', item_id: '', quantity: 1 }]);
  };

  const updateSaleItem = (index: number, updates: Partial<SaleItem>) => {
    const newItems = [...saleItems];
    newItems[index] = { ...newItems[index], ...updates };
    onSaleItemsChange(newItems);
  };

  const removeSaleItem = (index: number) => {
    onSaleItemsChange(saleItems.filter((_, i) => i !== index));
  };

  const calculateSaleTotal = () => {
    let total = 0;
    saleItems.forEach(item => {
      if (item.type === 'product') {
        const product = products.find(p => p.id === item.item_id);
        if (product) total += product.price * item.quantity;
      } else {
        const service = services.find(s => s.id === item.item_id);
        if (service) total += service.price * item.quantity;
      }
    });
    return total - saleDiscount;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingCustomer ? 'Editar Cliente' : 'Novo Cliente'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => updateFormData({ name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => updateFormData({ email: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => updateFormData({ phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                value={formData.whatsapp}
                onChange={(e) => updateFormData({ whatsapp: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => updateFormData({ notes: e.target.value })}
              rows={3}
            />
          </div>

          {/* Sale Section - Only for new customers */}
          {!editingCustomer && (
            <>
              <Separator className="my-4" />
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    Nova Venda
                  </h4>
                  <Switch
                    checked={showSaleSection}
                    onCheckedChange={onShowSaleSectionChange}
                  />
                </div>

                {showSaleSection && (
                  <div className="space-y-4 p-4 bg-muted/50 rounded-lg border border-border">
                    {saleItems.map((item, index) => (
                      <div key={index} className="flex items-end gap-2">
                        <div className="flex-1 space-y-2">
                          <Label className="text-xs">Tipo</Label>
                          <Select
                            value={item.type}
                            onValueChange={(v: 'product' | 'service') => updateSaleItem(index, { type: v, item_id: '' })}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="product">Produto</SelectItem>
                              <SelectItem value="service">Serviço</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex-[2] space-y-2">
                          <Label className="text-xs">{item.type === 'product' ? 'Produto' : 'Serviço'}</Label>
                          <Select
                            value={item.item_id}
                            onValueChange={(v) => updateSaleItem(index, { item_id: v })}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                              {item.type === 'product'
                                ? products.map(p => (
                                    <SelectItem key={p.id} value={p.id}>
                                      {p.name} - {formatCurrency(p.price)}
                                    </SelectItem>
                                  ))
                                : services.map(s => (
                                    <SelectItem key={s.id} value={s.id}>
                                      {s.name} - {formatCurrency(s.price)}
                                    </SelectItem>
                                  ))
                              }
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-20 space-y-2">
                          <Label className="text-xs">Qtd</Label>
                          <Input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => updateSaleItem(index, { quantity: parseInt(e.target.value) || 1 })}
                            className="h-9"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-destructive"
                          onClick={() => removeSaleItem(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}

                    <Button type="button" variant="outline" size="sm" onClick={addSaleItem} className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Item
                    </Button>

                    {saleItems.length > 0 && (
                      <div className="space-y-3 pt-2 border-t border-border">
                        <div className="flex items-center gap-2">
                          <Label className="text-sm flex items-center gap-1">
                            <Percent className="h-3 w-3" />
                            Desconto (R$)
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={saleDiscount}
                            onChange={(e) => onSaleDiscountChange(parseFloat(e.target.value) || 0)}
                            className="w-32 h-9"
                          />
                        </div>
                        <div className="flex items-center justify-between text-sm font-medium">
                          <span>Total da Venda:</span>
                          <span className="text-success">{formatCurrency(calculateSaleTotal())}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          <Separator className="my-4" />

          {/* Interest Section */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
              <Package className="h-4 w-4" />
              Interesse em Produto/Serviço
            </h4>

            <div className="space-y-2">
              <Label>Tipo de interesse</Label>
              <Select
                value={formData.interest_type}
                onValueChange={(v) => updateFormData({
                  interest_type: v,
                  interested_product_id: '',
                  interested_service_id: '',
                })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  <SelectItem value="product">
                    <span className="flex items-center gap-2">
                      <Package className="h-4 w-4" /> Produto
                    </span>
                  </SelectItem>
                  <SelectItem value="service">
                    <span className="flex items-center gap-2">
                      <Wrench className="h-4 w-4" /> Serviço
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.interest_type === 'product' && (
              <div className="space-y-2">
                <Label>Produto</Label>
                <Select
                  value={formData.interested_product_id}
                  onValueChange={(v) => updateFormData({ interested_product_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um produto..." />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} - {formatCurrency(p.price)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.interest_type === 'service' && (
              <div className="space-y-2">
                <Label>Serviço</Label>
                <Select
                  value={formData.interested_service_id}
                  onValueChange={(v) => updateFormData({ interested_service_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um serviço..." />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} - {formatCurrency(s.price)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.interest_type !== 'none' && (
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="recurring">Recorrente?</Label>
                  <p className="text-xs text-muted-foreground">
                    O cliente quer compra/assinatura contínua
                  </p>
                </div>
                <Switch
                  id="recurring"
                  checked={formData.interest_is_recurring}
                  onCheckedChange={(v) => updateFormData({ interest_is_recurring: v })}
                />
              </div>
            )}

            {/* Recurring Message Settings */}
            {formData.interest_is_recurring && (
              <div className="space-y-4 p-4 bg-muted/50 rounded-lg border border-border">
                <h5 className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Configurações de Mensagem Automática
                </h5>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="recurring_due_date" className="flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      Próximo Vencimento
                    </Label>
                    <Input
                      id="recurring_due_date"
                      type="date"
                      value={formData.recurring_due_date}
                      onChange={(e) => updateFormData({ recurring_due_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recurring_message_time" className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Horário de Envio
                    </Label>
                    <Input
                      id="recurring_message_time"
                      type="time"
                      value={formData.recurring_message_time}
                      onChange={(e) => updateFormData({ recurring_message_time: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Lembrete com antecedência</Label>
                    <Select
                      value={formData.recurring_reminder_days.toString()}
                      onValueChange={(v) => updateFormData({ recurring_reminder_days: parseInt(v) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 dia antes</SelectItem>
                        <SelectItem value="2">2 dias antes</SelectItem>
                        <SelectItem value="3">3 dias antes</SelectItem>
                        <SelectItem value="5">5 dias antes</SelectItem>
                        <SelectItem value="7">7 dias antes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de mensagem</Label>
                    <Select
                      value={formData.recurring_message_type}
                      onValueChange={(v) => updateFormData({ recurring_message_type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="reminder">Lembrete antes</SelectItem>
                        <SelectItem value="overdue">Cobrança depois</SelectItem>
                        <SelectItem value="both">Ambos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="recurring_reminder_template">
                    📩 Mensagem de Lembrete
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Use: {'{nome}'}, {'{produto}'}, {'{valor}'}, {'{vencimento}'}
                  </p>
                  <Textarea
                    id="recurring_reminder_template"
                    value={formData.recurring_reminder_template}
                    onChange={(e) => updateFormData({ recurring_reminder_template: e.target.value })}
                    rows={3}
                    className="text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="recurring_overdue_template">
                    📩 Mensagem de Cobrança
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Enviada após o vencimento caso não pague
                  </p>
                  <Textarea
                    id="recurring_overdue_template"
                    value={formData.recurring_overdue_template}
                    onChange={(e) => updateFormData({ recurring_overdue_template: e.target.value })}
                    rows={3}
                    className="text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editingCustomer ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
