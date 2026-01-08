import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, Wrench, CreditCard, Plus, Search, Pencil, Trash2, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export default function Catalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'produtos';

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Catálogo</h1>
          <p className="text-muted-foreground">Gerencie produtos, serviços e planos</p>
        </div>

        <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="produtos" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Produtos
            </TabsTrigger>
            <TabsTrigger value="servicos" className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Serviços
            </TabsTrigger>
            <TabsTrigger value="planos" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Planos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="produtos" className="mt-6">
            <ProductsContent />
          </TabsContent>
          <TabsContent value="servicos" className="mt-6">
            <ServicesContent />
          </TabsContent>
          <TabsContent value="planos" className="mt-6">
            <PlansContent />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

function ProductsContent() {
  const { business } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  interface Product {
    id: string;
    name: string;
    description: string | null;
    price: number;
    stock: number | null;
    is_active: boolean;
  }

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('business_id', business.id)
        .order('name');
      if (error) throw error;
      return data as Product[];
    },
    enabled: !!business?.id,
  });

  const filteredProducts = products.filter(
    (product) => product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">{products.length} produtos</span>
        </p>
        <Button onClick={() => navigate('/produtos')}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Produto
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar produtos..."
          className="pl-10"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">Carregando...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">Nenhum produto encontrado</div>
        ) : (
          filteredProducts.slice(0, 6).map((product) => (
            <div key={product.id} className="bg-card rounded-xl border border-border p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/produtos')}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold">{product.name}</h3>
                </div>
                <Badge variant={product.is_active ? 'default' : 'secondary'}>
                  {product.is_active ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
              <p className="text-lg font-semibold text-success">
                {(product.price ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
              <p className="text-sm text-muted-foreground">Estoque: {product.stock || 0}</p>
            </div>
          ))
        )}
      </div>
      {filteredProducts.length > 6 && (
        <div className="text-center">
          <Button variant="outline" onClick={() => navigate('/produtos')}>
            Ver todos os {filteredProducts.length} produtos
          </Button>
        </div>
      )}
    </div>
  );
}

function ServicesContent() {
  const { business } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  interface Service {
    id: string;
    name: string;
    description: string | null;
    price: number;
    duration_minutes: number | null;
    is_active: boolean;
  }

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['services', business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('business_id', business.id)
        .order('name');
      if (error) throw error;
      return data as Service[];
    },
    enabled: !!business?.id,
  });

  const filteredServices = services.filter(
    (service) => service.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}min`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}min`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">{services.length} serviços</span>
        </p>
        <Button onClick={() => navigate('/servicos')}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Serviço
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar serviços..."
          className="pl-10"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">Carregando...</div>
        ) : filteredServices.length === 0 ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">Nenhum serviço encontrado</div>
        ) : (
          filteredServices.slice(0, 6).map((service) => (
            <div key={service.id} className="bg-card rounded-xl border border-border p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/servicos')}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Wrench className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{service.name}</h3>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDuration(service.duration_minutes || 60)}
                    </div>
                  </div>
                </div>
                <Badge variant={service.is_active ? 'default' : 'secondary'}>
                  {service.is_active ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
              <p className="text-lg font-semibold text-success">
                {service.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
          ))
        )}
      </div>
      {filteredServices.length > 6 && (
        <div className="text-center">
          <Button variant="outline" onClick={() => navigate('/servicos')}>
            Ver todos os {filteredServices.length} serviços
          </Button>
        </div>
      )}
    </div>
  );
}

function PlansContent() {
  const { business } = useAuth();
  const navigate = useNavigate();

  interface Plan {
    id: string;
    name: string;
    description: string | null;
    price: number;
    credits: number;
    billing_cycle: string;
    is_active: boolean;
  }

  const billingCycles: Record<string, string> = {
    weekly: 'Semanal',
    monthly: 'Mensal',
    quarterly: 'Trimestral',
    yearly: 'Anual',
  };

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['plans', business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('business_id', business.id)
        .order('price');
      if (error) throw error;
      return data as Plan[];
    },
    enabled: !!business?.id,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">{plans.length} planos</span>
        </p>
        <Button onClick={() => navigate('/planos')}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Plano
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">Carregando...</div>
        ) : plans.length === 0 ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">Nenhum plano cadastrado</div>
        ) : (
          plans.map((plan) => (
            <div key={plan.id} className="bg-card rounded-xl border border-border p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/planos')}>
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold">{plan.name}</h3>
                <Badge variant={plan.is_active ? 'default' : 'secondary'}>
                  {plan.is_active ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
              {plan.description && <p className="text-sm text-muted-foreground mb-2">{plan.description}</p>}
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-foreground">
                  R$ {plan.price.toFixed(2)}
                </span>
                <span className="text-muted-foreground">
                  /{billingCycles[plan.billing_cycle]?.toLowerCase() || plan.billing_cycle}
                </span>
              </div>
              <Badge variant="outline" className="mt-2">{plan.credits} créditos</Badge>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
