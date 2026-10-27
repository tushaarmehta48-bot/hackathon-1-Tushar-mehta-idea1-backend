-- Deposit hold window for PENDING_PAYMENT reservations (Phase 8).

ALTER TABLE public.booking_policies
  ADD COLUMN IF NOT EXISTS deposit_hold_minutes integer NOT NULL DEFAULT 15
    CHECK (deposit_hold_minutes >= 5 AND deposit_hold_minutes <= 180);
