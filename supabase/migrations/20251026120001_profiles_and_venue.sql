-- Profiles (linked to Supabase Auth) and venue configuration tables.

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name text,
  role public.user_role NOT NULL DEFAULT 'CUSTOMER',
  preferred_locale text NOT NULL DEFAULT 'en'
    CHECK (preferred_locale IN ('en', 'es', 'eu', 'ca', 'fr')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.dining_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  area_type public.area_type NOT NULL DEFAULT 'INDOOR',
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.restaurant_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid NOT NULL REFERENCES public.dining_areas (id) ON DELETE RESTRICT,
  label text NOT NULL,
  min_capacity integer NOT NULL CHECK (min_capacity >= 1),
  max_capacity integer NOT NULL CHECK (max_capacity >= min_capacity),
  svg_x numeric(8, 2) NOT NULL DEFAULT 0,
  svg_y numeric(8, 2) NOT NULL DEFAULT 0,
  svg_width numeric(8, 2) NOT NULL DEFAULT 80,
  svg_height numeric(8, 2) NOT NULL DEFAULT 80,
  svg_rotation_deg numeric(6, 2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  bookable boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (area_id, label)
);

CREATE TABLE public.service_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  weekday smallint CHECK (weekday IS NULL OR (weekday >= 0 AND weekday <= 6)),
  service_date date,
  starts_at time NOT NULL,
  ends_at time NOT NULL,
  default_duration_minutes integer NOT NULL DEFAULT 120 CHECK (default_duration_minutes > 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (starts_at < ends_at),
  CHECK (weekday IS NOT NULL OR service_date IS NOT NULL)
);

CREATE TABLE public.season_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (starts_on <= ends_on)
);

CREATE TABLE public.service_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exception_date date NOT NULL,
  opens_at timestamptz,
  closes_at timestamptz,
  is_closed boolean NOT NULL DEFAULT false,
  reason text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.booking_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timezone text NOT NULL DEFAULT 'Europe/Madrid',
  min_notice_minutes integer NOT NULL DEFAULT 120 CHECK (min_notice_minutes >= 0),
  max_advance_days integer NOT NULL DEFAULT 90 CHECK (max_advance_days >= 1),
  cancellation_deadline_minutes integer NOT NULL DEFAULT 1440 CHECK (cancellation_deadline_minutes >= 0),
  min_party_size integer NOT NULL DEFAULT 1 CHECK (min_party_size >= 1),
  max_party_size integer NOT NULL DEFAULT 12 CHECK (max_party_size >= min_party_size),
  default_duration_minutes integer NOT NULL DEFAULT 120 CHECK (default_duration_minutes > 0),
  turnover_buffer_minutes integer NOT NULL DEFAULT 15 CHECK (turnover_buffer_minutes >= 0),
  deposit_required boolean NOT NULL DEFAULT false,
  deposit_amount_cents integer CHECK (deposit_amount_cents IS NULL OR deposit_amount_cents >= 0),
  deposit_currency char(3) NOT NULL DEFAULT 'EUR',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_restaurant_tables_area_id ON public.restaurant_tables (area_id);
CREATE INDEX idx_service_shifts_weekday ON public.service_shifts (weekday) WHERE active;
CREATE INDEX idx_season_rules_dates ON public.season_rules (starts_on, ends_on) WHERE enabled;
CREATE INDEX idx_service_exceptions_date ON public.service_exceptions (exception_date);
