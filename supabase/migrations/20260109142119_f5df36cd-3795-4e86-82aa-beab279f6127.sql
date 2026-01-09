-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a cron job to process scheduled messages every minute
SELECT cron.schedule(
  'process-scheduled-messages',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://tljbxoakdzuipkxkecph.supabase.co/functions/v1/process-scheduled-messages',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);