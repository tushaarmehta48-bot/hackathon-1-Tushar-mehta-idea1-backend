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
