import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus,
  Search,
  MoreVertical,
  FileText,
  Send,
  Eye,
  Trash2,
  Edit,
  Users,
  Copy,
  CheckCircle,
  Clock,
  XCircle,
  FileSignature,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const CONTRACT_TEMPLATES = [
  {
    id: 'service',
    name: 'Contrato de Prestação de Serviços',
    content: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS

CONTRATANTE: {{contratante_nome}}, inscrito no CPF/CNPJ sob o nº {{contratante_cpf_cnpj}}, com sede/residente em {{contratante_endereco}}.

CONTRATADA: {{contratado_nome}}, inscrita no CNPJ sob o nº {{contratado_cnpj}}, com sede em {{contratado_endereco}}.

CLÁUSULA PRIMEIRA - DO OBJETO
O presente contrato tem por objeto a prestação de serviços de {{descricao_servico}}.

CLÁUSULA SEGUNDA - DO PRAZO
O presente contrato terá vigência de {{prazo}} meses, iniciando-se em {{data_inicio}} e terminando em {{data_fim}}.

CLÁUSULA TERCEIRA - DO VALOR
Pela prestação dos serviços, a CONTRATANTE pagará à CONTRATADA o valor de R$ {{valor}}, a ser pago {{forma_pagamento}}.

CLÁUSULA QUARTA - DAS OBRIGAÇÕES
4.1. São obrigações da CONTRATADA:
a) Executar os serviços com zelo e qualidade;
b) Cumprir os prazos estabelecidos;
c) Manter sigilo sobre as informações do CONTRATANTE.

4.2. São obrigações do CONTRATANTE:
a) Efetuar os pagamentos nas datas acordadas;
b) Fornecer as informações necessárias para a execução dos serviços.

CLÁUSULA QUINTA - DA RESCISÃO
O presente contrato poderá ser rescindido por qualquer das partes, mediante aviso prévio de 30 (trinta) dias.

CLÁUSULA SEXTA - DO FORO
Fica eleito o foro da comarca de {{cidade_foro}} para dirimir quaisquer dúvidas oriundas do presente contrato.

E, por estarem assim justas e contratadas, as partes assinam o presente instrumento.

{{cidade}}, {{data}}.`
  },
  {
    id: 'supply',
    name: 'Contrato de Fornecimento',
    content: `CONTRATO DE FORNECIMENTO DE PRODUTOS

COMPRADOR: {{comprador_nome}}, inscrito no CNPJ sob o nº {{comprador_cnpj}}, com sede em {{comprador_endereco}}.

FORNECEDOR: {{fornecedor_nome}}, inscrito no CNPJ sob o nº {{fornecedor_cnpj}}, com sede em {{fornecedor_endereco}}.

CLÁUSULA PRIMEIRA - DO OBJETO
O presente contrato tem por objeto o fornecimento de {{descricao_produtos}}.

CLÁUSULA SEGUNDA - DA QUANTIDADE E ESPECIFICAÇÕES
Os produtos a serem fornecidos deverão atender às seguintes especificações:
{{especificacoes}}

Quantidade total: {{quantidade}} unidades.

CLÁUSULA TERCEIRA - DO VALOR E PAGAMENTO
O valor total do fornecimento é de R$ {{valor_total}}.
Condições de pagamento: {{condicao_pagamento}}.

CLÁUSULA QUARTA - DA ENTREGA
Os produtos deverão ser entregues em {{local_entrega}} até a data de {{data_entrega}}.

CLÁUSULA QUINTA - DA GARANTIA
O FORNECEDOR garante a qualidade dos produtos pelo período de {{prazo_garantia}}.

{{cidade}}, {{data}}.`
  },
  {
    id: 'partnership',
    name: 'Termo de Parceria',
    content: `TERMO DE PARCERIA

PARCEIRO 1: {{parceiro1_nome}}, inscrito no CPF/CNPJ sob o nº {{parceiro1_documento}}.

PARCEIRO 2: {{parceiro2_nome}}, inscrito no CPF/CNPJ sob o nº {{parceiro2_documento}}.

As partes acima qualificadas resolvem celebrar o presente TERMO DE PARCERIA, nos seguintes termos:

CLÁUSULA PRIMEIRA - DO OBJETIVO
A presente parceria tem por objetivo {{objetivo_parceria}}.

CLÁUSULA SEGUNDA - DAS RESPONSABILIDADES
PARCEIRO 1 será responsável por: {{responsabilidades_parceiro1}}
PARCEIRO 2 será responsável por: {{responsabilidades_parceiro2}}

CLÁUSULA TERCEIRA - DA DIVISÃO DE RESULTADOS
Os resultados obtidos com a parceria serão divididos da seguinte forma:
{{divisao_resultados}}

CLÁUSULA QUARTA - DO PRAZO
Esta parceria terá duração de {{prazo_parceria}}, podendo ser renovada mediante acordo entre as partes.

{{cidade}}, {{data}}.`
  },
  {
    id: 'nda',
    name: 'Acordo de Confidencialidade (NDA)',
    content: `ACORDO DE CONFIDENCIALIDADE

PARTE REVELADORA: {{reveladora_nome}}, inscrita no CNPJ sob o nº {{reveladora_cnpj}}.

PARTE RECEPTORA: {{receptora_nome}}, inscrita no CNPJ sob o nº {{receptora_cnpj}}.

CLÁUSULA PRIMEIRA - OBJETO
Este acordo estabelece os termos e condições para a proteção de informações confidenciais compartilhadas entre as partes.

CLÁUSULA SEGUNDA - INFORMAÇÕES CONFIDENCIAIS
Consideram-se informações confidenciais: dados técnicos, comerciais, financeiros, estratégicos, listas de clientes, códigos-fonte, processos, metodologias e quaisquer outras informações que não sejam de domínio público.

CLÁUSULA TERCEIRA - OBRIGAÇÕES DA PARTE RECEPTORA
A PARTE RECEPTORA compromete-se a:
a) Manter sigilo absoluto sobre as informações recebidas;
b) Utilizar as informações apenas para a finalidade acordada;
c) Não divulgar as informações a terceiros sem autorização prévia;
d) Devolver ou destruir as informações ao término deste acordo.

CLÁUSULA QUARTA - PRAZO
Este acordo terá vigência de {{prazo_anos}} anos a contar da data de assinatura.

CLÁUSULA QUINTA - PENALIDADES
O descumprimento deste acordo sujeitará a parte infratora ao pagamento de multa no valor de R$ {{valor_multa}}, sem prejuízo das demais sanções legais.

{{cidade}}, {{data}}.`
  }
];

export default function ContratosDigitais() {
  const { business } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSignatariosOpen, setIsSignatariosOpen] = useState(false);
  const [selectedContrato, setSelectedContrato] = useState<any>(null);
  const [newContrato, setNewContrato] = useState({
    titulo: "",
    conteudo: "",
    valor_total: 0,
    fornecedor_id: "",
  });
  const [newSignatario, setNewSignatario] = useState({
    signatario_tipo: "contratante",
    signatario_nome: "",
    signatario_cpf_cnpj: "",
    signatario_email: "",
  });

  // Fetch contratos
  const { data: contratos = [], isLoading } = useQuery({
    queryKey: ["contratos-digitais", business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      const { data, error } = await supabase
        .from("contratos_digitais")
        .select(`
          *,
          fornecedor:fornecedores(nome_fornecedor),
          assinaturas:assinaturas_contrato(*)
        `)
        .eq("business_id", business.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!business?.id,
  });

  // Fetch fornecedores
  const { data: fornecedores = [] } = useQuery({
    queryKey: ["fornecedores-select", business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      const { data, error } = await supabase
        .from("fornecedores")
        .select("id, nome_fornecedor")
        .eq("business_id", business.id);

      if (error) throw error;
      return data || [];
    },
    enabled: !!business?.id,
  });

  // Create contrato
  const createContratoMutation = useMutation({
    mutationFn: async (contrato: typeof newContrato) => {
      if (!business?.id) throw new Error("Business not found");
      const { data, error } = await supabase
        .from("contratos_digitais")
        .insert({
          business_id: business.id,
          titulo: contrato.titulo,
          conteudo: contrato.conteudo,
          valor_total: contrato.valor_total,
          fornecedor_id: contrato.fornecedor_id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contratos-digitais"] });
      setIsCreateOpen(false);
      setNewContrato({ titulo: "", conteudo: "", valor_total: 0, fornecedor_id: "" });
      toast.success("Contrato criado com sucesso!");
    },
    onError: (error) => {
      toast.error(`Erro ao criar contrato: ${error.message}`);
    },
  });

  // Delete contrato
  const deleteContratoMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("contratos_digitais")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contratos-digitais"] });
      toast.success("Contrato excluído!");
    },
    onError: (error) => {
      toast.error(`Erro ao excluir: ${error.message}`);
    },
  });

  // Add signatário
  const addSignatarioMutation = useMutation({
    mutationFn: async ({ contrato_id, signatario }: { contrato_id: string; signatario: typeof newSignatario }) => {
      const { error } = await supabase
        .from("assinaturas_contrato")
        .insert({
          contrato_id,
          signatario_tipo: signatario.signatario_tipo,
          signatario_nome: signatario.signatario_nome,
          signatario_cpf_cnpj: signatario.signatario_cpf_cnpj,
          signatario_email: signatario.signatario_email,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contratos-digitais"] });
      setNewSignatario({ signatario_tipo: "contratante", signatario_nome: "", signatario_cpf_cnpj: "", signatario_email: "" });
      toast.success("Signatário adicionado!");
    },
    onError: (error) => {
      toast.error(`Erro ao adicionar signatário: ${error.message}`);
    },
  });

  // Update status to aguardando_assinatura
  const enviarParaAssinaturaMutation = useMutation({
    mutationFn: async (contrato_id: string) => {
      const { error } = await supabase
        .from("contratos_digitais")
        .update({ status: "aguardando_assinatura" })
        .eq("id", contrato_id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contratos-digitais"] });
      toast.success("Contrato enviado para assinatura!");
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
      rascunho: { label: "Rascunho", variant: "secondary", icon: FileText },
      aguardando_assinatura: { label: "Aguardando", variant: "outline", icon: Clock },
      assinado: { label: "Assinado", variant: "default", icon: CheckCircle },
      cancelado: { label: "Cancelado", variant: "destructive", icon: XCircle },
    };

    const config = statusConfig[status] || statusConfig.rascunho;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getSignatureProgress = (assinaturas: any[]) => {
    if (!assinaturas || assinaturas.length === 0) return "0/0";
    const assinados = assinaturas.filter(a => a.status === "assinado").length;
    return `${assinados}/${assinaturas.length}`;
  };

  const copySignatureLink = (token: string) => {
    const link = `${window.location.origin}/assinar/${token}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copiado para a área de transferência!");
  };

  const filteredContratos = contratos.filter(
    (c: any) =>
      c.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.fornecedor?.nome_fornecedor?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const applyTemplate = (templateId: string) => {
    const template = CONTRACT_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setNewContrato({ ...newContrato, titulo: template.name, conteudo: template.content });
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileSignature className="h-6 w-6" />
              Contratos Digitais
            </h1>
            <p className="text-muted-foreground">
              Crie e gerencie contratos com validade jurídica
            </p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Contrato
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Criar Novo Contrato</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Título do Contrato</Label>
                    <Input
                      value={newContrato.titulo}
                      onChange={(e) => setNewContrato({ ...newContrato, titulo: e.target.value })}
                      placeholder="Ex: Contrato de Prestação de Serviços"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Valor Total (R$)</Label>
                    <Input
                      type="number"
                      value={newContrato.valor_total}
                      onChange={(e) => setNewContrato({ ...newContrato, valor_total: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Fornecedor (opcional)</Label>
                    <Select
                      value={newContrato.fornecedor_id}
                      onValueChange={(value) => setNewContrato({ ...newContrato, fornecedor_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um fornecedor" />
                      </SelectTrigger>
                      <SelectContent>
                        {fornecedores.map((f: any) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.nome_fornecedor}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Usar Template</Label>
                    <Select onValueChange={applyTemplate}>
                      <SelectTrigger>
                        <SelectValue placeholder="Escolha um template" />
                      </SelectTrigger>
                      <SelectContent>
                        {CONTRACT_TEMPLATES.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Conteúdo do Contrato</Label>
                  <Textarea
                    value={newContrato.conteudo}
                    onChange={(e) => setNewContrato({ ...newContrato, conteudo: e.target.value })}
                    placeholder="Digite o conteúdo completo do contrato..."
                    className="min-h-[400px] font-mono text-sm"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => createContratoMutation.mutate(newContrato)}
                    disabled={!newContrato.titulo || !newContrato.conteudo}
                  >
                    Criar Contrato
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar contratos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Contratos Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assinaturas</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredContratos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum contrato encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredContratos.map((contrato: any) => (
                  <TableRow key={contrato.id}>
                    <TableCell className="font-medium">{contrato.titulo}</TableCell>
                    <TableCell>{contrato.fornecedor?.nome_fornecedor || "-"}</TableCell>
                    <TableCell>
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(contrato.valor_total)}
                    </TableCell>
                    <TableCell>{getStatusBadge(contrato.status)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getSignatureProgress(contrato.assinaturas)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(contrato.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/contratos-digitais/${contrato.id}`)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Visualizar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setSelectedContrato(contrato);
                            setIsSignatariosOpen(true);
                          }}>
                            <Users className="h-4 w-4 mr-2" />
                            Signatários
                          </DropdownMenuItem>
                          {contrato.status === "rascunho" && contrato.assinaturas?.length > 0 && (
                            <DropdownMenuItem onClick={() => enviarParaAssinaturaMutation.mutate(contrato.id)}>
                              <Send className="h-4 w-4 mr-2" />
                              Enviar para Assinatura
                            </DropdownMenuItem>
                          )}
                          {contrato.status !== "rascunho" && (
                            <DropdownMenuItem onClick={() => copySignatureLink(contrato.token_assinatura)}>
                              <Copy className="h-4 w-4 mr-2" />
                              Copiar Link
                            </DropdownMenuItem>
                          )}
                          {contrato.status === "rascunho" && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => deleteContratoMutation.mutate(contrato.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Dialog de Signatários */}
        <Dialog open={isSignatariosOpen} onOpenChange={setIsSignatariosOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Gerenciar Signatários</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Lista de signatários existentes */}
              {selectedContrato?.assinaturas?.length > 0 && (
                <div className="space-y-2">
                  <Label>Signatários Adicionados</Label>
                  <div className="border rounded-lg divide-y">
                    {selectedContrato.assinaturas.map((sig: any) => (
                      <div key={sig.id} className="p-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium">{sig.signatario_nome}</p>
                          <p className="text-sm text-muted-foreground">
                            {sig.signatario_tipo} - {sig.signatario_email}
                          </p>
                        </div>
                        <Badge variant={sig.status === "assinado" ? "default" : "secondary"}>
                          {sig.status === "assinado" ? "Assinado" : "Pendente"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Adicionar novo signatário */}
              {selectedContrato?.status === "rascunho" && (
                <div className="space-y-4 border-t pt-4">
                  <Label>Adicionar Novo Signatário</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tipo</Label>
                      <Select
                        value={newSignatario.signatario_tipo}
                        onValueChange={(value) => setNewSignatario({ ...newSignatario, signatario_tipo: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="contratante">Contratante</SelectItem>
                          <SelectItem value="contratado">Contratado</SelectItem>
                          <SelectItem value="testemunha">Testemunha</SelectItem>
                          <SelectItem value="socio">Sócio</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Nome Completo</Label>
                      <Input
                        value={newSignatario.signatario_nome}
                        onChange={(e) => setNewSignatario({ ...newSignatario, signatario_nome: e.target.value })}
                        placeholder="Nome do signatário"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>CPF/CNPJ</Label>
                      <Input
                        value={newSignatario.signatario_cpf_cnpj}
                        onChange={(e) => setNewSignatario({ ...newSignatario, signatario_cpf_cnpj: e.target.value })}
                        placeholder="000.000.000-00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={newSignatario.signatario_email}
                        onChange={(e) => setNewSignatario({ ...newSignatario, signatario_email: e.target.value })}
                        placeholder="email@exemplo.com"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      if (selectedContrato) {
                        addSignatarioMutation.mutate({
                          contrato_id: selectedContrato.id,
                          signatario: newSignatario,
                        });
                      }
                    }}
                    disabled={!newSignatario.signatario_nome || !newSignatario.signatario_email}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Signatário
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
