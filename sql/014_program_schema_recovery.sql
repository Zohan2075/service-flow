-- 014_program_schema_recovery.sql
-- Recover the legacy Program projection tables when 009 was skipped or only
-- partially applied. This migration is additive and preserves existing data.

-- 009 is the normal dependency, but these IF NOT EXISTS guards make this safe
-- for projects that already ran later Program migrations without 009.
CREATE TABLE IF NOT EXISTS public.program_weeks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    week_id         TEXT NOT NULL,
    week_range_en   TEXT NOT NULL DEFAULT '',
    week_range_es   TEXT NOT NULL DEFAULT '',
    bible_reading   TEXT NOT NULL DEFAULT '',
    sections_json   JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, week_id)
);

CREATE TABLE IF NOT EXISTS public.program_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    week_id         TEXT NOT NULL,
    session_date    TEXT NOT NULL,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    log_json        JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, week_id, session_date)
);

ALTER TABLE public.program_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'program_weeks'
          AND policyname = 'Users can view own program weeks'
    ) THEN
        CREATE POLICY "Users can view own program weeks"
            ON public.program_weeks FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'program_weeks'
          AND policyname = 'Users can insert own program weeks'
    ) THEN
        CREATE POLICY "Users can insert own program weeks"
            ON public.program_weeks FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'program_weeks'
          AND policyname = 'Users can update own program weeks'
    ) THEN
        CREATE POLICY "Users can update own program weeks"
            ON public.program_weeks FOR UPDATE USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'program_weeks'
          AND policyname = 'Users can delete own program weeks'
    ) THEN
        CREATE POLICY "Users can delete own program weeks"
            ON public.program_weeks FOR DELETE USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'program_sessions'
          AND policyname = 'Users can view own program sessions'
    ) THEN
        CREATE POLICY "Users can view own program sessions"
            ON public.program_sessions FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'program_sessions'
          AND policyname = 'Users can insert own program sessions'
    ) THEN
        CREATE POLICY "Users can insert own program sessions"
            ON public.program_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'program_sessions'
          AND policyname = 'Users can update own program sessions'
    ) THEN
        CREATE POLICY "Users can update own program sessions"
            ON public.program_sessions FOR UPDATE USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'program_sessions'
          AND policyname = 'Users can delete own program sessions'
    ) THEN
        CREATE POLICY "Users can delete own program sessions"
            ON public.program_sessions FOR DELETE USING (auth.uid() = user_id);
    END IF;
END
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.program_weeks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.program_sessions TO authenticated;
REVOKE ALL ON public.program_weeks FROM anon;
REVOKE ALL ON public.program_sessions FROM anon;

DO $$
DECLARE
    required_column TEXT;
BEGIN
    IF to_regclass('public.program_weeks') IS NULL
       OR to_regclass('public.program_sessions') IS NULL THEN
        RAISE EXCEPTION 'Program schema recovery failed: required table is missing';
    END IF;

    FOREACH required_column IN ARRAY ARRAY[
        'user_id', 'week_id', 'week_range_en', 'week_range_es',
        'bible_reading', 'sections_json'
    ] LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'program_weeks'
              AND column_name = required_column
        ) THEN
            RAISE EXCEPTION 'Program schema recovery failed: public.program_weeks.% is missing', required_column;
        END IF;
    END LOOP;
END
$$;

-- PostgREST may retain the old relation cache after DDL.
NOTIFY pgrst, 'reload schema';
