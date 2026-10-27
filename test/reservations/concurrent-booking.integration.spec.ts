import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apiBase = process.env.API_BASE_URL ?? 'http://localhost:3001/api/v1';

const describeIf = url && serviceKey ? describe : describe.skip;

describeIf('Concurrent booking (integration)', () => {
  it('second create for the same table and slot returns 409', async () => {
    const admin = createClient(url!, serviceKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const email = `concurrent-${Date.now()}@example.com`;
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

    const availability = await fetch(
      `${apiBase}/availability?date=2026-02-06&partySize=4&shiftId=c1000000-0000-4000-8000-000000000011`,
    );
    expect(availability.status).toBe(200);
    const availabilityBody = (await availability.json()) as {
      shifts: { slots: { startsAt: string }[] }[];
    };
    const slotStartsAt = availabilityBody.shifts[0]?.slots[0]?.startsAt;
    expect(slotStartsAt).toBeTruthy();

    const floorPlan = await fetch(
      `${apiBase}/floor-plan?date=2026-02-06&partySize=4&shiftId=c1000000-0000-4000-8000-000000000011&slotStartsAt=${encodeURIComponent(slotStartsAt)}`,
    );
    expect(floorPlan.status).toBe(200);
    const floorBody = (await floorPlan.json()) as {
      tables: { id: string; availabilityState: string }[];
    };
    const tableId = floorBody.tables.find((table) => table.availabilityState === 'available')?.id;
    expect(tableId).toBeTruthy();

    const payload = {
      date: '2026-02-06',
      shiftId: 'c1000000-0000-4000-8000-000000000011',
      slotStartsAt,
      tableId,
      partySize: 4,
      acceptedTerms: true,
    };

    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const [first, second] = await Promise.all([
      fetch(`${apiBase}/reservations`, { method: 'POST', headers, body: JSON.stringify(payload) }),
      fetch(`${apiBase}/reservations`, { method: 'POST', headers, body: JSON.stringify(payload) }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);

    const success = first.status === 200 ? first : second;
    const body = (await success.json()) as { id: string };
    if (body.id) {
      await admin.from('reservations').delete().eq('id', body.id);
    }

    if (created.data.user?.id) {
      await admin.auth.admin.deleteUser(created.data.user.id);
    }
  });
});
