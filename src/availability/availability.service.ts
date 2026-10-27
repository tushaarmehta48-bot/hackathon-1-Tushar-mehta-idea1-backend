import { BadRequestException, Injectable } from '@nestjs/common';
import { SchedulesRepository } from '../schedules/schedules.repository.js';
import {
  assertBookingDate,
  assertPartySize,
  AvailabilityValidationError,
  countAvailableTablesForSlot,
  filterTablesForParty,
  generateSlotsForShift,
  getAvailableTableIdsForSlot,
  isDateWithinSeasons,
  isTableBlockedForSlot,
  isTableReservedForSlot,
  localDateTimeToUtc,
  resolveShiftsForDate,
} from './availability.engine.js';
import type { TimeSlot } from './availability.types.js';
import type { BlockWindow, BookingPolicy, ReservationBlock, TableDefinition } from './availability.types.js';
import { resolveTableTier } from '../schedules/table-tier.util.js';

@Injectable()
export class AvailabilityService {
  constructor(private readonly schedules: SchedulesRepository) {}

  async getAvailability(query: { date: string; partySize: number; shiftId?: string }) {
    const context = await this.loadContext(query.date);
    const policy = context.policy;

    try {
      assertPartySize(query.partySize, policy);
      assertBookingDate(query.date, policy);
    } catch (error) {
      this.toBadRequest(error);
    }

    if (!isDateWithinSeasons(query.date, context.seasons)) {
      return this.emptyAvailabilityResponse(query, policy);
    }

    let shifts = resolveShiftsForDate({
      dateStr: query.date,
      timezone: policy.timezone,
      shifts: context.shiftRows,
      exception: context.exception,
      defaultDurationMinutes: policy.defaultDurationMinutes,
    });

    if (query.shiftId) {
      shifts = shifts.filter((shift) => shift.id === query.shiftId);
    }

    const tables = filterTablesForParty(context.tables, query.partySize);
    const shiftResults = shifts.map((shift) => {
      const slots = generateSlotsForShift(query.date, shift, policy).map((slot) => ({
        startsAt: slot.startsAt.toISOString(),
        endsAt: slot.endsAt.toISOString(),
        availableTableCount: countAvailableTablesForSlot(
          tables,
          slot,
          context.reservations,
          context.blocks,
          policy,
        ),
      }));

      return {
        shiftId: shift.id,
        name: shift.name,
        slots: slots.filter((slot) => slot.availableTableCount > 0),
      };
    });

    return {
      date: query.date,
      timezone: policy.timezone,
      partySize: query.partySize,
      shifts: shiftResults.filter((shift) => shift.slots.length > 0),
    };
  }

  async getFloorPlan(query: {
    date: string;
    partySize: number;
    shiftId?: string;
    slotStartsAt?: string;
  }) {
    const context = await this.loadContext(query.date);
    const policy = context.policy;

    try {
      assertPartySize(query.partySize, policy);
      assertBookingDate(query.date, policy);
    } catch (error) {
      this.toBadRequest(error);
    }

    const areas = context.areaRows.map((area) => ({
      id: area.id,
      name: area.name,
      description: area.description,
      areaType: area.area_type,
      sortOrder: area.sort_order,
    }));

    const tablesForParty = filterTablesForParty(context.tables, query.partySize);
    const eligibleIds = new Set(tablesForParty.map((table) => table.id));

    let slot = null as null | {
      startsAt: Date;
      endsAt: Date;
    };

    if (query.slotStartsAt) {
      const startsAt = new Date(query.slotStartsAt);
      slot = {
        startsAt,
        endsAt: new Date(startsAt.getTime() + policy.defaultDurationMinutes * 60_000),
      };
    }

    const tables = context.tableRows.map((table) => {
      const base = {
        id: table.id,
        areaId: table.area_id,
        label: table.label,
        minCapacity: table.min_capacity,
        maxCapacity: table.max_capacity,
        tableTier: resolveTableTier({
          label: table.label,
          maxCapacity: table.max_capacity,
          tableTier: table.table_tier,
        }),
        bookable: table.bookable,
        svg: {
          x: Number(table.svg_x),
          y: Number(table.svg_y),
          width: Number(table.svg_width),
          height: Number(table.svg_height),
          rotationDeg: Number(table.svg_rotation_deg),
        },
      };

      if (!slot) {
        return {
          ...base,
          availabilityState: eligibleIds.has(table.id) ? 'unknown' : 'party_size_mismatch',
        };
      }

      if (!eligibleIds.has(table.id)) {
        return { ...base, availabilityState: 'party_size_mismatch' as const };
      }

      const tableDef: TableDefinition = {
        id: table.id,
        areaId: table.area_id,
        label: table.label,
        minCapacity: table.min_capacity,
        maxCapacity: table.max_capacity,
        bookable: table.bookable,
      };

      const timeSlot = {
        shiftId: query.shiftId ?? 'selected',
        shiftName: 'selected',
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
      };

      if (isTableBlockedForSlot(tableDef, timeSlot, context.blocks, policy.turnoverBufferMinutes)) {
        return { ...base, availabilityState: 'blocked' as const };
      }
      if (
        isTableReservedForSlot(
          table.id,
          timeSlot,
          context.reservations,
          policy.turnoverBufferMinutes,
        )
      ) {
        return { ...base, availabilityState: 'reserved' as const };
      }
      return { ...base, availabilityState: 'available' as const };
    });

    return {
      date: query.date,
      timezone: policy.timezone,
      partySize: query.partySize,
      slotStartsAt: query.slotStartsAt ?? null,
      areas,
      tables,
    };
  }

  async assertTableBookable(input: {
    date: string;
    shiftId: string;
    slotStartsAt: string;
    tableId: string;
    partySize: number;
  }): Promise<TimeSlot> {
    const context = await this.loadContext(input.date);
    const policy = context.policy;

    try {
      assertPartySize(input.partySize, policy);
      assertBookingDate(input.date, policy);
    } catch (error) {
      this.toBadRequest(error);
    }

    if (!isDateWithinSeasons(input.date, context.seasons)) {
      throw new BadRequestException({
        code: 'OUTSIDE_SEASON',
        message: 'Bookings are not available for this date',
      });
    }

    const shifts = resolveShiftsForDate({
      dateStr: input.date,
      timezone: policy.timezone,
      shifts: context.shiftRows,
      exception: context.exception,
      defaultDurationMinutes: policy.defaultDurationMinutes,
    });

    const shift = shifts.find((row) => row.id === input.shiftId);
    if (!shift) {
      throw new BadRequestException({
        code: 'INVALID_SHIFT',
        message: 'Selected service is not available on this date',
      });
    }

    const slotStartsAt = new Date(input.slotStartsAt);
    const slots = generateSlotsForShift(input.date, shift, policy);
    const slot = slots.find(
      (candidate) => candidate.startsAt.getTime() === slotStartsAt.getTime(),
    );

    if (!slot) {
      throw new BadRequestException({
        code: 'INVALID_SLOT',
        message: 'Selected time is not available',
      });
    }

    const tables = filterTablesForParty(context.tables, input.partySize);
    const table = tables.find((row) => row.id === input.tableId);
    if (!table) {
      throw new BadRequestException({
        code: 'TABLE_NOT_ELIGIBLE',
        message: 'Selected table is not available for this party size',
      });
    }

    const availableIds = getAvailableTableIdsForSlot(
      tables,
      slot,
      context.reservations,
      context.blocks,
      policy,
    );

    if (!availableIds.includes(input.tableId)) {
      throw new BadRequestException({
        code: 'TABLE_UNAVAILABLE',
        message: 'Selected table is no longer available for this time',
      });
    }

    return slot;
  }

  private async loadContext(dateStr: string) {
    const policyRow = await this.schedules.getActivePolicy();
    const policy: BookingPolicy = {
      timezone: policyRow.timezone,
      minNoticeMinutes: policyRow.min_notice_minutes,
      maxAdvanceDays: policyRow.max_advance_days,
      minPartySize: policyRow.min_party_size,
      maxPartySize: policyRow.max_party_size,
      defaultDurationMinutes: policyRow.default_duration_minutes,
      turnoverBufferMinutes: policyRow.turnover_buffer_minutes,
    };

    const dayStart = localDateTimeToUtc(dateStr, '00:00', policy.timezone);
    const dayEnd = localDateTimeToUtc(dateStr, '23:59', policy.timezone);
    const queryStart = new Date(dayStart.getTime() - policy.turnoverBufferMinutes * 60_000);
    const queryEnd = new Date(dayEnd.getTime() + 24 * 60 * 60_000);

    const [
      shiftRowsRaw,
      seasonsRaw,
      exceptionRaw,
      areaRows,
      tableRows,
      reservationsRaw,
      blocksRaw,
    ] = await Promise.all([
      this.schedules.getActiveShifts(),
      this.schedules.getEnabledSeasons(),
      this.schedules.getExceptionForDate(dateStr),
      this.schedules.getActiveAreas(),
      this.schedules.getActiveTables(),
      this.schedules.getReservationsBetween(queryStart.toISOString(), queryEnd.toISOString()),
      this.schedules.getActiveBlocksBetween(queryStart.toISOString(), queryEnd.toISOString()),
    ]);

    const shiftRows = shiftRowsRaw.map((shift) => ({
      id: shift.id,
      name: shift.name,
      weekday: shift.weekday,
      serviceDate: shift.service_date,
      startsAt: shift.starts_at,
      endsAt: shift.ends_at,
      durationMinutes: shift.default_duration_minutes,
      active: shift.active,
    }));

    const tables: TableDefinition[] = tableRows.map((table) => ({
      id: table.id,
      areaId: table.area_id,
      label: table.label,
      minCapacity: table.min_capacity,
      maxCapacity: table.max_capacity,
      bookable: table.bookable,
    }));

    const reservations: ReservationBlock[] = reservationsRaw.map((row) => ({
      tableId: row.table_id,
      startsAt: new Date(row.starts_at),
      endsAt: new Date(row.ends_at),
    }));

    const blocks: BlockWindow[] = blocksRaw.map((row) => ({
      tableId: row.table_id,
      areaId: row.area_id,
      startsAt: new Date(row.starts_at),
      endsAt: new Date(row.ends_at),
    }));

    return {
      policy,
      shiftRows,
      seasons: seasonsRaw.map((season) => ({
        startsOn: season.starts_on,
        endsOn: season.ends_on,
      })),
      exception: exceptionRaw
        ? {
            isClosed: exceptionRaw.is_closed,
            opensAt: exceptionRaw.opens_at,
            closesAt: exceptionRaw.closes_at,
          }
        : null,
      areaRows,
      tableRows,
      tables,
      reservations,
      blocks,
    };
  }

  private emptyAvailabilityResponse(
    query: { date: string; partySize: number },
    policy: BookingPolicy,
  ) {
    return {
      date: query.date,
      timezone: policy.timezone,
      partySize: query.partySize,
      shifts: [],
    };
  }

  private toBadRequest(error: unknown): never {
    if (error instanceof AvailabilityValidationError) {
      throw new BadRequestException({
        code: error.code,
        message: error.message,
      });
    }
    throw error;
  }
}
