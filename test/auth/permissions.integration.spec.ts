import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apiBase = process.env.API_BASE_URL ?? 'http://localhost:3001/api/v1';

const describeIf = url && serviceKey ? describe : describe.skip;

describeIf('Auth permissions (integration)', () => {
  it('customer token cannot access admin session endpoint', async () => {
    const admin = createClient(url!, serviceKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const email = `customer-${Date.now()}@example.com`;
    const password = 'TestPass123!';

    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    expect(created.error).toBeNull();

    const signedIn = await admin.auth.signInWithPassword({ email, password });
    const token = signedIn.data.session?.access_token;
    expect(token).toBeTruthy();

    for (const path of ['/admin/session', '/admin/venue']) {
      const response = await fetch(`${apiBase}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response.status).toBe(403);
    }

    if (created.data.user?.id) {
      await admin.auth.admin.deleteUser(created.data.user.id);
    }
  });
});
