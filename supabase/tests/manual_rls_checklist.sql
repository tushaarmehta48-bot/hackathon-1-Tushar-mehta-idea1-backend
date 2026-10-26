-- Manual RLS verification (run in Supabase SQL editor on a dev project after migrations + seed).
-- Replace UUIDs with real auth.users ids after creating test accounts.

-- 1) Public can read active tables (run as anon via PostgREST or disable JWT in API settings for test).
--    SELECT * FROM restaurant_tables;  -- expect rows, no customer PII

-- 2) Authenticated customer cannot read another customer's reservation (use user JWT in client).
--    SELECT * FROM reservations WHERE customer_id <> auth.uid();  -- expect 0 rows

-- 3) Overlap constraint (service role or SQL editor):
BEGIN;
INSERT INTO reservations (
  reference, table_id, starts_at, ends_at, party_size, status, source
) VALUES (
  'RLS-TEST-1',
  'b1000000-0000-4000-8000-000000000001',
  '2026-07-01T18:00:00Z',
  '2026-07-01T20:00:00Z',
  2,
  'CONFIRMED',
  'WEB'
);
INSERT INTO reservations (
  reference, table_id, starts_at, ends_at, party_size, status, source
) VALUES (
  'RLS-TEST-2',
  'b1000000-0000-4000-8000-000000000001',
  '2026-07-01T19:00:00Z',
  '2026-07-01T21:00:00Z',
  2,
  'CONFIRMED',
  'WEB'
);  -- should ERROR: conflicting key value violates exclusion constraint
ROLLBACK;
