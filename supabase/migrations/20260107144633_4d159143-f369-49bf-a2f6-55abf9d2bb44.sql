-- Add recurring message fields to leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS recurring_due_date DATE;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS recurring_message_time TIME DEFAULT '09:00';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS recurring_reminder_days INTEGER DEFAULT 3;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS recurring_message_type TEXT DEFAULT 'both';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS recurring_reminder_template TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS recurring_overdue_template TEXT;