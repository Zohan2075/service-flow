-- 015_program_sync_reliability.sql
-- Program schedule end times, editable-log timestamps, and deletion tombstones.
-- Tombstones prevent an offline full snapshot from resurrecting deleted rows.

ALTER TABLE public.program_interventions
    ADD COLUMN IF NOT EXISTS scheduled_end_minute INT;

UPDATE public.program_interventions
SET scheduled_end_minute = COALESCE(scheduled_start_minute, 0) + duration_min
WHERE scheduled_end_minute IS NULL;

ALTER TABLE public.program_timer_logs
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.program_sessions
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE public.program_timer_logs
SET updated_at = created_at
WHERE updated_at IS NULL;

UPDATE public.program_sessions
SET updated_at = created_at
WHERE updated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_prog_int_user_week_updated
    ON public.program_interventions(user_id, week_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_prog_log_user_session_updated
    ON public.program_timer_logs(user_id, session_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_prog_session_user_updated
    ON public.program_sessions(user_id, updated_at);

CREATE TABLE IF NOT EXISTS public.program_sync_tombstones (
    user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    entity_type   TEXT NOT NULL CHECK (entity_type IN ('week', 'intervention', 'session', 'log')),
    entity_key    TEXT NOT NULL,
    deleted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, entity_type, entity_key)
);

CREATE INDEX IF NOT EXISTS idx_prog_tombstone_user_type
    ON public.program_sync_tombstones(user_id, entity_type, updated_at);

ALTER TABLE public.program_sync_tombstones ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'program_sync_tombstones' AND policyname = 'p_prog_tombstone_select') THEN
        CREATE POLICY p_prog_tombstone_select ON public.program_sync_tombstones FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'program_sync_tombstones' AND policyname = 'p_prog_tombstone_insert') THEN
        CREATE POLICY p_prog_tombstone_insert ON public.program_sync_tombstones FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'program_sync_tombstones' AND policyname = 'p_prog_tombstone_update') THEN
        CREATE POLICY p_prog_tombstone_update ON public.program_sync_tombstones FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'program_sync_tombstones' AND policyname = 'p_prog_tombstone_delete') THEN
        CREATE POLICY p_prog_tombstone_delete ON public.program_sync_tombstones FOR DELETE USING (auth.uid() = user_id);
    END IF;
END
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.program_sync_tombstones TO authenticated;
REVOKE ALL ON public.program_sync_tombstones FROM anon;

NOTIFY pgrst, 'reload schema';
