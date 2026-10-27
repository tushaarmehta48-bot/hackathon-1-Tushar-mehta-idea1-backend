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
