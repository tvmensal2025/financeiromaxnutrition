import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Phone, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ValidateNumberModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ValidationResult {
  phone: string;
  isValid: boolean;
  exists?: boolean;
  jid?: string;
}

export function ValidateNumberModal({ open, onOpenChange }: ValidateNumberModalProps) {
  const [numbers, setNumbers] = useState('');
  const [results, setResults] = useState<ValidationResult[]>([]);

  const validateMutation = useMutation({
    mutationFn: async (phones: string[]) => {
      const { data, error } = await supabase.functions.invoke('validate-whatsapp', {
        body: { phones },
      });
      if (error) throw error;
      return data.results as ValidationResult[];
    },
    onSuccess: (data) => {
      setResults(data);
      const valid = data.filter(r => r.exists).length;
      toast.success(`Validação concluída: ${valid}/${data.length} válidos`);
    },
    onError: (error: Error) => {
      toast.error('Erro na validação: ' + error.message);
    },
  });

  const handleValidate = () => {
    const phones = numbers
      .split(/[\n,;]/)
      .map(p => p.trim().replace(/\D/g, ''))
      .filter(p => p.length >= 10);

    if (phones.length === 0) {
      toast.error('Insira pelo menos um número válido');
      return;
    }

    if (phones.length > 100) {
      toast.error('Máximo de 100 números por vez');
      return;
    }

    setResults([]);
    validateMutation.mutate(phones);
  };

  const validCount = results.filter(r => r.exists).length;
  const invalidCount = results.filter(r => !r.exists).length;

  const copyValid = () => {
    const valid = results.filter(r => r.exists).map(r => r.phone).join('\n');
    navigator.clipboard.writeText(valid);
    toast.success('Números válidos copiados');
  };

  const copyInvalid = () => {
    const invalid = results.filter(r => !r.exists).map(r => r.phone).join('\n');
    navigator.clipboard.writeText(invalid);
    toast.success('Números inválidos copiados');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            Validador de WhatsApp
          </DialogTitle>
          <DialogDescription>
            Verifique se os números possuem WhatsApp ativo
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Números (um por linha ou separados por vírgula)</Label>
            <Textarea
              placeholder="5511999999999&#10;5511888888888&#10;5521777777777"
              value={numbers}
              onChange={(e) => setNumbers(e.target.value)}
              className="min-h-[120px] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">Máximo: 100 números por vez</p>
          </div>

          <Button 
            onClick={handleValidate} 
            disabled={!numbers.trim() || validateMutation.isPending}
            className="w-full"
          >
            {validateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Validando...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Validar Números
              </>
            )}
          </Button>

          {results.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Badge variant="default" className="bg-green-500">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {validCount} válidos
                  </Badge>
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" />
                    {invalidCount} inválidos
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={copyValid} disabled={validCount === 0}>
                    Copiar válidos
                  </Button>
                  <Button variant="outline" size="sm" onClick={copyInvalid} disabled={invalidCount === 0}>
                    Copiar inválidos
                  </Button>
                </div>
              </div>

              <ScrollArea className="h-[200px] border rounded-lg">
                <div className="p-2 space-y-1">
                  {results.map((result, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between p-2 rounded ${
                        result.exists ? 'bg-green-500/10' : 'bg-destructive/10'
                      }`}
                    >
                      <span className="font-mono text-sm">{result.phone}</span>
                      {result.exists ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {validateMutation.isError && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" />
              Erro ao validar números. Verifique a conexão com o WhatsApp.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
