-- Add recurring message scheduling fields to customers table
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS recurring_due_date DATE;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS recurring_message_time TIME DEFAULT '09:00';
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS recurring_reminder_days INTEGER DEFAULT 3;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS recurring_message_type TEXT DEFAULT 'both';
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS recurring_reminder_template TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS recurring_overdue_template TEXT;

-- Add index for efficient querying of recurring customers
CREATE INDEX IF NOT EXISTS idx_customers_recurring ON public.customers(interest_is_recurring, recurring_due_date) WHERE interest_is_recurring = true;