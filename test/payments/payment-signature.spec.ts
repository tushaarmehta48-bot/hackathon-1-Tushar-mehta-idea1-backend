import { describe, expect, it } from 'vitest';
import {
  signPaymentWebhook,
  verifyPaymentWebhookSignature,
} from '../../src/payments/payment-signature.js';

describe('payment webhook signature', () => {
  const secret = 'test-webhook-secret';
  const payload = {
    idempotencyKey: 'pay-key-1',
    event: 'payment.captured' as const,
    timestamp: 1_700_000_000_000,
  };

  it('signs and verifies a payload', () => {
    const signature = signPaymentWebhook(secret, payload);
    expect(verifyPaymentWebhookSignature(secret, payload, signature)).toBe(true);
  });

  it('rejects tampered payloads', () => {
    const signature = signPaymentWebhook(secret, payload);
    expect(
      verifyPaymentWebhookSignature(secret, { ...payload, event: 'payment.failed' }, signature),
    ).toBe(false);
  });
});
