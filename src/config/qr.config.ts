import { createHash } from 'node:crypto';
import { requireSupabaseEnv } from './env.schema.js';

export function getQrPassSecret(): string {
  const fromEnv = process.env.QR_PASS_SECRET?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  const { serviceRoleKey } = requireSupabaseEnv();
  return createHash('sha256').update(`qr-pass:${serviceRoleKey}`, 'utf8').digest('hex');
}
