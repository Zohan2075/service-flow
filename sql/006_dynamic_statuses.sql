-- Make interested_people.status dynamic (no more fixed CHECK constraint)
-- and add completed column for marking people as visited/done.

-- 1. Drop the CHECK constraint that limited status to 3 fixed values
ALTER TABLE public.interested_people DROP CONSTRAINT IF EXISTS interested_people_status_check;

-- 2. Add completed boolean column
ALTER TABLE public.interested_people
ADD COLUMN IF NOT EXISTS completed BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.interested_people.completed IS
  'Whether this person has been visited/marked as done.';
