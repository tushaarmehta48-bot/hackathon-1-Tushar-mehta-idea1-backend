import { createHmac, timingSafeEqual } from 'node:crypto';

export type SignedWebhookPayload = {
  idempotencyKey: string;
  event: 'payment.captured' | 'payment.failed';
  timestamp: number;
};

export function signPaymentWebhook(
  secret: string,
  payload: SignedWebhookPayload,
): string {
  const body = `${payload.timestamp}:${payload.idempotencyKey}:${payload.event}`;
  return createHmac('sha256', secret).update(body).digest('hex');
}

export function verifyPaymentWebhookSignature(
  secret: string,
  payload: SignedWebhookPayload,
  signatureHex: string | undefined,
): boolean {
  if (!signatureHex?.trim()) {
    return false;
  }
  const expected = signPaymentWebhook(secret, payload);
  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(signatureHex.trim(), 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
