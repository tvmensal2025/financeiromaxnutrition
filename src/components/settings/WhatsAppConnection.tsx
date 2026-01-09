import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Smartphone, QrCode, CheckCircle2, XCircle, RefreshCw, LogOut, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type ConnectionStatus = 'disconnected' | 'waiting_qr' | 'connected' | 'loading';

interface WhatsAppConnectionProps {
  businessId?: string;
}

export function WhatsAppConnection({ businessId }: WhatsAppConnectionProps) {
  const [status, setStatus] = useState<ConnectionStatus>('loading');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pollingInterval, setPollingInterval] = useState<number | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await supabase.functions.invoke('evolution-manager', {
        body: { action: 'status' }
      });

      if (response.error) {
        console.error('Error fetching status:', response.error);
        return;
      }

      const data = response.data;
      setStatus(data.status as ConnectionStatus);
      setPhoneNumber(data.phone || null);

      // If connected, stop polling
      if (data.status === 'connected' && pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
    } catch (error) {
      console.error('Error fetching status:', error);
    }
  }, [pollingInterval]);

  useEffect(() => {
    fetchStatus();

    // Cleanup on unmount
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, []);

  const startPolling = useCallback(() => {
    // Poll every 5 seconds while waiting for QR
    const interval = window.setInterval(() => {
      fetchStatus();
    }, 5000);
    setPollingInterval(interval);

    // Stop after 2 minutes
    setTimeout(() => {
      clearInterval(interval);
      setPollingInterval(null);
    }, 120000);
  }, [fetchStatus]);

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      const response = await supabase.functions.invoke('evolution-manager', {
        body: { action: 'create' }
      });

      if (response.error) {
        toast.error('Erro ao criar conexão: ' + response.error.message);
        return;
      }

      const data = response.data;
      
      if (data.status === 'connected') {
        setStatus('connected');
        setPhoneNumber(data.phone);
        toast.success('WhatsApp já está conectado!');
      } else if (data.status === 'waiting_qr') {
        setStatus('waiting_qr');
        setQrCode(data.qrcode);
        toast.info('Escaneie o QR Code com seu WhatsApp');
        startPolling();
      }
    } catch (error: any) {
      toast.error('Erro ao conectar: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshQR = async () => {
    setIsLoading(true);
    try {
      const response = await supabase.functions.invoke('evolution-manager', {
        body: { action: 'connect' }
      });

      if (response.error) {
        toast.error('Erro ao atualizar QR Code');
        return;
      }

      const data = response.data;
      setQrCode(data.qrcode);
      toast.success('QR Code atualizado');
    } catch (error: any) {
      toast.error('Erro: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setIsLoading(true);
    try {
      const response = await supabase.functions.invoke('evolution-manager', {
        body: { action: 'logout' }
      });

      if (response.error) {
        toast.error('Erro ao desconectar');
        return;
      }

      setStatus('disconnected');
      setQrCode(null);
      setPhoneNumber(null);
      toast.success('WhatsApp desconectado');
    } catch (error: any) {
      toast.error('Erro: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      const response = await supabase.functions.invoke('evolution-manager', {
        body: { action: 'delete' }
      });

      if (response.error) {
        toast.error('Erro ao remover instância');
        return;
      }

      setStatus('disconnected');
      setQrCode(null);
      setPhoneNumber(null);
      toast.success('Instância removida com sucesso');
    } catch (error: any) {
      toast.error('Erro: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const formatPhoneNumber = (phone: string) => {
    // Format as +55 (11) 99999-9999
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    } else if (cleaned.length === 12) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 8)}-${cleaned.slice(8)}`;
    }
    return phone;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-green-600" />
            <CardTitle>Conexão WhatsApp</CardTitle>
          </div>
          {status === 'connected' && (
            <Badge variant="default" className="bg-green-600">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Conectado
            </Badge>
          )}
          {status === 'waiting_qr' && (
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
              <QrCode className="h-3 w-3 mr-1" />
              Aguardando QR
            </Badge>
          )}
          {status === 'disconnected' && (
            <Badge variant="destructive">
              <XCircle className="h-3 w-3 mr-1" />
              Desconectado
            </Badge>
          )}
        </div>
        <CardDescription>
          Conecte seu WhatsApp para enviar e receber mensagens automaticamente
        </CardDescription>
      </CardHeader>
      <CardContent>
        {status === 'loading' && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {status === 'disconnected' && (
          <div className="text-center py-6">
            <div className="mb-4">
              <Smartphone className="h-16 w-16 mx-auto text-muted-foreground/50" />
            </div>
            <p className="text-muted-foreground mb-4">
              Nenhum WhatsApp conectado. Clique no botão abaixo para começar.
            </p>
            <Button onClick={handleConnect} disabled={isLoading} size="lg">
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Criando conexão...
                </>
              ) : (
                <>
                  <QrCode className="h-4 w-4 mr-2" />
                  Conectar WhatsApp
                </>
              )}
            </Button>
          </div>
        )}

        {status === 'waiting_qr' && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Abra o WhatsApp no seu celular, vá em{' '}
              <strong>Configurações → Aparelhos conectados → Conectar um aparelho</strong>{' '}
              e escaneie o código abaixo:
            </p>
            
            {qrCode ? (
              <div className="inline-block p-4 bg-white rounded-lg shadow-lg mb-4">
                <img 
                  src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`} 
                  alt="QR Code WhatsApp" 
                  className="w-64 h-64"
                />
              </div>
            ) : (
              <div className="inline-block p-4 bg-muted rounded-lg mb-4">
                <div className="w-64 h-64 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}

            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" onClick={handleRefreshQR} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Atualizar QR Code
              </Button>
              <Button variant="ghost" onClick={() => setStatus('disconnected')}>
                Cancelar
              </Button>
            </div>

            {pollingInterval && (
              <p className="text-xs text-muted-foreground mt-4">
                <Loader2 className="h-3 w-3 inline animate-spin mr-1" />
                Aguardando conexão... O status será atualizado automaticamente.
              </p>
            )}
          </div>
        )}

        {status === 'connected' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-600 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-medium">WhatsApp Conectado</p>
                  {phoneNumber && (
                    <p className="text-sm text-muted-foreground">
                      {formatPhoneNumber(phoneNumber)}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={fetchStatus}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="flex-1">
                    <LogOut className="h-4 w-4 mr-2" />
                    Desconectar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Desconectar WhatsApp?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Você poderá reconectar a qualquer momento escaneando um novo QR Code.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDisconnect}>
                      Desconectar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="icon">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remover instância?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Isso irá remover completamente a instância do WhatsApp. Você precisará criar uma nova conexão para usar o WhatsApp novamente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                      Remover
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
