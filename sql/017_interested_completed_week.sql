-- 017_interested_completed_week.sql
-- Track which ISO week a person was marked completed, enabling weekly
-- recurring visits to reset: a weekly person counts as completed only when
-- completed AND completed_week_key matches the current week key.
-- Idempotent: column is added only if missing.

ALTER TABLE public.interested_people
    ADD COLUMN IF NOT EXISTS completed_week_key TEXT;

COMMENT ON COLUMN public.interested_people.completed_week_key IS
    'ISO week key (YYYY-Www) of the week this person was last marked completed; weekly visits reset when a new week starts';

NOTIFY pgrst, 'reload schema';
