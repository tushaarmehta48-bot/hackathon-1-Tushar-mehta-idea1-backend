export type BookingPolicyRow = {
  id: string;
  timezone: string;
  min_notice_minutes: number;
  max_advance_days: number;
  cancellation_deadline_minutes: number;
  min_party_size: number;
  max_party_size: number;
  default_duration_minutes: number;
  turnover_buffer_minutes: number;
  deposit_required: boolean;
  deposit_amount_cents: number | null;
  deposit_currency: string;
  deposit_hold_minutes: number;
};

export type ServiceShiftRow = {
  id: string;
  name: string;
  weekday: number | null;
  service_date: string | null;
  starts_at: string;
  ends_at: string;
  default_duration_minutes: number;
  active: boolean;
};

export type SeasonRuleRow = {
  id: string;
  starts_on: string;
  ends_on: string;
  enabled: boolean;
};

export type ServiceExceptionRow = {
  exception_date: string;
  opens_at: string | null;
  closes_at: string | null;
  is_closed: boolean;
};

export type DiningAreaRow = {
  id: string;
  name: string;
  description: string | null;
  area_type: string;
  sort_order: number;
  active: boolean;
};

export type TableTier = 'STANDARD' | 'PREMIUM' | 'GROUP';

export type RestaurantTableRow = {
  id: string;
  area_id: string;
  label: string;
  min_capacity: number;
  max_capacity: number;
  svg_x: number;
  svg_y: number;
  svg_width: number;
  svg_height: number;
  svg_rotation_deg: number;
  table_tier: TableTier;
  active: boolean;
  bookable: boolean;
};

export type ReservationRow = {
  id: string;
  table_id: string;
  starts_at: string;
  ends_at: string;
  status: string;
};

export type TableBlockRow = {
  id: string;
  table_id: string | null;
  area_id: string | null;
  starts_at: string;
  ends_at: string;
  active: boolean;
};
