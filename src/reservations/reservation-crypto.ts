import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const REFERENCE_PREFIX = 'HS';
export const QR_PASS_PREFIX = 'iturrieta-checkin-v1';

export function generateReservationReference(): string {
  const suffix = randomBytes(4).toString('hex').toUpperCase();
  return `${REFERENCE_PREFIX}-${suffix}`;
}

export function generateQrToken(): string {
  return randomBytes(24).toString('base64url');
}

export function hashQrToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function buildQrPassToken(reference: string, secret: string): string {
  const ref = reference.trim().toUpperCase();
  const sig = createHmac('sha256', secret).update(ref, 'utf8').digest('base64url');
  return `${QR_PASS_PREFIX}.${ref}.${sig}`;
}

/** Returns booking reference when the pass is authentic, otherwise null. */
export function parseQrPassToken(token: string, secret: string): string | null {
  const trimmed = token.trim();
  const parts = trimmed.split('.');
  if (parts.length !== 3 || parts[0] !== QR_PASS_PREFIX) {
    return null;
  }
  const ref = parts[1]?.toUpperCase();
  const sig = parts[2];
  if (!ref || !sig) {
    return null;
  }
  const expected = createHmac('sha256', secret).update(ref, 'utf8').digest('base64url');
  try {
    const a = Buffer.from(sig, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return null;
    }
  } catch {
    return null;
  }
  return ref;
}
