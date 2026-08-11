-- Scheduled background notification invocation.
-- Prerequisites: enable pg_cron/pg_net and store these values in Supabase Vault:
--   serviceflow_functions_url: https://<project-ref>.supabase.co/functions/v1
--   serviceflow_notification_cron_secret: value matching the Edge Function secret
-- Do not place service-role or VAPID secrets in this migration.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'serviceflow-interested-notifications';

SELECT cron.schedule(
  'serviceflow-interested-notifications',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'serviceflow_functions_url') || '/send-interested-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'serviceflow_notification_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- If Vault/pg_net is unavailable in the project plan, deploy the function and
-- invoke it from a trusted scheduler with the same x-cron-secret instead.
