import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Link2, Copy, ExternalLink, QrCode } from 'lucide-react';
import { toast } from 'sonner';

interface WhatsAppLinkGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPhone?: string;
}

export function WhatsAppLinkGenerator({ open, onOpenChange, initialPhone }: WhatsAppLinkGeneratorProps) {
  const [phone, setPhone] = useState(initialPhone || '');
  const [message, setMessage] = useState('');

  const cleanPhone = phone.replace(/\D/g, '');

  const link = useMemo(() => {
    if (!cleanPhone) return '';
    const base = `https://wa.me/${cleanPhone}`;
    if (message.trim()) {
      return `${base}?text=${encodeURIComponent(message)}`;
    }
    return base;
  }, [cleanPhone, message]);

  const shortLink = useMemo(() => {
    if (!cleanPhone) return '';
    return `wa.me/${cleanPhone}`;
  }, [cleanPhone]);

  const copyLink = () => {
    navigator.clipboard.writeText(link);
    toast.success('Link copiado!');
  };

  const openLink = () => {
    if (link) {
      window.open(link, '_blank');
    }
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 9) return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)} ${digits.slice(3)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)} ${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Gerador de Link WhatsApp
          </DialogTitle>
          <DialogDescription>
            Crie links wa.me com mensagem pré-definida
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Número do WhatsApp *</Label>
            <Input
              placeholder="(11) 9 9999-9999"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Inclua o código do país (55 para Brasil)
            </p>
          </div>

          <div className="space-y-2">
            <Label>Mensagem pré-definida (opcional)</Label>
            <Textarea
              placeholder="Olá! Vi seu anúncio e gostaria de mais informações..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[80px]"
            />
          </div>

          {link && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Link gerado</Label>
                <div className="flex gap-2">
                  <Input 
                    value={link} 
                    readOnly 
                    className="font-mono text-xs bg-muted"
                  />
                  <Button variant="outline" size="icon" onClick={copyLink}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={copyLink}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar Link
                </Button>
                <Button className="flex-1" onClick={openLink}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir Link
                </Button>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg text-center">
                <p className="text-sm font-medium text-primary">{shortLink}</p>
                <p className="text-xs text-muted-foreground mt-1">Link curto para compartilhar</p>
              </div>
            </div>
          )}

          {!cleanPhone && (
            <div className="p-4 bg-muted/30 rounded-lg text-center">
              <QrCode className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Digite um número para gerar o link
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
