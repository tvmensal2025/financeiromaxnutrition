import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface ExportContactsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ExportType = 'leads' | 'customers' | 'both';
type ExportFormat = 'csv' | 'xlsx';

export function ExportContactsModal({ open, onOpenChange }: ExportContactsModalProps) {
  const { business } = useAuth();
  const [exportType, setExportType] = useState<ExportType>('both');
  const [format, setFormat] = useState<ExportFormat>('xlsx');
  const [includeFields, setIncludeFields] = useState({
    name: true,
    phone: true,
    email: true,
    company: true,
    notes: true,
    createdAt: true,
    status: true,
  });
  const [isExporting, setIsExporting] = useState(false);

  const { data: leads = [] } = useQuery({
    queryKey: ['leads', business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('business_id', business?.id);
      if (error) throw error;
      return data;
    },
    enabled: open && !!business?.id && (exportType === 'leads' || exportType === 'both'),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers', business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('business_id', business?.id);
      if (error) throw error;
      return data;
    },
    enabled: open && !!business?.id && (exportType === 'customers' || exportType === 'both'),
  });

  const handleExport = async () => {
    setIsExporting(true);

    try {
      const exportData: Record<string, string>[] = [];

      const processContact = (contact: Record<string, unknown>, type: 'Lead' | 'Cliente') => {
        const row: Record<string, string> = {};
        if (includeFields.name) row['Nome'] = String(contact.name || '');
        if (includeFields.phone) row['Telefone'] = String(contact.phone || contact.whatsapp || '');
        if (includeFields.email) row['Email'] = String(contact.email || '');
        if (includeFields.company && type === 'Lead') row['Empresa'] = String(contact.company || '');
        if (includeFields.notes) row['Notas'] = String(contact.notes || '');
        if (includeFields.status && type === 'Lead') row['Status'] = String(contact.status || '');
        if (includeFields.createdAt) row['Criado em'] = contact.created_at ? new Date(String(contact.created_at)).toLocaleDateString('pt-BR') : '';
        row['Tipo'] = type;
        return row;
      };

      if (exportType === 'leads' || exportType === 'both') {
        leads.forEach((lead) => exportData.push(processContact(lead, 'Lead')));
      }

      if (exportType === 'customers' || exportType === 'both') {
        customers.forEach((customer) => exportData.push(processContact(customer, 'Cliente')));
      }

      if (exportData.length === 0) {
        toast.error('Nenhum contato para exportar');
        return;
      }

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Contatos');

      const fileName = `contatos_${new Date().toISOString().split('T')[0]}.${format}`;
      
      if (format === 'csv') {
        XLSX.writeFile(wb, fileName, { bookType: 'csv' });
      } else {
        XLSX.writeFile(wb, fileName, { bookType: 'xlsx' });
      }

      toast.success(`${exportData.length} contatos exportados`);
      onOpenChange(false);
    } catch (error) {
      toast.error('Erro ao exportar contatos');
    } finally {
      setIsExporting(false);
    }
  };

  const totalContacts = (exportType === 'leads' ? leads.length : 0) + 
                        (exportType === 'customers' ? customers.length : 0) +
                        (exportType === 'both' ? leads.length + customers.length : 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Exportar Contatos
          </DialogTitle>
          <DialogDescription>
            Exporte seus contatos para CSV ou Excel
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-3">
            <Label>Tipo de Contato</Label>
            <RadioGroup value={exportType} onValueChange={(v) => setExportType(v as ExportType)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="leads" id="leads" />
                <Label htmlFor="leads" className="font-normal">Apenas Leads ({leads.length})</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="customers" id="customers" />
                <Label htmlFor="customers" className="font-normal">Apenas Clientes ({customers.length})</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="both" id="both" />
                <Label htmlFor="both" className="font-normal">Todos ({leads.length + customers.length})</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-3">
            <Label>Campos para Exportar</Label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(includeFields).map(([field, checked]) => (
                <div key={field} className="flex items-center space-x-2">
                  <Checkbox
                    id={field}
                    checked={checked}
                    onCheckedChange={(c) => setIncludeFields({ ...includeFields, [field]: !!c })}
                  />
                  <Label htmlFor={field} className="font-normal text-sm">
                    {{
                      name: 'Nome',
                      phone: 'Telefone',
                      email: 'Email',
                      company: 'Empresa',
                      notes: 'Notas',
                      createdAt: 'Data de criação',
                      status: 'Status',
                    }[field]}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label>Formato</Label>
            <RadioGroup value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="xlsx" id="xlsx" />
                <Label htmlFor="xlsx" className="font-normal flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel (.xlsx)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="csv" id="csv" />
                <Label htmlFor="csv" className="font-normal flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  CSV (.csv)
                </Label>
              </div>
            </RadioGroup>
          </div>

          <Button onClick={handleExport} disabled={isExporting || totalContacts === 0} className="w-full">
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Exportar {totalContacts} Contatos
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
