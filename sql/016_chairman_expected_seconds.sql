-- 016_chairman_expected_seconds.sql
-- Chairman / president expected limit now supports minutes AND seconds (0-59).
-- Idempotent: both columns are backfilled on every run.

ALTER TABLE public.program_preferences
    ADD COLUMN IF NOT EXISTS chairman_expected_count INT NOT NULL DEFAULT 1;

ALTER TABLE public.program_preferences
    ADD COLUMN IF NOT EXISTS chairman_expected_seconds INT NOT NULL DEFAULT 0;

NOTIFY pgrst, 'reload schema';
