import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AvailabilityService } from '../availability/availability.service.js';
import { ReservationAccessService } from '../auth/reservation-access.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { SchedulesRepository } from '../schedules/schedules.repository.js';
import type { BookingPolicyRow } from '../schedules/schedules.types.js';
import type { AuthenticatedUser } from '../users/user.types.js';
import { CreateReservationDto } from './dto/create-reservation.dto.js';
import { getQrPassSecret } from '../config/qr.config.js';
import {
  buildQrPassToken,
  generateReservationReference,
  hashQrToken,
} from './reservation-crypto.js';
import { isDepositRequiredForPolicy } from '../config/payments.config.js';
import { ReservationsRepository } from './reservations.repository.js';
import type { ReservationRecord, ReservationView } from './reservations.types.js';

const ACTIVE_CANCEL_STATUSES = new Set([
  'PENDING_PAYMENT',
  'PENDING_CONFIRMATION',
  'CONFIRMED',
]);

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);

  constructor(
    private readonly reservations: ReservationsRepository,
    private readonly availability: AvailabilityService,
    private readonly schedules: SchedulesRepository,
    private readonly reservationAccess: ReservationAccessService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(user: AuthenticatedUser, dto: CreateReservationDto): Promise<ReservationView> {
    if (!dto.acceptedTerms) {
      throw new BadRequestException({
        code: 'TERMS_REQUIRED',
        message: 'You must accept the booking terms',
      });
    }

    const policy = await this.schedules.getActivePolicy();
    const slot = await this.availability.assertTableBookable({
      date: dto.date,
      shiftId: dto.shiftId,
      slotStartsAt: dto.slotStartsAt,
      tableId: dto.tableId,
      partySize: dto.partySize,
    });

    const depositRequired = isDepositRequiredForPolicy(policy.deposit_required);
    const status = depositRequired ? 'PENDING_PAYMENT' : 'CONFIRMED';
    const holdMinutes = policy.deposit_hold_minutes ?? 15;
    const depositDueAt = depositRequired
      ? new Date(Date.now() + holdMinutes * 60_000).toISOString()
      : null;
    const reference = generateReservationReference();
    const qrToken = buildQrPassToken(reference, getQrPassSecret());
    const qrTokenHash = hashQrToken(qrToken);

    let record: ReservationRecord;
    try {
      record = await this.reservations.insertReservation({
        reference,
        customerId: user.id,
        tableId: dto.tableId,
        shiftId: dto.shiftId,
        startsAt: slot.startsAt.toISOString(),
        endsAt: slot.endsAt.toISOString(),
        partySize: dto.partySize,
        status,
        source: 'WEB',
        specialRequest: dto.specialRequest?.trim() || null,
        depositRequired,
        depositDueAt,
        qrTokenHash,
        createdBy: user.id,
      });
    } catch (error) {
      if (error instanceof Error && (error as Error & { code?: string }).code === 'OVERLAP') {
        throw new ConflictException({
          code: 'SLOT_CONFLICT',
          message: 'This table was just booked for the selected time',
        });
      }
      throw error;
    }

    if (status === 'CONFIRMED') {
      try {
        await this.enqueueConfirmation(record, user.profile.preferredLocale);
      } catch (error) {
        this.logger.warn(
          `Booking ${record.reference} created but confirmation notification failed`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    const view = await this.toView(record, policy);
    return { ...view, qrToken };
  }

  async listMine(user: AuthenticatedUser): Promise<ReservationView[]> {
    const policy = await this.schedules.getActivePolicy();
    const rows = await this.reservations.findMine(user.id);
    return Promise.all(rows.map((row) => this.toView(row, policy)));
  }

  async getById(user: AuthenticatedUser, id: string): Promise<ReservationView> {
    await this.reservationAccess.assertCanReadReservation(user, id);
    const record = await this.reservations.findById(id);
    if (!record) {
      throw new NotFoundException('Reservation not found');
    }
    const policy = await this.schedules.getActivePolicy();
    return this.toView(record, policy);
  }

  async getCheckInPass(
    user: AuthenticatedUser,
    id: string,
  ): Promise<{ qrPass: string }> {
    await this.reservationAccess.assertCanReadReservation(user, id);
    const record = await this.reservations.findById(id);
    if (!record) {
      throw new NotFoundException('Reservation not found');
    }
    const guestsIn = record.checked_in_guest_count ?? 0;
    if (record.status !== 'CONFIRMED' || guestsIn >= record.party_size) {
      throw new BadRequestException({
        code: 'PASS_NOT_AVAILABLE',
        message: 'Check-in pass is not available for this booking yet',
      });
    }
    const qrPass = buildQrPassToken(record.reference, getQrPassSecret());
    const expectedHash = hashQrToken(qrPass);
    void this.reservations.updateQrTokenHash(record.id, expectedHash).catch(() => undefined);
    return { qrPass };
  }

  async mapRecordToView(record: ReservationRecord): Promise<ReservationView> {
    const policy = await this.schedules.getActivePolicy();
    return this.toView(record, policy);
  }

  async cancel(user: AuthenticatedUser, id: string): Promise<ReservationView> {
    await this.reservationAccess.assertCanReadReservation(user, id);
    const record = await this.reservations.findById(id);
    if (!record) {
      throw new NotFoundException('Reservation not found');
    }

    if (user.profile.role === 'CUSTOMER' && record.customer_id !== user.id) {
      throw new ForbiddenException('You cannot cancel this reservation');
    }

    const policy = await this.schedules.getActivePolicy();
    this.assertCancelAllowed(record, policy.cancellation_deadline_minutes);

    const updated = await this.reservations.cancelReservation(id);
    return this.toView(updated, policy);
  }

  private async enqueueConfirmation(record: ReservationRecord, locale: string): Promise<void> {
    await this.notifications.enqueueBookingConfirmation({
      reservationId: record.id,
      userId: record.customer_id,
      locale,
      reference: record.reference,
      startsAt: record.starts_at,
    });
  }

  private assertCancelAllowed(record: ReservationRecord, cancellationDeadlineMinutes: number): void {
    if (!ACTIVE_CANCEL_STATUSES.has(record.status)) {
      throw new BadRequestException({
        code: 'NOT_CANCELLABLE',
        message: 'This reservation cannot be cancelled',
      });
    }

    const startsAt = new Date(record.starts_at).getTime();
    const deadlineAt = startsAt - cancellationDeadlineMinutes * 60_000;
    if (Date.now() > deadlineAt) {
      throw new BadRequestException({
        code: 'CANCEL_DEADLINE_PASSED',
        message: 'The cancellation window for this reservation has closed',
      });
    }
  }

  private async toView(
    record: ReservationRecord,
    policy: BookingPolicyRow,
  ): Promise<ReservationView> {
    const cancellationDeadlineMinutes = policy.cancellation_deadline_minutes;
    const [tableLabel, shiftName, paymentStatus] = await Promise.all([
      this.reservations.getTableLabel(record.table_id),
      this.reservations.getShiftName(record.shift_id),
      record.deposit_required ? this.reservations.getLatestPaymentStatus(record.id) : null,
    ]);

    const startsAtMs = new Date(record.starts_at).getTime();
    const cancellationDeadlineAt = new Date(
      startsAtMs - cancellationDeadlineMinutes * 60_000,
    ).toISOString();

    const canCancel =
      ACTIVE_CANCEL_STATUSES.has(record.status) &&
      Date.now() <= startsAtMs - cancellationDeadlineMinutes * 60_000;

    return {
      id: record.id,
      reference: record.reference,
      tableId: record.table_id,
      tableLabel,
      shiftId: record.shift_id,
      shiftName,
      startsAt: record.starts_at,
      endsAt: record.ends_at,
      partySize: record.party_size,
      status: record.status,
      source: record.source,
      specialRequest: record.special_request,
      depositRequired: record.deposit_required,
      depositAmountCents: record.deposit_required ? policy.deposit_amount_cents : null,
      depositCurrency: record.deposit_required ? policy.deposit_currency : null,
      depositDueAt: record.deposit_due_at,
      paymentStatus,
      checkedInAt: record.checked_in_at,
      checkedInGuestCount: record.checked_in_guest_count ?? 0,
      createdAt: record.created_at,
      canCancel,
      cancellationDeadlineAt,
    };
  }
}
