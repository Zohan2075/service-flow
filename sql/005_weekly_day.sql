-- Add next_visit_weekly_day column to interested_people table
-- This allows marking a next visit as a recurring weekly event on a specific day.
-- 0=Sun, 1=Mon, ..., 6=Sat. NULL means not weekly.

ALTER TABLE public.interested_people
ADD COLUMN IF NOT EXISTS next_visit_weekly_day INT;

COMMENT ON COLUMN public.interested_people.next_visit_weekly_day IS
  'Day of week for recurring weekly visit. 0=Sun…6=Sat. NULL means not weekly.';
