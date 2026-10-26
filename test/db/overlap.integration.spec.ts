import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const describeIf = url && serviceKey ? describe : describe.skip;

describeIf("reservation overlap (integration)", () => {
  let supabase: SupabaseClient;
  const tableId = "b1000000-0000-4000-8000-000000000001";
  const references: string[] = [];

  beforeAll(() => {
    supabase = createClient(url!, serviceKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });

  afterAll(async () => {
    if (references.length === 0) {
      return;
    }
    await supabase.from("reservations").delete().in("reference", references);
  });

  it("rejects overlapping active reservations on the same table", async () => {
    const suffix = Date.now().toString(36);
    const refA = `IT-${suffix}-A`;
    const refB = `IT-${suffix}-B`;
    references.push(refA, refB);

    const window = {
      table_id: tableId,
      starts_at: "2026-08-10T17:00:00.000Z",
      ends_at: "2026-08-10T19:00:00.000Z",
      party_size: 2,
      status: "CONFIRMED" as const,
      source: "WEB" as const,
    };

    const first = await supabase.from("reservations").insert({
      reference: refA,
      ...window,
    });
    expect(first.error).toBeNull();

    const second = await supabase.from("reservations").insert({
      reference: refB,
      table_id: tableId,
      starts_at: "2026-08-10T18:00:00.000Z",
      ends_at: "2026-08-10T20:00:00.000Z",
      party_size: 2,
      status: "CONFIRMED",
      source: "WEB",
    });

    expect(second.error).not.toBeNull();
    expect(second.error?.message.toLowerCase()).toMatch(/exclude|overlap|conflict/);
  });
});
