-- Table tier for floor-plan styling and admin configuration (availability logic unchanged).

CREATE TYPE public.table_tier AS ENUM ('STANDARD', 'PREMIUM', 'GROUP');

ALTER TABLE public.restaurant_tables
  ADD COLUMN IF NOT EXISTS table_tier public.table_tier NOT NULL DEFAULT 'STANDARD';

UPDATE public.restaurant_tables
SET table_tier = 'GROUP'
WHERE label ~ '^G[0-9]+$';

UPDATE public.restaurant_tables
SET table_tier = 'PREMIUM'
WHERE id = 'b1000000-0000-4000-8000-000000000002';
