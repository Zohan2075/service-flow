-- 012_program_persistence.sql
-- Normalized Program config, interventions, start times, and role-aware logs.
-- Volunteer/assignee names are kept local-only and NOT stored here.
-- Retains 009 program_weeks/sessions as legacy fallback projections.

-- ── Program Preferences ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.program_preferences (
    user_id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    active_week_id       TEXT,
    auto_advance         BOOLEAN NOT NULL DEFAULT FALSE,
    meeting_start_hour   INT NOT NULL DEFAULT 19,
    meeting_start_minute INT NOT NULL DEFAULT 30,
    time_format          TEXT NOT NULL DEFAULT '24h' CHECK (time_format IN ('12h', '24h')),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.program_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "p_prefs_select" ON public.program_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "p_prefs_insert" ON public.program_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "p_prefs_update" ON public.program_preferences FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "p_prefs_delete" ON public.program_preferences FOR DELETE USING (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.program_preferences TO authenticated;
REVOKE ALL ON public.program_preferences FROM anon;

-- ── Program Interventions (per user, week, and section) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.program_interventions (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    week_id               TEXT NOT NULL,
    section_id            TEXT NOT NULL,
    parent_section_id     TEXT,
    sort_order            INT NOT NULL DEFAULT 0,
    title_en              TEXT NOT NULL DEFAULT '',
    title_es              TEXT NOT NULL DEFAULT '',
    duration_min          INT NOT NULL DEFAULT 5,
    group_name            TEXT,
    scheduled_start_minute INT,
    timer_roles           JSONB,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, week_id, section_id)
);

CREATE INDEX IF NOT EXISTS idx_prog_int_user_week ON public.program_interventions(user_id, week_id);

ALTER TABLE public.program_interventions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "p_int_select" ON public.program_interventions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "p_int_insert" ON public.program_interventions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "p_int_update" ON public.program_interventions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "p_int_delete" ON public.program_interventions FOR DELETE USING (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.program_interventions TO authenticated;
REVOKE ALL ON public.program_interventions FROM anon;

-- ── Program Timer Logs (per user, week, session, and role) ──────────────────────
CREATE TABLE IF NOT EXISTS public.program_timer_logs (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    week_id               TEXT NOT NULL,
    session_id            TEXT NOT NULL,
    section_id            TEXT NOT NULL,
    title_en              TEXT NOT NULL DEFAULT '',
    title_es              TEXT NOT NULL DEFAULT '',
    role                  TEXT,
    scheduled_duration_min INT NOT NULL,
    actual_start          TIMESTAMPTZ NOT NULL,
    actual_end            TIMESTAMPTZ NOT NULL,
    actual_duration_sec   REAL NOT NULL DEFAULT 0,
    was_overtime          BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order            INT NOT NULL DEFAULT 0,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, week_id, session_id, section_id, role)
);

CREATE INDEX IF NOT EXISTS idx_prog_log_user_week ON public.program_timer_logs(user_id, week_id);

ALTER TABLE public.program_timer_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "p_log_select" ON public.program_timer_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "p_log_insert" ON public.program_timer_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "p_log_update" ON public.program_timer_logs FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "p_log_delete" ON public.program_timer_logs FOR DELETE USING (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.program_timer_logs TO authenticated;
REVOKE ALL ON public.program_timer_logs FROM anon;

-- ── Reconcile auth user IDs in legacy 009 tables ────────────────────────────────
-- (no schema change, but ensure legacy tables are owned by the same user_id FK)
