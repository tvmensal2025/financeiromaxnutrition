import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Package, Edit, Trash2, CreditCard, Check, Clock } from "lucide-react";
import { toast } from "sonner";

interface ProdutoServico {
  id: string;
  fornecedor_id: string;
  nome_item: string;
  categoria: string;
  descricao: string | null;
  valor_unitario: number;
  quantidade: number;
  quantidade_paga: number;
  quantidade_estoque: number;
  valor_total: number;
  valor_pago: number;
  condicao_pagamento: string | null;
  status_pagamento: string;
  fornecedores?: { nome_fornecedor: string };
}

interface Fornecedor {
  id: string;
  nome_fornecedor: string;
}

const categorias = [
  { value: "produto", label: "Produto" },
  { value: "servico", label: "Serviço" },
  { value: "contrato", label: "Contrato" },
  { value: "embalagem", label: "Embalagem" },
  { value: "rotulo", label: "Rótulo" },
];

export default function ProdutosServicos() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isPagamentoOpen, setIsPagamentoOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ProdutoServico | null>(null);
  const [editingItem, setEditingItem] = useState<ProdutoServico | null>(null);
  const [pagamentoData, setPagamentoData] = useState({ valor: 0, quantidade: 0, metodo: "" });
  const [formData, setFormData] = useState({
    fornecedor_id: "",
    nome_item: "",
    categoria: "produto",
    descricao: "",
    valor_unitario: 0,
    quantidade: 0,
    condicao_pagamento: "",
  });

  const { data: fornecedores } = useQuery({
    queryKey: ["fornecedores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fornecedores").select("id, nome_fornecedor").order("nome_fornecedor");
      if (error) throw error;
      return data as Fornecedor[];
    },
    enabled: !!profile?.business_id,
  });

  const { data: items, isLoading } = useQuery({
    queryKey: ["produtos_servicos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos_servicos")
        .select("*, fornecedores(nome_fornecedor)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ProdutoServico[];
    },
    enabled: !!profile?.business_id,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("produtos_servicos").insert({
        ...data,
        business_id: profile?.business_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos_servicos"] });
      toast.success("Item criado com sucesso!");
      resetForm();
    },
    onError: () => toast.error("Erro ao criar item"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase.from("produtos_servicos").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos_servicos"] });
      toast.success("Item atualizado!");
      resetForm();
    },
    onError: () => toast.error("Erro ao atualizar item"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("produtos_servicos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos_servicos"] });
      toast.success("Item excluído!");
    },
    onError: () => toast.error("Erro ao excluir item"),
  });

  const pagamentoMutation = useMutation({
    mutationFn: async ({ item, valor, quantidade, metodo }: { item: ProdutoServico; valor: number; quantidade: number; metodo: string }) => {
      // Registrar pagamento
      const { error: pagError } = await supabase.from("pagamentos_fornecedor").insert({
        business_id: profile?.business_id,
        produto_servico_id: item.id,
        valor_pago: valor,
        quantidade_liberada: quantidade,
        metodo_pagamento: metodo,
      });
      if (pagError) throw pagError;

      // Atualizar produto com novo estoque
      const novaQuantidadePaga = item.quantidade_paga + quantidade;
      const novoEstoque = item.quantidade_estoque + quantidade;
      const novoValorPago = item.valor_pago + valor;
      const novoStatus = novaQuantidadePaga >= item.quantidade ? "pago" : "parcial";

      const { error: updateError } = await supabase
        .from("produtos_servicos")
        .update({
          quantidade_paga: novaQuantidadePaga,
          quantidade_estoque: novoEstoque,
          valor_pago: novoValorPago,
          status_pagamento: novoStatus,
        })
        .eq("id", item.id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos_servicos"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_financeiro"] });
      toast.success("Pagamento registrado e estoque liberado!");
      setIsPagamentoOpen(false);
      setSelectedItem(null);
      setPagamentoData({ valor: 0, quantidade: 0, metodo: "" });
    },
    onError: () => toast.error("Erro ao registrar pagamento"),
  });

  const resetForm = () => {
    setFormData({
      fornecedor_id: "",
      nome_item: "",
      categoria: "produto",
      descricao: "",
      valor_unitario: 0,
      quantidade: 0,
      condicao_pagamento: "",
    });
    setEditingItem(null);
    setIsOpen(false);
  };

  const handleEdit = (item: ProdutoServico) => {
    setEditingItem(item);
    setFormData({
      fornecedor_id: item.fornecedor_id,
      nome_item: item.nome_item,
      categoria: item.categoria,
      descricao: item.descricao || "",
      valor_unitario: item.valor_unitario,
      quantidade: item.quantidade,
      condicao_pagamento: item.condicao_pagamento || "",
    });
    setIsOpen(true);
  };

  const handlePagamento = (item: ProdutoServico) => {
    setSelectedItem(item);
    const restante = item.quantidade - item.quantidade_paga;
    const valorRestante = restante * item.valor_unitario;
    setPagamentoData({ valor: valorRestante, quantidade: restante, metodo: "" });
    setIsPagamentoOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const getStatusBadge = (item: ProdutoServico) => {
    if (item.status_pagamento === "pago") {
      return <Badge className="bg-green-500"><Check className="mr-1 h-3 w-3" />Pago</Badge>;
    }
    if (item.status_pagamento === "parcial") {
      return <Badge className="bg-yellow-500"><Clock className="mr-1 h-3 w-3" />Parcial</Badge>;
    }
    return <Badge variant="destructive"><Clock className="mr-1 h-3 w-3" />Pendente</Badge>;
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Produtos & Serviços</h1>
            <p className="text-muted-foreground">Gerencie itens de fornecedores</p>
          </div>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingItem ? "Editar Item" : "Novo Item"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>Fornecedor *</Label>
                    <Select
                      value={formData.fornecedor_id}
                      onValueChange={(v) => setFormData({ ...formData, fornecedor_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um fornecedor" />
                      </SelectTrigger>
                      <SelectContent>
                        {fornecedores?.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.nome_fornecedor}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label>Nome do Item *</Label>
                    <Input
                      value={formData.nome_item}
                      onChange={(e) => setFormData({ ...formData, nome_item: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label>Categoria</Label>
                    <Select
                      value={formData.categoria}
                      onValueChange={(v) => setFormData({ ...formData, categoria: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categorias.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Condição de Pagamento</Label>
                    <Input
                      value={formData.condicao_pagamento}
                      onChange={(e) => setFormData({ ...formData, condicao_pagamento: e.target.value })}
                      placeholder="Ex: à vista, 30 dias"
                    />
                  </div>
                  <div>
                    <Label>Valor Unitário (R$) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.valor_unitario}
                      onChange={(e) => setFormData({ ...formData, valor_unitario: parseFloat(e.target.value) || 0 })}
                      required
                    />
                  </div>
                  <div>
                    <Label>Quantidade *</Label>
                    <Input
                      type="number"
                      value={formData.quantidade}
                      onChange={(e) => setFormData({ ...formData, quantidade: parseInt(e.target.value) || 0 })}
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Descrição</Label>
                    <Textarea
                      value={formData.descricao}
                      onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancelar
                  </Button>
                  <Button type="submit">{editingItem ? "Salvar" : "Criar"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Dialog de Pagamento */}
        <Dialog open={isPagamentoOpen} onOpenChange={setIsPagamentoOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Pagamento</DialogTitle>
            </DialogHeader>
            {selectedItem && (
              <div className="space-y-4">
                <div className="rounded-lg bg-muted p-4">
                  <p className="font-medium">{selectedItem.nome_item}</p>
                  <p className="text-sm text-muted-foreground">
                    Restante: {selectedItem.quantidade - selectedItem.quantidade_paga} unidades
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Valor restante: {formatCurrency((selectedItem.quantidade - selectedItem.quantidade_paga) * selectedItem.valor_unitario)}
                  </p>
                </div>
                <div>
                  <Label>Quantidade a Liberar para Estoque</Label>
                  <Input
                    type="number"
                    value={pagamentoData.quantidade}
                    onChange={(e) => {
                      const qty = parseInt(e.target.value) || 0;
                      setPagamentoData({
                        ...pagamentoData,
                        quantidade: qty,
                        valor: qty * selectedItem.valor_unitario,
                      });
                    }}
                    max={selectedItem.quantidade - selectedItem.quantidade_paga}
                  />
                </div>
                <div>
                  <Label>Valor do Pagamento (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={pagamentoData.valor}
                    onChange={(e) => setPagamentoData({ ...pagamentoData, valor: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>Método de Pagamento</Label>
                  <Select
                    value={pagamentoData.metodo}
                    onValueChange={(v) => setPagamentoData({ ...pagamentoData, metodo: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="transferencia">Transferência</SelectItem>
                      <SelectItem value="boleto">Boleto</SelectItem>
                      <SelectItem value="cartao">Cartão</SelectItem>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsPagamentoOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={() =>
                      pagamentoMutation.mutate({
                        item: selectedItem,
                        valor: pagamentoData.valor,
                        quantidade: pagamentoData.quantidade,
                        metodo: pagamentoData.metodo,
                      })
                    }
                    disabled={pagamentoData.quantidade <= 0 || pagamentoData.valor <= 0}
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    Confirmar Pagamento
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {isLoading ? (
          <div className="flex justify-center py-8">Carregando...</div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Valor Unit.</TableHead>
                    <TableHead className="text-center">Qtd</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead className="text-center">Estoque</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.nome_item}</TableCell>
                      <TableCell>{item.fornecedores?.nome_fornecedor}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {categorias.find((c) => c.value === item.categoria)?.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(item.valor_unitario)}</TableCell>
                      <TableCell className="text-center">{item.quantidade}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(item.valor_total)}</TableCell>
                      <TableCell className="text-center">
                        <span className={item.quantidade_estoque > 0 ? "text-green-600 font-medium" : "text-muted-foreground"}>
                          {item.quantidade_estoque}
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(item)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {item.status_pagamento !== "pago" && (
                            <Button size="sm" variant="outline" onClick={() => handlePagamento(item)}>
                              <CreditCard className="h-4 w-4" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(item)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(item.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {items?.length === 0 && (
          <Card className="p-8 text-center">
            <Package className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Nenhum item cadastrado</h3>
            <p className="text-muted-foreground">Cadastre primeiro os fornecedores, depois adicione os itens</p>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
