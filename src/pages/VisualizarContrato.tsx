import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  FileSignature,
  CheckCircle,
  Clock,
  XCircle,
  User,
  MapPin,
  Shield,
  Monitor,
  Copy,
  Download,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

export default function VisualizarContrato() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { business } = useAuth();

  // Fetch contrato
  const { data: contrato, isLoading } = useQuery({
    queryKey: ["contrato-detalhe", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("contratos_digitais")
        .select(`
          *,
          fornecedor:fornecedores(nome_fornecedor),
          assinaturas:assinaturas_contrato(*),
          audit_logs:contratos_audit_log(*)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
      rascunho: { label: "Rascunho", variant: "secondary", icon: FileText },
      aguardando_assinatura: { label: "Aguardando Assinaturas", variant: "outline", icon: Clock },
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

  const copySignatureLink = () => {
    if (contrato?.token_assinatura) {
      const link = `${window.location.origin}/assinar/${contrato.token_assinatura}`;
      navigator.clipboard.writeText(link);
      toast.success("Link copiado!");
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <span>Carregando...</span>
        </div>
      </MainLayout>
    );
  }

  if (!contrato) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold">Contrato não encontrado</h2>
          <Button variant="link" onClick={() => navigate("/contratos-digitais")}>
            Voltar para lista
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/contratos-digitais")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <FileSignature className="h-6 w-6" />
                {contrato.titulo}
              </h1>
              <p className="text-muted-foreground">
                Criado em {format(new Date(contrato.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(contrato.status)}
            {contrato.status !== 'rascunho' && (
              <Button variant="outline" size="sm" onClick={copySignatureLink}>
                <Copy className="h-4 w-4 mr-2" />
                Copiar Link
              </Button>
            )}
          </div>
        </div>

        <Tabs defaultValue="contrato" className="space-y-4">
          <TabsList>
            <TabsTrigger value="contrato">Contrato</TabsTrigger>
            <TabsTrigger value="assinaturas">
              Assinaturas ({contrato.assinaturas?.filter((a: any) => a.status === 'assinado').length || 0}/{contrato.assinaturas?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
          </TabsList>

          {/* Tab: Contrato */}
          <TabsContent value="contrato">
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Conteúdo do Contrato</CardTitle>
                </CardHeader>
                <CardContent>
                  {contrato.status === 'assinado' && (
                    <div className="mb-4 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="text-green-700 dark:text-green-400 font-medium">
                        DOCUMENTO ASSINADO DIGITALMENTE
                      </span>
                    </div>
                  )}
                  <pre className="whitespace-pre-wrap font-sans text-sm bg-muted/50 p-4 rounded-lg max-h-[500px] overflow-y-auto">
                    {contrato.conteudo}
                  </pre>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Informações</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <span className="text-sm text-muted-foreground">Valor Total</span>
                      <p className="text-lg font-semibold">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(contrato.valor_total)}
                      </p>
                    </div>
                    {contrato.fornecedor && (
                      <div>
                        <span className="text-sm text-muted-foreground">Fornecedor</span>
                        <p className="font-medium">{contrato.fornecedor.nome_fornecedor}</p>
                      </div>
                    )}
                    <Separator />
                    <div>
                      <span className="text-sm text-muted-foreground">Status</span>
                      <div className="mt-1">{getStatusBadge(contrato.status)}</div>
                    </div>
                  </CardContent>
                </Card>

                {contrato.status !== 'rascunho' && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Link de Assinatura</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="p-2 bg-muted rounded text-xs break-all mb-2">
                        {`${window.location.origin}/assinar/${contrato.token_assinatura}`}
                      </div>
                      <Button size="sm" className="w-full" onClick={copySignatureLink}>
                        <Copy className="h-4 w-4 mr-2" />
                        Copiar Link
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Tab: Assinaturas */}
          <TabsContent value="assinaturas">
            <div className="grid gap-4 md:grid-cols-2">
              {contrato.assinaturas?.map((assinatura: any) => (
                <Card key={assinatura.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-semibold">{assinatura.signatario_nome}</p>
                          <p className="text-sm text-muted-foreground capitalize">
                            {assinatura.signatario_tipo}
                          </p>
                        </div>
                      </div>
                      <Badge variant={assinatura.status === 'assinado' ? 'default' : 'secondary'}>
                        {assinatura.status === 'assinado' ? (
                          <><CheckCircle className="h-3 w-3 mr-1" /> Assinado</>
                        ) : (
                          <><Clock className="h-3 w-3 mr-1" /> Pendente</>
                        )}
                      </Badge>
                    </div>

                    {assinatura.status === 'assinado' && (
                      <div className="space-y-2 text-sm">
                        <Separator />
                        <div className="grid grid-cols-2 gap-2 pt-2">
                          <div>
                            <span className="text-muted-foreground">CPF/CNPJ:</span>
                            <p>{assinatura.signatario_cpf_cnpj || '-'}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Email:</span>
                            <p>{assinatura.signatario_email || '-'}</p>
                          </div>
                        </div>

                        <div className="bg-muted/50 p-3 rounded-lg space-y-2 mt-3">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span>
                              {format(new Date(assinatura.assinado_em), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span>
                              IP: {assinatura.ip_address}
                              {assinatura.ip_geolocation?.city && ` (${assinatura.ip_geolocation.city}, ${assinatura.ip_geolocation.regionName})`}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Monitor className="h-4 w-4 text-muted-foreground" />
                            <span className="truncate text-xs">{assinatura.user_agent?.substring(0, 50)}...</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <Shield className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <span className="text-xs break-all">
                              Hash: {assinatura.hash_documento?.substring(0, 40)}...
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Tab: Auditoria */}
          <TabsContent value="auditoria">
            <Card>
              <CardHeader>
                <CardTitle>Log de Auditoria</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {contrato.audit_logs?.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      Nenhum registro de auditoria ainda
                    </p>
                  ) : (
                    contrato.audit_logs?.sort((a: any, b: any) => 
                      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                    ).map((log: any) => (
                      <div key={log.id} className="flex gap-4 pb-4 border-b last:border-0">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          {log.acao === 'assinatura' && <FileSignature className="h-4 w-4 text-primary" />}
                          {log.acao === 'envio_codigo' && <Shield className="h-4 w-4 text-primary" />}
                          {log.acao === 'criacao' && <FileText className="h-4 w-4 text-primary" />}
                          {!['assinatura', 'envio_codigo', 'criacao'].includes(log.acao) && <Clock className="h-4 w-4 text-primary" />}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium capitalize">{log.acao.replace('_', ' ')}</p>
                          <p className="text-sm text-muted-foreground">{log.descricao}</p>
                          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                            <span>
                              {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                            </span>
                            {log.ip_address && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {log.ip_address}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
