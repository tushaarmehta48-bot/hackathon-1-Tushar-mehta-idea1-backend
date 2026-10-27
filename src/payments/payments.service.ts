import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { isOnlinePaymentsEnabled } from '../config/payments.config.js';
import { randomUUID } from 'node:crypto';
import { ReservationAccessService } from '../auth/reservation-access.service.js';
import { ReservationsRepository } from '../reservations/reservations.repository.js';
import { SchedulesRepository } from '../schedules/schedules.repository.js';
import type { AuthenticatedUser } from '../users/user.types.js';
import { PaymentCaptureService } from './payment-capture.service.js';
import { PaymentsRepository } from './payments.repository.js';

export type CheckoutSessionView = {
  reservationId: string;
  paymentId: string;
  idempotencyKey: string;
  provider: string;
  amountCents: number;
  currency: string;
  depositDueAt: string | null;
  checkoutUrl: string | null;
  devSimulateAllowed: boolean;
};

@Injectable()
export class PaymentsService {
  constructor(
    private readonly payments: PaymentsRepository,
    private readonly reservations: ReservationsRepository,
    private readonly schedules: SchedulesRepository,
    private readonly reservationAccess: ReservationAccessService,
    private readonly capture: PaymentCaptureService,
  ) {}

  async createCheckout(
    user: AuthenticatedUser,
    reservationId: string,
  ): Promise<CheckoutSessionView> {
    if (!isOnlinePaymentsEnabled()) {
      throw new ServiceUnavailableException('Online payments are not enabled');
    }
    await this.reservationAccess.assertCanReadReservation(user, reservationId);

    const reservation = await this.reservations.findById(reservationId);
    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }

    if (user.profile.role === 'CUSTOMER' && reservation.customer_id !== user.id) {
      throw new ForbiddenException('You cannot pay for this reservation');
    }

    if (reservation.status !== 'PENDING_PAYMENT') {
      throw new BadRequestException('This reservation does not require payment');
    }

    const dueAt = reservation.deposit_due_at
      ? new Date(reservation.deposit_due_at).getTime()
      : null;
    if (dueAt !== null && Date.now() > dueAt) {
      throw new BadRequestException('Deposit hold has expired');
    }

    const policy = await this.schedules.getActivePolicy();
    const amountCents = policy.deposit_amount_cents ?? 0;
    if (amountCents <= 0) {
      throw new BadRequestException('Deposit amount is not configured');
    }

    const provider = (process.env.PAYMENT_PROVIDER?.trim() || 'dev').toLowerCase();
    const existing = await this.payments.findLatestForReservation(reservationId);
    if (existing?.status === 'PENDING') {
      return this.toCheckoutView(reservation.id, existing, reservation.deposit_due_at, provider);
    }

    const idempotencyKey = randomUUID();
    const payment = await this.payments.insertPayment({
      reservationId,
      provider,
      amountCents,
      currency: policy.deposit_currency ?? 'EUR',
      idempotencyKey,
    });

    return this.toCheckoutView(reservation.id, payment, reservation.deposit_due_at, provider);
  }

  async devSimulateCapture(user: AuthenticatedUser, reservationId: string): Promise<{ ok: true }> {
    if (!isOnlinePaymentsEnabled()) {
      throw new ServiceUnavailableException('Online payments are not enabled');
    }
    if ((process.env.PAYMENT_PROVIDER?.trim() || 'dev').toLowerCase() !== 'dev') {
      throw new BadRequestException('Dev payment simulation is disabled');
    }
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException('Dev payment simulation is disabled');
    }

    await this.reservationAccess.assertCanReadReservation(user, reservationId);
    const payment = await this.payments.findLatestForReservation(reservationId);
    if (!payment || payment.status !== 'PENDING') {
      throw new BadRequestException('No pending payment for this reservation');
    }

    await this.capture.captureByIdempotencyKey(payment.idempotency_key, `dev_${payment.id}`);
    return { ok: true };
  }

  private toCheckoutView(
    reservationId: string,
    payment: {
      id: string;
      idempotency_key: string;
      provider: string;
      amount_cents: number;
      currency: string;
    },
    depositDueAt: string | null,
    provider: string,
  ): CheckoutSessionView {
    const frontend = (process.env.FRONTEND_URL?.trim() || 'http://localhost:3000').replace(
      /\/$/,
      '',
    );
    const devSimulateAllowed = provider === 'dev' && process.env.NODE_ENV !== 'production';

    return {
      reservationId,
      paymentId: payment.id,
      idempotencyKey: payment.idempotency_key,
      provider: payment.provider,
      amountCents: payment.amount_cents,
      currency: payment.currency,
      depositDueAt,
      checkoutUrl:
        provider === 'dev'
          ? null
          : `${frontend}/book/pay/${reservationId}?payment=${payment.id}`,
      devSimulateAllowed,
    };
  }
}
