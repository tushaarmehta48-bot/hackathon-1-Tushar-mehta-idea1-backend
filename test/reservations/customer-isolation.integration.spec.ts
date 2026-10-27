import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apiBase = process.env.API_BASE_URL ?? 'http://localhost:3001/api/v1';

const describeIf = url && serviceKey ? describe : describe.skip;

async function createCustomer(emailPrefix: string) {
  const admin = createClient(url!, serviceKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = `${emailPrefix}-${Date.now()}@example.com`;
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
  return { admin, token: token!, userId: created.data.user!.id };
}

describeIf('Reservation customer isolation (integration)', () => {
  it('customer B cannot read customer A reservation', async () => {
    const tableId = 'b1000000-0000-4000-8000-000000000003';
    const reference = `ISO-${Date.now().toString(36)}`;
    const admin = createClient(url!, serviceKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const insert = await admin
      .from('reservations')
      .insert({
        reference,
        table_id: tableId,
        starts_at: '2026-09-12T17:00:00.000Z',
        ends_at: '2026-09-12T19:00:00.000Z',
        party_size: 2,
        status: 'CONFIRMED',
        source: 'WEB',
      })
      .select('id')
      .single();
    expect(insert.error).toBeNull();
    const reservationId = insert.data?.id as string | undefined;
    expect(reservationId).toBeTruthy();

    const customerA = await createCustomer('cust-a');
    const customerB = await createCustomer('cust-b');

    await admin
      .from('reservations')
      .update({ customer_id: customerA.userId })
      .eq('id', reservationId!);

    const forbidden = await fetch(`${apiBase}/reservations/${reservationId}`, {
      headers: { Authorization: `Bearer ${customerB.token}` },
    });
    expect(forbidden.status).toBe(403);

    const allowed = await fetch(`${apiBase}/reservations/${reservationId}`, {
      headers: { Authorization: `Bearer ${customerA.token}` },
    });
    expect(allowed.status).toBe(200);

    await admin.from('reservations').delete().eq('id', reservationId!);
    await customerA.admin.auth.admin.deleteUser(customerA.userId);
    await customerB.admin.auth.admin.deleteUser(customerB.userId);
  });
});
