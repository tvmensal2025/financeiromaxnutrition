/**
 * Integrated Systems Demo Component
 * 
 * Demonstrates how all refactored systems work together cohesively.
 * This component showcases CRUD operations, form dialogs, business logic,
 * error handling, and pattern consistency across the entire application.
 * 
 * @fileoverview Demo component for integrated systems
 * @version 1.0.0
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  UserPlus, 
  Package, 
  Wrench, 
  DollarSign, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  Trash2,
  Edit,
  Eye
} from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { useIntegratedSystems, useBusinessLogic } from './useIntegratedSystems';
import { Customer, Lead, Product, Service, Transaction } from './entityConfigurations';

/**
 * Demo component showing integrated systems in action
 */
export function IntegratedSystemsDemo() {
  const { entities, status, actions } = useIntegratedSystems();
  const businessLogic = useBusinessLogic();

  // Modal states
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [transactionModalOpen, setTransactionModalOpen] = useState(false);

  // Selected entities for editing
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedProduct, setSelectedProduct | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  // Loading states
  const [isCreatingSale, setIsCreatingSale] = useState(false);

  // System status display
  if (status.isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Clock className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Initializing integrated systems...</p>
        </div>
      </div>
    );
  }

  if (status.error) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          System Error: {status.error}
          <Button 
            variant="outline" 
            size="sm" 
            className="ml-2"
            onClick={actions.reinitialize}
          >
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!status.isInitialized || !entities.customers) {
    return (
      <div className="flex items-center justify-center p-8">
        <p>Systems not initialized</p>
      </div>
    );
  }

  // Use integrated query hooks
  const customers = entities.customers.queries.useEntities();
  const leads = entities.leads.queries.useEntities();
  const products = entities.products.queries.useEntities();
  const services = entities.services.queries.useEntities();
  const transactions = entities.transactions.queries.useEntities();

  // Use integrated CRUD hooks
  const deleteCustomer = entities.customers.crud.useDelete();
  const deleteLead = entities.leads.crud.useDelete();
  const deleteProduct = entities.products.crud.useDelete();
  const deleteService = entities.services.crud.useDelete();
  const deleteTransaction = entities.transactions.crud.useDelete();

  // Get integrated form components
  const { FormDialogWithCRUD: CustomerFormDialog } = entities.customers.forms;
  const { FormDialogWithCRUD: LeadFormDialog } = entities.leads.forms;
  const { FormDialogWithCRUD: ProductFormDialog } = entities.products.forms;
  const { FormDialogWithCRUD: ServiceFormDialog } = entities.services.forms;
  const { FormDialogWithCRUD: TransactionFormDialog } = entities.transactions.forms;

  // Business logic operations
  const handleCreateQuickSale = async () => {
    if (!businessLogic) return;

    setIsCreatingSale(true);
    try {
      const result = await businessLogic.sales.createQuickSale({
        customerName: 'Cliente Teste',
        customerPhone: '(11) 99999-9999',
        amount: 100,
        paymentMethod: 'pix',
        description: 'Venda rápida de demonstração'
      });

      if (result.success) {
        console.log('Quick sale created:', result.data);
        // Refresh transactions
        transactions.refetch();
      }
    } catch (error) {
      console.error('Failed to create quick sale:', error);
    } finally {
      setIsCreatingSale(false);
    }
  };

  const handleConvertLeadToSale = async (leadId: string) => {
    if (!businessLogic) return;

    try {
      const result = await businessLogic.sales.convertLeadToSale(leadId, {
        products: [{ productId: products.data?.[0]?.id || '', quantity: 1, unitPrice: 100 }],
        paymentMethod: 'pix'
      });

      if (result.success) {
        console.log('Lead converted to sale:', result.data);
        // Refresh data
        leads.refetch();
        customers.refetch();
        transactions.refetch();
      }
    } catch (error) {
      console.error('Failed to convert lead:', error);
    }
  };

  // System health indicator
  const healthColor = status.health?.status === 'healthy' ? 'green' : 
                     status.health?.status === 'degraded' ? 'yellow' : 'red';

  return (
    <div className="p-6 space-y-6">
      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" style={{ color: healthColor }} />
            Integrated Systems Status
          </CardTitle>
          <CardDescription>
            All refactored systems working together cohesively
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Badge variant={status.health?.status === 'healthy' ? 'default' : 'destructive'}>
              {status.health?.status || 'unknown'}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {Object.keys(status.health?.entities || {}).length} entity systems active
            </span>
            <Button variant="outline" size="sm" onClick={actions.refreshHealth}>
              Refresh Health
            </Button>
          </div>
          
          {status.health?.errors && status.health.errors.length > 0 && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside">
                  {status.health.errors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Entity Management Tabs */}
      <Tabs defaultValue="customers" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="customers" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Customers
          </TabsTrigger>
          <TabsTrigger value="leads" className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Leads
          </TabsTrigger>
          <TabsTrigger value="products" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Products
          </TabsTrigger>
          <TabsTrigger value="services" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Services
          </TabsTrigger>
          <TabsTrigger value="transactions" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Transactions
          </TabsTrigger>
        </TabsList>

        {/* Customers Tab */}
        <TabsContent value="customers">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Customers</CardTitle>
                  <CardDescription>
                    Manage customers using integrated CRUD and form systems
                  </CardDescription>
                </div>
                <Button onClick={() => {
                  setSelectedCustomer(null);
                  setCustomerModalOpen(true);
                }}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  New Customer
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {customers.isLoading ? (
                <div className="text-center py-4">Loading customers...</div>
              ) : customers.error ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Error loading customers: {customers.error.message}
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-2">
                  {customers.data?.map((customer) => (
                    <div key={customer.id} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <h4 className="font-medium">{customer.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {customer.email} • {customer.phone}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedCustomer(customer);
                            setCustomerModalOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteCustomer.mutate(customer.id)}
                          disabled={deleteCustomer.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  {customers.data?.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No customers found. Create your first customer!
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leads Tab */}
        <TabsContent value="leads">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Leads</CardTitle>
                  <CardDescription>
                    Manage leads with business logic integration
                  </CardDescription>
                </div>
                <Button onClick={() => {
                  setSelectedLead(null);
                  setLeadModalOpen(true);
                }}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  New Lead
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {leads.isLoading ? (
                <div className="text-center py-4">Loading leads...</div>
              ) : leads.error ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Error loading leads: {leads.error.message}
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-2">
                  {leads.data?.map((lead) => (
                    <div key={lead.id} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <h4 className="font-medium">{lead.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {lead.email} • {lead.source}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">{lead.status}</Badge>
                          {lead.temperature && (
                            <Badge variant={
                              lead.temperature === 'hot' ? 'destructive' :
                              lead.temperature === 'warm' ? 'default' : 'secondary'
                            }>
                              {lead.temperature}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleConvertLeadToSale(lead.id)}
                          disabled={!products.data?.length}
                        >
                          Convert to Sale
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedLead(lead);
                            setLeadModalOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteLead.mutate(lead.id)}
                          disabled={deleteLead.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  {leads.data?.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No leads found. Create your first lead!
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value="products">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Products</CardTitle>
                  <CardDescription>
                    Product catalog management
                  </CardDescription>
                </div>
                <Button onClick={() => {
                  setSelectedProduct(null);
                  setProductModalOpen(true);
                }}>
                  <Package className="h-4 w-4 mr-2" />
                  New Product
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {products.isLoading ? (
                <div className="text-center py-4">Loading products...</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {products.data?.map((product) => (
                    <Card key={product.id}>
                      <CardHeader>
                        <CardTitle className="text-lg">{product.name}</CardTitle>
                        <CardDescription>{product.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-bold text-green-600">
                            {formatCurrency(product.price)}
                          </span>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedProduct(product);
                                setProductModalOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteProduct.mutate(product.id)}
                              disabled={deleteProduct.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  
                  {products.data?.length === 0 && (
                    <div className="col-span-full text-center py-8 text-muted-foreground">
                      No products found. Create your first product!
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Services Tab */}
        <TabsContent value="services">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Services</CardTitle>
                  <CardDescription>
                    Service catalog management
                  </CardDescription>
                </div>
                <Button onClick={() => {
                  setSelectedService(null);
                  setServiceModalOpen(true);
                }}>
                  <Wrench className="h-4 w-4 mr-2" />
                  New Service
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {services.isLoading ? (
                <div className="text-center py-4">Loading services...</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {services.data?.map((service) => (
                    <Card key={service.id}>
                      <CardHeader>
                        <CardTitle className="text-lg">{service.name}</CardTitle>
                        <CardDescription>{service.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-lg font-bold text-green-600">
                              {formatCurrency(service.price)}
                            </span>
                            {service.duration && (
                              <p className="text-sm text-muted-foreground">
                                {service.duration} minutes
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedService(service);
                                setServiceModalOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteService.mutate(service.id)}
                              disabled={deleteService.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  
                  {services.data?.length === 0 && (
                    <div className="col-span-full text-center py-8 text-muted-foreground">
                      No services found. Create your first service!
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Transactions</CardTitle>
                  <CardDescription>
                    Financial transactions with business logic integration
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={handleCreateQuickSale}
                    disabled={isCreatingSale}
                  >
                    {isCreatingSale ? 'Creating...' : 'Quick Sale'}
                  </Button>
                  <Button onClick={() => {
                    setSelectedTransaction(null);
                    setTransactionModalOpen(true);
                  }}>
                    <DollarSign className="h-4 w-4 mr-2" />
                    New Transaction
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {transactions.isLoading ? (
                <div className="text-center py-4">Loading transactions...</div>
              ) : (
                <div className="space-y-2">
                  {transactions.data?.map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <h4 className="font-medium">{transaction.description}</h4>
                        <p className="text-sm text-muted-foreground">
                          {transaction.date} • {transaction.payment_method}
                        </p>
                        <Badge variant={transaction.type === 'income' ? 'default' : 'destructive'}>
                          {transaction.type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`text-lg font-bold ${
                          transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedTransaction(transaction);
                              setTransactionModalOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteTransaction.mutate(transaction.id)}
                            disabled={deleteTransaction.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {transactions.data?.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No transactions found. Create your first transaction!
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Integrated Form Dialogs */}
      <CustomerFormDialog
        isOpen={customerModalOpen}
        onClose={() => setCustomerModalOpen(false)}
        mode={selectedCustomer ? 'edit' : 'create'}
        initialData={selectedCustomer || undefined}
        entityId={selectedCustomer?.id}
        onSuccess={() => {
          setCustomerModalOpen(false);
          setSelectedCustomer(null);
          customers.refetch();
        }}
      />

      <LeadFormDialog
        isOpen={leadModalOpen}
        onClose={() => setLeadModalOpen(false)}
        mode={selectedLead ? 'edit' : 'create'}
        initialData={selectedLead || undefined}
        entityId={selectedLead?.id}
        onSuccess={() => {
          setLeadModalOpen(false);
          setSelectedLead(null);
          leads.refetch();
        }}
      />

      <ProductFormDialog
        isOpen={productModalOpen}
        onClose={() => setProductModalOpen(false)}
        mode={selectedProduct ? 'edit' : 'create'}
        initialData={selectedProduct || undefined}
        entityId={selectedProduct?.id}
        onSuccess={() => {
          setProductModalOpen(false);
          setSelectedProduct(null);
          products.refetch();
        }}
      />

      <ServiceFormDialog
        isOpen={serviceModalOpen}
        onClose={() => setServiceModalOpen(false)}
        mode={selectedService ? 'edit' : 'create'}
        initialData={selectedService || undefined}
        entityId={selectedService?.id}
        onSuccess={() => {
          setServiceModalOpen(false);
          setSelectedService(null);
          services.refetch();
        }}
      />

      <TransactionFormDialog
        isOpen={transactionModalOpen}
        onClose={() => setTransactionModalOpen(false)}
        mode={selectedTransaction ? 'edit' : 'create'}
        initialData={selectedTransaction || undefined}
        entityId={selectedTransaction?.id}
        onSuccess={() => {
          setTransactionModalOpen(false);
          setSelectedTransaction(null);
          transactions.refetch();
        }}
      />
    </div>
  );
}

export default IntegratedSystemsDemo;