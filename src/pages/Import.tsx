import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useExcelImport, ImportRow } from '@/hooks/useExcelImport';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, addMonths, addWeeks, addYears } from 'date-fns';

export default function Import() {
  const { business } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  const {
    isProcessing,
    rows,
    error,
    processFile,
    updateRowAction,
    getSummary,
    reset,
  } = useExcelImport();

  const { data: customers } = useQuery({
    queryKey: ['customers-import'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, email');
      if (error) throw error;
      return data;
    },
  });

  const { data: plans } = useQuery({
    queryKey: ['plans-import'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plans')
        .select('id, name, price, credits, billing_cycle')
        .eq('is_active', true);
      if (error) throw error;
      return data;
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast({
        title: 'Arquivo inválido',
        description: 'Por favor, selecione um arquivo Excel (.xlsx ou .xls)',
        variant: 'destructive',
      });
      return;
    }

    try {
      await processFile(file, customers || [], plans || []);
      toast({ title: 'Arquivo processado com sucesso!' });
    } catch {
      toast({
        title: 'Erro ao processar arquivo',
        variant: 'destructive',
      });
    }
  };

  const getEndDate = (startDate: Date, billingCycle: string) => {
    switch (billingCycle) {
      case 'weekly':
        return addWeeks(startDate, 1);
      case 'monthly':
        return addMonths(startDate, 1);
      case 'quarterly':
        return addMonths(startDate, 3);
      case 'yearly':
        return addYears(startDate, 1);
      default:
        return addMonths(startDate, 1);
    }
  };

  const handleImport = async () => {
    if (!business?.id) return;

    setIsImporting(true);
    const summary = getSummary();
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const row of rows) {
        if (!row.isValid) continue;

        const plan = plans?.find(
          (p) => p.name.toLowerCase() === row.planName.toLowerCase()
        );
        if (!plan) continue;

        try {
          if (row.action === 'import') {
            // Create new customer
            const { data: newCustomer, error: customerError } = await supabase
              .from('customers')
              .insert({
                business_id: business.id,
                name: row.customerName,
                email: row.customerEmail,
                phone: row.customerPhone,
                whatsapp: row.customerWhatsapp,
              })
              .select('id')
              .single();

            if (customerError) throw customerError;

            // Create subscription
            const startDate = new Date();
            const endDate = getEndDate(startDate, plan.billing_cycle);

            const { error: subError } = await supabase
              .from('subscriptions')
              .insert({
                business_id: business.id,
                customer_id: newCustomer.id,
                plan_id: plan.id,
                credits_total: plan.credits,
                credits_used: 0,
                start_date: format(startDate, 'yyyy-MM-dd'),
                end_date: format(endDate, 'yyyy-MM-dd'),
                status: 'active',
                auto_renew: true,
              });

            if (subError) throw subError;
            successCount++;
          } else if (row.action === 'update' && row.existingCustomerId) {
            // Update existing customer
            const { error: updateError } = await supabase
              .from('customers')
              .update({
                name: row.customerName,
                phone: row.customerPhone,
                whatsapp: row.customerWhatsapp,
              })
              .eq('id', row.existingCustomerId);

            if (updateError) throw updateError;

            // Create subscription for existing customer
            const startDate = new Date();
            const endDate = getEndDate(startDate, plan.billing_cycle);

            const { error: subError } = await supabase
              .from('subscriptions')
              .insert({
                business_id: business.id,
                customer_id: row.existingCustomerId,
                plan_id: plan.id,
                credits_total: plan.credits,
                credits_used: 0,
                start_date: format(startDate, 'yyyy-MM-dd'),
                end_date: format(endDate, 'yyyy-MM-dd'),
                status: 'active',
                auto_renew: true,
              });

            if (subError) throw subError;
            successCount++;
          }
        } catch (err) {
          console.error('Error importing row:', err);
          errorCount++;
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['customers'] });
      await queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });

      toast({
        title: 'Importação concluída',
        description: `${successCount} registros importados${errorCount > 0 ? `, ${errorCount} erros` : ''}`,
      });

      reset();
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      toast({
        title: 'Erro na importação',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      ['Nome', 'Email', 'Telefone', 'WhatsApp', 'Plano', 'Valor'],
      ['João Silva', 'joao@email.com', '(11) 99999-9999', '(11) 99999-9999', 'Plano Básico', '99.90'],
      ['Maria Santos', 'maria@email.com', '(11) 88888-8888', '(11) 88888-8888', 'Plano Premium', '199.90'],
    ];

    const ws = import('xlsx').then((XLSX) => {
      const worksheet = XLSX.utils.aoa_to_sheet(template);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
      XLSX.writeFile(workbook, 'template-importacao.xlsx');
    });
  };

  const summary = getSummary();

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Importar Dados</h1>
            <p className="text-muted-foreground mt-1">
              Importe clientes e assinaturas via planilha Excel
            </p>
          </div>
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Baixar Template
          </Button>
        </div>

        {/* Upload Area */}
        {rows.length === 0 && (
          <div
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors',
              'border-border hover:border-primary/50 hover:bg-accent/50'
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
            />
            {isProcessing ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-muted-foreground">Processando arquivo...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <FileSpreadsheet className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    Clique para selecionar ou arraste seu arquivo
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Formatos aceitos: .xlsx, .xls
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-destructive">Erro ao processar arquivo</p>
              <p className="text-sm text-destructive/80">{error}</p>
            </div>
          </div>
        )}

        {/* Preview */}
        {rows.length > 0 && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-card rounded-lg border border-border p-4">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-foreground">{summary.total}</p>
              </div>
              <div className="bg-card rounded-lg border border-border p-4">
                <p className="text-sm text-muted-foreground">Válidos</p>
                <p className="text-2xl font-bold text-success">{summary.valid}</p>
              </div>
              <div className="bg-card rounded-lg border border-border p-4">
                <p className="text-sm text-muted-foreground">Duplicados</p>
                <p className="text-2xl font-bold text-warning">{summary.duplicates}</p>
              </div>
              <div className="bg-card rounded-lg border border-border p-4">
                <p className="text-sm text-muted-foreground">Importar</p>
                <p className="text-2xl font-bold text-primary">{summary.toImport}</p>
              </div>
              <div className="bg-card rounded-lg border border-border p-4">
                <p className="text-sm text-muted-foreground">Atualizar</p>
                <p className="text-2xl font-bold text-info">{summary.toUpdate}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => {
                reset();
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Novo Arquivo
              </Button>
              <Button
                onClick={handleImport}
                disabled={isImporting || summary.toImport + summary.toUpdate === 0}
              >
                {isImporting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Upload className="h-4 w-4 mr-2" />
                Importar ({summary.toImport + summary.toUpdate})
              </Button>
            </div>

            {/* Table */}
            <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Linha</th>
                    <th>Cliente</th>
                    <th>Email</th>
                    <th>Plano</th>
                    <th>Valor</th>
                    <th>Status</th>
                    <th>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.rowIndex}
                      className={cn(
                        'animate-fade-in',
                        !row.isValid && 'bg-destructive/5'
                      )}
                    >
                      <td className="text-muted-foreground">{row.rowIndex}</td>
                      <td>
                        <p className="font-medium text-foreground">{row.customerName || '-'}</p>
                        {row.customerWhatsapp && (
                          <p className="text-xs text-muted-foreground">{row.customerWhatsapp}</p>
                        )}
                      </td>
                      <td className="text-muted-foreground">{row.customerEmail || '-'}</td>
                      <td className="text-foreground">{row.planName || '-'}</td>
                      <td className="text-muted-foreground">
                        R$ {row.planPrice.toFixed(2)}
                      </td>
                      <td>
                        {!row.isValid ? (
                          <div className="flex items-center gap-1.5">
                            <XCircle className="h-4 w-4 text-destructive" />
                            <span className="text-sm text-destructive">
                              {row.errors[0]}
                            </span>
                          </div>
                        ) : row.isDuplicate ? (
                          <Badge variant="outline" className="text-warning border-warning/20">
                            Duplicado
                          </Badge>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <CheckCircle className="h-4 w-4 text-success" />
                            <span className="text-sm text-success">OK</span>
                          </div>
                        )}
                      </td>
                      <td>
                        {row.isValid && row.isDuplicate ? (
                          <Select
                            value={row.action}
                            onValueChange={(value: 'import' | 'skip' | 'update') =>
                              updateRowAction(row.rowIndex, value)
                            }
                          >
                            <SelectTrigger className="w-[130px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="skip">Pular</SelectItem>
                              <SelectItem value="update">Atualizar</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : row.isValid ? (
                          <span className="text-sm text-muted-foreground">Importar</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}
