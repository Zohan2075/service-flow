# Interested People Notifications

The browser foreground reminder flow uses the authenticated Supabase-backed app
state. Closed-browser delivery is handled by the scheduled Edge Function and
Web Push; browser/OS sound settings control sound for closed-browser pushes.

## Required configuration

Set the public frontend variable in `web/.env.local` and the deployment
environment:

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
```

Configure these Supabase Edge Function secrets. None belong in SQL or the
frontend bundle:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT              # e.g. mailto:admin@example.com
NOTIFICATION_CRON_SECRET
```

The public/private VAPID pair must match. Generate it with a trusted Web Push
key generator or `web-push generate-vapid-keys` outside the repository.

## Supabase setup

1. Apply `sql/010_notifications.sql` after the existing schema migrations.
2. Deploy `supabase/functions/send-interested-notifications` with the secrets
   above. The function uses the service role only server-side and still filters
   every query by the owning `user_id`.
3. Store these values in Supabase Vault:

   - `serviceflow_functions_url`: `https://<project-ref>.supabase.co/functions/v1`
   - `serviceflow_notification_cron_secret`: the same value as the function secret

4. Apply `sql/011_notifications_cron.sql` after confirming `pg_cron`, `pg_net`,
   and Vault are available. Otherwise invoke the function from a trusted
   scheduler with the `x-cron-secret` header.

The notification tables have per-user RLS policies and authenticated grants.
The Edge Function uses the service role to process scheduled jobs, removes
expired Web Push subscriptions, and records unique person/occurrence delivery
keys to prevent duplicate reminders.
