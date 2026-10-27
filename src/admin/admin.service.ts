import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { addDays, format } from 'date-fns';
import { localDateTimeToUtc } from '../availability/availability.engine.js';
import { AuditRepository } from '../ops/audit.repository.js';
import type { AuthenticatedUser } from '../users/user.types.js';
import { isOnlinePaymentsEnabled } from '../config/payments.config.js';
import { buildAdminReportWorkbook, type AdminReportExcelRow } from './admin-report-excel.js';
import { AdminRepository } from './admin.repository.js';
import type {
  AssignStaffRoleDto,
  CreateDiningAreaDto,
  CreateExceptionDto,
  CreateSeasonDto,
  CreateShiftDto,
  CreateTableBlockDto,
  CreateTableDto,
  UpdateBookingPolicyDto,
  UpdateDiningAreaDto,
  UpdateSeasonDto,
  UpdateShiftDto,
  UpdateTableDto,
} from './dto/admin-mutations.dto.js';

@Injectable()
export class AdminService {
  constructor(
    private readonly repo: AdminRepository,
    private readonly audit: AuditRepository,
  ) {}

  async getVenueSnapshot() {
    const [areas, tables, shifts, seasons, policy] = await Promise.all([
      this.repo.listDiningAreas(),
      this.repo.listTables(true),
      this.repo.listShifts(),
      this.repo.listSeasons(),
      this.repo.getActivePolicy(),
    ]);

    return {
      diningAreas: areas.map(mapArea),
      tables: tables.map(mapTable),
      shifts: shifts.map(mapShift),
      seasons: seasons.map(mapSeason),
      bookingPolicy: policy ? mapPolicy(policy) : null,
    };
  }

  async listDiningAreas() {
    const rows = await this.repo.listDiningAreas();
    return rows.map(mapArea);
  }

  async createDiningArea(actor: AuthenticatedUser, dto: CreateDiningAreaDto) {
    const row = await this.repo.insertDiningArea({
      name: dto.name,
      description: dto.description ?? null,
      area_type: dto.areaType ?? 'INDOOR',
      sort_order: dto.sortOrder ?? 0,
    });
    if (!row) {
      throw new NotFoundException('Dining area create failed');
    }
    await this.audit.log({
      actorId: actor.id,
      action: 'dining_area.create',
      entityType: 'dining_area',
      entityId: row.id as string,
      metadata: { name: dto.name },
    });
    return mapArea(row);
  }

  async updateDiningArea(actor: AuthenticatedUser, id: string, dto: UpdateDiningAreaDto) {
    const row = await this.repo.updateDiningArea(id, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.areaType !== undefined ? { area_type: dto.areaType } : {}),
      ...(dto.sortOrder !== undefined ? { sort_order: dto.sortOrder } : {}),
      ...(dto.active !== undefined ? { active: dto.active } : {}),
    });
    if (!row) {
      throw new NotFoundException('Dining area not found');
    }
    await this.audit.log({
      actorId: actor.id,
      action: 'dining_area.update',
      entityType: 'dining_area',
      entityId: id,
      metadata: dto as Record<string, unknown>,
    });
    return mapArea(row);
  }

  async listTables() {
    const rows = await this.repo.listTables(true);
    return rows.map(mapTable);
  }

  async createTable(actor: AuthenticatedUser, dto: CreateTableDto) {
    if (dto.maxCapacity < dto.minCapacity) {
      throw new BadRequestException('maxCapacity must be >= minCapacity');
    }
    const row = await this.repo.insertTable({
      area_id: dto.areaId,
      label: dto.label,
      min_capacity: dto.minCapacity,
      max_capacity: dto.maxCapacity,
      svg_x: dto.svgX ?? 0,
      svg_y: dto.svgY ?? 0,
      svg_width: dto.svgWidth ?? 80,
      svg_height: dto.svgHeight ?? 80,
      svg_rotation_deg: dto.svgRotationDeg ?? 0,
      table_tier: dto.tableTier ?? 'STANDARD',
    });
    if (!row) {
      throw new NotFoundException('Table create failed');
    }
    await this.audit.log({
      actorId: actor.id,
      action: 'table.create',
      entityType: 'restaurant_table',
      entityId: row.id as string,
      metadata: { label: dto.label },
    });
    return mapTable(row);
  }

  async updateTable(actor: AuthenticatedUser, id: string, dto: UpdateTableDto) {
    const minCap = dto.minCapacity;
    const maxCap = dto.maxCapacity;
    if (minCap !== undefined && maxCap !== undefined && maxCap < minCap) {
      throw new BadRequestException('maxCapacity must be >= minCapacity');
    }
    const row = await this.repo.updateTable(id, {
      ...(dto.areaId !== undefined ? { area_id: dto.areaId } : {}),
      ...(dto.label !== undefined ? { label: dto.label } : {}),
      ...(dto.minCapacity !== undefined ? { min_capacity: dto.minCapacity } : {}),
      ...(dto.maxCapacity !== undefined ? { max_capacity: dto.maxCapacity } : {}),
      ...(dto.svgX !== undefined ? { svg_x: dto.svgX } : {}),
      ...(dto.svgY !== undefined ? { svg_y: dto.svgY } : {}),
      ...(dto.svgWidth !== undefined ? { svg_width: dto.svgWidth } : {}),
      ...(dto.svgHeight !== undefined ? { svg_height: dto.svgHeight } : {}),
      ...(dto.svgRotationDeg !== undefined ? { svg_rotation_deg: dto.svgRotationDeg } : {}),
      ...(dto.active !== undefined ? { active: dto.active } : {}),
      ...(dto.bookable !== undefined ? { bookable: dto.bookable } : {}),
      ...(dto.tableTier !== undefined ? { table_tier: dto.tableTier } : {}),
    });
    if (!row) {
      throw new NotFoundException('Table not found');
    }
    await this.audit.log({
      actorId: actor.id,
      action: 'table.update',
      entityType: 'restaurant_table',
      entityId: id,
      metadata: dto as Record<string, unknown>,
    });
    return mapTable(row);
  }

  async listShifts() {
    return (await this.repo.listShifts()).map(mapShift);
  }

  async createShift(actor: AuthenticatedUser, dto: CreateShiftDto) {
    if (dto.weekday === undefined && !dto.serviceDate) {
      throw new BadRequestException('weekday or serviceDate is required');
    }
    const row = await this.repo.insertShift({
      name: dto.name,
      weekday: dto.weekday ?? null,
      service_date: dto.serviceDate ?? null,
      starts_at: dto.startsAt,
      ends_at: dto.endsAt,
      default_duration_minutes: dto.defaultDurationMinutes ?? 120,
    });
    if (!row) {
      throw new NotFoundException('Shift create failed');
    }
    await this.audit.log({
      actorId: actor.id,
      action: 'shift.create',
      entityType: 'service_shift',
      entityId: row.id as string,
      metadata: { name: dto.name },
    });
    return mapShift(row);
  }

  async updateShift(actor: AuthenticatedUser, id: string, dto: UpdateShiftDto) {
    const row = await this.repo.updateShift(id, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.weekday !== undefined ? { weekday: dto.weekday } : {}),
      ...(dto.serviceDate !== undefined ? { service_date: dto.serviceDate } : {}),
      ...(dto.startsAt !== undefined ? { starts_at: dto.startsAt } : {}),
      ...(dto.endsAt !== undefined ? { ends_at: dto.endsAt } : {}),
      ...(dto.defaultDurationMinutes !== undefined
        ? { default_duration_minutes: dto.defaultDurationMinutes }
        : {}),
      ...(dto.active !== undefined ? { active: dto.active } : {}),
    });
    if (!row) {
      throw new NotFoundException('Shift not found');
    }
    await this.audit.log({
      actorId: actor.id,
      action: 'shift.update',
      entityType: 'service_shift',
      entityId: id,
      metadata: dto as Record<string, unknown>,
    });
    return mapShift(row);
  }

  async listSeasons() {
    return (await this.repo.listSeasons()).map(mapSeason);
  }

  async createSeason(actor: AuthenticatedUser, dto: CreateSeasonDto) {
    const row = await this.repo.insertSeason({
      name: dto.name,
      starts_on: dto.startsOn,
      ends_on: dto.endsOn,
      config: dto.config ?? {},
      enabled: dto.enabled ?? true,
    });
    if (!row) {
      throw new NotFoundException('Season create failed');
    }
    await this.audit.log({
      actorId: actor.id,
      action: 'season.create',
      entityType: 'season_rule',
      entityId: row.id as string,
      metadata: { name: dto.name },
    });
    return mapSeason(row);
  }

  async updateSeason(actor: AuthenticatedUser, id: string, dto: UpdateSeasonDto) {
    const row = await this.repo.updateSeason(id, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.startsOn !== undefined ? { starts_on: dto.startsOn } : {}),
      ...(dto.endsOn !== undefined ? { ends_on: dto.endsOn } : {}),
      ...(dto.config !== undefined ? { config: dto.config } : {}),
      ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
    });
    if (!row) {
      throw new NotFoundException('Season not found');
    }
    await this.audit.log({
      actorId: actor.id,
      action: 'season.update',
      entityType: 'season_rule',
      entityId: id,
      metadata: dto as Record<string, unknown>,
    });
    return mapSeason(row);
  }

  async listExceptions(from: string, to: string) {
    return (await this.repo.listExceptions(from, to)).map(mapException);
  }

  async createException(actor: AuthenticatedUser, dto: CreateExceptionDto) {
    const existing = await this.repo.findExceptionByDate(dto.exceptionDate);
    const payload = {
      exception_date: dto.exceptionDate,
      is_closed: dto.isClosed,
      opens_at: dto.isClosed ? null : (dto.opensAt ?? null),
      closes_at: dto.isClosed ? null : (dto.closesAt ?? null),
      reason: dto.reason ?? null,
      created_by: actor.id,
    };
    const row = existing
      ? await this.repo.updateException(existing.id as string, payload)
      : await this.repo.insertException(payload);
    if (!row) {
      throw new NotFoundException('Exception not found');
    }
    await this.audit.log({
      actorId: actor.id,
      action: existing ? 'exception.update' : 'exception.create',
      entityType: 'service_exception',
      entityId: row.id as string,
      metadata: { date: dto.exceptionDate, isClosed: dto.isClosed },
    });
    return mapException(row);
  }

  async deleteException(actor: AuthenticatedUser, id: string) {
    await this.repo.deleteException(id);
    await this.audit.log({
      actorId: actor.id,
      action: 'exception.delete',
      entityType: 'service_exception',
      entityId: id,
    });
    return { ok: true };
  }

  async getBookingPolicy() {
    const row = await this.repo.getActivePolicy();
    if (!row) {
      throw new NotFoundException('No active booking policy');
    }
    return mapPolicy(row);
  }

  async updateBookingPolicy(actor: AuthenticatedUser, dto: UpdateBookingPolicyDto) {
    const current = await this.repo.getActivePolicy();
    if (!current) {
      throw new NotFoundException('No active booking policy');
    }
    if (dto.depositRequired === true && !isOnlinePaymentsEnabled()) {
      throw new BadRequestException(
        'Online deposits require PAYMENTS_ENABLED=true and a payment provider',
      );
    }
    const minParty = dto.minPartySize ?? (current.min_party_size as number);
    const maxParty = dto.maxPartySize ?? (current.max_party_size as number);
    if (maxParty < minParty) {
      throw new BadRequestException('maxPartySize must be >= minPartySize');
    }
    const row = await this.repo.updatePolicy(current.id as string, {
      ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
      ...(dto.minNoticeMinutes !== undefined ? { min_notice_minutes: dto.minNoticeMinutes } : {}),
      ...(dto.maxAdvanceDays !== undefined ? { max_advance_days: dto.maxAdvanceDays } : {}),
      ...(dto.cancellationDeadlineMinutes !== undefined
        ? { cancellation_deadline_minutes: dto.cancellationDeadlineMinutes }
        : {}),
      ...(dto.minPartySize !== undefined ? { min_party_size: dto.minPartySize } : {}),
      ...(dto.maxPartySize !== undefined ? { max_party_size: dto.maxPartySize } : {}),
      ...(dto.defaultDurationMinutes !== undefined
        ? { default_duration_minutes: dto.defaultDurationMinutes }
        : {}),
      ...(dto.turnoverBufferMinutes !== undefined
        ? { turnover_buffer_minutes: dto.turnoverBufferMinutes }
        : {}),
      ...(dto.depositRequired !== undefined ? { deposit_required: dto.depositRequired } : {}),
      ...(dto.depositAmountCents !== undefined
        ? { deposit_amount_cents: dto.depositAmountCents }
        : {}),
      ...(dto.depositCurrency !== undefined ? { deposit_currency: dto.depositCurrency } : {}),
      ...(dto.depositHoldMinutes !== undefined
        ? { deposit_hold_minutes: dto.depositHoldMinutes }
        : {}),
    });
    if (!row) {
      throw new NotFoundException('Booking policy not found');
    }
    await this.audit.log({
      actorId: actor.id,
      action: 'booking_policy.update',
      entityType: 'booking_policy',
      entityId: current.id as string,
      metadata: dto as Record<string, unknown>,
    });
    return mapPolicy(row);
  }

  async listTableBlocks(fromIso: string, toIso: string) {
    return (await this.repo.listTableBlocks(fromIso, toIso)).map(mapBlock);
  }

  async createTableBlock(actor: AuthenticatedUser, dto: CreateTableBlockDto) {
    if (!dto.tableId && !dto.areaId) {
      throw new BadRequestException('tableId or areaId is required');
    }
    const row = await this.repo.insertTableBlock({
      table_id: dto.tableId ?? null,
      area_id: dto.areaId ?? null,
      starts_at: dto.startsAt,
      ends_at: dto.endsAt,
      reason: dto.reason ?? null,
      created_by: actor.id,
    });
    if (!row) {
      throw new NotFoundException('Table block create failed');
    }
    await this.audit.log({
      actorId: actor.id,
      action: 'table_block.create',
      entityType: 'table_block',
      entityId: row.id as string,
    });
    return mapBlock(row);
  }

  async deactivateTableBlock(actor: AuthenticatedUser, id: string) {
    const row = await this.repo.deactivateTableBlock(id);
    if (!row) {
      throw new NotFoundException('Table block not found');
    }
    await this.audit.log({
      actorId: actor.id,
      action: 'table_block.deactivate',
      entityType: 'table_block',
      entityId: id,
    });
    return mapBlock(row);
  }

  async listStaffProfiles() {
    return (await this.repo.listPortalProfiles()).map(mapStaffProfile);
  }

  async assignStaffRole(actor: AuthenticatedUser, dto: AssignStaffRoleDto) {
    if (dto.userId === actor.id) {
      throw new BadRequestException('You cannot change your own role here');
    }
    const profile = await this.repo.getProfile(dto.userId);
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }
    if (profile.role === 'ADMIN') {
      throw new ForbiddenException('Admin roles cannot be changed through this endpoint');
    }
    const row = await this.repo.updateProfileRole(dto.userId, dto.role);
    if (!row) {
      throw new NotFoundException('Profile not found');
    }
    await this.audit.log({
      actorId: actor.id,
      action: 'profile.role.assign',
      entityType: 'profile',
      entityId: dto.userId,
      metadata: { role: dto.role },
    });
    return mapStaffProfile(row);
  }

  async reportAnalytics(fromDate: string, toDate: string) {
    const { timezone, fromIso, toExclusive } = await this.resolveReportWindow(fromDate, toDate);
    const rows = await this.repo.reservationStats(fromIso, toExclusive);
    return buildBookingAnalytics(fromDate, toDate, timezone, rows);
  }

  async reportSummary(fromDate: string, toDate: string) {
    const { timezone, fromIso, toExclusive } = await this.resolveReportWindow(fromDate, toDate);
    const rows = await this.repo.reservationStats(fromIso, toExclusive);

    const todayDate = formatVenueCalendarDate(timezone);
    const todayStart = localDateTimeToUtc(todayDate, '00:00', timezone).toISOString();
    const todayEnd = addDays(localDateTimeToUtc(todayDate, '00:00', timezone), 1).toISOString();
    const todayRows = await this.repo.reservationStats(todayStart, todayEnd);

    const period = aggregateReservationMetrics(rows);
    const today = aggregateReservationMetrics(todayRows);

    return {
      from: fromDate,
      to: toDate,
      timezone,
      reservationCount: period.reservationCount,
      activeCount: period.activeCount,
      cancellationCount: period.cancellationCount,
      guestSeats: period.guestSeats,
      checkedInCount: period.checkedInCount,
      attendanceGuests: period.attendanceGuests,
      pendingCheckInCount: period.pendingCheckInCount,
      noShowCount: period.noShowCount,
      webBookings: period.webBookings,
      walkInBookings: period.walkInBookings,
      checkInRatePercent: period.checkInRatePercent,
      today: {
        date: todayDate,
        reservationCount: today.reservationCount,
        guestSeats: today.guestSeats,
        checkedInCount: today.checkedInCount,
        attendanceGuests: today.attendanceGuests,
        pendingCheckInCount: today.pendingCheckInCount,
      },
    };
  }

  async exportReportExcel(fromDate: string, toDate: string): Promise<Buffer> {
    const summary = await this.reportSummary(fromDate, toDate);
    const { fromIso, toExclusive } = await this.resolveReportWindow(fromDate, toDate);
    const rows = await this.repo.reservationStats(fromIso, toExclusive);

    const bookingRows: AdminReportExcelRow[] = rows
      .map((row) => mapReservationExportRow(row))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

    return buildAdminReportWorkbook(
      {
        from: summary.from,
        to: summary.to,
        timezone: summary.timezone,
        reservationCount: summary.reservationCount,
        activeCount: summary.activeCount,
        cancellationCount: summary.cancellationCount,
        guestSeats: summary.guestSeats,
        checkedInCount: summary.checkedInCount,
        attendanceGuests: summary.attendanceGuests,
        pendingCheckInCount: summary.pendingCheckInCount,
        noShowCount: summary.noShowCount,
        webBookings: summary.webBookings,
        walkInBookings: summary.walkInBookings,
        checkInRatePercent: summary.checkInRatePercent,
        todayDate: summary.today.date,
        todayReservationCount: summary.today.reservationCount,
        todayGuestSeats: summary.today.guestSeats,
        todayCheckedInCount: summary.today.checkedInCount,
        todayAttendanceGuests: summary.today.attendanceGuests,
        todayPendingCheckInCount: summary.today.pendingCheckInCount,
      },
      bookingRows,
    );
  }

  private async resolveReportWindow(fromDate: string, toDate: string) {
    const policy = await this.repo.getActivePolicy();
    const timezone = (policy?.timezone as string | undefined) ?? 'Europe/Madrid';
    const fromIso = localDateTimeToUtc(fromDate, '00:00', timezone).toISOString();
    const toExclusive = addDays(localDateTimeToUtc(toDate, '00:00', timezone), 1).toISOString();
    return { timezone, fromIso, toExclusive };
  }
}

type ReservationStatRow = {
  reference?: unknown;
  status: unknown;
  party_size: unknown;
  starts_at?: unknown;
  ends_at?: unknown;
  checked_in_at: unknown;
  checked_in_guest_count?: unknown;
  source: unknown;
};

function mapReservationExportRow(row: ReservationStatRow): AdminReportExcelRow {
  return {
    reference: String(row.reference ?? ''),
    startsAt: String(row.starts_at ?? ''),
    endsAt: String(row.ends_at ?? ''),
    partySize: Number(row.party_size) || 0,
    status: String(row.status ?? ''),
    source: String(row.source ?? ''),
    checkedInAt: row.checked_in_at ? String(row.checked_in_at) : null,
  };
}

function formatVenueCalendarDate(timezone: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function formatVenueCalendarDateFromIso(iso: string, timezone: string): string {
  return formatVenueCalendarDate(timezone, new Date(iso));
}

function formatVenueHourFromIso(iso: string, timezone: string): number {
  const hourPart = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso));
  const raw = hourPart.find((p) => p.type === 'hour')?.value ?? '0';
  const hour = Number.parseInt(raw, 10);
  return Number.isFinite(hour) ? hour % 24 : 0;
}

function formatVenueWeekdayFromIso(iso: string, timezone: string): number {
  const wd = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
  }).format(new Date(iso));
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[wd] ?? 0;
}

function addCalendarDays(isoDate: string, days: number): string {
  const anchor = new Date(`${isoDate}T12:00:00`);
  return format(addDays(anchor, days), 'yyyy-MM-dd');
}

function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export type BookingAnalyticsView = {
  from: string;
  to: string;
  timezone: string;
  totalBookings: number;
  peakDate: { date: string; bookings: number } | null;
  peakHour: { hour: number; label: string; bookings: number } | null;
  byDate: Array<{ date: string; bookings: number; guests: number }>;
  byHour: Array<{ hour: number; label: string; bookings: number }>;
  byWeekday: Array<{ weekday: number; label: string; bookings: number }>;
};

function buildBookingAnalytics(
  fromDate: string,
  toDate: string,
  timezone: string,
  rows: ReservationStatRow[],
): BookingAnalyticsView {
  const byDateMap = new Map<string, { bookings: number; guests: number }>();
  const byHourMap = new Map<number, number>();
  const byWeekdayMap = new Map<number, number>();

  let totalBookings = 0;

  for (const row of rows) {
    const status = String(row.status);
    if (status === 'CANCELLED') {
      continue;
    }
    const startsAt = row.starts_at ? String(row.starts_at) : null;
    if (!startsAt) {
      continue;
    }

    totalBookings += 1;
    const party = Number(row.party_size) || 0;
    const dateKey = formatVenueCalendarDateFromIso(startsAt, timezone);
    const dateBucket = byDateMap.get(dateKey) ?? { bookings: 0, guests: 0 };
    dateBucket.bookings += 1;
    dateBucket.guests += party;
    byDateMap.set(dateKey, dateBucket);

    const hour = formatVenueHourFromIso(startsAt, timezone);
    byHourMap.set(hour, (byHourMap.get(hour) ?? 0) + 1);

    const weekday = formatVenueWeekdayFromIso(startsAt, timezone);
    byWeekdayMap.set(weekday, (byWeekdayMap.get(weekday) ?? 0) + 1);
  }

  const byDate: BookingAnalyticsView['byDate'] = [];
  for (let cursor = fromDate; cursor <= toDate; cursor = addCalendarDays(cursor, 1)) {
    const bucket = byDateMap.get(cursor) ?? { bookings: 0, guests: 0 };
    byDate.push({ date: cursor, bookings: bucket.bookings, guests: bucket.guests });
  }

  const byHour: BookingAnalyticsView['byHour'] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    byHour.push({ hour, label: hourLabel(hour), bookings: byHourMap.get(hour) ?? 0 });
  }

  const byWeekday: BookingAnalyticsView['byWeekday'] = [];
  for (let weekday = 0; weekday < 7; weekday += 1) {
    byWeekday.push({
      weekday,
      label: WEEKDAY_LABELS[weekday] ?? String(weekday),
      bookings: byWeekdayMap.get(weekday) ?? 0,
    });
  }

  let peakDate: BookingAnalyticsView['peakDate'] = null;
  for (const entry of byDate) {
    if (!peakDate || entry.bookings > peakDate.bookings) {
      peakDate = { date: entry.date, bookings: entry.bookings };
    }
  }
  if (peakDate && peakDate.bookings === 0) {
    peakDate = null;
  }

  let peakHour: BookingAnalyticsView['peakHour'] = null;
  for (const entry of byHour) {
    if (!peakHour || entry.bookings > peakHour.bookings) {
      peakHour = { hour: entry.hour, label: entry.label, bookings: entry.bookings };
    }
  }
  if (peakHour && peakHour.bookings === 0) {
    peakHour = null;
  }

  return {
    from: fromDate,
    to: toDate,
    timezone,
    totalBookings,
    peakDate,
    peakHour,
    byDate,
    byHour,
    byWeekday,
  };
}

function guestCheckInsFromRow(row: ReservationStatRow): number {
  const raw = row.checked_in_guest_count;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function isFullyCheckedInRow(row: ReservationStatRow): boolean {
  const status = String(row.status);
  const party = Number(row.party_size) || 0;
  return status === 'CHECKED_IN' || guestCheckInsFromRow(row) >= party;
}

function aggregateReservationMetrics(rows: ReservationStatRow[]) {
  let activeCount = 0;
  let cancellationCount = 0;
  let guestSeats = 0;
  let checkedInCount = 0;
  let attendanceGuests = 0;
  let pendingCheckInCount = 0;
  let noShowCount = 0;
  let webBookings = 0;
  let walkInBookings = 0;

  for (const row of rows) {
    const status = String(row.status);
    const party = Number(row.party_size) || 0;
    const source = String(row.source ?? 'WEB');

    if (status === 'CANCELLED') {
      cancellationCount += 1;
      continue;
    }
    if (status === 'NO_SHOW') {
      noShowCount += 1;
      continue;
    }

    activeCount += 1;
    guestSeats += party;

    if (source === 'WEB') {
      webBookings += 1;
    } else if (source === 'WALK_IN' || source === 'PHONE') {
      walkInBookings += 1;
    }

    const guestsIn = guestCheckInsFromRow(row);
    if (isFullyCheckedInRow(row)) {
      checkedInCount += 1;
      attendanceGuests += party;
    } else if (status === 'CONFIRMED') {
      if (guestsIn > 0) {
        attendanceGuests += guestsIn;
      }
      pendingCheckInCount += 1;
    }
  }

  const eligibleForRate = checkedInCount + pendingCheckInCount;
  const checkInRatePercent =
    eligibleForRate > 0 ? Math.round((checkedInCount / eligibleForRate) * 100) : null;

  return {
    reservationCount: rows.length,
    activeCount,
    cancellationCount,
    guestSeats,
    checkedInCount,
    attendanceGuests,
    pendingCheckInCount,
    noShowCount,
    webBookings,
    walkInBookings,
    checkInRatePercent,
  };
}

function mapArea(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    areaType: row.area_type,
    sortOrder: row.sort_order,
    active: row.active,
  };
}

function mapTable(row: Record<string, unknown>) {
  return {
    id: row.id,
    areaId: row.area_id,
    label: row.label,
    minCapacity: row.min_capacity,
    maxCapacity: row.max_capacity,
    tableTier: row.table_tier ?? 'STANDARD',
    svg: {
      x: Number(row.svg_x),
      y: Number(row.svg_y),
      width: Number(row.svg_width),
      height: Number(row.svg_height),
      rotationDeg: Number(row.svg_rotation_deg),
    },
    active: row.active,
    bookable: row.bookable,
  };
}

function mapShift(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    weekday: row.weekday,
    serviceDate: row.service_date,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    defaultDurationMinutes: row.default_duration_minutes,
    active: row.active,
  };
}

function mapSeason(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    config: row.config,
    enabled: row.enabled,
  };
}

function mapException(row: Record<string, unknown>) {
  return {
    id: row.id,
    exceptionDate: row.exception_date,
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    isClosed: row.is_closed,
    reason: row.reason,
  };
}

function mapPolicy(row: Record<string, unknown>) {
  return {
    id: row.id,
    timezone: row.timezone,
    minNoticeMinutes: row.min_notice_minutes,
    maxAdvanceDays: row.max_advance_days,
    cancellationDeadlineMinutes: row.cancellation_deadline_minutes,
    minPartySize: row.min_party_size,
    maxPartySize: row.max_party_size,
    defaultDurationMinutes: row.default_duration_minutes,
    turnoverBufferMinutes: row.turnover_buffer_minutes,
    depositRequired: row.deposit_required,
    depositAmountCents: row.deposit_amount_cents,
    depositCurrency: row.deposit_currency,
    depositHoldMinutes: row.deposit_hold_minutes,
    active: row.active,
  };
}

function mapBlock(row: Record<string, unknown>) {
  return {
    id: row.id,
    tableId: row.table_id,
    areaId: row.area_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    reason: row.reason,
    active: row.active,
  };
}

function mapStaffProfile(row: Record<string, unknown>) {
  return {
    id: row.id,
    displayName: row.display_name,
    role: row.role,
    active: row.active,
  };
}
