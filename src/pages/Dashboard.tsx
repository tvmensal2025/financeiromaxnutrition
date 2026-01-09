import { useState } from 'react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface FornecedorResumo {
  id: string;
  nome_fornecedor: string;
  tipo_fornecedor: string;
  total: number;
  pago: number;
  pendente: number;
  produtos: Array<{
    id: string;
    nome_item: string;
    quantidade: number;
    valor_unitario: number;
    valor_total: number;
    valor_pago: number;
  }>;
  contratos: Array<{
    id: string;
    descricao: string;
    valor: number;
    status_pagamento: string;
  }>;
}

export default function Dashboard() {
  const { profile } = useAuth();
  const [selectedFornecedor, setSelectedFornecedor] = useState<FornecedorResumo | null>(null);
  
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [customersRes, leadsRes, fornecedoresRes, produtosRes, contratosRes, pagamentosRes] = await Promise.all([
        supabase.from('customers').select('id', { count: 'exact' }),
        supabase.from('leads').select('id', { count: 'exact' }),
        supabase.from('fornecedores').select('id', { count: 'exact' }),
        supabase.from('produtos_servicos').select('*'),
        supabase.from('contratos_taxas').select('*'),
        supabase.from('pagamentos_fornecedor').select('*'),
      ]);

      const customers = customersRes.count || 0;
      const leads = leadsRes.count || 0;
      const fornecedores = fornecedoresRes.count || 0;
      const produtos = produtosRes.data || [];
      const contratos = contratosRes.data || [];
      const pagamentos = pagamentosRes.data || [];

      const totalProdutos = produtos.reduce((acc, p) => acc + (p.valor_total || 0), 0);
      const totalContratos = contratos.reduce((acc, c) => acc + (c.valor || 0), 0);
      const totalInvestido = totalProdutos + totalContratos;
      
      // Calcular total pago a partir da tabela pagamentos_fornecedor
      const totalPagoPagamentos = pagamentos.reduce((acc, p) => acc + Number(p.valor_pago || 0), 0);
      const totalPagoContratos = contratos.filter((c) => c.status_pagamento === 'pago').reduce((acc, c) => acc + (c.valor || 0), 0);
      const totalPago = totalPagoPagamentos + totalPagoContratos;
      
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
      const { data: pagamentos } = await supabase.from('pagamentos_fornecedor').select('*');

      return fornecedores?.map((f) => {
        const produtosForn = produtos?.filter((p) => p.fornecedor_id === f.id) || [];
        const contratosForn = contratos?.filter((c) => c.fornecedor_id === f.id) || [];
        const pagamentosForn = pagamentos?.filter((p) => p.fornecedor_id === f.id) || [];
        
        const total = produtosForn.reduce((acc, p) => acc + (p.valor_total || 0), 0) + contratosForn.reduce((acc, c) => acc + c.valor, 0);
        // Usar pagamentos da tabela pagamentos_fornecedor
        const pago = pagamentosForn.reduce((acc, p) => acc + Number(p.valor_pago || 0), 0) + contratosForn.filter((c) => c.status_pagamento === 'pago').reduce((acc, c) => acc + c.valor, 0);
        return { 
          ...f, 
          total, 
          pago, 
          pendente: total - pago,
          produtos: produtosForn,
          contratos: contratosForn,
        } as FornecedorResumo;
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
                  <TableRow 
                    key={f.id} 
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setSelectedFornecedor(f)}
                  >
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

        {/* Modal de Detalhes do Fornecedor */}
        <Dialog open={!!selectedFornecedor} onOpenChange={() => setSelectedFornecedor(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {selectedFornecedor?.nome_fornecedor}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* Resumo */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-muted/50 p-3 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-lg font-bold">{formatCurrency(selectedFornecedor?.total || 0)}</p>
                </div>
                <div className="bg-green-500/10 p-3 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">Pago</p>
                  <p className="text-lg font-bold text-green-600">{formatCurrency(selectedFornecedor?.pago || 0)}</p>
                </div>
                <div className="bg-destructive/10 p-3 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">Pendente</p>
                  <p className="text-lg font-bold text-destructive">{formatCurrency(selectedFornecedor?.pendente || 0)}</p>
                </div>
              </div>

              {/* Produtos/Serviços */}
              {selectedFornecedor?.produtos && selectedFornecedor.produtos.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Produtos/Serviços
                  </h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">Valor Unit.</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Pago</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedFornecedor.produtos.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.nome_item}</TableCell>
                          <TableCell className="text-right">{p.quantidade}</TableCell>
                          <TableCell className="text-right">{formatCurrency(p.valor_unitario)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(p.valor_total)}</TableCell>
                          <TableCell className="text-right text-green-600">{formatCurrency(p.valor_pago)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Contratos/Taxas */}
              {selectedFornecedor?.contratos && selectedFornecedor.contratos.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Contratos/Taxas
                  </h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedFornecedor.contratos.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.descricao}</TableCell>
                          <TableCell className="text-right">{formatCurrency(c.valor)}</TableCell>
                          <TableCell>
                            <Badge className={c.status_pagamento === 'pago' ? 'bg-green-500' : 'bg-yellow-500'}>
                              {c.status_pagamento === 'pago' ? 'Pago' : 'Pendente'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
