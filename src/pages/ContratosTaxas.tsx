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
import { Plus, FileText, Edit, Trash2, CreditCard, Check, Clock } from "lucide-react";
import { toast } from "sonner";

interface ContratoTaxa {
  id: string;
  fornecedor_id: string;
  descricao: string;
  valor: number;
  status_pagamento: string;
  fornecedores?: { nome_fornecedor: string };
}

interface Fornecedor {
  id: string;
  nome_fornecedor: string;
}

export default function ContratosTaxas() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ContratoTaxa | null>(null);
  const [formData, setFormData] = useState({
    fornecedor_id: "",
    descricao: "",
    valor: 0,
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

  const { data: contratos, isLoading } = useQuery({
    queryKey: ["contratos_taxas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contratos_taxas")
        .select("*, fornecedores(nome_fornecedor)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ContratoTaxa[];
    },
    enabled: !!profile?.business_id,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("contratos_taxas").insert({
        ...data,
        business_id: profile?.business_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contratos_taxas"] });
      toast.success("Contrato/Taxa criado com sucesso!");
      resetForm();
    },
    onError: () => toast.error("Erro ao criar contrato/taxa"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ContratoTaxa> }) => {
      const { error } = await supabase.from("contratos_taxas").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contratos_taxas"] });
      toast.success("Contrato/Taxa atualizado!");
      resetForm();
    },
    onError: () => toast.error("Erro ao atualizar contrato/taxa"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contratos_taxas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contratos_taxas"] });
      toast.success("Contrato/Taxa excluído!");
    },
    onError: () => toast.error("Erro ao excluir contrato/taxa"),
  });

  const marcarPagoMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contratos_taxas").update({ status_pagamento: "pago" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contratos_taxas"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_financeiro"] });
      toast.success("Marcado como pago!");
    },
    onError: () => toast.error("Erro ao atualizar status"),
  });

  const resetForm = () => {
    setFormData({ fornecedor_id: "", descricao: "", valor: 0 });
    setEditingItem(null);
    setIsOpen(false);
  };

  const handleEdit = (item: ContratoTaxa) => {
    setEditingItem(item);
    setFormData({
      fornecedor_id: item.fornecedor_id,
      descricao: item.descricao,
      valor: item.valor,
    });
    setIsOpen(true);
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

  const totalContratos = contratos?.reduce((acc, c) => acc + c.valor, 0) || 0;
  const totalPago = contratos?.filter((c) => c.status_pagamento === "pago").reduce((acc, c) => acc + c.valor, 0) || 0;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Contratos & Taxas</h1>
            <p className="text-muted-foreground">Gerencie contratos e taxas de fornecedores</p>
          </div>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Contrato/Taxa
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingItem ? "Editar" : "Novo Contrato/Taxa"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
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
                <div>
                  <Label>Descrição *</Label>
                  <Textarea
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Valor (R$) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.valor}
                    onChange={(e) => setFormData({ ...formData, valor: parseFloat(e.target.value) || 0 })}
                    required
                  />
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

        {/* Resumo */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Total em Contratos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalContratos)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Pago</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(totalPago)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Pendente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{formatCurrency(totalContratos - totalPago)}</div>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">Carregando...</div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contratos?.map((contrato) => (
                    <TableRow key={contrato.id}>
                      <TableCell className="font-medium">{contrato.descricao}</TableCell>
                      <TableCell>{contrato.fornecedores?.nome_fornecedor}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(contrato.valor)}</TableCell>
                      <TableCell>
                        {contrato.status_pagamento === "pago" ? (
                          <Badge className="bg-green-500">
                            <Check className="mr-1 h-3 w-3" />
                            Pago
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <Clock className="mr-1 h-3 w-3" />
                            Pendente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {contrato.status_pagamento !== "pago" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => marcarPagoMutation.mutate(contrato.id)}
                            >
                              <CreditCard className="h-4 w-4" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(contrato)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(contrato.id)}>
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

        {contratos?.length === 0 && (
          <Card className="p-8 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Nenhum contrato/taxa cadastrado</h3>
            <p className="text-muted-foreground">Clique em "Novo Contrato/Taxa" para começar</p>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
