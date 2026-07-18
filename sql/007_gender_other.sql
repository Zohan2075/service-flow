-- Add 'other' option to interested_people.gender CHECK constraint
-- (support for "Sin especificar" / "Unspecified" gender)

ALTER TABLE public.interested_people DROP CONSTRAINT IF EXISTS interested_people_gender_check;

ALTER TABLE public.interested_people
ADD CONSTRAINT interested_people_gender_check
CHECK (gender IN ('male', 'female', 'other'));
