-- Add recurring transaction fields to transactions table
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS recurrence_pattern TEXT,
ADD COLUMN IF NOT EXISTS recurrence_interval INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS recurrence_end_date DATE,
ADD COLUMN IF NOT EXISTS parent_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS next_due_date DATE;

-- Add index for recurring transactions lookup
CREATE INDEX IF NOT EXISTS idx_transactions_recurring ON public.transactions(is_recurring, next_due_date) WHERE is_recurring = true;

-- Add comment for documentation
COMMENT ON COLUMN public.transactions.is_recurring IS 'Whether this transaction repeats automatically';
COMMENT ON COLUMN public.transactions.recurrence_pattern IS 'Pattern: daily, weekly, biweekly, monthly, custom';
COMMENT ON COLUMN public.transactions.recurrence_interval IS 'Interval for custom pattern (e.g., every X days/weeks/months)';
COMMENT ON COLUMN public.transactions.recurrence_end_date IS 'When the recurrence should stop';
COMMENT ON COLUMN public.transactions.parent_transaction_id IS 'Reference to the original recurring transaction';
COMMENT ON COLUMN public.transactions.next_due_date IS 'Next date when a new transaction should be created';