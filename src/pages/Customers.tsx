import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DialogTrigger } from '@/components/ui/dialog';
import { Plus, Search, Edit, Trash2, Phone, Mail, MessageSquare, Package, Wrench, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useCustomers, useProducts, useServices } from '@/hooks/queries';
import { useCreateCustomer, useUpdateCustomer, useDeleteCustomer } from '@/hooks/mutations/useCustomerMutations';
import { useCustomerStats } from '@/hooks/queries/useCustomerStats';
import { useSaleCreationService } from '@/factories/business-logic/saleCreationService';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { DataTable, type Column } from '@/components/common/DataTable';
import { CustomerFormDialog, type CustomerFormData } from '@/components/customers/CustomerFormDialog';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

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

interface SaleItem {
  type: 'product' | 'service';
  item_id: string;
  quantity: number;
}

const DEFAULT_FORM_DATA: CustomerFormData = {
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
};

export default function Customers() {
  const { business } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<CustomerFormData>(DEFAULT_FORM_DATA);

  // Sale form state
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [saleDiscount, setSaleDiscount] = useState(0);
  const [showSaleSection, setShowSaleSection] = useState(false);

  // Use custom hooks for data fetching
  const { data: customers = [], isLoading } = useCustomers();
  const { data: products = [] } = useProducts();
  const { data: services = [] } = useServices();
  const customerStatsMap = useCustomerStats();
  const saleCreationService = business?.id ? useSaleCreationService(business.id) : null;

  // Use custom mutation hooks
  const updateCustomerMutation = useUpdateCustomer();
  const deleteCustomerMutation = useDeleteCustomer();

  // Custom mutation for creating customer with sale using unified business logic
  const createMutation = useMutation({
    mutationFn: async (data: CustomerFormData) => {
      if (!business?.id || !saleCreationService) {
        throw new Error('Business not found');
      }

      // Prepare customer data
      const customerData = {
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        whatsapp: data.whatsapp || null,
        notes: data.notes || null,
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

      // Prepare sale data if there are sale items
      const saleData = saleItems.length > 0 ? {
        saleItems,
        saleDiscount,
        products,
        services
      } : undefined;

      // Use unified business logic to create customer and sale atomically
      return await saleCreationService.createSaleWithCustomer(customerData, saleData);
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

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CustomerFormData }) => {
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
    setFormData(DEFAULT_FORM_DATA);
    setSaleItems([]);
    setSaleDiscount(0);
    setShowSaleSection(false);
    setEditingCustomer(null);
    setIsDialogOpen(false);
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
      recurring_reminder_template: customer.recurring_reminder_template || DEFAULT_FORM_DATA.recurring_reminder_template,
      recurring_overdue_template: customer.recurring_overdue_template || DEFAULT_FORM_DATA.recurring_overdue_template,
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
          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Cliente
          </Button>
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

        {/* Customer Form Dialog */}
        <CustomerFormDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          editingCustomer={editingCustomer}
          formData={formData}
          onFormDataChange={setFormData}
          products={products}
          services={services}
          saleItems={saleItems}
          onSaleItemsChange={setSaleItems}
          saleDiscount={saleDiscount}
          onSaleDiscountChange={setSaleDiscount}
          showSaleSection={showSaleSection}
          onShowSaleSectionChange={setShowSaleSection}
          onSubmit={handleSubmit}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      </div>
    </MainLayout>
  );
}
