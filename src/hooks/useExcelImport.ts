import { useState } from 'react';
import * as XLSX from 'xlsx';

export interface ImportRow {
  rowIndex: number;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  customerWhatsapp: string | null;
  planName: string;
  planPrice: number;
  dueDay: number;
  isDuplicate: boolean;
  existingCustomerId: string | null;
  action: 'import' | 'skip' | 'update';
  isValid: boolean;
  errors: string[];
}

export interface ImportSummary {
  total: number;
  valid: number;
  duplicates: number;
  toImport: number;
  toUpdate: number;
  toSkip: number;
}

interface ExistingCustomer {
  id: string;
  email: string | null;
  whatsapp: string | null;
}

interface ExistingPlan {
  id: string;
  name: string;
  price: number;
  credits: number;
  billing_cycle: string;
}

export function useExcelImport() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const processFile = async (
    file: File,
    existingCustomers: ExistingCustomer[],
    existingPlans: ExistingPlan[]
  ): Promise<ImportRow[]> => {
    setIsProcessing(true);
    setError(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      const customerEmailMap = new Map(
        existingCustomers
          .filter((c) => c.email)
          .map((c) => [c.email!.toLowerCase(), c.id])
      );

      const customerWhatsappMap = new Map(
        existingCustomers
          .filter((c) => c.whatsapp)
          .map((c) => [c.whatsapp!.replace(/\D/g, ''), c.id])
      );

      const planNameMap = new Map(
        existingPlans.map((p) => [p.name.toLowerCase(), p])
      );

      const processedRows: ImportRow[] = jsonData.map((row: any, index: number) => {
        const errors: string[] = [];

        // Extract data - support multiple column name formats
        const customerName = String(
          row['Nome'] || row['nome'] || row['Cliente'] || row['cliente'] || row['Name'] || row['name'] || ''
        ).trim();
        
        const customerEmail = String(
          row['Email'] || row['email'] || row['E-mail'] || row['e-mail'] || ''
        ).trim() || null;
        
        const customerPhone = String(
          row['Telefone'] || row['telefone'] || row['Phone'] || row['phone'] || ''
        ).trim() || null;
        
        const customerWhatsapp = String(
          row['WhatsApp'] || row['whatsapp'] || row['Whatsapp'] || ''
        ).trim() || null;
        
        const planName = String(
          row['Plano'] || row['plano'] || row['Plan'] || row['plan'] || ''
        ).trim();
        
        const planPriceRaw = row['Valor'] || row['valor'] || row['Price'] || row['price'] || row['Preço'] || row['preço'] || 0;
        const planPrice = typeof planPriceRaw === 'number' 
          ? planPriceRaw 
          : parseFloat(String(planPriceRaw).replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;

        const dueDayRaw = row['Vencimento'] || row['vencimento'] || row['Dia'] || row['dia'] || row['Due Day'] || row['due_day'] || '';
        const dueDay = typeof dueDayRaw === 'number' 
          ? dueDayRaw 
          : parseInt(String(dueDayRaw).replace(/\D/g, ''), 10) || 0;

        // Validation
        if (!customerName) {
          errors.push('Nome do cliente é obrigatório');
        }
        if (!planName) {
          errors.push('Nome do plano é obrigatório');
        }
        if (dueDay < 1 || dueDay > 31) {
          errors.push('Dia de vencimento deve ser entre 1 e 31');
        }

        // Check for duplicates by email OR whatsapp
        const whatsappNormalized = customerWhatsapp?.replace(/\D/g, '') || '';
        const isDuplicateByEmail = customerEmail 
          ? customerEmailMap.has(customerEmail.toLowerCase()) 
          : false;
        const isDuplicateByWhatsapp = whatsappNormalized
          ? customerWhatsappMap.has(whatsappNormalized)
          : false;
        const isDuplicate = isDuplicateByEmail || isDuplicateByWhatsapp;
        
        const existingCustomerId = customerEmail 
          ? customerEmailMap.get(customerEmail.toLowerCase()) || null 
          : whatsappNormalized
            ? customerWhatsappMap.get(whatsappNormalized) || null
            : null;

        // Check if plan exists
        if (planName && !planNameMap.has(planName.toLowerCase())) {
          errors.push(`Plano "${planName}" não encontrado`);
        }

        return {
          rowIndex: index + 2, // +2 because Excel is 1-indexed and has header
          customerName,
          customerEmail,
          customerPhone,
          customerWhatsapp,
          planName,
          planPrice,
          dueDay,
          isDuplicate,
          existingCustomerId,
          action: isDuplicate ? 'skip' : 'import',
          isValid: errors.length === 0,
          errors,
        };
      });

      setRows(processedRows);
      return processedRows;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao processar arquivo';
      setError(message);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  };

  const updateRowAction = (rowIndex: number, action: 'import' | 'skip' | 'update') => {
    setRows((prev) =>
      prev.map((row) =>
        row.rowIndex === rowIndex ? { ...row, action } : row
      )
    );
  };

  const getSummary = (): ImportSummary => {
    return {
      total: rows.length,
      valid: rows.filter((r) => r.isValid).length,
      duplicates: rows.filter((r) => r.isDuplicate).length,
      toImport: rows.filter((r) => r.action === 'import' && r.isValid).length,
      toUpdate: rows.filter((r) => r.action === 'update' && r.isValid).length,
      toSkip: rows.filter((r) => r.action === 'skip' || !r.isValid).length,
    };
  };

  const reset = () => {
    setRows([]);
    setError(null);
  };

  return {
    isProcessing,
    rows,
    error,
    processFile,
    updateRowAction,
    getSummary,
    reset,
  };
}
