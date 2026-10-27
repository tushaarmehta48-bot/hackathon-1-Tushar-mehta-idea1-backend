-- One QR scan = one guest; full check-in when count reaches party_size.

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS checked_in_guest_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.reservations
  DROP CONSTRAINT IF EXISTS reservations_checked_in_guest_count_valid;

ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_checked_in_guest_count_valid
  CHECK (checked_in_guest_count >= 0);
