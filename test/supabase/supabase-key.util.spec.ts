import { describe, expect, it } from 'vitest';
import { assertSupabaseServiceRoleKey, decodeSupabaseJwtRole } from '../../src/supabase/supabase-key.util.js';

function fakeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }), 'utf8').toString(
    'base64url',
  );
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${header}.${body}.sig`;
}

describe('supabase-key.util', () => {
  it('reads role from JWT payload', () => {
    expect(decodeSupabaseJwtRole(fakeJwt({ role: 'service_role' }))).toBe('service_role');
    expect(decodeSupabaseJwtRole(fakeJwt({ role: 'anon' }))).toBe('anon');
  });

  it('accepts service_role keys', () => {
    expect(() => assertSupabaseServiceRoleKey(fakeJwt({ role: 'service_role' }))).not.toThrow();
  });

  it('rejects anon keys', () => {
    expect(() => assertSupabaseServiceRoleKey(fakeJwt({ role: 'anon' }))).toThrow(/service_role/);
  });
});
