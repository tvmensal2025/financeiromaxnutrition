import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, Package, FileText, Building2, Percent, ShoppingCart, Tag } from "lucide-react";

interface ProdutoServico {
  id: string;
  fornecedor_id: string;
  nome_item: string;
  categoria: string;
  valor_unitario: number;
  quantidade: number;
  valor_total: number;
  valor_pago: number;
  quantidade_estoque: number;
  status_pagamento: string;
  fornecedores?: { nome_fornecedor: string };
}

interface ContratoTaxa {
  id: string;
  fornecedor_id: string;
  descricao: string;
  valor: number;
  status_pagamento: string;
  fornecedores?: { nome_fornecedor: string };
}

export default function DashboardFinanceiro() {
  const { profile } = useAuth();

  const { data: produtosServicos } = useQuery({
    queryKey: ["produtos_servicos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos_servicos")
        .select("*, fornecedores(nome_fornecedor)");
      if (error) throw error;
      return data as ProdutoServico[];
    },
    enabled: !!profile?.business_id,
  });

  const { data: contratosTaxas } = useQuery({
    queryKey: ["contratos_taxas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contratos_taxas")
        .select("*, fornecedores(nome_fornecedor)");
      if (error) throw error;
      return data as ContratoTaxa[];
    },
    enabled: !!profile?.business_id,
  });

  const { data: fornecedores } = useQuery({
    queryKey: ["fornecedores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fornecedores").select("*");
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.business_id,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  // Cálculos
  const totalProdutos = produtosServicos?.filter((p) => p.categoria === "produto").reduce((acc, p) => acc + p.valor_total, 0) || 0;
  const totalRotulos = produtosServicos?.filter((p) => p.categoria === "rotulo" || p.categoria === "embalagem").reduce((acc, p) => acc + p.valor_total, 0) || 0;
  const totalServicos = produtosServicos?.filter((p) => p.categoria === "servico").reduce((acc, p) => acc + p.valor_total, 0) || 0;
  const totalContratos = (contratosTaxas?.reduce((acc, c) => acc + c.valor, 0) || 0) + (produtosServicos?.filter((p) => p.categoria === "contrato").reduce((acc, p) => acc + p.valor_total, 0) || 0);
  
  const totalGeral = totalProdutos + totalRotulos + totalServicos + totalContratos;
  const totalPago = (produtosServicos?.reduce((acc, p) => acc + p.valor_pago, 0) || 0) + (contratosTaxas?.filter((c) => c.status_pagamento === "pago").reduce((acc, c) => acc + c.valor, 0) || 0);
  const totalPendente = totalGeral - totalPago;

  const totalEstoque = produtosServicos?.reduce((acc, p) => acc + p.quantidade_estoque, 0) || 0;
  const totalItens = produtosServicos?.reduce((acc, p) => acc + p.quantidade, 0) || 0;

  const custoMedioProduto = produtosServicos?.filter((p) => p.categoria === "produto").length 
    ? totalProdutos / produtosServicos.filter((p) => p.categoria === "produto").length 
    : 0;

  // Totais por fornecedor
  const totaisPorFornecedor = fornecedores?.map((f) => {
    const produtosForn = produtosServicos?.filter((p) => p.fornecedor_id === f.id) || [];
    const contratosForn = contratosTaxas?.filter((c) => c.fornecedor_id === f.id) || [];
    const total = produtosForn.reduce((acc, p) => acc + p.valor_total, 0) + contratosForn.reduce((acc, c) => acc + c.valor, 0);
    const pago = produtosForn.reduce((acc, p) => acc + p.valor_pago, 0) + contratosForn.filter((c) => c.status_pagamento === "pago").reduce((acc, c) => acc + c.valor, 0);
    return { ...f, total, pago, pendente: total - pago };
  }).filter((f) => f.total > 0).sort((a, b) => b.total - a.total);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard Financeiro</h1>
          <p className="text-muted-foreground">Resumo de investimentos e custos do projeto</p>
        </div>

        {/* Cards principais */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Investido</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalGeral)}</div>
              <p className="text-xs text-muted-foreground">
                Pago: {formatCurrency(totalPago)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pendente</CardTitle>
              <TrendingUp className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{formatCurrency(totalPendente)}</div>
              <p className="text-xs text-muted-foreground">
                {((totalPendente / totalGeral) * 100 || 0).toFixed(1)}% do total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Em Estoque</CardTitle>
              <Package className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{totalEstoque}</div>
              <p className="text-xs text-muted-foreground">
                de {totalItens} unidades totais
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Custo Médio/Produto</CardTitle>
              <Percent className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(custoMedioProduto)}</div>
              <p className="text-xs text-muted-foreground">
                Base para precificação
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Totais por categoria */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <ShoppingCart className="h-4 w-4" />
                Produtos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{formatCurrency(totalProdutos)}</div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Tag className="h-4 w-4" />
                Rótulos/Embalagens
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{formatCurrency(totalRotulos)}</div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4" />
                Serviços
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{formatCurrency(totalServicos)}</div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4" />
                Contratos/Taxas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{formatCurrency(totalContratos)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabela por fornecedor */}
        <Card>
          <CardHeader>
            <CardTitle>Total por Fornecedor</CardTitle>
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
                {totaisPorFornecedor?.map((f) => (
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
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Lista de todos os itens */}
        <Card>
          <CardHeader>
            <CardTitle>Detalhamento de Itens</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Valor Unit.</TableHead>
                  <TableHead className="text-center">Qtd</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-center">Estoque</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {produtosServicos?.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.nome_item}</TableCell>
                    <TableCell>{item.fornecedores?.nome_fornecedor}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.categoria}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(item.valor_unitario)}</TableCell>
                    <TableCell className="text-center">{item.quantidade}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(item.valor_total)}</TableCell>
                    <TableCell className="text-center">
                      <span className={item.quantidade_estoque > 0 ? "font-medium text-green-600" : "text-muted-foreground"}>
                        {item.quantidade_estoque}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
