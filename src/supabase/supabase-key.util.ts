/** Decodes the `role` claim from a Supabase JWT (anon, authenticated, or service_role). */
export function decodeSupabaseJwtRole(jwt: string): string | null {
  const parts = jwt.trim().split('.');
  if (parts.length < 2) {
    return null;
  }
  try {
    const payloadJson = Buffer.from(parts[1]!, 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson) as { role?: unknown };
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

export function assertSupabaseServiceRoleKey(key: string): void {
  const role = decodeSupabaseJwtRole(key);
  if (role === 'service_role') {
    return;
  }
  const hint =
    role === 'anon'
      ? 'You pasted the anon (public) key — that key cannot insert bookings.'
      : `Expected role "service_role"${role ? ` but this JWT has role "${role}"` : ''}.`;
  throw new Error(
    `SUPABASE_SERVICE_ROLE_KEY is invalid for the API. ${hint} Copy the service_role secret from Supabase Dashboard → Project Settings → API → service_role (backend/.env.local only).`,
  );
}
