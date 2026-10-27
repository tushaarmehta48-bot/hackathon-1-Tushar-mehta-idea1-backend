import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { isOnlinePaymentsEnabled } from '../config/payments.config.js';
import { PaymentsRepository } from './payments.repository.js';
import { ReservationsRepository } from '../reservations/reservations.repository.js';

@Injectable()
export class PaymentExpiryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentExpiryService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly reservations: ReservationsRepository,
    private readonly payments: PaymentsRepository,
  ) {}

  onModuleInit(): void {
    if (!isOnlinePaymentsEnabled()) {
      return;
    }
    const enabled = process.env.PAYMENT_HOLD_EXPIRY_ENABLED !== 'false';
    if (!enabled) {
      return;
    }
    void this.expireStaleHolds();
    this.timer = setInterval(() => {
      void this.expireStaleHolds();
    }, 60_000);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async expireStaleHolds(): Promise<number> {
    const nowIso = new Date().toISOString();
    const rows = await this.reservations.listExpiredPendingPayments(nowIso);
    let count = 0;

    for (const row of rows) {
      const expired = await this.reservations.expireReservation(row.id);
      if (!expired) {
        continue;
      }
      const payment = await this.payments.findLatestForReservation(row.id);
      if (payment?.status === 'PENDING') {
        await this.payments.markCancelled(payment.id);
      }
      count += 1;
      this.logger.log(`Expired unpaid hold ${row.reference}`);
    }

    return count;
  }
}
