-- Add cap_exempt column to service_types for monthly hour cap exemptions
ALTER TABLE public.service_types
ADD COLUMN IF NOT EXISTS cap_exempt BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.service_types.cap_exempt IS
  'When true, hours logged under this service type are excluded from the monthly hour cap calculation.';
