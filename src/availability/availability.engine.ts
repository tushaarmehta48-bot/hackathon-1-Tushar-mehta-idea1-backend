import { addDays, parseISO } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import type {
  BlockWindow,
  BookingPolicy,
  ReservationBlock,
  ResolvedShift,
  TableDefinition,
  TimeSlot,
} from './availability.types.js';

export class AvailabilityValidationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AvailabilityValidationError';
  }
}

function parseLocalTime(timeValue: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeValue.split(':').map(Number);
  return { hours, minutes: minutes ?? 0 };
}

export function localDateTimeToUtc(
  dateStr: string,
  timeValue: string,
  timezone: string,
): Date {
  const { hours, minutes } = parseLocalTime(timeValue);
  const localIso = `${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
  return fromZonedTime(localIso, timezone);
}

export function getWeekdayInTimezone(dateStr: string, timezone: string): number {
  const utcNoon = localDateTimeToUtc(dateStr, '12:00', timezone);
  return toZonedTime(utcNoon, timezone).getDay();
}

export function assertPartySize(partySize: number, policy: BookingPolicy): void {
  if (partySize < policy.minPartySize || partySize > policy.maxPartySize) {
    throw new AvailabilityValidationError(
      'PARTY_SIZE_OUT_OF_RANGE',
      `Party size must be between ${policy.minPartySize} and ${policy.maxPartySize}`,
    );
  }
}

export function assertBookingDate(
  dateStr: string,
  policy: BookingPolicy,
  now: Date = new Date(),
): void {
  const dayStartUtc = localDateTimeToUtc(dateStr, '00:00', policy.timezone);
  const zonedNow = toZonedTime(now, policy.timezone);
  const todayStr = zonedNow.toISOString().slice(0, 10);
  const todayStartUtc = localDateTimeToUtc(todayStr, '00:00', policy.timezone);
  const maxDate = addDays(todayStartUtc, policy.maxAdvanceDays);
  const maxDateStr = toZonedTime(maxDate, policy.timezone).toISOString().slice(0, 10);
  const maxDayStartUtc = localDateTimeToUtc(maxDateStr, '00:00', policy.timezone);

  if (dayStartUtc < todayStartUtc) {
    throw new AvailabilityValidationError('DATE_IN_PAST', 'Booking date is in the past');
  }
  if (dayStartUtc > maxDayStartUtc) {
    throw new AvailabilityValidationError(
      'DATE_TOO_FAR_AHEAD',
      `Bookings are limited to ${policy.maxAdvanceDays} days ahead`,
    );
  }
}

export function isDateWithinSeasons(
  dateStr: string,
  seasons: { startsOn: string; endsOn: string }[],
): boolean {
  if (seasons.length === 0) {
    return true;
  }
  return seasons.some(
    (season) => dateStr >= season.startsOn && dateStr <= season.endsOn,
  );
}

export function resolveShiftsForDate(input: {
  dateStr: string;
  timezone: string;
  shifts: {
    id: string;
    name: string;
    weekday: number | null;
    serviceDate: string | null;
    startsAt: string;
    endsAt: string;
    durationMinutes: number;
    active: boolean;
  }[];
  exception: {
    isClosed: boolean;
    opensAt: string | null;
    closesAt: string | null;
  } | null;
  defaultDurationMinutes: number;
}): ResolvedShift[] {
  if (input.exception?.isClosed) {
    return [];
  }

  if (input.exception?.opensAt && input.exception.closesAt) {
    const opens = parseISO(input.exception.opensAt);
    const closes = parseISO(input.exception.closesAt);
    const opensLocal = toZonedTime(opens, input.timezone);
    const closesLocal = toZonedTime(closes, input.timezone);
    const pad = (value: number) => String(value).padStart(2, '0');
    return [
      {
        id: 'exception-window',
        name: 'Special service',
        startsAtLocal: `${pad(opensLocal.getHours())}:${pad(opensLocal.getMinutes())}`,
        endsAtLocal: `${pad(closesLocal.getHours())}:${pad(closesLocal.getMinutes())}`,
        durationMinutes: input.defaultDurationMinutes,
      },
    ];
  }

  const weekday = getWeekdayInTimezone(input.dateStr, input.timezone);
  return input.shifts
    .filter((shift) => shift.active)
    .filter(
      (shift) =>
        shift.serviceDate === input.dateStr ||
        (shift.serviceDate === null && shift.weekday === weekday),
    )
    .map((shift) => ({
      id: shift.id,
      name: shift.name,
      startsAtLocal: shift.startsAt.slice(0, 5),
      endsAtLocal: shift.endsAt.slice(0, 5),
      durationMinutes: shift.durationMinutes,
    }));
}

export function generateSlotsForShift(
  dateStr: string,
  shift: ResolvedShift,
  policy: BookingPolicy,
  now: Date = new Date(),
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const shiftStart = localDateTimeToUtc(dateStr, shift.startsAtLocal, policy.timezone);
  const shiftEnd = localDateTimeToUtc(dateStr, shift.endsAtLocal, policy.timezone);
  const durationMs = shift.durationMinutes * 60_000;
  const bufferMs = policy.turnoverBufferMinutes * 60_000;
  const minNoticeMs = policy.minNoticeMinutes * 60_000;
  const earliestAllowed = new Date(now.getTime() + minNoticeMs);

  let cursor = shiftStart;
  while (cursor.getTime() + durationMs <= shiftEnd.getTime()) {
    const slotEnd = new Date(cursor.getTime() + durationMs);
    if (cursor >= earliestAllowed) {
      slots.push({
        shiftId: shift.id,
        shiftName: shift.name,
        startsAt: new Date(cursor),
        endsAt: slotEnd,
      });
    }
    cursor = new Date(slotEnd.getTime() + bufferMs);
  }

  return slots;
}

function rangesOverlapWithBuffer(
  slotStart: Date,
  slotEnd: Date,
  blockStart: Date,
  blockEnd: Date,
  bufferMs: number,
): boolean {
  const bufferedEnd = new Date(blockEnd.getTime() + bufferMs);
  return slotStart < bufferedEnd && blockStart < slotEnd;
}

export function isTableBlockedForSlot(
  table: TableDefinition,
  slot: TimeSlot,
  blocks: BlockWindow[],
  bufferMinutes: number,
): boolean {
  const bufferMs = bufferMinutes * 60_000;
  return blocks.some((block) => {
    const appliesToTable =
      block.tableId === table.id ||
      (block.areaId !== null && block.areaId === table.areaId && block.tableId === null);
    if (!appliesToTable) {
      return false;
    }
    return rangesOverlapWithBuffer(
      slot.startsAt,
      slot.endsAt,
      block.startsAt,
      block.endsAt,
      bufferMs,
    );
  });
}

export function isTableReservedForSlot(
  tableId: string,
  slot: TimeSlot,
  reservations: ReservationBlock[],
  bufferMinutes: number,
): boolean {
  const bufferMs = bufferMinutes * 60_000;
  return reservations.some(
    (reservation) =>
      reservation.tableId === tableId &&
      rangesOverlapWithBuffer(
        slot.startsAt,
        slot.endsAt,
        reservation.startsAt,
        reservation.endsAt,
        bufferMs,
      ),
  );
}

export function filterTablesForParty(
  tables: TableDefinition[],
  partySize: number,
): TableDefinition[] {
  return tables.filter(
    (table) =>
      table.bookable &&
      partySize >= table.minCapacity &&
      partySize <= table.maxCapacity,
  );
}

export function countAvailableTablesForSlot(
  tables: TableDefinition[],
  slot: TimeSlot,
  reservations: ReservationBlock[],
  blocks: BlockWindow[],
  policy: BookingPolicy,
): number {
  return tables.filter(
    (table) =>
      !isTableBlockedForSlot(table, slot, blocks, policy.turnoverBufferMinutes) &&
      !isTableReservedForSlot(
        table.id,
        slot,
        reservations,
        policy.turnoverBufferMinutes,
      ),
  ).length;
}

export function getAvailableTableIdsForSlot(
  tables: TableDefinition[],
  slot: TimeSlot,
  reservations: ReservationBlock[],
  blocks: BlockWindow[],
  policy: BookingPolicy,
): string[] {
  return tables
    .filter(
      (table) =>
        !isTableBlockedForSlot(table, slot, blocks, policy.turnoverBufferMinutes) &&
        !isTableReservedForSlot(
          table.id,
          slot,
          reservations,
          policy.turnoverBufferMinutes,
        ),
    )
    .map((table) => table.id);
}
