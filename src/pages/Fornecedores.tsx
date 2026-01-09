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
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Building2, Edit, Trash2, DollarSign, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Fornecedor {
  id: string;
  nome_fornecedor: string;
  tipo_fornecedor: string;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  telefone: string | null;
  email: string | null;
  observacoes: string | null;
  created_at: string;
}

interface Pagamento {
  id: string;
  fornecedor_id: string;
  valor_pago: number;
  data_pagamento: string;
  metodo_pagamento: string | null;
  observacoes: string | null;
  pago_por_user_id: string | null;
  pago_por?: {
    full_name: string | null;
  } | null;
}

interface Profile {
  id: string;
  full_name: string | null;
}

const tiposFornecedor = [
  { value: "industrial", label: "Industrial" },
  { value: "grafico", label: "Gráfico" },
  { value: "design", label: "Design" },
  { value: "juridico", label: "Jurídico" },
  { value: "servicos", label: "Serviços" }
];

const metodosPagamento = [
  { value: "pix", label: "PIX" },
  { value: "transferencia", label: "Transferência" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao", label: "Cartão" },
  { value: "boleto", label: "Boleto" }
];

export default function Fornecedores() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isPagamentoOpen, setIsPagamentoOpen] = useState(false);
  const [editingFornecedor, setEditingFornecedor] = useState<Fornecedor | null>(null);
  const [selectedFornecedor, setSelectedFornecedor] = useState<Fornecedor | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState({
    nome_fornecedor: "",
    tipo_fornecedor: "industrial",
    endereco: "",
    cidade: "",
    estado: "",
    cep: "",
    telefone: "",
    email: "",
    observacoes: ""
  });

  const [pagamentoData, setPagamentoData] = useState({
    valor_pago: "",
    data_pagamento: new Date().toISOString().split("T")[0],
    metodo_pagamento: "pix",
    pago_por_user_id: "",
    observacoes: ""
  });

  // Fetch fornecedores
  const { data: fornecedores, isLoading } = useQuery({
    queryKey: ["fornecedores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fornecedores")
        .select("*")
        .order("nome_fornecedor");
      if (error) throw error;
      return data as Fornecedor[];
    },
    enabled: !!profile?.business_id
  });

  // Fetch pagamentos com quem pagou
  const { data: pagamentos } = useQuery({
    queryKey: ["pagamentos-fornecedor"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos_fornecedor")
        .select(`
          *,
          pago_por:profiles!pagamentos_fornecedor_pago_por_user_id_fkey(full_name)
        `)
        .order("data_pagamento", { ascending: false });
      if (error) throw error;
      return data as Pagamento[];
    },
    enabled: !!profile?.business_id
  });

  // Fetch sócios (profiles do mesmo business)
  const { data: socios } = useQuery({
    queryKey: ["socios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("business_id", profile?.business_id);
      if (error) throw error;
      return data as Profile[];
    },
    enabled: !!profile?.business_id
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("fornecedores").insert({
        ...data,
        business_id: profile?.business_id
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      toast.success("Fornecedor criado com sucesso!");
      resetForm();
    },
    onError: () => toast.error("Erro ao criar fornecedor")
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase.from("fornecedores").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      toast.success("Fornecedor atualizado!");
      resetForm();
    },
    onError: () => toast.error("Erro ao atualizar fornecedor")
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fornecedores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      toast.success("Fornecedor excluído!");
    },
    onError: () => toast.error("Erro ao excluir fornecedor")
  });

  const createPagamentoMutation = useMutation({
    mutationFn: async (data: { fornecedor_id: string } & typeof pagamentoData) => {
      const { error } = await supabase.from("pagamentos_fornecedor").insert({
        business_id: profile?.business_id,
        fornecedor_id: data.fornecedor_id,
        valor_pago: parseFloat(data.valor_pago),
        data_pagamento: data.data_pagamento,
        metodo_pagamento: data.metodo_pagamento,
        pago_por_user_id: data.pago_por_user_id || null,
        observacoes: data.observacoes || null
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pagamentos-fornecedor"] });
      toast.success("Pagamento registrado!");
      resetPagamentoForm();
    },
    onError: () => toast.error("Erro ao registrar pagamento")
  });

  const deletePagamentoMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pagamentos_fornecedor").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pagamentos-fornecedor"] });
      toast.success("Pagamento excluído!");
    },
    onError: () => toast.error("Erro ao excluir pagamento")
  });

  const resetForm = () => {
    setFormData({
      nome_fornecedor: "",
      tipo_fornecedor: "industrial",
      endereco: "",
      cidade: "",
      estado: "",
      cep: "",
      telefone: "",
      email: "",
      observacoes: ""
    });
    setEditingFornecedor(null);
    setIsOpen(false);
  };

  const resetPagamentoForm = () => {
    setPagamentoData({
      valor_pago: "",
      data_pagamento: new Date().toISOString().split("T")[0],
      metodo_pagamento: "pix",
      pago_por_user_id: "",
      observacoes: ""
    });
    setSelectedFornecedor(null);
    setIsPagamentoOpen(false);
  };

  const handleEdit = (fornecedor: Fornecedor) => {
    setEditingFornecedor(fornecedor);
    setFormData({
      nome_fornecedor: fornecedor.nome_fornecedor,
      tipo_fornecedor: fornecedor.tipo_fornecedor,
      endereco: fornecedor.endereco || "",
      cidade: fornecedor.cidade || "",
      estado: fornecedor.estado || "",
      cep: fornecedor.cep || "",
      telefone: fornecedor.telefone || "",
      email: fornecedor.email || "",
      observacoes: fornecedor.observacoes || ""
    });
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingFornecedor) {
      updateMutation.mutate({ id: editingFornecedor.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handlePagamentoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFornecedor) return;
    createPagamentoMutation.mutate({
      fornecedor_id: selectedFornecedor.id,
      ...pagamentoData
    });
  };

  const openPagamentoModal = (fornecedor: Fornecedor) => {
    setSelectedFornecedor(fornecedor);
    setIsPagamentoOpen(true);
  };

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const getPagamentosByFornecedor = (fornecedorId: string) => {
    return pagamentos?.filter(p => p.fornecedor_id === fornecedorId) || [];
  };

  const getTotalPagoFornecedor = (fornecedorId: string) => {
    return getPagamentosByFornecedor(fornecedorId).reduce((acc, p) => acc + Number(p.valor_pago), 0);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Fornecedores</h1>
            <p className="text-muted-foreground">Gerencie fornecedores e pagamentos dos sócios</p>
          </div>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Fornecedor
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingFornecedor ? "Editar Fornecedor" : "Novo Fornecedor"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>Nome do Fornecedor *</Label>
                    <Input
                      value={formData.nome_fornecedor}
                      onChange={e => setFormData({ ...formData, nome_fornecedor: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label>Tipo</Label>
                    <Select
                      value={formData.tipo_fornecedor}
                      onValueChange={v => setFormData({ ...formData, tipo_fornecedor: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {tiposFornecedor.map(t => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Telefone</Label>
                    <Input
                      value={formData.telefone}
                      onChange={e => setFormData({ ...formData, telefone: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>CEP</Label>
                    <Input
                      value={formData.cep}
                      onChange={e => setFormData({ ...formData, cep: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Endereço</Label>
                    <Input
                      value={formData.endereco}
                      onChange={e => setFormData({ ...formData, endereco: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Cidade</Label>
                    <Input
                      value={formData.cidade}
                      onChange={e => setFormData({ ...formData, cidade: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Estado</Label>
                    <Input
                      value={formData.estado}
                      onChange={e => setFormData({ ...formData, estado: e.target.value })}
                      maxLength={2}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Observações</Label>
                    <Textarea
                      value={formData.observacoes}
                      onChange={e => setFormData({ ...formData, observacoes: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingFornecedor ? "Salvar" : "Criar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Modal de Pagamento */}
        <Dialog open={isPagamentoOpen} onOpenChange={setIsPagamentoOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Anexar Pagamento - {selectedFornecedor?.nome_fornecedor}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handlePagamentoSubmit} className="space-y-4">
              <div>
                <Label>Quem pagou? *</Label>
                <Select
                  value={pagamentoData.pago_por_user_id}
                  onValueChange={v => setPagamentoData({ ...pagamentoData, pago_por_user_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o sócio" />
                  </SelectTrigger>
                  <SelectContent>
                    {socios?.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.full_name || "Sem nome"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valor Pago *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={pagamentoData.valor_pago}
                  onChange={e => setPagamentoData({ ...pagamentoData, valor_pago: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Data do Pagamento</Label>
                <Input
                  type="date"
                  value={pagamentoData.data_pagamento}
                  onChange={e => setPagamentoData({ ...pagamentoData, data_pagamento: e.target.value })}
                />
              </div>
              <div>
                <Label>Método</Label>
                <Select
                  value={pagamentoData.metodo_pagamento}
                  onValueChange={v => setPagamentoData({ ...pagamentoData, metodo_pagamento: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {metodosPagamento.map(m => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea
                  value={pagamentoData.observacoes}
                  onChange={e => setPagamentoData({ ...pagamentoData, observacoes: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetPagamentoForm}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={!pagamentoData.valor_pago || !pagamentoData.pago_por_user_id}>
                  Registrar Pagamento
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {isLoading ? (
          <div className="flex justify-center py-8">Carregando...</div>
        ) : fornecedores?.length === 0 ? (
          <Card className="p-8 text-center">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Nenhum fornecedor cadastrado</h3>
            <p className="text-muted-foreground">Clique em "Novo Fornecedor" para começar</p>
          </Card>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead className="text-right">Total Pago</TableHead>
                  <TableHead className="w-32">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fornecedores?.map(fornecedor => {
                  const isExpanded = expandedRows.has(fornecedor.id);
                  const pagamentosFornecedor = getPagamentosByFornecedor(fornecedor.id);
                  const totalPago = getTotalPagoFornecedor(fornecedor.id);

                  return (
                    <>
                      <TableRow key={fornecedor.id} className="cursor-pointer" onClick={() => toggleRow(fornecedor.id)}>
                        <TableCell>
                          {pagamentosFornecedor.length > 0 && (
                            isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-primary" />
                            <span className="font-medium">{fornecedor.nome_fornecedor}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {tiposFornecedor.find(t => t.value === fornecedor.tipo_fornecedor)?.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground">
                            {fornecedor.telefone || fornecedor.email || "-"}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(totalPago)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => openPagamentoModal(fornecedor)}
                              title="Anexar pagamento"
                            >
                              <DollarSign className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => handleEdit(fornecedor)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => deleteMutation.mutate(fornecedor.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && pagamentosFornecedor.length > 0 && (
                        <TableRow key={`${fornecedor.id}-pagamentos`} className="bg-muted/30">
                          <TableCell colSpan={6} className="p-0">
                            <div className="p-4">
                              <h4 className="text-sm font-medium mb-2">Pagamentos por sócio:</h4>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Sócio</TableHead>
                                    <TableHead>Data</TableHead>
                                    <TableHead>Método</TableHead>
                                    <TableHead className="text-right">Valor</TableHead>
                                    <TableHead>Observações</TableHead>
                                    <TableHead className="w-10"></TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {pagamentosFornecedor.map(pag => (
                                    <TableRow key={pag.id}>
                                      <TableCell>
                                        <Badge variant="outline">
                                          {pag.pago_por?.full_name || "Não informado"}
                                        </Badge>
                                      </TableCell>
                                      <TableCell>
                                        {format(new Date(pag.data_pagamento), "dd/MM/yyyy", { locale: ptBR })}
                                      </TableCell>
                                      <TableCell>
                                        {metodosPagamento.find(m => m.value === pag.metodo_pagamento)?.label || pag.metodo_pagamento}
                                      </TableCell>
                                      <TableCell className="text-right font-medium text-green-600">
                                        {formatCurrency(Number(pag.valor_pago))}
                                      </TableCell>
                                      <TableCell className="text-muted-foreground text-sm">
                                        {pag.observacoes || "-"}
                                      </TableCell>
                                      <TableCell>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          onClick={() => deletePagamentoMutation.mutate(pag.id)}
                                        >
                                          <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
