-- =============================================================================
-- ServiceFlow Supabase Schema
-- Run this in Supabase SQL Editor (https://app.supabase.com → SQL Editor)
-- =============================================================================
-- Creates all tables for the ServiceFlow app migration from Google Drive to
-- Supabase. Each table has user_id for Row-Level Security and timestamps.
-- =============================================================================

-- 1. Profiles — one row per user (links to auth.users)
--    Google profile fields (name, email, image) come from auth.users metadata
--    User-editable fields (display_name, bio, custom_image) stored here
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  bio         TEXT,
  custom_image TEXT,       -- data URL or null
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Settings — one row per user (jsonb for flexibility)
CREATE TABLE IF NOT EXISTS public.settings (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data       JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Service Types
CREATE TABLE IF NOT EXISTS public.service_types (
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
CREATE TABLE IF NOT EXISTS public.time_entries (
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

CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON public.time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_start_time ON public.time_entries(user_id, start_time);
CREATE INDEX IF NOT EXISTS idx_time_entries_service_type ON public.time_entries(service_type_id);

-- 5. Goals
CREATE TABLE IF NOT EXISTS public.goals (
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

CREATE INDEX IF NOT EXISTS idx_goals_user_id ON public.goals(user_id);

-- 6. Interested People
CREATE TABLE IF NOT EXISTS public.interested_people (
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

CREATE INDEX IF NOT EXISTS idx_interested_people_user_id ON public.interested_people(user_id);
CREATE INDEX IF NOT EXISTS idx_interested_people_status ON public.interested_people(user_id, status);

-- =============================================================================
-- Auto-update updated_at triggers (optional but recommended)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables that have updated_at
CREATE OR REPLACE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER set_updated_at BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER set_updated_at BEFORE UPDATE ON public.service_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER set_updated_at BEFORE UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER set_updated_at BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER set_updated_at BEFORE UPDATE ON public.interested_people
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
