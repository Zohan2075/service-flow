-- 009_program_schema.sql
-- Program/Presiding schedules & session timers
-- Configurations + timer logs only (volunteer names stay local cache)

-- ── Program Weeks ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.program_weeks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    week_id         TEXT NOT NULL,                          -- "2026-W31" format
    week_range_en   TEXT NOT NULL DEFAULT '',               -- "AUGUST 3-9"
    week_range_es   TEXT NOT NULL DEFAULT '',               -- "3-9 DE AGOSTO"
    bible_reading   TEXT NOT NULL DEFAULT '',               -- weekly bible reading
    sections_json   JSONB NOT NULL DEFAULT '[]'::jsonb,     -- all sections as JSON
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(user_id, week_id)
);

-- Enable RLS
ALTER TABLE public.program_weeks ENABLE ROW LEVEL SECURITY;

-- Policies: user can only see/modify their own weeks
CREATE POLICY "Users can view own program weeks"
    ON public.program_weeks FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own program weeks"
    ON public.program_weeks FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own program weeks"
    ON public.program_weeks FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own program weeks"
    ON public.program_weeks FOR DELETE
    USING (auth.uid() = user_id);

-- ── Program Sessions (Timer Logs) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.program_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    week_id         TEXT NOT NULL,                          -- which week this session is for
    session_date    TEXT NOT NULL,                          -- "yyyy-MM-dd"
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    log_json        JSONB NOT NULL DEFAULT '[]'::jsonb,     -- array of TimerLogEntry
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(user_id, week_id, session_date)
);

-- Enable RLS
ALTER TABLE public.program_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own program sessions"
    ON public.program_sessions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own program sessions"
    ON public.program_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own program sessions"
    ON public.program_sessions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own program sessions"
    ON public.program_sessions FOR DELETE
    USING (auth.uid() = user_id);
