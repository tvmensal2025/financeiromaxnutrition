import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Calendar, Clock, User, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { format, parseISO, isToday, isTomorrow, isPast, startOfDay, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

interface Appointment {
  id: string;
  customer_id: string;
  service_id: string | null;
  scheduled_at: string;
  duration_minutes: number | null;
  status: AppointmentStatus;
  notes: string | null;
  created_at: string;
  customers: { name: string; whatsapp: string | null };
  services: { name: string; price: number } | null;
}

const statusConfig: Record<AppointmentStatus, { label: string; color: string; icon: React.ReactNode }> = {
  scheduled: { label: 'Agendado', color: 'bg-primary/10 text-primary', icon: <Clock className="h-4 w-4" /> },
  confirmed: { label: 'Confirmado', color: 'bg-success/10 text-success', icon: <CheckCircle className="h-4 w-4" /> },
  completed: { label: 'Concluído', color: 'bg-muted text-muted-foreground', icon: <CheckCircle className="h-4 w-4" /> },
  cancelled: { label: 'Cancelado', color: 'bg-destructive/10 text-destructive', icon: <XCircle className="h-4 w-4" /> },
  no_show: { label: 'Não Compareceu', color: 'bg-warning/10 text-warning', icon: <AlertCircle className="h-4 w-4" /> },
};

export default function Appointments() {
  const { business } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [formData, setFormData] = useState({
    customer_id: '',
    service_id: '',
    scheduled_date: format(new Date(), 'yyyy-MM-dd'),
    scheduled_time: '09:00',
    duration_minutes: '60',
    status: 'scheduled' as AppointmentStatus,
    notes: '',
  });

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['appointments', business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      const { data, error } = await supabase
        .from('appointments')
        .select('*, customers(name, whatsapp), services(name, price)')
        .eq('business_id', business.id)
        .order('scheduled_at', { ascending: true });
      if (error) throw error;
      return data as Appointment[];
    },
    enabled: !!business?.id,
  });

  const { data: customers = [] } = useQuery({
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

  const { data: services = [] } = useQuery({
    queryKey: ['services', business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      const { data, error } = await supabase
        .from('services')
        .select('id, name, duration_minutes, price')
        .eq('business_id', business.id)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const scheduledAt = new Date(`${data.scheduled_date}T${data.scheduled_time}`);
      const { error } = await supabase.from('appointments').insert({
        business_id: business!.id,
        customer_id: data.customer_id,
        service_id: data.service_id || null,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: parseInt(data.duration_minutes) || 60,
        status: data.status,
        notes: data.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast({ title: 'Agendamento criado com sucesso!' });
      resetForm();
    },
    onError: () => {
      toast({ title: 'Erro ao criar agendamento', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const scheduledAt = new Date(`${data.scheduled_date}T${data.scheduled_time}`);
      const { error } = await supabase
        .from('appointments')
        .update({
          customer_id: data.customer_id,
          service_id: data.service_id || null,
          scheduled_at: scheduledAt.toISOString(),
          duration_minutes: parseInt(data.duration_minutes) || 60,
          status: data.status,
          notes: data.notes || null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast({ title: 'Agendamento atualizado!' });
      resetForm();
    },
    onError: () => {
      toast({ title: 'Erro ao atualizar agendamento', variant: 'destructive' });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AppointmentStatus }) => {
      const { error } = await supabase.from('appointments').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast({ title: 'Status atualizado!' });
    },
  });

  const resetForm = () => {
    setFormData({
      customer_id: '',
      service_id: '',
      scheduled_date: format(new Date(), 'yyyy-MM-dd'),
      scheduled_time: '09:00',
      duration_minutes: '60',
      status: 'scheduled',
      notes: '',
    });
    setEditingAppointment(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (appointment: Appointment) => {
    const date = parseISO(appointment.scheduled_at);
    setEditingAppointment(appointment);
    setFormData({
      customer_id: appointment.customer_id,
      service_id: appointment.service_id || '',
      scheduled_date: format(date, 'yyyy-MM-dd'),
      scheduled_time: format(date, 'HH:mm'),
      duration_minutes: (appointment.duration_minutes || 60).toString(),
      status: appointment.status,
      notes: appointment.notes || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingAppointment) {
      updateMutation.mutate({ id: editingAppointment.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleServiceChange = (serviceId: string) => {
    const service = services.find((s) => s.id === serviceId);
    setFormData({
      ...formData,
      service_id: serviceId,
      duration_minutes: service?.duration_minutes?.toString() || '60',
    });
  };

  // Filter appointments by selected date
  const filteredAppointments = appointments.filter((apt) => {
    const aptDate = format(parseISO(apt.scheduled_at), 'yyyy-MM-dd');
    return aptDate === selectedDate;
  });

  // Get quick date filters
  const dateFilters = [
    { label: 'Hoje', date: format(new Date(), 'yyyy-MM-dd') },
    { label: 'Amanhã', date: format(addDays(new Date(), 1), 'yyyy-MM-dd') },
    { label: 'Esta Semana', date: null },
  ];

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Agendamentos</h1>
            <p className="text-muted-foreground">Gerencie sua agenda de atendimentos</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Agendamento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingAppointment ? 'Editar Agendamento' : 'Novo Agendamento'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Cliente *</Label>
                  <Select
                    value={formData.customer_id}
                    onValueChange={(v) => setFormData({ ...formData, customer_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Serviço</Label>
                  <Select value={formData.service_id} onValueChange={handleServiceChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um serviço" />
                    </SelectTrigger>
                    <SelectContent>
                      {services.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} - {s.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="scheduled_date">Data *</Label>
                    <Input
                      id="scheduled_date"
                      type="date"
                      value={formData.scheduled_date}
                      onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="scheduled_time">Horário *</Label>
                    <Input
                      id="scheduled_time"
                      type="time"
                      value={formData.scheduled_time}
                      onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="duration_minutes">Duração (min)</Label>
                    <Input
                      id="duration_minutes"
                      type="number"
                      value={formData.duration_minutes}
                      onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(v) => setFormData({ ...formData, status: v as AppointmentStatus })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="scheduled">Agendado</SelectItem>
                        <SelectItem value="confirmed">Confirmado</SelectItem>
                        <SelectItem value="completed">Concluído</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                        <SelectItem value="no_show">Não Compareceu</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingAppointment ? 'Salvar Alterações' : 'Criar Agendamento'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {dateFilters.slice(0, 2).map((filter) => (
              <Button
                key={filter.label}
                variant={selectedDate === filter.date ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedDate(filter.date!)}
              >
                {filter.label}
              </Button>
            ))}
          </div>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-auto"
          />
        </div>

        {/* Appointments List */}
        <div className="space-y-4">
          <h2 className="font-semibold text-lg">
            {format(parseISO(selectedDate), "EEEE, d 'de' MMMM", { locale: ptBR })}
            <span className="text-muted-foreground font-normal ml-2">
              ({filteredAppointments.length} agendamento{filteredAppointments.length !== 1 ? 's' : ''})
            </span>
          </h2>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : filteredAppointments.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum agendamento para esta data</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAppointments.map((appointment) => {
                const time = format(parseISO(appointment.scheduled_at), 'HH:mm');
                const config = statusConfig[appointment.status];

                return (
                  <div
                    key={appointment.id}
                    className="bg-card rounded-xl border border-border p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => handleEdit(appointment)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-center min-w-[60px]">
                        <p className="text-2xl font-bold text-primary">{time}</p>
                        <p className="text-xs text-muted-foreground">{appointment.duration_minutes || 60} min</p>
                      </div>

                      <div className="h-12 w-px bg-border" />

                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{appointment.customers?.name}</span>
                        </div>
                        {appointment.services && (
                          <p className="text-sm text-muted-foreground">
                            {appointment.services.name} -{' '}
                            {appointment.services.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </p>
                        )}
                      </div>

                      <Badge className={config.color} variant="secondary">
                        {config.icon}
                        <span className="ml-1">{config.label}</span>
                      </Badge>

                      {appointment.status === 'scheduled' && (
                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateStatusMutation.mutate({ id: appointment.id, status: 'confirmed' })}
                          >
                            Confirmar
                          </Button>
                        </div>
                      )}
                      {appointment.status === 'confirmed' && (
                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateStatusMutation.mutate({ id: appointment.id, status: 'completed' })}
                          >
                            Concluir
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
