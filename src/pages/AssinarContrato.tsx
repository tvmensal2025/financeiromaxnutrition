import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  FileSignature,
  CheckCircle,
  AlertCircle,
  Shield,
  MapPin,
  Clock,
  User,
  Mail,
  CreditCard,
  Loader2,
} from "lucide-react";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

interface Contrato {
  id: string;
  titulo: string;
  conteudo: string;
  valor_total: number;
  status: string;
  created_at: string;
}

interface Assinatura {
  id: string;
  signatario_tipo: string;
  signatario_nome: string;
  signatario_cpf_cnpj: string | null;
  signatario_email: string | null;
  status: string;
  assinado_em: string | null;
  ip_address: string | null;
  ip_geolocation: any;
}

export default function AssinarContrato() {
  const { token } = useParams<{ token: string }>();
  const [contrato, setContrato] = useState<Contrato | null>(null);
  const [assinaturas, setAssinaturas] = useState<Assinatura[]>([]);
  const [selectedAssinatura, setSelectedAssinatura] = useState<Assinatura | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [step, setStep] = useState<'select' | 'form' | 'verify' | 'success'>('select');
  const [formData, setFormData] = useState({
    nome: "",
    cpf_cnpj: "",
    email: "",
    aceite_termos: false,
  });
  const [verificationCode, setVerificationCode] = useState("");
  const [sentCode, setSentCode] = useState("");
  const [signatureResult, setSignatureResult] = useState<any>(null);

  useEffect(() => {
    if (token) {
      fetchContrato();
    }
  }, [token]);

  const fetchContrato = async () => {
    try {
      // Buscar contrato pelo token
      const { data: contratoData, error: contratoError } = await supabase
        .from("contratos_digitais")
        .select("*")
        .eq("token_assinatura", token)
        .single();

      if (contratoError || !contratoData) {
        toast.error("Contrato não encontrado ou link inválido");
        setLoading(false);
        return;
      }

      setContrato(contratoData);

      // Buscar assinaturas
      const { data: assinaturasData, error: assinaturasError } = await supabase
        .from("assinaturas_contrato")
        .select("*")
        .eq("contrato_id", contratoData.id);

      if (!assinaturasError && assinaturasData) {
        setAssinaturas(assinaturasData);
      }

      setLoading(false);
    } catch (error) {
      console.error("Erro ao buscar contrato:", error);
      toast.error("Erro ao carregar contrato");
      setLoading(false);
    }
  };

  const handleSelectAssinatura = (assinatura: Assinatura) => {
    setSelectedAssinatura(assinatura);
    setFormData({
      nome: assinatura.signatario_nome || "",
      cpf_cnpj: assinatura.signatario_cpf_cnpj || "",
      email: assinatura.signatario_email || "",
      aceite_termos: false,
    });
    setStep('form');
  };

  const handleSendCode = async () => {
    if (!selectedAssinatura || !contrato) return;

    setSigning(true);
    try {
      const { data, error } = await supabase.functions.invoke("capture-signature", {
        body: {
          action: "send_code",
          contrato_id: contrato.id,
          assinatura_id: selectedAssinatura.id,
          signatario_nome: formData.nome,
          signatario_cpf_cnpj: formData.cpf_cnpj,
          signatario_email: formData.email,
        },
      });

      if (error) throw error;

      if (data.success) {
        // Em desenvolvimento, o código é retornado
        if (data.code) {
          setSentCode(data.code);
          toast.info(`Código de verificação (dev): ${data.code}`);
        } else {
          toast.success("Código enviado para seu email!");
        }
        setStep('verify');
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast.error(`Erro ao enviar código: ${error.message}`);
    } finally {
      setSigning(false);
    }
  };

  const handleSign = async () => {
    if (!selectedAssinatura || !contrato) return;

    if (!formData.aceite_termos) {
      toast.error("Você precisa aceitar os termos para assinar");
      return;
    }

    setSigning(true);
    try {
      const { data, error } = await supabase.functions.invoke("capture-signature", {
        body: {
          action: "verify_and_sign",
          contrato_id: contrato.id,
          assinatura_id: selectedAssinatura.id,
          signatario_nome: formData.nome,
          signatario_cpf_cnpj: formData.cpf_cnpj,
          signatario_email: formData.email,
          aceite_termos: formData.aceite_termos,
          codigo_verificacao: verificationCode,
        },
      });

      if (error) throw error;

      if (data.success) {
        setSignatureResult(data.data);
        setStep('success');
        toast.success("Contrato assinado com sucesso!");
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast.error(`Erro ao assinar: ${error.message}`);
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Carregando contrato...</span>
        </div>
      </div>
    );
  }

  if (!contrato) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Contrato não encontrado</h2>
            <p className="text-muted-foreground">
              O link pode estar expirado ou inválido.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-primary">
            <FileSignature className="h-8 w-8" />
            <h1 className="text-2xl font-bold">Assinatura Digital</h1>
          </div>
          <p className="text-muted-foreground">
            Sistema de contratos com validade jurídica
          </p>
        </div>

        {/* Security Badge */}
        <div className="flex justify-center">
          <Badge variant="outline" className="gap-1">
            <Shield className="h-3 w-3" />
            Conexão Segura • Lei 14.063/20
          </Badge>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Contrato Preview */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>{contrato.titulo}</CardTitle>
              <CardDescription>
                Criado em {format(new Date(contrato.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-sm bg-muted/50 p-4 rounded-lg max-h-[400px] overflow-y-auto">
                  {contrato.conteudo}
                </pre>
              </div>
              <Separator className="my-4" />
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Valor do Contrato:</span>
                <span className="text-lg font-semibold">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(contrato.valor_total)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Signing Area */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {step === 'select' && "Selecione seu nome"}
                {step === 'form' && "Seus Dados"}
                {step === 'verify' && "Verificação"}
                {step === 'success' && "Assinado!"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Step: Select Signatário */}
              {step === 'select' && (
                <div className="space-y-2">
                  {assinaturas.map((assinatura) => (
                    <Button
                      key={assinatura.id}
                      variant={assinatura.status === 'assinado' ? 'secondary' : 'outline'}
                      className="w-full justify-start"
                      disabled={assinatura.status === 'assinado'}
                      onClick={() => handleSelectAssinatura(assinatura)}
                    >
                      <User className="h-4 w-4 mr-2" />
                      <div className="text-left">
                        <div>{assinatura.signatario_nome}</div>
                        <div className="text-xs text-muted-foreground capitalize">
                          {assinatura.signatario_tipo}
                        </div>
                      </div>
                      {assinatura.status === 'assinado' && (
                        <CheckCircle className="h-4 w-4 ml-auto text-green-600" />
                      )}
                    </Button>
                  ))}
                </div>
              )}

              {/* Step: Form */}
              {step === 'form' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      Nome Completo
                    </Label>
                    <Input
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <CreditCard className="h-3 w-3" />
                      CPF/CNPJ
                    </Label>
                    <Input
                      value={formData.cpf_cnpj}
                      onChange={(e) => setFormData({ ...formData, cpf_cnpj: e.target.value })}
                      placeholder="000.000.000-00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      Email
                    </Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>

                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="termos"
                      checked={formData.aceite_termos}
                      onCheckedChange={(checked) => setFormData({ ...formData, aceite_termos: !!checked })}
                    />
                    <label htmlFor="termos" className="text-xs text-muted-foreground leading-tight">
                      Li e concordo com os termos do contrato. Declaro que as informações prestadas são verdadeiras e autorizo a captura de meus dados para fins de comprovação legal.
                    </label>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep('select')} className="flex-1">
                      Voltar
                    </Button>
                    <Button
                      onClick={handleSendCode}
                      disabled={signing || !formData.nome || !formData.email || !formData.aceite_termos}
                      className="flex-1"
                    >
                      {signing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar Código"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Step: Verify */}
              {step === 'verify' && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground text-center">
                    Digite o código de 6 dígitos enviado para seu email
                  </p>
                  <div className="flex justify-center">
                    <InputOTP
                      maxLength={6}
                      value={verificationCode}
                      onChange={(value) => setVerificationCode(value)}
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>

                  {sentCode && (
                    <p className="text-xs text-center text-muted-foreground">
                      (Dev) Código: <code className="bg-muted px-1 rounded">{sentCode}</code>
                    </p>
                  )}

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep('form')} className="flex-1">
                      Voltar
                    </Button>
                    <Button
                      onClick={handleSign}
                      disabled={signing || verificationCode.length !== 6}
                      className="flex-1"
                    >
                      {signing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Assinar"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Step: Success */}
              {step === 'success' && signatureResult && (
                <div className="space-y-4 text-center">
                  <CheckCircle className="h-16 w-16 text-green-600 mx-auto" />
                  <h3 className="font-semibold">Contrato Assinado!</h3>
                  <p className="text-sm text-muted-foreground">
                    Sua assinatura foi registrada com sucesso.
                  </p>
                  
                  <div className="text-left space-y-2 bg-muted/50 p-3 rounded-lg text-xs">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      <span>
                        {format(new Date(signatureResult.assinado_em), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3 w-3" />
                      <span>
                        IP: {signatureResult.ip_address}
                        {signatureResult.geoLocation?.city && ` (${signatureResult.geoLocation.city})`}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Shield className="h-3 w-3 mt-0.5" />
                      <span className="break-all">
                        Hash: {signatureResult.hash_documento?.substring(0, 32)}...
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground">
          <p>
            Este documento possui validade jurídica conforme Lei 14.063/20 e MP 2.200-2/2001.
          </p>
          <p>
            Todos os dados de assinatura são capturados e armazenados com segurança.
          </p>
        </div>
      </div>
    </div>
  );
}
