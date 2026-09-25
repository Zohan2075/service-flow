-- 020_program_gap_before_minute.sql
-- Per-intervention user gap (minutes) inserted before the part in the cascading schedule.

ALTER TABLE public.program_interventions
    ADD COLUMN IF NOT EXISTS gap_before_minute INT;

NOTIFY pgrst, 'reload schema';
