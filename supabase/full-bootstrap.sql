-- AUTO-GENERATED: run once in Supabase SQL Editor. Prefer: npm run db:apply

-- === 20251026120000_extensions_and_enums.sql ===
-- Core extensions and enum types for the booking domain.

CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE public.user_role AS ENUM ('CUSTOMER', 'STAFF', 'ADMIN');

CREATE TYPE public.reservation_status AS ENUM (
  'PENDING_PAYMENT',
  'PENDING_CONFIRMATION',
  'CONFIRMED',
  'CHECKED_IN',
  'COMPLETED',
  'CANCELLED',
  'REJECTED',
  'NO_SHOW',
  'EXPIRED'
);

CREATE TYPE public.reservation_source AS ENUM ('WEB', 'PHONE', 'WALK_IN', 'STAFF');

CREATE TYPE public.payment_status AS ENUM (
  'PENDING',
  'AUTHORIZED',
  'CAPTURED',
  'FAILED',
  'REFUNDED',
  'CANCELLED'
);

CREATE TYPE public.check_in_method AS ENUM ('QR', 'MANUAL');

CREATE TYPE public.check_in_outcome AS ENUM ('SUCCESS', 'REJECTED', 'DUPLICATE');

CREATE TYPE public.notification_status AS ENUM ('PENDING', 'SENT', 'FAILED');

CREATE TYPE public.area_type AS ENUM ('INDOOR', 'OUTDOOR', 'MIXED');

-- Statuses that hold table capacity (used by exclusion constraint and app logic).
CREATE OR REPLACE FUNCTION public.reservation_status_consumes_capacity(
  status public.reservation_status
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT status IN (
    'PENDING_PAYMENT',
    'PENDING_CONFIRMATION',
    'CONFIRMED',
    'CHECKED_IN'
  );
$$;


-- === 20251026120001_profiles_and_venue.sql ===
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


-- === 20251026120002_reservations_and_ops.sql ===
-- Reservations, payments, check-in, blocks, audit, notifications.

CREATE TABLE public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  customer_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  table_id uuid NOT NULL REFERENCES public.restaurant_tables (id) ON DELETE RESTRICT,
  shift_id uuid REFERENCES public.service_shifts (id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  party_size integer NOT NULL CHECK (party_size >= 1),
  status public.reservation_status NOT NULL DEFAULT 'PENDING_CONFIRMATION',
  source public.reservation_source NOT NULL DEFAULT 'WEB',
  special_request text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  deposit_required boolean NOT NULL DEFAULT false,
  deposit_due_at timestamptz,
  qr_token_hash text,
  checked_in_at timestamptz,
  checked_in_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (starts_at < ends_at),
  CHECK (length(reference) >= 6)
);

CREATE INDEX idx_reservations_customer_id ON public.reservations (customer_id);
CREATE INDEX idx_reservations_table_time ON public.reservations (table_id, starts_at, ends_at);
CREATE INDEX idx_reservations_status ON public.reservations (status);
CREATE INDEX idx_reservations_starts_at ON public.reservations (starts_at);

-- Half-open ranges [starts_at, ends_at): adjacent bookings allowed unless buffer applies in app layer.
ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_no_overlap_active
  EXCLUDE USING gist (
    table_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  )
  WHERE (public.reservation_status_consumes_capacity(status));

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL REFERENCES public.reservations (id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_payment_id text,
  provider_checkout_session_id text,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  currency char(3) NOT NULL DEFAULT 'EUR',
  status public.payment_status NOT NULL DEFAULT 'PENDING',
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_reservation_id ON public.payments (reservation_id);

CREATE TABLE public.check_in_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL REFERENCES public.reservations (id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  method public.check_in_method NOT NULL,
  outcome public.check_in_outcome NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_check_in_logs_reservation_id ON public.check_in_logs (reservation_id);

CREATE TABLE public.table_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid REFERENCES public.restaurant_tables (id) ON DELETE CASCADE,
  area_id uuid REFERENCES public.dining_areas (id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (starts_at < ends_at),
  CHECK (table_id IS NOT NULL OR area_id IS NOT NULL)
);

CREATE INDEX idx_table_blocks_window ON public.table_blocks (starts_at, ends_at) WHERE active;

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs (created_at DESC);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid REFERENCES public.reservations (id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles (id) ON DELETE CASCADE,
  channel text NOT NULL,
  locale text NOT NULL DEFAULT 'en',
  template_key text NOT NULL,
  status public.notification_status NOT NULL DEFAULT 'PENDING',
  sent_at timestamptz,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (reservation_id IS NOT NULL OR user_id IS NOT NULL)
);

CREATE INDEX idx_notifications_status ON public.notifications (status);


-- === 20251026120003_auth_helpers_and_triggers.sql ===
-- Auth hooks, role guards, and updated_at maintenance.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER dining_areas_set_updated_at
  BEFORE UPDATE ON public.dining_areas
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER restaurant_tables_set_updated_at
  BEFORE UPDATE ON public.restaurant_tables
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER service_shifts_set_updated_at
  BEFORE UPDATE ON public.service_shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER season_rules_set_updated_at
  BEFORE UPDATE ON public.season_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER booking_policies_set_updated_at
  BEFORE UPDATE ON public.booking_policies
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER reservations_set_updated_at
  BEFORE UPDATE ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER payments_set_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'ADMIN'
      AND active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('STAFF', 'ADMIN')
      AND active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, preferred_locale)
  VALUES (NEW.id, 'CUSTOMER', 'en');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.enforce_profile_role_rules()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.role <> 'CUSTOMER' AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Public signup cannot grant privileged roles';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Only admins can change profile roles';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_enforce_role_rules
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profile_role_rules();


-- === 20251026120004_row_level_security.sql ===
-- Row level security: direct Supabase access is constrained; NestJS uses service role for writes.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dining_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_in_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY profiles_select_own_or_staff
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.is_staff_or_admin());

CREATE POLICY profiles_update_own
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY profiles_admin_manage
  ON public.profiles
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Public venue layout (no PII)
CREATE POLICY dining_areas_public_read
  ON public.dining_areas
  FOR SELECT
  TO anon, authenticated
  USING (active = true);

CREATE POLICY dining_areas_admin_write
  ON public.dining_areas
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY restaurant_tables_public_read
  ON public.restaurant_tables
  FOR SELECT
  TO anon, authenticated
  USING (active = true);

CREATE POLICY restaurant_tables_admin_write
  ON public.restaurant_tables
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY service_shifts_public_read
  ON public.service_shifts
  FOR SELECT
  TO anon, authenticated
  USING (active = true);

CREATE POLICY service_shifts_admin_write
  ON public.service_shifts
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY season_rules_public_read
  ON public.season_rules
  FOR SELECT
  TO anon, authenticated
  USING (enabled = true);

CREATE POLICY season_rules_admin_write
  ON public.season_rules
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY service_exceptions_public_read
  ON public.service_exceptions
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY service_exceptions_admin_write
  ON public.service_exceptions
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY booking_policies_public_read
  ON public.booking_policies
  FOR SELECT
  TO anon, authenticated
  USING (active = true);

CREATE POLICY booking_policies_admin_write
  ON public.booking_policies
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY table_blocks_staff_read
  ON public.table_blocks
  FOR SELECT
  TO authenticated
  USING (public.is_staff_or_admin());

CREATE POLICY table_blocks_admin_write
  ON public.table_blocks
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- reservations: reads scoped; mutations only via service role (NestJS)
CREATE POLICY reservations_customer_read_own
  ON public.reservations
  FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());

CREATE POLICY reservations_staff_read
  ON public.reservations
  FOR SELECT
  TO authenticated
  USING (public.is_staff_or_admin());

CREATE POLICY payments_customer_read_own
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.reservations r
      WHERE r.id = payments.reservation_id
        AND r.customer_id = auth.uid()
    )
  );

CREATE POLICY payments_staff_read
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (public.is_staff_or_admin());

CREATE POLICY check_in_logs_staff_read
  ON public.check_in_logs
  FOR SELECT
  TO authenticated
  USING (public.is_staff_or_admin());

CREATE POLICY check_in_logs_staff_insert
  ON public.check_in_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff_or_admin() AND staff_id = auth.uid());

CREATE POLICY audit_logs_admin_read
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY notifications_user_read
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY notifications_staff_read
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (public.is_staff_or_admin());


-- === 20251026120005_service_role_profile_bootstrap.sql ===
-- Allow backend (service_role) to set privileged profile roles during portal user bootstrap.

CREATE OR REPLACE FUNCTION public.enforce_profile_role_rules()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.role <> 'CUSTOMER' AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Public signup cannot grant privileged roles';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Only admins can change profile roles';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- === 20251027120000_deposit_hold_minutes.sql ===
-- Deposit hold window for PENDING_PAYMENT reservations (Phase 8).

ALTER TABLE public.booking_policies
  ADD COLUMN IF NOT EXISTS deposit_hold_minutes integer NOT NULL DEFAULT 15
    CHECK (deposit_hold_minutes >= 5 AND deposit_hold_minutes <= 180);


-- === 20251027130000_iturrieta_public_hours.sql ===
-- Iturrieta public booking: Thu–Sun lunch 13:00–16:00 only; Mon–Wed closed; no online dinner.

UPDATE public.service_shifts
SET active = false
WHERE id IN (
  'c1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000002',
  'c1000000-0000-4000-8000-000000000003'
);

INSERT INTO public.service_shifts (
  id,
  name,
  weekday,
  starts_at,
  ends_at,
  default_duration_minutes,
  active
)
VALUES
  (
    'c1000000-0000-4000-8000-000000000010',
    'Thursday lunch',
    4,
    '13:00',
    '16:00',
    120,
    true
  ),
  (
    'c1000000-0000-4000-8000-000000000011',
    'Friday lunch',
    5,
    '13:00',
    '16:00',
    120,
    true
  ),
  (
    'c1000000-0000-4000-8000-000000000012',
    'Saturday lunch',
    6,
    '13:00',
    '16:00',
    120,
    true
  ),
  (
    'c1000000-0000-4000-8000-000000000013',
    'Sunday lunch',
    0,
    '13:00',
    '16:00',
    120,
    true
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  weekday = EXCLUDED.weekday,
  starts_at = EXCLUDED.starts_at,
  ends_at = EXCLUDED.ends_at,
  default_duration_minutes = EXCLUDED.default_duration_minutes,
  active = EXCLUDED.active;

-- Year-round online lunch (txotx highlight remains in season config JSON on separate rule if needed).
UPDATE public.season_rules
SET
  name = 'Public lunch service',
  starts_on = '2020-01-02',
  ends_on = '2099-12-23',
  config = '{"online_lunch_only": true, "dinners_by_arrangement": true}'::jsonb,
  enabled = true
WHERE id = 'd1000000-0000-4000-8000-000000000001';

-- Year-end closure: 24 December – 1 January (inclusive), 2025–2030.
INSERT INTO public.service_exceptions (id, exception_date, is_closed, reason)
VALUES
  ('e1100000-0000-4000-8000-20251224', '2025-12-24', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20251225', '2025-12-25', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20251226', '2025-12-26', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20251227', '2025-12-27', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20251228', '2025-12-28', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20251229', '2025-12-29', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20251230', '2025-12-30', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20251231', '2025-12-31', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20260101', '2026-01-01', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20261224', '2026-12-24', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20261225', '2026-12-25', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20261226', '2026-12-26', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20261227', '2026-12-27', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20261228', '2026-12-28', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20261229', '2026-12-29', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20261230', '2026-12-30', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20261231', '2026-12-31', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20270101', '2027-01-01', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20271224', '2027-12-24', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20271225', '2027-12-25', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20271226', '2027-12-26', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20271227', '2027-12-27', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20271228', '2027-12-28', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20271229', '2027-12-29', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20271230', '2027-12-30', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20271231', '2027-12-31', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20280101', '2028-01-01', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20281224', '2028-12-24', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20281225', '2028-12-25', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20281226', '2028-12-26', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20281227', '2028-12-27', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20281228', '2028-12-28', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20281229', '2028-12-29', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20281230', '2028-12-30', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20281231', '2028-12-31', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20290101', '2029-01-01', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20291224', '2029-12-24', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20291225', '2029-12-25', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20291226', '2029-12-26', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20291227', '2029-12-27', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20291228', '2029-12-28', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20291229', '2029-12-29', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20291230', '2029-12-30', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20291231', '2029-12-31', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20300101', '2030-01-01', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20301224', '2030-12-24', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20301225', '2030-12-25', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20301226', '2030-12-26', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20301227', '2030-12-27', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20301228', '2030-12-28', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20301229', '2030-12-29', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20301230', '2030-12-30', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20301231', '2030-12-31', true, 'Year-end holidays'),
  ('e1100000-0000-4000-8000-20310101', '2031-01-01', true, 'Year-end holidays')
ON CONFLICT (id) DO NOTHING;


-- === seed.sql ===
-- Development seed (run after migrations). Safe to re-run on empty dev DB only.

INSERT INTO public.booking_policies (
  id,
  timezone,
  min_notice_minutes,
  max_advance_days,
  cancellation_deadline_minutes,
  min_party_size,
  max_party_size,
  default_duration_minutes,
  turnover_buffer_minutes,
  deposit_required,
  active
)
VALUES (
  'e1000000-0000-4000-8000-000000000001',
  'Europe/Madrid',
  120,
  90,
  1440,
  1,
  10,
  120,
  15,
  false,
  true
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.dining_areas (id, name, description, area_type, sort_order, active)
VALUES
  (
    'a1000000-0000-4000-8000-000000000001',
    'Main hall',
    'Long tables by the fire',
    'INDOOR',
    1,
    true
  ),
  (
    'a1000000-0000-4000-8000-000000000002',
    'Garden terrace',
    'Outdoor seating in the Aramaio valley',
    'OUTDOOR',
    2,
    true
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.restaurant_tables (
  id,
  area_id,
  label,
  min_capacity,
  max_capacity,
  svg_x,
  svg_y,
  svg_width,
  svg_height,
  active,
  bookable
)
VALUES
  (
    'b1000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001',
    'T1',
    2,
    6,
    40,
    60,
    100,
    70,
    true,
    true
  ),
  (
    'b1000000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000001',
    'T2',
    2,
    8,
    180,
    60,
    120,
    70,
    true,
    true
  ),
  (
    'b1000000-0000-4000-8000-000000000003',
    'a1000000-0000-4000-8000-000000000002',
    'G1',
    2,
    4,
    50,
    120,
    80,
    80,
    true,
    true
  )
ON CONFLICT (id) DO NOTHING;

-- Public online booking: Thu–Sun lunch 13:00–16:00 (Europe/Madrid). Mon–Wed: no shifts.
INSERT INTO public.service_shifts (
  id,
  name,
  weekday,
  starts_at,
  ends_at,
  default_duration_minutes,
  active
)
VALUES
  (
    'c1000000-0000-4000-8000-000000000010',
    'Thursday lunch',
    4,
    '13:00',
    '16:00',
    120,
    true
  ),
  (
    'c1000000-0000-4000-8000-000000000011',
    'Friday lunch',
    5,
    '13:00',
    '16:00',
    120,
    true
  ),
  (
    'c1000000-0000-4000-8000-000000000012',
    'Saturday lunch',
    6,
    '13:00',
    '16:00',
    120,
    true
  ),
  (
    'c1000000-0000-4000-8000-000000000013',
    'Sunday lunch',
    0,
    '13:00',
    '16:00',
    120,
    true
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  weekday = EXCLUDED.weekday,
  starts_at = EXCLUDED.starts_at,
  ends_at = EXCLUDED.ends_at,
  default_duration_minutes = EXCLUDED.default_duration_minutes,
  active = EXCLUDED.active;

INSERT INTO public.season_rules (id, name, starts_on, ends_on, config, enabled)
VALUES (
  'd1000000-0000-4000-8000-000000000001',
  'Public lunch service',
  '2020-01-02',
  '2099-12-23',
  '{"online_lunch_only": true, "txotx_jan_may": true, "dinners_by_arrangement": true}'::jsonb,
  true
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  starts_on = EXCLUDED.starts_on,
  ends_on = EXCLUDED.ends_on,
  config = EXCLUDED.config,
  enabled = EXCLUDED.enabled;
