-- ServiceFlow Interested People notification storage.
-- VAPID private keys are deployment secrets and must never be stored here.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint        TEXT NOT NULL,
  p256dh          TEXT NOT NULL,
  auth            TEXT NOT NULL,
  expiration_time BIGINT,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
  ON public.push_subscriptions(user_id);

CREATE TABLE IF NOT EXISTS public.notification_delivery (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id      UUID REFERENCES public.interested_people(id) ON DELETE CASCADE,
  notification_key TEXT NOT NULL,
  channel        TEXT NOT NULL DEFAULT 'push' CHECK (channel IN ('push', 'foreground')),
  status         TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'failed')),
  scheduled_for  DATE,
  delivered_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, notification_key)
);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_user_date
  ON public.notification_delivery(user_id, scheduled_for);

CREATE TABLE IF NOT EXISTS public.notification_runs (
  user_id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_delivery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can insert own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can update own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can delete own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can select own push subscriptions" ON public.push_subscriptions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own push subscriptions" ON public.push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own push subscriptions" ON public.push_subscriptions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own push subscriptions" ON public.push_subscriptions
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can select own notification deliveries" ON public.notification_delivery;
DROP POLICY IF EXISTS "Users can insert own notification deliveries" ON public.notification_delivery;
DROP POLICY IF EXISTS "Users can update own notification deliveries" ON public.notification_delivery;
DROP POLICY IF EXISTS "Users can delete own notification deliveries" ON public.notification_delivery;
CREATE POLICY "Users can select own notification deliveries" ON public.notification_delivery
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own notification deliveries" ON public.notification_delivery
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notification deliveries" ON public.notification_delivery
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own notification deliveries" ON public.notification_delivery
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can select own notification runs" ON public.notification_runs;
DROP POLICY IF EXISTS "Users can insert own notification runs" ON public.notification_runs;
DROP POLICY IF EXISTS "Users can update own notification runs" ON public.notification_runs;
DROP POLICY IF EXISTS "Users can delete own notification runs" ON public.notification_runs;
CREATE POLICY "Users can select own notification runs" ON public.notification_runs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own notification runs" ON public.notification_runs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notification runs" ON public.notification_runs
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own notification runs" ON public.notification_runs
  FOR DELETE USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_delivery TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_runs TO authenticated;
REVOKE ALL ON public.push_subscriptions FROM anon;
REVOKE ALL ON public.notification_delivery FROM anon;
REVOKE ALL ON public.notification_runs FROM anon;
