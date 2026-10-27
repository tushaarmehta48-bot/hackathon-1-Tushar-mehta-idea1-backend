import { Injectable, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import type { ReservationRecord } from './reservations.types.js';

type InsertReservationInput = {
  reference: string;
  customerId: string | null;
  tableId: string;
  shiftId: string;
  startsAt: string;
  endsAt: string;
  partySize: number;
  status: string;
  source: 'WEB' | 'PHONE' | 'WALK_IN' | 'STAFF';
  specialRequest: string | null;
  depositRequired: boolean;
  depositDueAt?: string | null;
  qrTokenHash: string;
  createdBy: string;
};

const RESERVATION_SELECT =
  'id, reference, customer_id, table_id, shift_id, starts_at, ends_at, party_size, status, source, special_request, deposit_required, deposit_due_at, checked_in_at, checked_in_guest_count, created_at, updated_at';

const RESERVATION_SELECT_LEGACY =
  'id, reference, customer_id, table_id, shift_id, starts_at, ends_at, party_size, status, source, special_request, deposit_required, deposit_due_at, checked_in_at, created_at, updated_at';

function mapReservationRows(data: unknown): ReservationRecord[] {
  if (!Array.isArray(data)) {
    return [];
  }
  return data
    .map((row) => mapReservationRow(row as Record<string, unknown>))
    .filter((row): row is ReservationRecord => row != null);
}

function mapReservationRow(row: Record<string, unknown> | null): ReservationRecord | null {
  if (!row) {
    return null;
  }
  const guestRaw = row.checked_in_guest_count;
  const guestParsed =
    typeof guestRaw === 'number' ? guestRaw : guestRaw != null ? Number(guestRaw) : 0;
  return {
    id: String(row.id),
    reference: String(row.reference),
    customer_id: (row.customer_id as string | null) ?? null,
    table_id: String(row.table_id),
    shift_id: (row.shift_id as string | null) ?? null,
    starts_at: String(row.starts_at),
    ends_at: String(row.ends_at),
    party_size: Number(row.party_size) || 0,
    status: String(row.status),
    source: String(row.source),
    special_request: (row.special_request as string | null) ?? null,
    deposit_required: Boolean(row.deposit_required),
    deposit_due_at: (row.deposit_due_at as string | null) ?? null,
    checked_in_at: (row.checked_in_at as string | null) ?? null,
    checked_in_guest_count: Number.isFinite(guestParsed) ? Math.max(0, guestParsed) : 0,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

@Injectable()
export class ReservationsRepository implements OnModuleInit {
  /** null = not probed yet; default to legacy SELECT until we know the column exists. */
  private guestCountColumnSupported: boolean | null = null;

  constructor(private readonly supabase: SupabaseService) {}

  async onModuleInit(): Promise<void> {
    await this.probeGuestCountColumn();
  }

  private async probeGuestCountColumn(): Promise<void> {
    const { error } = await this.supabase
      .getAdminClient()
      .from('reservations')
      .select('checked_in_guest_count')
      .limit(1);

    if (error && isMissingGuestCountColumn(error.message)) {
      this.guestCountColumnSupported = false;
      return;
    }
    if (error) {
      return;
    }
    this.guestCountColumnSupported = true;
  }

  private reservationSelect(): string {
    if (this.guestCountColumnSupported === true) {
      return RESERVATION_SELECT;
    }
    return RESERVATION_SELECT_LEGACY;
  }

  private noteGuestCountColumnFromError(message: string | undefined): void {
    if (isMissingGuestCountColumn(message)) {
      this.guestCountColumnSupported = false;
    }
  }

  /** Reads live guest count from DB (required for per-guest QR check-in). */
  private async readGuestCheckInCount(reservationId: string): Promise<number | null> {
    const { data, error } = await this.supabase
      .getAdminClient()
      .from('reservations')
      .select('checked_in_guest_count')
      .eq('id', reservationId)
      .maybeSingle();

    if (error) {
      if (isMissingGuestCountColumn(error.message)) {
        this.guestCountColumnSupported = false;
        return null;
      }
      throw new ServiceUnavailableException(error.message);
    }
    this.guestCountColumnSupported = true;
    const raw = (data as { checked_in_guest_count?: number } | null)?.checked_in_guest_count;
    const parsed = typeof raw === 'number' ? raw : raw != null ? Number(raw) : 0;
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }

  async insertReservation(input: InsertReservationInput): Promise<ReservationRecord> {
    const { data, error } = await this.supabase
      .getAdminClient()
      .from('reservations')
      .insert({
        reference: input.reference,
        customer_id: input.customerId,
        table_id: input.tableId,
        shift_id: input.shiftId,
        starts_at: input.startsAt,
        ends_at: input.endsAt,
        party_size: input.partySize,
        status: input.status,
        source: input.source,
        special_request: input.specialRequest,
        deposit_required: input.depositRequired,
        deposit_due_at: input.depositDueAt ?? null,
        qr_token_hash: input.qrTokenHash,
        created_by: input.createdBy,
      })
      .select(this.reservationSelect())
      .single();

    if (error) {
      if (this.isOverlapError(error)) {
        return Promise.reject(Object.assign(new Error('OVERLAP'), { code: 'OVERLAP' }));
      }
      throwRepositoryError(error);
    }

    const mapped = mapReservationRow(data as unknown as Record<string, unknown>);
    if (!mapped) {
      throw new ServiceUnavailableException('Reservation insert returned no row');
    }
    return mapped;
  }

  async findById(id: string): Promise<ReservationRecord | null> {
    let select = this.reservationSelect();
    let { data, error } = await this.supabase
      .getAdminClient()
      .from('reservations')
      .select(select)
      .eq('id', id)
      .maybeSingle();

    if (error && isMissingGuestCountColumn(error.message)) {
      this.guestCountColumnSupported = false;
      select = RESERVATION_SELECT_LEGACY;
      ({ data, error } = await this.supabase
        .getAdminClient()
        .from('reservations')
        .select(select)
        .eq('id', id)
        .maybeSingle());
    }

    if (error) {
      throw new ServiceUnavailableException(error.message);
    }
    return mapReservationRow((data as Record<string, unknown> | null) ?? null);
  }

  async findMine(customerId: string): Promise<ReservationRecord[]> {
    const { data, error } = await this.supabase
      .getAdminClient()
      .from('reservations')
      .select(this.reservationSelect())
      .eq('customer_id', customerId)
      .order('starts_at', { ascending: false });

    if (error) {
      throw new ServiceUnavailableException(error.message);
    }
    return mapReservationRows(data);
  }

  async cancelReservation(id: string): Promise<ReservationRecord> {
    const { data, error } = await this.supabase
      .getAdminClient()
      .from('reservations')
      .update({ status: 'CANCELLED' })
      .eq('id', id)
      .select(this.reservationSelect())
      .single();

    if (error) {
      throw new ServiceUnavailableException(error.message);
    }
    const mapped = mapReservationRow(data as unknown as Record<string, unknown>);
    if (!mapped) {
      throw new ServiceUnavailableException('Cancel returned no row');
    }
    return mapped;
  }

  async getTableLabel(tableId: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .getAdminClient()
      .from('restaurant_tables')
      .select('label')
      .eq('id', tableId)
      .maybeSingle();

    if (error) {
      throw new ServiceUnavailableException(error.message);
    }
    return (data as { label: string } | null)?.label ?? null;
  }

  async getShiftName(shiftId: string | null): Promise<string | null> {
    if (!shiftId) {
      return null;
    }
    const { data, error } = await this.supabase
      .getAdminClient()
      .from('service_shifts')
      .select('name')
      .eq('id', shiftId)
      .maybeSingle();

    if (error) {
      throw new ServiceUnavailableException(error.message);
    }
    return (data as { name: string } | null)?.name ?? null;
  }

  async findByReference(reference: string): Promise<ReservationRecord | null> {
    const { data, error } = await this.supabase
      .getAdminClient()
      .from('reservations')
      .select(this.reservationSelect())
      .eq('reference', reference)
      .maybeSingle();

    if (error) {
      throw new ServiceUnavailableException(error.message);
    }
    return mapReservationRow((data as Record<string, unknown> | null) ?? null);
  }

  async updateQrTokenHash(id: string, hash: string): Promise<void> {
    const { error } = await this.supabase
      .getAdminClient()
      .from('reservations')
      .update({ qr_token_hash: hash })
      .eq('id', id);

    if (error) {
      throw new ServiceUnavailableException(error.message);
    }
  }

  async findByQrTokenHash(hash: string): Promise<ReservationRecord | null> {
    const { data, error } = await this.supabase
      .getAdminClient()
      .from('reservations')
      .select(this.reservationSelect())
      .eq('qr_token_hash', hash)
      .maybeSingle();

    if (error) {
      throw new ServiceUnavailableException(error.message);
    }
    return mapReservationRow((data as Record<string, unknown> | null) ?? null);
  }

  async listBetween(startIso: string, endIso: string, referenceQuery?: string): Promise<ReservationRecord[]> {
    let query = this.supabase
      .getAdminClient()
      .from('reservations')
      .select(this.reservationSelect())
      .gte('starts_at', startIso)
      .lt('starts_at', endIso)
      .order('starts_at', { ascending: true });

    if (referenceQuery?.trim()) {
      query = query.ilike('reference', `%${referenceQuery.trim()}%`);
    }

    const { data, error } = await query;

    if (error) {
      throw new ServiceUnavailableException(error.message);
    }
    return mapReservationRows(data);
  }

  /** Adds one guest to check-in; marks booking CHECKED_IN when party_size is reached. */
  async incrementGuestCheckIn(
    reservationId: string,
    staffId: string,
  ): Promise<ReservationRecord | null> {
    if (this.guestCountColumnSupported === null) {
      await this.probeGuestCountColumn();
    }
    if (this.guestCountColumnSupported !== true) {
      return this.legacyCheckInFullParty(reservationId, staffId);
    }

    const existing = await this.findById(reservationId);
    if (!existing || existing.status !== 'CONFIRMED') {
      return null;
    }

    const currentFromDb = await this.readGuestCheckInCount(reservationId);
    if (currentFromDb === null) {
      return this.legacyCheckInFullParty(reservationId, staffId);
    }

    const current = currentFromDb;
    if (current >= existing.party_size) {
      return null;
    }

    const next = current + 1;
    const fullyCheckedIn = next >= existing.party_size;
    const now = new Date().toISOString();

    const patch: Record<string, unknown> = {
      checked_in_guest_count: next,
      updated_at: now,
    };
    if (fullyCheckedIn) {
      patch.status = 'CHECKED_IN';
      patch.checked_in_at = now;
      patch.checked_in_by = staffId;
    }

    const { data, error } = await this.supabase
      .getAdminClient()
      .from('reservations')
      .update(patch)
      .eq('id', reservationId)
      .eq('status', 'CONFIRMED')
      .eq('checked_in_guest_count', current)
      .select(this.reservationSelect())
      .maybeSingle();

    if (error) {
      if (isMissingGuestCountColumn(error.message)) {
        this.guestCountColumnSupported = false;
        return this.legacyCheckInFullParty(reservationId, staffId);
      }
      throw new ServiceUnavailableException(error.message);
    }

    const mapped = mapReservationRow((data as Record<string, unknown> | null) ?? null);
    if (mapped) {
      mapped.checked_in_guest_count = next;
      return mapped;
    }

    if (current === 0) {
      return null;
    }

    const refreshed = await this.readGuestCheckInCount(reservationId);
    if (refreshed != null && refreshed > current && refreshed <= existing.party_size) {
      return this.findById(reservationId);
    }
    return null;
  }

  /** When checked_in_guest_count migration is not applied yet. */
  private async legacyCheckInFullParty(
    reservationId: string,
    staffId: string,
  ): Promise<ReservationRecord | null> {
    const { data, error } = await this.supabase
      .getAdminClient()
      .from('reservations')
      .update({
        status: 'CHECKED_IN',
        checked_in_at: new Date().toISOString(),
        checked_in_by: staffId,
      })
      .eq('id', reservationId)
      .eq('status', 'CONFIRMED')
      .is('checked_in_at', null)
      .select(this.reservationSelect())
      .maybeSingle();

    if (error) {
      throw new ServiceUnavailableException(error.message);
    }
    return mapReservationRow((data as Record<string, unknown> | null) ?? null);
  }

  async listCheckInSuccessHistoryByStaff(
    staffId: string,
    limit: number,
  ): Promise<
    Array<{
      id: string;
      method: string;
      created_at: string;
      reference: string;
      party_size: number;
      starts_at: string;
      table_id: string;
    }>
  > {
    const { data, error } = await this.supabase
      .getAdminClient()
      .from('check_in_logs')
      .select(
        `
        id,
        method,
        created_at,
        reservations!inner (
          reference,
          party_size,
          starts_at,
          table_id
        )
      `,
      )
      .eq('staff_id', staffId)
      .eq('outcome', 'SUCCESS')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new ServiceUnavailableException(error.message);
    }

    const rows = data ?? [];
    return rows.map((row) => {
      const reservationRaw = row.reservations as
        | {
            reference: string;
            party_size: number;
            starts_at: string;
            table_id: string;
          }
        | {
            reference: string;
            party_size: number;
            starts_at: string;
            table_id: string;
          }[]
        | null;
      const reservation = Array.isArray(reservationRaw) ? reservationRaw[0] : reservationRaw;
      if (!reservation) {
        throw new ServiceUnavailableException('Check-in history row missing reservation');
      }
      return {
        id: row.id as string,
        method: row.method as string,
        created_at: row.created_at as string,
        reference: reservation.reference,
        party_size: reservation.party_size,
        starts_at: reservation.starts_at,
        table_id: reservation.table_id,
      };
    });
  }

  async insertCheckInLog(input: {
    reservationId: string;
    staffId: string;
    method: 'QR' | 'MANUAL';
    outcome: 'SUCCESS' | 'REJECTED' | 'DUPLICATE';
  }): Promise<void> {
    const { error } = await this.supabase.getAdminClient().from('check_in_logs').insert({
      reservation_id: input.reservationId,
      staff_id: input.staffId,
      method: input.method,
      outcome: input.outcome,
    });

    if (error) {
      throw new ServiceUnavailableException(error.message);
    }
  }

  async getLatestPaymentStatus(reservationId: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .getAdminClient()
      .from('payments')
      .select('status')
      .eq('reservation_id', reservationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new ServiceUnavailableException(error.message);
    }
    return (data as { status: string } | null)?.status ?? null;
  }

  async confirmAfterPayment(id: string): Promise<ReservationRecord | null> {
    const { data, error } = await this.supabase
      .getAdminClient()
      .from('reservations')
      .update({ status: 'CONFIRMED' })
      .eq('id', id)
      .eq('status', 'PENDING_PAYMENT')
      .select(this.reservationSelect())
      .maybeSingle();

    if (error) {
      throw new ServiceUnavailableException(error.message);
    }
    return mapReservationRow((data as Record<string, unknown> | null) ?? null);
  }

  async listExpiredPendingPayments(nowIso: string): Promise<ReservationRecord[]> {
    const { data, error } = await this.supabase
      .getAdminClient()
      .from('reservations')
      .select(this.reservationSelect())
      .eq('status', 'PENDING_PAYMENT')
      .not('deposit_due_at', 'is', null)
      .lt('deposit_due_at', nowIso);

    if (error) {
      throw new ServiceUnavailableException(error.message);
    }
    return mapReservationRows(data);
  }

  async expireReservation(id: string): Promise<ReservationRecord | null> {
    const { data, error } = await this.supabase
      .getAdminClient()
      .from('reservations')
      .update({ status: 'EXPIRED' })
      .eq('id', id)
      .eq('status', 'PENDING_PAYMENT')
      .select(this.reservationSelect())
      .maybeSingle();

    if (error) {
      throw new ServiceUnavailableException(error.message);
    }
    return mapReservationRow((data as Record<string, unknown> | null) ?? null);
  }

  private isOverlapError(error: { code?: string; message?: string }): boolean {
    if (error.code === '23P01') {
      return true;
    }
    const message = error.message?.toLowerCase() ?? '';
    return message.includes('exclude') || message.includes('overlap') || message.includes('conflict');
  }
}

function isMissingGuestCountColumn(message: string | undefined): boolean {
  const text = message?.toLowerCase() ?? '';
  return (
    text.includes('checked_in_guest_count') &&
    (text.includes('does not exist') || text.includes('could not find'))
  );
}

function throwRepositoryError(error: { message?: string }): never {
  const message = error.message ?? 'Database error';
  if (/row-level security/i.test(message)) {
    throw new ServiceUnavailableException(
      'Booking could not be saved: the API must use the Supabase service_role key in backend/.env.local (Supabase → Project Settings → API → service_role). Do not use the anon/public key there.',
    );
  }
  throw new ServiceUnavailableException(message);
}
