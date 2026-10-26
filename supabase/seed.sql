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
    'Outdoor seating under the haritz',
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
    'c1000000-0000-4000-8000-000000000001',
    'Friday lunch',
    5,
    '13:00',
    '16:00',
    120,
    true
  ),
  (
    'c1000000-0000-4000-8000-000000000002',
    'Friday dinner',
    5,
    '20:00',
    '23:30',
    150,
    true
  ),
  (
    'c1000000-0000-4000-8000-000000000003',
    'Saturday lunch',
    6,
    '13:00',
    '16:00',
    120,
    true
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.season_rules (id, name, starts_on, ends_on, config, enabled)
VALUES (
  'd1000000-0000-4000-8000-000000000001',
  'Txotx season',
  '2026-01-01',
  '2026-04-30',
  '{"txotx_enabled": true, "highlight_key": "season.txotx"}'::jsonb,
  true
)
ON CONFLICT (id) DO NOTHING;
