import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Users, Edit, Trash2, Loader2, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface Socio {
  id: string;
  nome: string;
  cpf: string | null;
  email: string | null;
  telefone: string | null;
  percentual_participacao: number;
  is_active: boolean;
  created_at: string;
}

export default function Socios() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editingSocio, setEditingSocio] = useState<Socio | null>(null);

  const [formData, setFormData] = useState({
    nome: "",
    cpf: "",
    email: "",
    telefone: "",
    percentual_participacao: 0,
    is_active: true
  });

  // Fetch socios
  const { data: socios, isLoading } = useQuery({
    queryKey: ["socios-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("socios")
        .select("*")
        .eq("business_id", profile?.business_id)
        .order("nome");
      if (error) throw error;
      return data as Socio[];
    },
    enabled: !!profile?.business_id
  });

  // Fetch total pagamentos por sócio
  const { data: pagamentosPorSocio } = useQuery({
    queryKey: ["pagamentos-por-socio"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos_fornecedor")
        .select("socio_id, valor_pago")
        .eq("business_id", profile?.business_id);
      if (error) throw error;
      
      const totals: Record<string, number> = {};
      data?.forEach(p => {
        if (p.socio_id) {
          totals[p.socio_id] = (totals[p.socio_id] || 0) + Number(p.valor_pago);
        }
      });
      return totals;
    },
    enabled: !!profile?.business_id
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("socios").insert({
        ...data,
        business_id: profile?.business_id
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["socios-list"] });
      queryClient.invalidateQueries({ queryKey: ["socios"] });
      toast.success("Sócio adicionado com sucesso!");
      resetForm();
    },
    onError: () => toast.error("Erro ao adicionar sócio")
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase.from("socios").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["socios-list"] });
      queryClient.invalidateQueries({ queryKey: ["socios"] });
      toast.success("Sócio atualizado!");
      resetForm();
    },
    onError: () => toast.error("Erro ao atualizar sócio")
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("socios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["socios-list"] });
      queryClient.invalidateQueries({ queryKey: ["socios"] });
      toast.success("Sócio excluído!");
    },
    onError: () => toast.error("Erro ao excluir sócio. Verifique se não há pagamentos associados.")
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("socios").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["socios-list"] });
      queryClient.invalidateQueries({ queryKey: ["socios"] });
      toast.success("Status atualizado!");
    },
    onError: () => toast.error("Erro ao atualizar status")
  });

  const resetForm = () => {
    setFormData({
      nome: "",
      cpf: "",
      email: "",
      telefone: "",
      percentual_participacao: 0,
      is_active: true
    });
    setEditingSocio(null);
    setIsOpen(false);
  };

  const handleEdit = (socio: Socio) => {
    setEditingSocio(socio);
    setFormData({
      nome: socio.nome,
      cpf: socio.cpf || "",
      email: socio.email || "",
      telefone: socio.telefone || "",
      percentual_participacao: socio.percentual_participacao,
      is_active: socio.is_active
    });
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSocio) {
      updateMutation.mutate({ id: editingSocio.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const totalParticipacao = socios?.reduce((acc, s) => acc + (s.is_active ? s.percentual_participacao : 0), 0) || 0;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Sócios</h1>
            <p className="text-muted-foreground">Gerencie os sócios do negócio</p>
          </div>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Sócio
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingSocio ? "Editar Sócio" : "Novo Sócio"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Nome *</Label>
                  <Input
                    value={formData.nome}
                    onChange={e => setFormData({ ...formData, nome: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>CPF</Label>
                    <Input
                      value={formData.cpf}
                      onChange={e => setFormData({ ...formData, cpf: e.target.value })}
                      placeholder="000.000.000-00"
                    />
                  </div>
                  <div>
                    <Label>Telefone</Label>
                    <Input
                      value={formData.telefone}
                      onChange={e => setFormData({ ...formData, telefone: e.target.value })}
                    />
                  </div>
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
                  <Label>Participação (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.percentual_participacao}
                    onChange={e => setFormData({ ...formData, percentual_participacao: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="is_active">Ativo</Label>
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={checked => setFormData({ ...formData, is_active: checked })}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {(createMutation.isPending || updateMutation.isPending) && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {editingSocio ? "Salvar" : "Criar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Sócios</p>
                <p className="text-2xl font-bold">{socios?.filter(s => s.is_active).length || 0}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                <DollarSign className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Investido</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(Object.values(pagamentosPorSocio || {}).reduce((a, b) => a + b, 0))}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${totalParticipacao === 100 ? 'bg-success/10' : 'bg-warning/10'}`}>
                <span className={`text-lg font-bold ${totalParticipacao === 100 ? 'text-success' : 'text-warning'}`}>%</span>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Participação Total</p>
                <p className={`text-2xl font-bold ${totalParticipacao === 100 ? 'text-success' : 'text-warning'}`}>
                  {totalParticipacao.toFixed(2)}%
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : socios?.length === 0 ? (
          <Card className="p-10 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">Nenhum sócio cadastrado</h3>
            <p className="text-muted-foreground">Adicione sócios para gerenciar pagamentos</p>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead className="text-right">Participação</TableHead>
                  <TableHead className="text-right">Total Investido</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {socios?.map(socio => (
                  <TableRow key={socio.id}>
                    <TableCell className="font-medium">{socio.nome}</TableCell>
                    <TableCell>{socio.cpf || "-"}</TableCell>
                    <TableCell>{socio.email || "-"}</TableCell>
                    <TableCell>{socio.telefone || "-"}</TableCell>
                    <TableCell className="text-right font-medium">
                      {socio.percentual_participacao.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right font-medium text-success">
                      {formatCurrency(pagamentosPorSocio?.[socio.id] || 0)}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={socio.is_active}
                        onCheckedChange={checked => toggleActiveMutation.mutate({ id: socio.id, is_active: checked })}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(socio)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("Tem certeza que deseja excluir este sócio?")) {
                              deleteMutation.mutate(socio.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
