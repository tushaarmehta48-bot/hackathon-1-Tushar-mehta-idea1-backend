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
