import { ConflictException, Injectable } from '@nestjs/common';
import { localDateTimeToUtc } from '../availability/availability.engine.js';
import { AvailabilityService } from '../availability/availability.service.js';
import { SchedulesRepository } from '../schedules/schedules.repository.js';
import type { AuthenticatedUser } from '../users/user.types.js';
import { getQrPassSecret } from '../config/qr.config.js';
import {
  buildQrPassToken,
  generateReservationReference,
  hashQrToken,
} from '../reservations/reservation-crypto.js';
import { ReservationsRepository } from '../reservations/reservations.repository.js';
import { ReservationsService } from '../reservations/reservations.service.js';
import type { ReservationView } from '../reservations/reservations.types.js';
import { StaffCreateReservationDto } from './dto/staff-create-reservation.dto.js';

@Injectable()
export class StaffReservationsService {
  constructor(
    private readonly reservations: ReservationsRepository,
    private readonly availability: AvailabilityService,
    private readonly schedules: SchedulesRepository,
    private readonly reservationsService: ReservationsService,
  ) {}

  async create(staff: AuthenticatedUser, dto: StaffCreateReservationDto): Promise<ReservationView> {
    const policy = await this.schedules.getActivePolicy();
    const slot = await this.availability.assertTableBookable({
      date: dto.date,
      shiftId: dto.shiftId,
      slotStartsAt: dto.slotStartsAt,
      tableId: dto.tableId,
      partySize: dto.partySize,
    });

    const reference = generateReservationReference();
    const qrToken = buildQrPassToken(reference, getQrPassSecret());
    const qrTokenHash = hashQrToken(qrToken);

    try {
      const record = await this.reservations.insertReservation({
        reference,
        customerId: null,
        tableId: dto.tableId,
        shiftId: dto.shiftId,
        startsAt: slot.startsAt.toISOString(),
        endsAt: slot.endsAt.toISOString(),
        partySize: dto.partySize,
        status: 'CONFIRMED',
        source: dto.source,
        specialRequest: dto.specialRequest?.trim() || null,
        depositRequired: false,
        qrTokenHash,
        createdBy: staff.id,
      });

      const view = await this.reservationsService.mapRecordToView(record);
      return { ...view, qrToken };
    } catch (error) {
      if (error instanceof Error && (error as Error & { code?: string }).code === 'OVERLAP') {
        throw new ConflictException({
          code: 'SLOT_CONFLICT',
          message: 'This table was just booked for the selected time',
        });
      }
      throw error;
    }
  }

  async listDay(date: string, referenceQuery?: string): Promise<ReservationView[]> {
    const policyRow = await this.schedules.getActivePolicy();
    const dayStart = localDateTimeToUtc(date, '00:00', policyRow.timezone);
    const nextDay = new Date(dayStart.getTime() + 24 * 60 * 60_000);
    const rows = await this.reservations.listBetween(
      dayStart.toISOString(),
      nextDay.toISOString(),
      referenceQuery,
    );
    return Promise.all(
      rows.map((row) => this.reservationsService.mapRecordToView(row)),
    );
  }
}
