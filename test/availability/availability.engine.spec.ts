import { describe, expect, it } from 'vitest';
import {
  assertBookingDate,
  assertPartySize,
  AvailabilityValidationError,
  countAvailableTablesForSlot,
  generateSlotsForShift,
  getWeekdayInTimezone,
  isTableReservedForSlot,
  resolveShiftsForDate,
} from '../../src/availability/availability.engine.js';
import type { BookingPolicy, ReservationBlock, TableDefinition } from '../../src/availability/availability.types.js';

const policy: BookingPolicy = {
  timezone: 'Europe/Madrid',
  minNoticeMinutes: 120,
  maxAdvanceDays: 90,
  minPartySize: 1,
  maxPartySize: 8,
  defaultDurationMinutes: 120,
  turnoverBufferMinutes: 15,
};

const tableA: TableDefinition = {
  id: 'table-a',
  areaId: 'area-1',
  label: 'T1',
  minCapacity: 2,
  maxCapacity: 6,
  bookable: true,
};

describe('availability.engine', () => {
  it('validates party size against policy', () => {
    expect(() => assertPartySize(10, policy)).toThrow(AvailabilityValidationError);
  });

  it('maps Friday to weekday 5 in Madrid', () => {
    expect(getWeekdayInTimezone('2026-06-05', policy.timezone)).toBe(5);
  });

  it('returns no shifts on Monday when only Thu–Sun lunches exist', () => {
    const shifts = resolveShiftsForDate({
      dateStr: '2026-06-01',
      timezone: policy.timezone,
      shifts: [
        {
          id: 'thu',
          name: 'Thursday lunch',
          weekday: 4,
          serviceDate: null,
          startsAt: '13:00:00',
          endsAt: '16:00:00',
          durationMinutes: 120,
          active: true,
        },
        {
          id: 'sun',
          name: 'Sunday lunch',
          weekday: 0,
          serviceDate: null,
          startsAt: '13:00:00',
          endsAt: '16:00:00',
          durationMinutes: 120,
          active: true,
        },
      ],
      exception: null,
      defaultDurationMinutes: 120,
    });
    expect(shifts).toHaveLength(0);
  });

  it('returns lunch shift on Thursday 13:00–16:00', () => {
    const shifts = resolveShiftsForDate({
      dateStr: '2026-06-04',
      timezone: policy.timezone,
      shifts: [
        {
          id: 'thu',
          name: 'Thursday lunch',
          weekday: 4,
          serviceDate: null,
          startsAt: '13:00:00',
          endsAt: '16:00:00',
          durationMinutes: 120,
          active: true,
        },
      ],
      exception: null,
      defaultDurationMinutes: 120,
    });
    expect(shifts).toHaveLength(1);
    expect(shifts[0]?.startsAtLocal).toBe('13:00');
    expect(shifts[0]?.endsAtLocal).toBe('16:00');
  });

  it('returns no shifts when exception closes the day', () => {
    const shifts = resolveShiftsForDate({
      dateStr: '2026-06-05',
      timezone: policy.timezone,
      shifts: [
        {
          id: 'shift-1',
          name: 'Friday lunch',
          weekday: 5,
          serviceDate: null,
          startsAt: '13:00:00',
          endsAt: '16:00:00',
          durationMinutes: 120,
          active: true,
        },
      ],
      exception: { isClosed: true, opensAt: null, closesAt: null },
      defaultDurationMinutes: 120,
    });
    expect(shifts).toHaveLength(0);
  });

  it('generates spaced slots with turnover buffer', () => {
    const now = new Date('2026-06-01T08:00:00.000Z');
    const slots = generateSlotsForShift(
      '2026-06-05',
      {
        id: 'shift-1',
        name: 'Friday lunch',
        startsAtLocal: '13:00',
        endsAtLocal: '16:00',
        durationMinutes: 120,
      },
      policy,
      now,
    );
    expect(slots).toHaveLength(1);
  });

  it('respects minimum notice by dropping early slots', () => {
    const now = new Date('2026-06-05T11:30:00.000Z');
    const slots = generateSlotsForShift(
      '2026-06-05',
      {
        id: 'shift-1',
        name: 'Friday lunch',
        startsAtLocal: '13:00',
        endsAtLocal: '16:00',
        durationMinutes: 120,
      },
      policy,
      now,
    );
    expect(slots).toHaveLength(0);
  });

  it('treats adjacent reservation as conflict when buffer applies', () => {
    const slot = {
      shiftId: 'shift-1',
      shiftName: 'Friday lunch',
      startsAt: new Date('2026-06-05T15:00:00.000Z'),
      endsAt: new Date('2026-06-05T17:00:00.000Z'),
    };
    const reservation: ReservationBlock = {
      tableId: 'table-a',
      startsAt: new Date('2026-06-05T13:00:00.000Z'),
      endsAt: new Date('2026-06-05T15:00:00.000Z'),
    };

    expect(isTableReservedForSlot('table-a', slot, [reservation], 15)).toBe(true);
  });

  it('allows adjacent reservation when buffer is zero', () => {
    const slot = {
      shiftId: 'shift-1',
      shiftName: 'Friday lunch',
      startsAt: new Date('2026-06-05T15:00:00.000Z'),
      endsAt: new Date('2026-06-05T17:00:00.000Z'),
    };
    const reservation: ReservationBlock = {
      tableId: 'table-a',
      startsAt: new Date('2026-06-05T13:00:00.000Z'),
      endsAt: new Date('2026-06-05T15:00:00.000Z'),
    };

    expect(isTableReservedForSlot('table-a', slot, [reservation], 0)).toBe(false);
  });

  it('rejects dates beyond advance window', () => {
    const now = new Date('2026-01-01T12:00:00.000Z');
    expect(() => assertBookingDate('2026-06-01', policy, now)).toThrow(
      AvailabilityValidationError,
    );
  });

  it('counts free tables for a slot', () => {
    const slot = {
      shiftId: 'shift-1',
      shiftName: 'Friday lunch',
      startsAt: new Date('2026-06-05T13:00:00.000Z'),
      endsAt: new Date('2026-06-05T15:00:00.000Z'),
    };
    const count = countAvailableTablesForSlot([tableA], slot, [], [], policy);
    expect(count).toBe(1);
  });
});
