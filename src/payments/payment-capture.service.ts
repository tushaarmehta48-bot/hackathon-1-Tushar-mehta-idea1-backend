import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ReservationsRepository } from '../reservations/reservations.repository.js';
import { UsersService } from '../users/users.service.js';
import type { SignedWebhookPayload } from './payment-signature.js';
import { verifyPaymentWebhookSignature } from './payment-signature.js';
import { PaymentsRepository } from './payments.repository.js';

@Injectable()
export class PaymentCaptureService {
  constructor(
    private readonly payments: PaymentsRepository,
    private readonly reservations: ReservationsRepository,
    private readonly notifications: NotificationsService,
    private readonly users: UsersService,
  ) {}

  async applyWebhookEvent(
    payload: SignedWebhookPayload,
    signature: string | undefined,
  ): Promise<{ ok: true; alreadyProcessed?: boolean }> {
    const secret = process.env.PAYMENT_WEBHOOK_SECRET?.trim();
    if (!secret) {
      throw new UnauthorizedException('Payment webhook is not configured');
    }
    if (!verifyPaymentWebhookSignature(secret, payload, signature)) {
      throw new UnauthorizedException('Invalid payment webhook signature');
    }

    const skewMs = 5 * 60_000;
    if (Math.abs(Date.now() - payload.timestamp) > skewMs) {
      throw new BadRequestException('Webhook timestamp out of range');
    }

    if (payload.event === 'payment.failed') {
      return { ok: true };
    }

    return this.captureByIdempotencyKey(payload.idempotencyKey, null);
  }

  async captureByIdempotencyKey(
    idempotencyKey: string,
    providerPaymentId: string | null,
  ): Promise<{ ok: true; alreadyProcessed?: boolean }> {
    const payment = await this.payments.findByIdempotencyKey(idempotencyKey);
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status === 'CAPTURED') {
      return { ok: true, alreadyProcessed: true };
    }

    if (payment.status !== 'PENDING') {
      throw new BadRequestException('Payment is not pending');
    }

    const reservation = await this.reservations.findById(payment.reservation_id);
    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }

    if (reservation.status === 'CONFIRMED') {
      return { ok: true, alreadyProcessed: true };
    }

    if (reservation.status !== 'PENDING_PAYMENT') {
      throw new BadRequestException('Reservation is not awaiting payment');
    }

    const dueAt = reservation.deposit_due_at
      ? new Date(reservation.deposit_due_at).getTime()
      : null;
    if (dueAt !== null && Date.now() > dueAt) {
      throw new BadRequestException('Deposit hold has expired');
    }

    const updatedPayment = await this.payments.markCaptured(payment.id, providerPaymentId);
    if (!updatedPayment) {
      const again = await this.payments.findByIdempotencyKey(idempotencyKey);
      if (again?.status === 'CAPTURED') {
        return { ok: true, alreadyProcessed: true };
      }
      throw new BadRequestException('Could not capture payment');
    }

    const confirmed = await this.reservations.confirmAfterPayment(reservation.id);
    if (!confirmed) {
      throw new BadRequestException('Could not confirm reservation');
    }

    const locale = reservation.customer_id
      ? ((await this.users.findProfileById(reservation.customer_id))?.preferredLocale ?? 'en')
      : 'en';

    await this.notifications.enqueueBookingConfirmation({
      reservationId: reservation.id,
      userId: reservation.customer_id,
      locale,
      reference: reservation.reference,
      startsAt: reservation.starts_at,
    });

    return { ok: true };
  }
}
