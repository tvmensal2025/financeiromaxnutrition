import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Search, Edit, Trash2, Phone, Mail, MessageSquare, Loader2, Package, Wrench, CalendarDays, Clock, Bell, ShoppingCart, Percent, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useCustomers } from '@/hooks/queries';
import { useProducts } from '@/hooks/queries';
import { useServices } from '@/hooks/queries';
import { useCreateCustomer, useUpdateCustomer, useDeleteCustomer } from '@/hooks/mutations/useCustomerMutations';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { DataTable, type Column } from '@/components/common/DataTable';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  notes: string | null;
  created_at: string;
  interest_type?: string | null;
  interested_product_id?: string | null;
  interested_service_id?: string | null;
  interest_is_recurring?: boolean | null;
  recurring_due_date?: string | null;
  recurring_message_time?: string | null;
  recurring_reminder_days?: number | null;
  recurring_message_type?: string | null;
  recurring_reminder_template?: string | null;
  recurring_overdue_template?: string | null;
}

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

interface CustomerStats {
  totalProducts: number;
  totalServices: number;
  totalDiscount: number;
  totalPurchases: number;
}

export default function Customers() {
  const { business } = useAuth();
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    whatsapp: '',
    notes: '',
    interest_type: 'none',
    interested_product_id: '',
    interested_service_id: '',
    interest_is_recurring: false,
    recurring_due_date: '',
    recurring_message_time: '09:00',
    recurring_reminder_days: 3,
    recurring_message_type: 'both',
    recurring_reminder_template: 'Olá {nome}! Sua assinatura de {produto} (R$ {valor}) vence em {vencimento}. Podemos confirmar o pagamento?',
    recurring_overdue_template: 'Olá {nome}! Sua fatura de {produto} (R$ {valor}) venceu. Por favor, regularize o pagamento para continuar utilizando o serviço.',
  });
  
  // Sale form state
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [saleDiscount, setSaleDiscount] = useState(0);
  const [showSaleSection, setShowSaleSection] = useState(false);

  // Use custom hooks for data fetching
  const { data: customers = [], isLoading } = useCustomers();
  const { data: products = [] } = useProducts();
  const { data: services = [] } = useServices();

  // Fetch customer invoices for stats
  const { data: customerInvoices = [] } = useQuery({
    queryKey: ['customer-invoices-stats', business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      const { data, error } = await supabase
        .from('invoices')
        .select('*, invoice_items(*)')
        .eq('business_id', business.id);
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });

  // Calculate stats per customer
  const customerStatsMap = new Map<string, CustomerStats>();
  customerInvoices.forEach((inv: any) => {
    const customerId = inv.customer_id;
    const existing = customerStatsMap.get(customerId) || {
      totalProducts: 0,
      totalServices: 0,
      totalDiscount: 0,
      totalPurchases: 0,
    };
    
    if (inv.status === 'paid') {
      existing.totalPurchases += Number(inv.total || 0);
    }
    existing.totalDiscount += Number(inv.discount || 0);
    
    inv.invoice_items?.forEach((item: any) => {
      if (item.product_id) existing.totalProducts += item.quantity || 1;
      if (item.service_id) existing.totalServices += item.quantity || 1;
    });
    
    customerStatsMap.set(customerId, existing);
  });

  // Use custom mutation hooks
  const createCustomerMutation = useCreateCustomer();
  const updateCustomerMutation = useUpdateCustomer();
  const deleteCustomerMutation = useDeleteCustomer();

  // Custom mutation for creating customer with sale invoice
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const insertData: any = {
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        whatsapp: data.whatsapp || null,
        notes: data.notes || null,
        business_id: business?.id,
        interest_type: data.interest_type,
        interested_product_id: data.interest_type === 'product' && data.interested_product_id ? data.interested_product_id : null,
        interested_service_id: data.interest_type === 'service' && data.interested_service_id ? data.interested_service_id : null,
        interest_is_recurring: data.interest_is_recurring,
        recurring_due_date: data.interest_is_recurring && data.recurring_due_date ? data.recurring_due_date : null,
        recurring_message_time: data.interest_is_recurring ? data.recurring_message_time : null,
        recurring_reminder_days: data.interest_is_recurring ? data.recurring_reminder_days : null,
        recurring_message_type: data.interest_is_recurring ? data.recurring_message_type : null,
        recurring_reminder_template: data.interest_is_recurring ? data.recurring_reminder_template : null,
        recurring_overdue_template: data.interest_is_recurring ? data.recurring_overdue_template : null,
      };
      const { data: newCustomer, error } = await supabase.from('customers').insert(insertData).select().single();
      if (error) throw error;
      
      // Create invoice if there are sale items
      if (saleItems.length > 0 && newCustomer) {
        await createSaleInvoice(newCustomer.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-invoices-stats'] });
      toast({ title: 'Cliente criado com sucesso!' });
      resetForm();
    },
    onError: () => {
      toast({ title: 'Erro ao criar cliente', variant: 'destructive' });
    },
  });

  const createSaleInvoice = async (customerId: string) => {
    if (!business?.id || saleItems.length === 0) return;
    
    // Calculate totals
    let subtotal = 0;
    const invoiceItems: any[] = [];
    
    for (const item of saleItems) {
      if (item.type === 'product') {
        const product = products.find(p => p.id === item.item_id);
        if (product) {
          const total = product.price * item.quantity;
          subtotal += total;
          invoiceItems.push({
            product_id: item.item_id,
            description: product.name,
            quantity: item.quantity,
            unit_price: product.price,
            total,
          });
        }
      } else {
        const service = services.find(s => s.id === item.item_id);
        if (service) {
          const total = service.price * item.quantity;
          subtotal += total;
          invoiceItems.push({
            service_id: item.item_id,
            description: service.name,
            quantity: item.quantity,
            unit_price: service.price,
            total,
          });
        }
      }
    }
    
    const total = subtotal - saleDiscount;
    const invoiceNumber = `VND-${Date.now().toString().slice(-6)}`;
    const dueDate = new Date().toISOString().split('T')[0];
    
    // Create invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        business_id: business.id,
        customer_id: customerId,
        invoice_number: invoiceNumber,
        subtotal,
        discount: saleDiscount,
        total,
        due_date: dueDate,
        status: 'paid',
        paid_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (invoiceError) throw invoiceError;
    
    // Create invoice items
    if (invoice) {
      const itemsWithInvoiceId = invoiceItems.map(item => ({
        ...item,
        invoice_id: invoice.id,
      }));
      
      const { error: itemsError } = await supabase.from('invoice_items').insert(itemsWithInvoiceId);
      if (itemsError) throw itemsError;
    }
  };

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      await updateCustomerMutation.mutateAsync({ id, data });
    },
    onSuccess: () => {
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteCustomerMutation.mutateAsync(id);
    },
  });

  const resetForm = () => {
    setFormData({ 
      name: '', 
      email: '', 
      phone: '', 
      whatsapp: '', 
      notes: '',
      interest_type: 'none',
      interested_product_id: '',
      interested_service_id: '',
      interest_is_recurring: false,
      recurring_due_date: '',
      recurring_message_time: '09:00',
      recurring_reminder_days: 3,
      recurring_message_type: 'both',
      recurring_reminder_template: 'Olá {nome}! Sua assinatura de {produto} (R$ {valor}) vence em {vencimento}. Podemos confirmar o pagamento?',
      recurring_overdue_template: 'Olá {nome}! Sua fatura de {produto} (R$ {valor}) venceu. Por favor, regularize o pagamento para continuar utilizando o serviço.',
    });
    setSaleItems([]);
    setSaleDiscount(0);
    setShowSaleSection(false);
    setEditingCustomer(null);
    setIsDialogOpen(false);
  };

  const addSaleItem = () => {
    setSaleItems([...saleItems, { type: 'product', item_id: '', quantity: 1 }]);
  };

  const updateSaleItem = (index: number, updates: Partial<SaleItem>) => {
    const newItems = [...saleItems];
    newItems[index] = { ...newItems[index], ...updates };
    setSaleItems(newItems);
  };

  const removeSaleItem = (index: number) => {
    setSaleItems(saleItems.filter((_, i) => i !== index));
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

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      email: customer.email || '',
      phone: customer.phone || '',
      whatsapp: customer.whatsapp || '',
      notes: customer.notes || '',
      interest_type: customer.interest_type || 'none',
      interested_product_id: customer.interested_product_id || '',
      interested_service_id: customer.interested_service_id || '',
      interest_is_recurring: customer.interest_is_recurring || false,
      recurring_due_date: customer.recurring_due_date || '',
      recurring_message_time: customer.recurring_message_time || '09:00',
      recurring_reminder_days: customer.recurring_reminder_days || 3,
      recurring_message_type: customer.recurring_message_type || 'both',
      recurring_reminder_template: customer.recurring_reminder_template || 'Olá {nome}! Sua assinatura de {produto} (R$ {valor}) vence em {vencimento}. Podemos confirmar o pagamento?',
      recurring_overdue_template: customer.recurring_overdue_template || 'Olá {nome}! Sua fatura de {produto} (R$ {valor}) venceu. Por favor, regularize o pagamento para continuar utilizando o serviço.',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search)
  );

  // Define columns for DataTable
  const columns: Column<Customer>[] = [
    {
      key: 'name',
      header: 'Nome',
      accessor: 'name',
      render: (_, customer) => (
        <div>
          <p className="font-medium text-foreground">{customer.name}</p>
          {customer.notes && (
            <p className="text-sm text-muted-foreground line-clamp-1">
              {customer.notes}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contato',
      accessor: () => null,
      render: (_, customer) => (
        <div className="space-y-1">
          {customer.email && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Mail className="h-3 w-3" />
              {customer.email}
            </div>
          )}
          {customer.phone && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Phone className="h-3 w-3" />
              {customer.phone}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'whatsapp',
      header: 'WhatsApp',
      accessor: 'whatsapp',
      render: (_, customer) =>
        customer.whatsapp ? (
          <a
            href={`https://wa.me/${customer.whatsapp.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-success hover:underline"
          >
            <MessageSquare className="h-4 w-4" />
            {customer.whatsapp}
          </a>
        ) : null,
    },
    {
      key: 'products',
      header: 'Produtos',
      accessor: () => null,
      className: 'text-center',
      render: (_, customer) => {
        const stats = customerStatsMap.get(customer.id);
        return stats?.totalProducts ? (
          <Badge variant="secondary" className="gap-1">
            <Package className="h-3 w-3" />
            {stats.totalProducts}
          </Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      },
    },
    {
      key: 'services',
      header: 'Serviços',
      accessor: () => null,
      className: 'text-center',
      render: (_, customer) => {
        const stats = customerStatsMap.get(customer.id);
        return stats?.totalServices ? (
          <Badge variant="secondary" className="gap-1">
            <Wrench className="h-3 w-3" />
            {stats.totalServices}
          </Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      },
    },
    {
      key: 'discounts',
      header: 'Descontos',
      accessor: () => null,
      className: 'text-right',
      render: (_, customer) => {
        const stats = customerStatsMap.get(customer.id);
        return stats?.totalDiscount ? (
          <span className="text-warning font-medium">
            {formatCurrency(stats.totalDiscount)}
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      },
    },
    {
      key: 'created_at',
      header: 'Criado em',
      accessor: 'created_at',
      render: (value) => (
        <span className="text-muted-foreground">
          {formatDate(value as string, "dd 'de' MMM, yyyy")}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Ações',
      accessor: () => null,
      className: 'text-right',
      render: (_, customer) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(customer);
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              deleteMutation.mutate(customer.id);
            }}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Clientes</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie sua base de clientes
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingCustomer ? 'Editar Cliente' : 'Novo Cliente'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="whatsapp">WhatsApp</Label>
                    <Input
                      id="whatsapp"
                      value={formData.whatsapp}
                      onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                    />
                  </div>
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
                          onCheckedChange={setShowSaleSection}
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
                                  onChange={(e) => setSaleDiscount(parseFloat(e.target.value) || 0)}
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
                            onChange={(e) => setFormData({ ...formData, recurring_due_date: e.target.value })}
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
                            onChange={(e) => setFormData({ ...formData, recurring_message_time: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Lembrete com antecedência</Label>
                          <Select
                            value={formData.recurring_reminder_days.toString()}
                            onValueChange={(v) => setFormData({ ...formData, recurring_reminder_days: parseInt(v) })}
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
                          onChange={(e) => setFormData({ ...formData, recurring_reminder_template: e.target.value })}
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
                          onChange={(e) => setFormData({ ...formData, recurring_overdue_template: e.target.value })}
                          rows={3}
                          className="text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {(createMutation.isPending || updateMutation.isPending) && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {editingCustomer ? 'Salvar' : 'Criar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar clientes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Table */}
        <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
          <DataTable
            columns={columns}
            data={filteredCustomers}
            isLoading={isLoading}
            rowKey="id"
            emptyState={{
              icon: Users,
              title: 'Nenhum cliente encontrado',
              description: search ? 'Tente ajustar sua busca' : 'Comece adicionando seu primeiro cliente',
            }}
          />
        </div>
      </div>
    </MainLayout>
  );
}
