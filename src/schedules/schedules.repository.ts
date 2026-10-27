import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import type {
  BookingPolicyRow,
  DiningAreaRow,
  ReservationRow,
  RestaurantTableRow,
  SeasonRuleRow,
  ServiceExceptionRow,
  ServiceShiftRow,
  TableBlockRow,
} from './schedules.types.js';
import { CAPACITY_RESERVATION_STATUSES } from '../availability/availability.types.js';
import { resolveTableTier } from './table-tier.util.js';

@Injectable()
export class SchedulesRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async getActivePolicy(): Promise<BookingPolicyRow> {
    const withHold =
      'id, timezone, min_notice_minutes, max_advance_days, cancellation_deadline_minutes, min_party_size, max_party_size, default_duration_minutes, turnover_buffer_minutes, deposit_required, deposit_amount_cents, deposit_currency, deposit_hold_minutes';
    const withoutHold =
      'id, timezone, min_notice_minutes, max_advance_days, cancellation_deadline_minutes, min_party_size, max_party_size, default_duration_minutes, turnover_buffer_minutes, deposit_required, deposit_amount_cents, deposit_currency';

    let { data, error } = await this.supabase
      .getAdminClient()
      .from('booking_policies')
      .select(withHold)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && this.isMissingDepositHoldColumn(error.message)) {
      ({ data, error } = await this.supabase
        .getAdminClient()
        .from('booking_policies')
        .select(withoutHold)
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle());
    }

    this.assertOk(error);
    if (!data) {
      throw new ServiceUnavailableException('No active booking policy configured');
    }
    const row = data as BookingPolicyRow & { deposit_hold_minutes?: number };
    return {
      ...row,
      deposit_hold_minutes: row.deposit_hold_minutes ?? 15,
    };
  }

  async getActiveShifts(): Promise<ServiceShiftRow[]> {
    const { data, error } = await this.supabase
      .getAdminClient()
      .from('service_shifts')
      .select(
        'id, name, weekday, service_date, starts_at, ends_at, default_duration_minutes, active',
      )
      .eq('active', true);

    this.assertOk(error);
    return (data ?? []) as ServiceShiftRow[];
  }

  async getEnabledSeasons(): Promise<SeasonRuleRow[]> {
    const { data, error } = await this.supabase
      .getAdminClient()
      .from('season_rules')
      .select('id, starts_on, ends_on, enabled')
      .eq('enabled', true);

    this.assertOk(error);
    return (data ?? []) as SeasonRuleRow[];
  }

  async getExceptionForDate(dateStr: string): Promise<ServiceExceptionRow | null> {
    const { data, error } = await this.supabase
      .getAdminClient()
      .from('service_exceptions')
      .select('exception_date, opens_at, closes_at, is_closed')
      .eq('exception_date', dateStr)
      .maybeSingle();

    this.assertOk(error);
    return (data as ServiceExceptionRow | null) ?? null;
  }

  async getActiveAreas(): Promise<DiningAreaRow[]> {
    const { data, error } = await this.supabase
      .getAdminClient()
      .from('dining_areas')
      .select('id, name, description, area_type, sort_order, active')
      .eq('active', true)
      .order('sort_order', { ascending: true });

    this.assertOk(error);
    return (data ?? []) as DiningAreaRow[];
  }

  async getActiveTables(): Promise<RestaurantTableRow[]> {
    const withTier =
      'id, area_id, label, min_capacity, max_capacity, svg_x, svg_y, svg_width, svg_height, svg_rotation_deg, table_tier, active, bookable';
    const withoutTier =
      'id, area_id, label, min_capacity, max_capacity, svg_x, svg_y, svg_width, svg_height, svg_rotation_deg, active, bookable';

    const first = await this.supabase
      .getAdminClient()
      .from('restaurant_tables')
      .select(withTier)
      .eq('active', true);

    let rows: Record<string, unknown>[] | null = (first.data as Record<string, unknown>[] | null) ?? null;
    let queryError = first.error;

    if (queryError && this.isMissingTableTierColumn(queryError.message)) {
      const fallback = await this.supabase
        .getAdminClient()
        .from('restaurant_tables')
        .select(withoutTier)
        .eq('active', true);
      rows = (fallback.data as Record<string, unknown>[] | null) ?? null;
      queryError = fallback.error;
    }

    this.assertOk(queryError);
    return (rows ?? []).map((row) => {
      const label = String(row.label ?? '');
      const maxCapacity = Number(row.max_capacity ?? 1);
      const table_tier = resolveTableTier({
        label,
        maxCapacity,
        tableTier: row.table_tier as string | null | undefined,
      });
      return {
        ...(row as unknown as RestaurantTableRow),
        table_tier,
      };
    });
  }

  async getReservationsBetween(startIso: string, endIso: string): Promise<ReservationRow[]> {
    const { data, error } = await this.supabase
      .getAdminClient()
      .from('reservations')
      .select('id, table_id, starts_at, ends_at, status')
      .lt('starts_at', endIso)
      .gt('ends_at', startIso);

    this.assertOk(error);
    return ((data ?? []) as ReservationRow[]).filter((row) =>
      CAPACITY_RESERVATION_STATUSES.has(row.status),
    );
  }

  async getActiveBlocksBetween(startIso: string, endIso: string): Promise<TableBlockRow[]> {
    const { data, error } = await this.supabase
      .getAdminClient()
      .from('table_blocks')
      .select('id, table_id, area_id, starts_at, ends_at, active')
      .eq('active', true)
      .lt('starts_at', endIso)
      .gt('ends_at', startIso);

    this.assertOk(error);
    return (data ?? []) as TableBlockRow[];
  }

  private isMissingTableTierColumn(message: string): boolean {
    return message.includes('table_tier') || message.includes('42703');
  }

  private isMissingDepositHoldColumn(message: string): boolean {
    const text = message.toLowerCase();
    return text.includes('deposit_hold_minutes') && text.includes('does not exist');
  }

  private assertOk(error: { message: string } | null): void {
    if (error) {
      throw new ServiceUnavailableException(error.message);
    }
  }
}
