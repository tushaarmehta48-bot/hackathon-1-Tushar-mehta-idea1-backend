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
  table_tier,
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
    36,
    100,
    58,
    'STANDARD',
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
    36,
    120,
    58,
    'PREMIUM',
    true,
    true
  ),
  (
    'b1000000-0000-4000-8000-000000000003',
    'a1000000-0000-4000-8000-000000000002',
    'G1',
    2,
    4,
    130,
    118,
    90,
    72,
    'GROUP',
    true,
    true
  )
ON CONFLICT (id) DO UPDATE SET
  svg_x = EXCLUDED.svg_x,
  svg_y = EXCLUDED.svg_y,
  svg_width = EXCLUDED.svg_width,
  svg_height = EXCLUDED.svg_height,
  table_tier = EXCLUDED.table_tier;

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
