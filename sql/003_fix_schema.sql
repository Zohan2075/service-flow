-- =============================================================================
-- ServiceFlow: Drop old backend tables and recreate with correct schema
-- Run this in Supabase SQL Editor if you get "column not found" errors
-- =============================================================================
-- The old FastAPI backend created tables with different columns and
-- foreign keys (to a custom `users` table, not Supabase's `auth.users`).
-- This script drops everything and recreates from scratch.
-- =============================================================================

-- Drop old backend tables (order matters for FK constraints)
DROP TABLE IF EXISTS public.time_entries CASCADE;
DROP TABLE IF EXISTS public.service_types CASCADE;
DROP TABLE IF EXISTS public.google_tokens CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Also drop any new tables that might have been partially created
DROP TABLE IF EXISTS public.interested_people CASCADE;
DROP TABLE IF EXISTS public.goals CASCADE;
DROP TABLE IF EXISTS public.settings CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- =============================================================================
-- Recreate all tables (same as 001_schema.sql)
-- =============================================================================

-- 1. Profiles
CREATE TABLE public.profiles (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  bio         TEXT,
  custom_image TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Settings
CREATE TABLE public.settings (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data       JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Service Types (now with entry_type column!)
CREATE TABLE public.service_types (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  entry_type  TEXT NOT NULL CHECK (entry_type IN ('time', 'units')),
  color       TEXT NOT NULL DEFAULT '#2094f3',
  icon        TEXT NOT NULL DEFAULT 'volunteer_activism',
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Time Entries
CREATE TABLE public.time_entries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL DEFAULT '',
  notes            TEXT,
  location         TEXT,
  start_time       TIMESTAMPTZ NOT NULL,
  end_time         TIMESTAMPTZ,
  duration_seconds INT,
  units_quantity   DOUBLE PRECISION,
  units_label      TEXT,
  service_type_id  UUID REFERENCES public.service_types(id) ON DELETE SET NULL,
  is_planned       BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_time_entries_user_id ON public.time_entries(user_id);
CREATE INDEX idx_time_entries_start_time ON public.time_entries(user_id, start_time);

-- 5. Goals
CREATE TABLE public.goals (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                     TEXT NOT NULL,
  scope                    TEXT NOT NULL CHECK (scope IN ('service', 'combined')),
  service_type_id          UUID REFERENCES public.service_types(id) ON DELETE SET NULL,
  service_type_ids         UUID[] DEFAULT '{}',
  monthly_duration_seconds INT,
  monthly_units_quantity   DOUBLE PRECISION,
  yearly_duration_seconds  INT,
  yearly_units_quantity    DOUBLE PRECISION,
  yearly_start_month       INT NOT NULL DEFAULT 9 CHECK (yearly_start_month BETWEEN 1 AND 12),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_goals_user_id ON public.goals(user_id);

-- 6. Interested People
CREATE TABLE public.interested_people (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                       TEXT NOT NULL,
  last_name                  TEXT NOT NULL DEFAULT '',
  gender                     TEXT NOT NULL CHECK (gender IN ('male', 'female')),
  age                        INT,
  address                    TEXT,
  comments                   TEXT,
  latitude                   DOUBLE PRECISION,
  longitude                  DOUBLE PRECISION,
  initial_conversation_date  TIMESTAMPTZ,
  next_visit_date            TIMESTAMPTZ,
  status                     TEXT NOT NULL DEFAULT 'interested_person'
                               CHECK (status IN ('bible_student', 'return_visit', 'interested_person')),
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_interested_people_user_id ON public.interested_people(user_id);

-- =============================================================================
-- RLS Policies (same as 002_rls.sql)
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interested_people ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Users can select own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own profile" ON public.profiles FOR DELETE USING (auth.uid() = user_id);

-- Settings
CREATE POLICY "Users can select own settings" ON public.settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own settings" ON public.settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON public.settings FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own settings" ON public.settings FOR DELETE USING (auth.uid() = user_id);

-- Service Types
CREATE POLICY "Users can select own service_types" ON public.service_types FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own service_types" ON public.service_types FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own service_types" ON public.service_types FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own service_types" ON public.service_types FOR DELETE USING (auth.uid() = user_id);

-- Time Entries
CREATE POLICY "Users can select own time_entries" ON public.time_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own time_entries" ON public.time_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own time_entries" ON public.time_entries FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own time_entries" ON public.time_entries FOR DELETE USING (auth.uid() = user_id);

-- Goals
CREATE POLICY "Users can select own goals" ON public.goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own goals" ON public.goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goals" ON public.goals FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own goals" ON public.goals FOR DELETE USING (auth.uid() = user_id);

-- Interested People
CREATE POLICY "Users can select own interested_people" ON public.interested_people FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own interested_people" ON public.interested_people FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own interested_people" ON public.interested_people FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own interested_people" ON public.interested_people FOR DELETE USING (auth.uid() = user_id);
