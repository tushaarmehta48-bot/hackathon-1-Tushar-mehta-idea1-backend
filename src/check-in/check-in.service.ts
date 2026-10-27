import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AuditRepository } from '../ops/audit.repository.js';
import { getQrPassSecret } from '../config/qr.config.js';
import { hashQrToken, parseQrPassToken } from '../reservations/reservation-crypto.js';
import { ReservationsRepository } from '../reservations/reservations.repository.js';
import { ReservationsService } from '../reservations/reservations.service.js';
import type { ReservationRecord } from '../reservations/reservations.types.js';
import type { AuthenticatedUser } from '../users/user.types.js';
import { CheckInScanDto } from './dto/check-in-scan.dto.js';

const CHECK_IN_ELIGIBLE = new Set(['CONFIRMED']);

export type StaffCheckInHistoryItem = {
  id: string;
  reference: string;
  partySize: number;
  tableLabel: string | null;
  reservationStartsAt: string;
  method: string;
  checkedInAt: string;
};

export type CheckInScanResult = {
  reservationId: string;
  reference: string;
  partySize: number;
  guestsCheckedIn: number;
  guestsRemaining: number;
  tableLabel: string | null;
  status: string;
  startsAt: string;
  canCheckIn: boolean;
  message: string;
};

@Injectable()
export class CheckInService {
  private readonly logger = new Logger(CheckInService.name);

  constructor(
    private readonly reservations: ReservationsRepository,
    private readonly reservationsService: ReservationsService,
    private readonly audit: AuditRepository,
  ) {}

  async listMyHistory(staff: AuthenticatedUser, limit = 50): Promise<StaffCheckInHistoryItem[]> {
    const capped = Math.min(100, Math.max(1, limit));
    const rows = await this.reservations.listCheckInSuccessHistoryByStaff(staff.id, capped);
    return Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        reference: row.reference,
        partySize: row.party_size,
        tableLabel: await this.reservations.getTableLabel(row.table_id),
        reservationStartsAt: row.starts_at,
        method: row.method,
        checkedInAt: row.created_at,
      })),
    );
  }

  async scan(staff: AuthenticatedUser, dto: CheckInScanDto): Promise<CheckInScanResult> {
    const method = dto.token ? 'QR' : 'MANUAL';
    const record = await this.resolveReservation(dto);

    if (!record) {
      throw new NotFoundException('No matching reservation');
    }

    if (dto.token?.trim() && isFullyCheckedIn(record)) {
      await this.safeInsertCheckInLog({
        reservationId: record.id,
        staffId: staff.id,
        method: 'QR',
        outcome: 'DUPLICATE',
      });
      await this.safeAudit({
        actorId: staff.id,
        action: 'check_in_scan_rejected',
        entityType: 'reservation',
        entityId: record.id,
        metadata: { method: 'QR', reason: 'party_fully_checked_in' },
      });
      throw new NotFoundException('No matching reservation');
    }

    const summary = await this.buildSummary(record);

    if (!summary.canCheckIn) {
      await this.safeInsertCheckInLog({
        reservationId: record.id,
        staffId: staff.id,
        method,
        outcome: 'REJECTED',
      });
      await this.safeAudit({
        actorId: staff.id,
        action: 'check_in_scan_rejected',
        entityType: 'reservation',
        entityId: record.id,
        metadata: { method, status: record.status },
      });
    }

    return summary;
  }

  async confirm(staff: AuthenticatedUser, reservationId: string) {
    const record = await this.reservations.findById(reservationId);
    if (!record) {
      throw new NotFoundException('Reservation not found');
    }

    if (isFullyCheckedIn(record)) {
      await this.safeInsertCheckInLog({
        reservationId: record.id,
        staffId: staff.id,
        method: 'MANUAL',
        outcome: 'DUPLICATE',
      });
      throw new ConflictException({
        code: 'ALREADY_CHECKED_IN',
        message: 'All guests are already checked in',
      });
    }

    if (!CHECK_IN_ELIGIBLE.has(record.status)) {
      await this.safeInsertCheckInLog({
        reservationId: record.id,
        staffId: staff.id,
        method: 'MANUAL',
        outcome: 'REJECTED',
      });
      throw new BadRequestException({
        code: 'NOT_CHECK_IN_ELIGIBLE',
        message: 'Reservation cannot be checked in in its current state',
      });
    }

    const updated = await this.reservations.incrementGuestCheckIn(record.id, staff.id);
    if (!updated) {
      await this.safeInsertCheckInLog({
        reservationId: record.id,
        staffId: staff.id,
        method: 'MANUAL',
        outcome: 'DUPLICATE',
      });
      throw new ConflictException({
        code: 'ALREADY_CHECKED_IN',
        message: 'All guests are already checked in',
      });
    }

    await this.safeInsertCheckInLog({
      reservationId: updated.id,
      staffId: staff.id,
      method: 'MANUAL',
      outcome: 'SUCCESS',
    });
    await this.safeAudit({
      actorId: staff.id,
      action: 'check_in_confirmed',
      entityType: 'reservation',
      entityId: updated.id,
      metadata: {
        reference: updated.reference,
        guestsCheckedIn: updated.checked_in_guest_count,
        partySize: updated.party_size,
      },
    });

    return this.reservationsService.mapRecordToView(updated);
  }

  private async safeInsertCheckInLog(input: {
    reservationId: string;
    staffId: string;
    method: 'QR' | 'MANUAL';
    outcome: 'SUCCESS' | 'REJECTED' | 'DUPLICATE';
  }): Promise<void> {
    try {
      await this.reservations.insertCheckInLog(input);
    } catch (error) {
      this.logger.warn(
        `Check-in log not saved (${input.outcome}): ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  private async safeAudit(input: {
    actorId: string | null;
    action: string;
    entityType: string;
    entityId: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.audit.log(input);
    } catch (error) {
      this.logger.warn(
        `Audit log not saved (${input.action}): ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  private async resolveReservation(dto: CheckInScanDto): Promise<ReservationRecord | null> {
    if (dto.token?.trim()) {
      const raw = dto.token.trim();
      const byHash = await this.reservations.findByQrTokenHash(hashQrToken(raw));
      if (byHash) {
        return byHash;
      }
      const reference = parseQrPassToken(raw, getQrPassSecret());
      if (reference) {
        return this.reservations.findByReference(reference);
      }
      return null;
    }
    if (dto.reference?.trim()) {
      return this.reservations.findByReference(dto.reference.trim().toUpperCase());
    }
    throw new BadRequestException({
      code: 'LOOKUP_REQUIRED',
      message: 'Provide a QR token or booking reference',
    });
  }

  private async buildSummary(record: ReservationRecord): Promise<CheckInScanResult> {
    const tableLabel = await this.reservations.getTableLabel(record.table_id);
    const guestsCheckedIn = guestCheckInCount(record);
    const guestsRemaining = Math.max(0, record.party_size - guestsCheckedIn);
    let canCheckIn = CHECK_IN_ELIGIBLE.has(record.status) && guestsRemaining > 0;
    let message = `Guest ${guestsCheckedIn + 1} of ${record.party_size}`;

    if (isFullyCheckedIn(record)) {
      canCheckIn = false;
      message = 'All guests checked in';
    } else if (record.status === 'PENDING_PAYMENT') {
      canCheckIn = false;
      message = 'Deposit not completed';
    } else if (!CHECK_IN_ELIGIBLE.has(record.status)) {
      canCheckIn = false;
      message = `Status: ${record.status}`;
    }

    return {
      reservationId: record.id,
      reference: record.reference,
      partySize: record.party_size,
      guestsCheckedIn,
      guestsRemaining,
      tableLabel,
      status: record.status,
      startsAt: record.starts_at,
      canCheckIn,
      message,
    };
  }
}

function guestCheckInCount(record: ReservationRecord): number {
  return record.checked_in_guest_count ?? 0;
}

function isFullyCheckedIn(record: ReservationRecord): boolean {
  return (
    record.status === 'CHECKED_IN' ||
    guestCheckInCount(record) >= record.party_size
  );
}
