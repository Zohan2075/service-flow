-- =============================================================================
-- ServiceFlow RLS Policies
-- Run AFTER 001_schema.sql
-- =============================================================================
-- Row-Level Security ensures each user can only access their own data.
-- All tables use: auth.uid() = user_id
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interested_people ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Profiles: users can read/write only their own profile
-- =============================================================================
CREATE POLICY "Users can select own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own profile"
  ON public.profiles FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================================================
-- Settings: users can read/write only their own settings
-- =============================================================================
CREATE POLICY "Users can select own settings"
  ON public.settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON public.settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON public.settings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own settings"
  ON public.settings FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================================================
-- Service Types: users CRUD their own
-- =============================================================================
CREATE POLICY "Users can select own service_types"
  ON public.service_types FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own service_types"
  ON public.service_types FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own service_types"
  ON public.service_types FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own service_types"
  ON public.service_types FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================================================
-- Time Entries: users CRUD their own
-- =============================================================================
CREATE POLICY "Users can select own time_entries"
  ON public.time_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own time_entries"
  ON public.time_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own time_entries"
  ON public.time_entries FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own time_entries"
  ON public.time_entries FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================================================
-- Goals: users CRUD their own
-- =============================================================================
CREATE POLICY "Users can select own goals"
  ON public.goals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own goals"
  ON public.goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goals"
  ON public.goals FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own goals"
  ON public.goals FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================================================
-- Interested People: users CRUD their own
-- =============================================================================
CREATE POLICY "Users can select own interested_people"
  ON public.interested_people FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own interested_people"
  ON public.interested_people FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own interested_people"
  ON public.interested_people FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own interested_people"
  ON public.interested_people FOR DELETE
  USING (auth.uid() = user_id);
