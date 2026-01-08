import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface ImportContactsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'leads' | 'customers';
}

interface ColumnMapping {
  name: string;
  phone: string;
  email: string;
  company: string;
  notes: string;
}

export function ImportContactsModal({ open, onOpenChange, type }: ImportContactsModalProps) {
  const { business } = useAuth();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    name: '',
    phone: '',
    email: '',
    company: '',
    notes: '',
  });
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'importing'>('upload');
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFile(file);
    const reader = new FileReader();

    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const rawData = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });
      
      if (rawData.length > 0) {
        setHeaders(Object.keys(rawData[0]));
        setData(rawData.slice(0, 500)); // Limit to 500 rows
        setStep('mapping');
        
        // Auto-detect mapping
        const autoMapping: ColumnMapping = { name: '', phone: '', email: '', company: '', notes: '' };
        Object.keys(rawData[0]).forEach(header => {
          const lower = header.toLowerCase();
          if (lower.includes('nome') || lower.includes('name')) autoMapping.name = header;
          if (lower.includes('telefone') || lower.includes('phone') || lower.includes('whatsapp') || lower.includes('celular')) autoMapping.phone = header;
          if (lower.includes('email') || lower.includes('e-mail')) autoMapping.email = header;
          if (lower.includes('empresa') || lower.includes('company')) autoMapping.company = header;
          if (lower.includes('nota') || lower.includes('obs') || lower.includes('notes')) autoMapping.notes = header;
        });
        setMapping(autoMapping);
      }
    };

    reader.readAsBinaryString(file);
  }, []);

  const importMutation = useMutation({
    mutationFn: async () => {
      let success = 0;
      let failed = 0;

      for (const row of data) {
        const name = row[mapping.name]?.trim();
        const phone = row[mapping.phone]?.replace(/\D/g, '');
        
        if (!name) {
          failed++;
          continue;
        }

        const record = {
          business_id: business?.id,
          name,
          phone: phone || null,
          whatsapp: phone || null,
          email: row[mapping.email]?.trim() || null,
          notes: row[mapping.notes]?.trim() || null,
          ...(type === 'leads' ? { company: row[mapping.company]?.trim() || null } : {}),
        };

        const { error } = await supabase.from(type).insert(record);
        
        if (error) {
          failed++;
        } else {
          success++;
        }
      }

      return { success, failed };
    },
    onSuccess: (result) => {
      setImportResult(result);
      setStep('importing');
      queryClient.invalidateQueries({ queryKey: [type] });
      toast.success(`Importação concluída: ${result.success} importados`);
    },
    onError: () => {
      toast.error('Erro durante a importação');
    },
  });

  const resetModal = () => {
    setFile(null);
    setData([]);
    setHeaders([]);
    setMapping({ name: '', phone: '', email: '', company: '', notes: '' });
    setStep('upload');
    setImportResult(null);
  };

  const handleClose = (open: boolean) => {
    if (!open) resetModal();
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Importar {type === 'leads' ? 'Leads' : 'Clientes'}
          </DialogTitle>
          <DialogDescription>
            Importe contatos a partir de um arquivo CSV ou Excel
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center">
              <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                Arraste um arquivo ou clique para selecionar
              </p>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload">
                <Button variant="outline" asChild>
                  <span>Selecionar Arquivo</span>
                </Button>
              </label>
              <p className="text-xs text-muted-foreground mt-4">
                Formatos: CSV, XLSX, XLS (máx. 500 contatos)
              </p>
            </div>
          </div>
        )}

        {step === 'mapping' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileSpreadsheet className="h-4 w-4" />
              {file?.name} - {data.length} registros encontrados
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome * (obrigatório)</Label>
                <Select value={mapping.name} onValueChange={(v) => setMapping({ ...mapping, name: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {headers.map((h) => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Telefone/WhatsApp</Label>
                <Select value={mapping.phone} onValueChange={(v) => setMapping({ ...mapping, phone: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {headers.map((h) => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Email</Label>
                <Select value={mapping.email} onValueChange={(v) => setMapping({ ...mapping, email: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {headers.map((h) => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {type === 'leads' && (
                <div className="space-y-2">
                  <Label>Empresa</Label>
                  <Select value={mapping.company} onValueChange={(v) => setMapping({ ...mapping, company: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Notas/Observações</Label>
                <Select value={mapping.notes} onValueChange={(v) => setMapping({ ...mapping, notes: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {headers.map((h) => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={resetModal}>Voltar</Button>
              <Button onClick={() => setStep('preview')} disabled={!mapping.name}>
                Visualizar
              </Button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Prévia dos primeiros 10 registros:
            </p>

            <ScrollArea className="h-[300px] border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Email</TableHead>
                    {type === 'leads' && <TableHead>Empresa</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.slice(0, 10).map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>{row[mapping.name]}</TableCell>
                      <TableCell>{row[mapping.phone]}</TableCell>
                      <TableCell>{row[mapping.email]}</TableCell>
                      {type === 'leads' && <TableCell>{row[mapping.company]}</TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <AlertCircle className="h-4 w-4 text-primary" />
              <p className="text-sm">
                {data.length} contatos serão importados
              </p>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setStep('mapping')}>Voltar</Button>
              <Button onClick={() => importMutation.mutate()} disabled={importMutation.isPending}>
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importando...
                  </>
                ) : (
                  'Importar'
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 'importing' && importResult && (
          <div className="text-center py-8 space-y-4">
            <CheckCircle2 className="h-16 w-16 mx-auto text-green-500" />
            <h3 className="text-lg font-semibold">Importação Concluída!</h3>
            <div className="flex justify-center gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-500">{importResult.success}</p>
                <p className="text-sm text-muted-foreground">Importados</p>
              </div>
              {importResult.failed > 0 && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-destructive">{importResult.failed}</p>
                  <p className="text-sm text-muted-foreground">Falhas</p>
                </div>
              )}
            </div>
            <Button onClick={() => handleClose(false)}>Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
