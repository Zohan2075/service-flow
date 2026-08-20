-- 019_program_week_reading_es.sql
-- Program weeks now carry the Spanish Bible reading (EN stays in bible_reading).

ALTER TABLE public.program_weeks
    ADD COLUMN IF NOT EXISTS bible_reading_es TEXT NOT NULL DEFAULT '';

NOTIFY pgrst, 'reload schema';