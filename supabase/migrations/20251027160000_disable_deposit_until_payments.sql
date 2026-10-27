-- Keep policy aligned when no payment gateway is in use (PAYMENTS_ENABLED=false on API).

UPDATE public.booking_policies
SET deposit_required = false
WHERE active = true AND deposit_required = true;
