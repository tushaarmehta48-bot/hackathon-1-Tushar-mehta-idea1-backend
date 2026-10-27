import { describe, expect, it, vi } from 'vitest';
import { PaymentExpiryService } from '../../src/payments/payment-expiry.service.js';

describe('PaymentExpiryService', () => {
  it('expires pending payment holds and cancels payments', async () => {
    const reservations = {
      listExpiredPendingPayments: vi.fn().mockResolvedValue([
        {
          id: 'res-1',
          reference: 'ABC123',
        },
      ]),
      expireReservation: vi.fn().mockResolvedValue({ id: 'res-1', status: 'EXPIRED' }),
    };
    const payments = {
      findLatestForReservation: vi.fn().mockResolvedValue({ id: 'pay-1', status: 'PENDING' }),
      markCancelled: vi.fn().mockResolvedValue(undefined),
    };

    const service = new PaymentExpiryService(
      reservations as never,
      payments as never,
    );

    const count = await service.expireStaleHolds();
    expect(count).toBe(1);
    expect(payments.markCancelled).toHaveBeenCalledWith('pay-1');
  });
});
