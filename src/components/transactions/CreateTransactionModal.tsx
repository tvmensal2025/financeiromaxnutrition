import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format, addDays, addWeeks, addMonths } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreateTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const categories = [
  'Recebimentos',
  'Vendas',
  'Serviços',
  'Pagamentos',
  'Fornecedores',
  'Aluguel',
  'Salários',
  'Marketing',
  'Combustível',
  'Outros'
];

const recurrencePatterns = [
  { value: 'weekly', label: 'Semanal', description: 'Toda semana' },
  { value: 'biweekly', label: 'Quinzenal', description: 'A cada 15 dias' },
  { value: 'monthly', label: 'Mensal', description: 'Todo mês' },
  { value: 'custom', label: 'Personalizado', description: 'Escolher intervalo' },
];

export function CreateTransactionModal({ open, onOpenChange }: CreateTransactionModalProps) {
  const { business } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state
  const [type, setType] = useState<'income' | 'expense'>('income');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [customerId, setCustomerId] = useState<string>('');
  const [transactionDate, setTransactionDate] = useState<Date>(new Date());
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [notes, setNotes] = useState('');
  
  // Recurrence state
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState('monthly');
  const [recurrenceInterval, setRecurrenceInterval] = useState('1');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date | undefined>();

  // Fetch customers
  const { data: customers } = useQuery({
    queryKey: ['customers', business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      const { data, error } = await supabase
        .from('customers')
        .select('id, name')
        .eq('business_id', business.id)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });

  // Calculate next due date based on pattern
  const calculateNextDueDate = (baseDate: Date, pattern: string, interval: number): Date => {
    switch (pattern) {
      case 'daily':
        return addDays(baseDate, interval);
      case 'weekly':
        return addWeeks(baseDate, 1);
      case 'biweekly':
        return addWeeks(baseDate, 2);
      case 'monthly':
        return addMonths(baseDate, 1);
      case 'custom':
        return addDays(baseDate, interval);
      default:
        return addMonths(baseDate, 1);
    }
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!business?.id) throw new Error('Business not found');
      
      const parsedAmount = parseFloat(amount.replace(',', '.'));
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error('Valor inválido');
      }

      const baseData = {
        business_id: business.id,
        type,
        description: description.trim(),
        amount: parsedAmount,
        category: category || null,
        customer_id: customerId || null,
        transaction_date: format(transactionDate, 'yyyy-MM-dd'),
        due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : null,
        notes: notes.trim() || null,
        status: 'pending',
        is_recurring: isRecurring,
        recurrence_pattern: isRecurring ? recurrencePattern : null,
        recurrence_interval: isRecurring && recurrencePattern === 'custom' 
          ? parseInt(recurrenceInterval) 
          : isRecurring ? 1 : null,
        recurrence_end_date: isRecurring && recurrenceEndDate 
          ? format(recurrenceEndDate, 'yyyy-MM-dd') 
          : null,
        next_due_date: isRecurring && dueDate 
          ? format(calculateNextDueDate(dueDate, recurrencePattern, parseInt(recurrenceInterval) || 1), 'yyyy-MM-dd')
          : null,
      };

      const { error } = await supabase
        .from('transactions')
        .insert(baseData);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ 
        title: 'Transação criada!',
        description: isRecurring 
          ? `Transação recorrente (${recurrencePatterns.find(p => p.value === recurrencePattern)?.label}) criada com sucesso.`
          : 'Transação criada com sucesso.'
      });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      resetForm();
      onOpenChange(false);
    },
    onError: (error) => {
      toast({ 
        title: 'Erro ao criar transação', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  const resetForm = () => {
    setType('income');
    setDescription('');
    setAmount('');
    setCategory('');
    setCustomerId('');
    setTransactionDate(new Date());
    setDueDate(undefined);
    setNotes('');
    setIsRecurring(false);
    setRecurrencePattern('monthly');
    setRecurrenceInterval('1');
    setRecurrenceEndDate(undefined);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      toast({ title: 'Descrição é obrigatória', variant: 'destructive' });
      return;
    }
    if (!amount) {
      toast({ title: 'Valor é obrigatório', variant: 'destructive' });
      return;
    }
    createMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Transação</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type */}
          <div className="space-y-2">
            <Label>Tipo</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={type === 'income' ? 'default' : 'outline'}
                onClick={() => setType('income')}
                className={cn(
                  'flex-1',
                  type === 'income' && 'bg-success hover:bg-success/90'
                )}
              >
                Receita
              </Button>
              <Button
                type="button"
                variant={type === 'expense' ? 'default' : 'outline'}
                onClick={() => setType('expense')}
                className={cn(
                  'flex-1',
                  type === 'expense' && 'bg-destructive hover:bg-destructive/90'
                )}
              >
                Despesa
              </Button>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição *</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Pagamento do cliente, Aluguel..."
            />
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Valor (R$) *</Label>
            <Input
              id="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              type="text"
              inputMode="decimal"
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Customer */}
          <div className="space-y-2">
            <Label>Cliente (opcional)</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="Vincular a um cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nenhum</SelectItem>
                {customers?.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data da Transação</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(transactionDate, 'dd/MM/yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={transactionDate}
                    onSelect={(date) => date && setTransactionDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Vencimento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, 'dd/MM/yyyy') : 'Selecionar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anotações adicionais..."
              rows={2}
            />
          </div>

          {/* Recurring Toggle */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <RefreshCw className={cn(
                "h-5 w-5",
                isRecurring ? "text-primary" : "text-muted-foreground"
              )} />
              <div>
                <p className="font-medium">Transação Recorrente</p>
                <p className="text-sm text-muted-foreground">Repetir automaticamente</p>
              </div>
            </div>
            <Switch
              checked={isRecurring}
              onCheckedChange={setIsRecurring}
            />
          </div>

          {/* Recurrence Options */}
          {isRecurring && (
            <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/30">
              <div className="space-y-2">
                <Label>Frequência</Label>
                <Select value={recurrencePattern} onValueChange={setRecurrencePattern}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {recurrencePatterns.map((pattern) => (
                      <SelectItem key={pattern.value} value={pattern.value}>
                        <div>
                          <span className="font-medium">{pattern.label}</span>
                          <span className="text-muted-foreground ml-2">({pattern.description})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {recurrencePattern === 'custom' && (
                <div className="space-y-2">
                  <Label htmlFor="interval">A cada quantos dias?</Label>
                  <Input
                    id="interval"
                    type="number"
                    min="1"
                    value={recurrenceInterval}
                    onChange={(e) => setRecurrenceInterval(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Data Final (opcional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {recurrenceEndDate ? format(recurrenceEndDate, 'dd/MM/yyyy') : 'Sem data final'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={recurrenceEndDate}
                      onSelect={setRecurrenceEndDate}
                      initialFocus
                      disabled={(date) => date < new Date()}
                    />
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">
                  Deixe vazio para repetir indefinidamente
                </p>
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                'Criar Transação'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}