-- 018_comments_schema.sql
-- Comentarios (Comments) timer book — config + sessions.
-- Simpler than the Program: config is one JSON row, sessions carry a JSON log.

-- ── Comments Config ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.comments_config (
    user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    config_json   JSONB NOT NULL DEFAULT '{}'::jsonb,       -- CommentsConfig
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.comments_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "p_cmt_cfg_select" ON public.comments_config FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "p_cmt_cfg_insert" ON public.comments_config FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "p_cmt_cfg_update" ON public.comments_config FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "p_cmt_cfg_delete" ON public.comments_config FOR DELETE USING (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments_config TO authenticated;
REVOKE ALL ON public.comments_config FROM anon;

-- ── Comments Sessions ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.comments_sessions (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_date   TEXT NOT NULL,                           -- "yyyy-MM-dd"
    started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    log_json       JSONB NOT NULL DEFAULT '[]'::jsonb,      -- array of CommentTiming
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, session_date)
);

CREATE INDEX IF NOT EXISTS idx_cmt_sessions_user_date
    ON public.comments_sessions(user_id, session_date);

ALTER TABLE public.comments_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "p_cmt_sess_select" ON public.comments_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "p_cmt_sess_insert" ON public.comments_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "p_cmt_sess_update" ON public.comments_sessions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "p_cmt_sess_delete" ON public.comments_sessions FOR DELETE USING (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments_sessions TO authenticated;
REVOKE ALL ON public.comments_sessions FROM anon;

NOTIFY pgrst, 'reload schema';