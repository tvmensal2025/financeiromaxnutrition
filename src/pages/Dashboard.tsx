import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { 
  Users, 
  TrendingUp, 
  DollarSign,
  Package,
  Building2,
  ShoppingCart
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export default function Dashboard() {
  const { profile } = useAuth();
  
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [customersRes, leadsRes, fornecedoresRes, produtosRes] = await Promise.all([
        supabase.from('customers').select('id', { count: 'exact' }),
        supabase.from('leads').select('id', { count: 'exact' }),
        supabase.from('fornecedores').select('id', { count: 'exact' }),
        supabase.from('produtos_servicos').select('*'),
      ]);

      const customers = customersRes.count || 0;
      const leads = leadsRes.count || 0;
      const fornecedores = fornecedoresRes.count || 0;
      const produtos = produtosRes.data || [];

      const totalInvestido = produtos.reduce((acc, p) => acc + (p.valor_total || 0), 0);
      const totalPago = produtos.reduce((acc, p) => acc + (p.valor_pago || 0), 0);
      const totalEstoque = produtos.reduce((acc, p) => acc + (p.quantidade_estoque || 0), 0);

      return {
        customers,
        leads,
        fornecedores,
        totalInvestido,
        totalPago,
        totalPendente: totalInvestido - totalPago,
        totalEstoque,
      };
    },
    enabled: !!profile?.business_id,
  });

  const { data: fornecedoresData } = useQuery({
    queryKey: ['fornecedores-resumo'],
    queryFn: async () => {
      const { data: fornecedores } = await supabase.from('fornecedores').select('*');
      const { data: produtos } = await supabase.from('produtos_servicos').select('*');
      const { data: contratos } = await supabase.from('contratos_taxas').select('*');

      return fornecedores?.map((f) => {
        const produtosForn = produtos?.filter((p) => p.fornecedor_id === f.id) || [];
        const contratosForn = contratos?.filter((c) => c.fornecedor_id === f.id) || [];
        const total = produtosForn.reduce((acc, p) => acc + (p.valor_total || 0), 0) + contratosForn.reduce((acc, c) => acc + c.valor, 0);
        const pago = produtosForn.reduce((acc, p) => acc + (p.valor_pago || 0), 0) + contratosForn.filter((c) => c.status_pagamento === 'pago').reduce((acc, c) => acc + c.valor, 0);
        return { ...f, total, pago, pendente: total - pago };
      }).filter((f) => f.total > 0).sort((a, b) => b.total - a.total) || [];
    },
    enabled: !!profile?.business_id,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Visão geral do seu negócio
          </p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Total Investido"
            value={formatCurrency(stats?.totalInvestido || 0)}
            subtitle={`Pago: ${formatCurrency(stats?.totalPago || 0)}`}
            icon={DollarSign}
            variant="primary"
          />
          <MetricCard
            title="Pendente"
            value={formatCurrency(stats?.totalPendente || 0)}
            icon={TrendingUp}
            variant="warning"
          />
          <MetricCard
            title="Em Estoque"
            value={stats?.totalEstoque || 0}
            subtitle="Unidades disponíveis"
            icon={Package}
            variant="success"
          />
          <MetricCard
            title="Fornecedores"
            value={stats?.fornecedores || 0}
            icon={Building2}
          />
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <MetricCard
            title="Total de Clientes"
            value={stats?.customers || 0}
            icon={Users}
          />
          <MetricCard
            title="Leads"
            value={stats?.leads || 0}
            icon={ShoppingCart}
          />
        </div>

        {/* Fornecedores Table */}
        <Card>
          <CardHeader>
            <CardTitle>Resumo por Fornecedor</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Pago</TableHead>
                  <TableHead className="text-right">Pendente</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fornecedoresData?.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.nome_fornecedor}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{f.tipo_fornecedor}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(f.total)}</TableCell>
                    <TableCell className="text-right text-green-600">{formatCurrency(f.pago)}</TableCell>
                    <TableCell className="text-right text-destructive">{formatCurrency(f.pendente)}</TableCell>
                    <TableCell>
                      {f.pendente === 0 ? (
                        <Badge className="bg-green-500">Quitado</Badge>
                      ) : f.pago > 0 ? (
                        <Badge className="bg-yellow-500">Parcial</Badge>
                      ) : (
                        <Badge variant="destructive">Pendente</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {(!fornecedoresData || fornecedoresData.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhum fornecedor cadastrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
