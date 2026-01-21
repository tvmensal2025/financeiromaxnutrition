import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Plus, Package, Wrench } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import type { Lead, LeadStatus, LeadTemperature } from '@/hooks/queries/useLeads';
import type { Product } from '@/hooks/queries/useProducts';
import type { Service } from '@/hooks/queries/useServices';

interface LeadFormData {
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  company: string;
  source: string;
  status: LeadStatus;
  temperature: LeadTemperature;
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

interface LeadFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingLead: Lead | null;
  products: Product[];
  services: Service[];
  onSubmit: (data: LeadFormData) => void;
  isLoading: boolean;
}

const initialFormData: LeadFormData = {
  name: '',
  email: '',
  phone: '',
  whatsapp: '',
  company: '',
  source: '',
  status: 'new',
  temperature: 'cold',
  notes: '',
  interest_type: 'none',
  interested_product_id: '',
  interested_service_id: '',
  interest_is_recurring: false,
  recurring_due_date: '',
  recurring_message_time: '09:00',
  recurring_reminder_days: 3,
  recurring_message_type: 'both',
  recurring_reminder_template: '',
  recurring_overdue_template: '',
};

export function LeadFormDialog({
  open,
  onOpenChange,
  editingLead,
  products,
  services,
  onSubmit,
  isLoading,
}: LeadFormDialogProps) {
  const [formData, setFormData] = useState<LeadFormData>(initialFormData);

  // Reset form when dialog opens/closes or editing lead changes
  useEffect(() => {
    if (open) {
      if (editingLead) {
        setFormData({
          name: editingLead.name,
          email: editingLead.email || '',
          phone: editingLead.phone || '',
          whatsapp: editingLead.whatsapp || '',
          company: editingLead.company || '',
          source: editingLead.source || '',
          status: editingLead.status,
          temperature: editingLead.temperature || 'cold',
          notes: editingLead.notes || '',
          interest_type: editingLead.interest_type || 'none',
          interested_product_id: editingLead.interested_product_id || '',
          interested_service_id: editingLead.interested_service_id || '',
          interest_is_recurring: editingLead.interest_is_recurring || false,
          recurring_due_date: editingLead.recurring_due_date || '',
          recurring_message_time: editingLead.recurring_message_time || '09:00',
          recurring_reminder_days: editingLead.recurring_reminder_days || 3,
          recurring_message_type: editingLead.recurring_message_type || 'both',
          recurring_reminder_template: editingLead.recurring_reminder_template || '',
          recurring_overdue_template: editingLead.recurring_overdue_template || '',
        });
      } else {
        setFormData(initialFormData);
      }
    }
  }, [open, editingLead]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Novo Lead
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingLead ? 'Editar Lead' : 'Novo Lead'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                value={formData.whatsapp}
                onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Empresa</Label>
              <Input
                id="company"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="source">Origem</Label>
              <Input
                id="source"
                placeholder="Ex: Instagram, Indicação"
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Temperatura</Label>
              <Select
                value={formData.temperature}
                onValueChange={(v) => setFormData({ ...formData, temperature: v as LeadTemperature })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cold">🥶 Frio</SelectItem>
                  <SelectItem value="warm">🌡️ Morno</SelectItem>
                  <SelectItem value="hot">🔥 Quente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={formData.status}
              onValueChange={(v) => setFormData({ ...formData, status: v as LeadStatus })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Novo</SelectItem>
                <SelectItem value="contacted">Contactado</SelectItem>
                <SelectItem value="qualified">Qualificado</SelectItem>
                <SelectItem value="unqualified">Não Qualificado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>

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
                onValueChange={(v) => setFormData({ 
                  ...formData, 
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
                  onValueChange={(v) => setFormData({ ...formData, interested_product_id: v })}
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
                  onValueChange={(v) => setFormData({ ...formData, interested_service_id: v })}
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
              <>
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
                    onCheckedChange={(v) => setFormData({ ...formData, interest_is_recurring: v })}
                  />
                </div>

                {/* Recurring message settings */}
                {formData.interest_is_recurring && (
                  <div className="space-y-4 p-4 bg-muted/50 rounded-lg border">
                    <h5 className="text-sm font-medium text-foreground">Configurações de Mensagem Automática</h5>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="recurring_due_date">Próximo Vencimento</Label>
                        <Input
                          id="recurring_due_date"
                          type="date"
                          value={formData.recurring_due_date}
                          onChange={(e) => setFormData({ ...formData, recurring_due_date: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="recurring_message_time">Horário de Envio</Label>
                        <Input
                          id="recurring_message_time"
                          type="time"
                          value={formData.recurring_message_time}
                          onChange={(e) => setFormData({ ...formData, recurring_message_time: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Lembrete com antecedência</Label>
                        <Select
                          value={String(formData.recurring_reminder_days)}
                          onValueChange={(v) => setFormData({ ...formData, recurring_reminder_days: Number(v) })}
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
                          onValueChange={(v) => setFormData({ ...formData, recurring_message_type: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="reminder">Só lembrete antes</SelectItem>
                            <SelectItem value="overdue">Só cobrança depois</SelectItem>
                            <SelectItem value="both">Ambos</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {(formData.recurring_message_type === 'reminder' || formData.recurring_message_type === 'both') && (
                      <div className="space-y-2">
                        <Label htmlFor="recurring_reminder_template">Mensagem de Lembrete</Label>
                        <Textarea
                          id="recurring_reminder_template"
                          placeholder="Olá {nome}! Sua assinatura de {produto} no valor de {valor} vence em {vencimento}."
                          value={formData.recurring_reminder_template}
                          onChange={(e) => setFormData({ ...formData, recurring_reminder_template: e.target.value })}
                          rows={3}
                        />
                        <p className="text-xs text-muted-foreground">
                          Use: {'{nome}'}, {'{produto}'}, {'{valor}'}, {'{vencimento}'}
                        </p>
                      </div>
                    )}

                    {(formData.recurring_message_type === 'overdue' || formData.recurring_message_type === 'both') && (
                      <div className="space-y-2">
                        <Label htmlFor="recurring_overdue_template">Mensagem de Cobrança</Label>
                        <Textarea
                          id="recurring_overdue_template"
                          placeholder="Olá {nome}! Sua fatura de {produto} no valor de {valor} venceu em {vencimento}."
                          value={formData.recurring_overdue_template}
                          onChange={(e) => setFormData({ ...formData, recurring_overdue_template: e.target.value })}
                          rows={3}
                        />
                        <p className="text-xs text-muted-foreground">
                          Use: {'{nome}'}, {'{produto}'}, {'{valor}'}, {'{vencimento}'}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {editingLead ? 'Salvar Alterações' : 'Criar Lead'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export type { LeadFormData };