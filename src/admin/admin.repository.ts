import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';

@Injectable()
export class AdminRepository {
  constructor(private readonly supabase: SupabaseService) {}

  private client() {
    return this.supabase.getAdminClient();
  }

  private assertOk(error: { message: string } | null): void {
    if (error) {
      throw new ServiceUnavailableException(error.message);
    }
  }

  async listDiningAreas() {
    const { data, error } = await this.client()
      .from('dining_areas')
      .select('id, name, description, area_type, sort_order, active')
      .order('sort_order', { ascending: true });
    this.assertOk(error);
    return data ?? [];
  }

  async insertDiningArea(row: Record<string, unknown>) {
    const { data, error } = await this.client()
      .from('dining_areas')
      .insert(row)
      .select('id, name, description, area_type, sort_order, active')
      .single();
    this.assertOk(error);
    return data;
  }

  async updateDiningArea(id: string, patch: Record<string, unknown>) {
    const { data, error } = await this.client()
      .from('dining_areas')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, name, description, area_type, sort_order, active')
      .maybeSingle();
    this.assertOk(error);
    return data;
  }

  async listTables(includeInactive: boolean) {
    const withTier =
      'id, area_id, label, min_capacity, max_capacity, svg_x, svg_y, svg_width, svg_height, svg_rotation_deg, table_tier, active, bookable';
    const withoutTier =
      'id, area_id, label, min_capacity, max_capacity, svg_x, svg_y, svg_width, svg_height, svg_rotation_deg, active, bookable';

    const runSelect = (columns: string) => {
      let query = this.client().from('restaurant_tables').select(columns).order('label', { ascending: true });
      if (!includeInactive) {
        query = query.eq('active', true);
      }
      return query;
    };

    const first = await runSelect(withTier);
    let rows = first.data;
    let queryError = first.error;
    if (queryError && (queryError.message.includes('table_tier') || queryError.message.includes('42703'))) {
      const fallback = await runSelect(withoutTier);
      rows = fallback.data;
      queryError = fallback.error;
    }
    this.assertOk(queryError);
    return ((rows ?? []) as unknown as Record<string, unknown>[]).map((row) => ({
      ...row,
      table_tier: row.table_tier ?? 'STANDARD',
    }));
  }

  async insertTable(row: Record<string, unknown>) {
    const { data, error } = await this.client()
      .from('restaurant_tables')
      .insert(row)
      .select(
        'id, area_id, label, min_capacity, max_capacity, svg_x, svg_y, svg_width, svg_height, svg_rotation_deg, table_tier, active, bookable',
      )
      .single();
    this.assertOk(error);
    return data;
  }

  async updateTable(id: string, patch: Record<string, unknown>) {
    const { data, error } = await this.client()
      .from('restaurant_tables')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(
        'id, area_id, label, min_capacity, max_capacity, svg_x, svg_y, svg_width, svg_height, svg_rotation_deg, table_tier, active, bookable',
      )
      .maybeSingle();
    this.assertOk(error);
    return data;
  }

  async listShifts() {
    const { data, error } = await this.client()
      .from('service_shifts')
      .select(
        'id, name, weekday, service_date, starts_at, ends_at, default_duration_minutes, active',
      )
      .order('weekday', { ascending: true, nullsFirst: false })
      .order('starts_at', { ascending: true });
    this.assertOk(error);
    return data ?? [];
  }

  async insertShift(row: Record<string, unknown>) {
    const { data, error } = await this.client()
      .from('service_shifts')
      .insert(row)
      .select(
        'id, name, weekday, service_date, starts_at, ends_at, default_duration_minutes, active',
      )
      .single();
    this.assertOk(error);
    return data;
  }

  async updateShift(id: string, patch: Record<string, unknown>) {
    const { data, error } = await this.client()
      .from('service_shifts')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(
        'id, name, weekday, service_date, starts_at, ends_at, default_duration_minutes, active',
      )
      .maybeSingle();
    this.assertOk(error);
    return data;
  }

  async listSeasons() {
    const { data, error } = await this.client()
      .from('season_rules')
      .select('id, name, starts_on, ends_on, config, enabled')
      .order('starts_on', { ascending: true });
    this.assertOk(error);
    return data ?? [];
  }

  async insertSeason(row: Record<string, unknown>) {
    const { data, error } = await this.client()
      .from('season_rules')
      .insert(row)
      .select('id, name, starts_on, ends_on, config, enabled')
      .single();
    this.assertOk(error);
    return data;
  }

  async updateSeason(id: string, patch: Record<string, unknown>) {
    const { data, error } = await this.client()
      .from('season_rules')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, name, starts_on, ends_on, config, enabled')
      .maybeSingle();
    this.assertOk(error);
    return data;
  }

  async listExceptions(from: string, to: string) {
    const { data, error } = await this.client()
      .from('service_exceptions')
      .select('id, exception_date, opens_at, closes_at, is_closed, reason')
      .gte('exception_date', from)
      .lte('exception_date', to)
      .order('exception_date', { ascending: true });
    this.assertOk(error);
    return data ?? [];
  }

  async findExceptionByDate(date: string) {
    const { data, error } = await this.client()
      .from('service_exceptions')
      .select('id, exception_date, opens_at, closes_at, is_closed, reason')
      .eq('exception_date', date)
      .maybeSingle();
    this.assertOk(error);
    return data;
  }

  async insertException(row: Record<string, unknown>) {
    const { data, error } = await this.client()
      .from('service_exceptions')
      .insert(row)
      .select('id, exception_date, opens_at, closes_at, is_closed, reason')
      .single();
    this.assertOk(error);
    return data;
  }

  async updateException(id: string, patch: Record<string, unknown>) {
    const { data, error } = await this.client()
      .from('service_exceptions')
      .update(patch)
      .eq('id', id)
      .select('id, exception_date, opens_at, closes_at, is_closed, reason')
      .maybeSingle();
    this.assertOk(error);
    return data;
  }

  async deleteException(id: string) {
    const { error } = await this.client().from('service_exceptions').delete().eq('id', id);
    this.assertOk(error);
  }

  async getActivePolicy() {
    const { data, error } = await this.client()
      .from('booking_policies')
      .select(
        'id, timezone, min_notice_minutes, max_advance_days, cancellation_deadline_minutes, min_party_size, max_party_size, default_duration_minutes, turnover_buffer_minutes, deposit_required, deposit_amount_cents, deposit_currency, deposit_hold_minutes, active',
      )
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    this.assertOk(error);
    return data;
  }

  async updatePolicy(id: string, patch: Record<string, unknown>) {
    const { data, error } = await this.client()
      .from('booking_policies')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(
        'id, timezone, min_notice_minutes, max_advance_days, cancellation_deadline_minutes, min_party_size, max_party_size, default_duration_minutes, turnover_buffer_minutes, deposit_required, deposit_amount_cents, deposit_currency, deposit_hold_minutes, active',
      )
      .maybeSingle();
    this.assertOk(error);
    return data;
  }

  async listTableBlocks(fromIso: string, toIso: string) {
    const { data, error } = await this.client()
      .from('table_blocks')
      .select('id, table_id, area_id, starts_at, ends_at, reason, active')
      .eq('active', true)
      .lt('starts_at', toIso)
      .gt('ends_at', fromIso)
      .order('starts_at', { ascending: true });
    this.assertOk(error);
    return data ?? [];
  }

  async insertTableBlock(row: Record<string, unknown>) {
    const { data, error } = await this.client()
      .from('table_blocks')
      .insert(row)
      .select('id, table_id, area_id, starts_at, ends_at, reason, active')
      .single();
    this.assertOk(error);
    return data;
  }

  async deactivateTableBlock(id: string) {
    const { data, error } = await this.client()
      .from('table_blocks')
      .update({ active: false })
      .eq('id', id)
      .select('id, table_id, area_id, starts_at, ends_at, reason, active')
      .maybeSingle();
    this.assertOk(error);
    return data;
  }

  async listPortalProfiles() {
    const { data, error } = await this.client()
      .from('profiles')
      .select('id, display_name, role, active')
      .in('role', ['STAFF', 'ADMIN'])
      .order('role', { ascending: true });
    this.assertOk(error);
    return data ?? [];
  }

  async updateProfileRole(id: string, role: 'STAFF' | 'CUSTOMER', displayName?: string) {
    const patch: Record<string, unknown> = {
      role,
      updated_at: new Date().toISOString(),
    };
    if (displayName !== undefined) {
      patch.display_name = displayName;
    }
    const { data, error } = await this.client()
      .from('profiles')
      .update(patch)
      .eq('id', id)
      .select('id, display_name, role, active')
      .maybeSingle();
    this.assertOk(error);
    return data;
  }

  async getProfile(id: string) {
    const { data, error } = await this.client()
      .from('profiles')
      .select('id, display_name, role, active')
      .eq('id', id)
      .maybeSingle();
    this.assertOk(error);
    return data;
  }

  async reservationStats(fromIso: string, toExclusiveIso: string) {
    const { data, error } = await this.client()
      .from('reservations')
      .select('id, reference, status, party_size, starts_at, ends_at, checked_in_at, source')
      .gte('starts_at', fromIso)
      .lt('starts_at', toExclusiveIso);
    this.assertOk(error);
    return data ?? [];
  }
}
