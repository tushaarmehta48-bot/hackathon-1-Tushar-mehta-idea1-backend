import { describe, expect, it } from 'vitest';
import {
  buildQrPassToken,
  generateQrToken,
  generateReservationReference,
  hashQrToken,
  parseQrPassToken,
} from '../../src/reservations/reservation-crypto.js';

describe('reservation crypto', () => {
  it('generates unique references with prefix', () => {
    const reference = generateReservationReference();
    expect(reference.startsWith('HS-')).toBe(true);
    expect(reference.length).toBeGreaterThanOrEqual(8);
  });

  it('hashes qr tokens deterministically', () => {
    const token = generateQrToken();
    expect(hashQrToken(token)).toHaveLength(64);
    expect(hashQrToken(token)).toBe(hashQrToken(token));
  });

  it('builds and verifies signed check-in passes', () => {
    const secret = 'test-secret';
    const pass = buildQrPassToken('HS-ABCD1234', secret);
    expect(parseQrPassToken(pass, secret)).toBe('HS-ABCD1234');
    expect(parseQrPassToken(`${pass}x`, secret)).toBeNull();
    expect(parseQrPassToken(pass, 'wrong')).toBeNull();
  });
});
