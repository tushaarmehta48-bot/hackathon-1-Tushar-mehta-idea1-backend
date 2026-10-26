import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = join(process.cwd(), "supabase", "migrations");

describe("supabase migrations (static)", () => {
  const files = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql"));

  it("includes ordered migration files", () => {
    expect(files.length).toBeGreaterThanOrEqual(5);
  });

  it("defines capacity-consuming overlap protection", () => {
    const sql = files
      .map((name) => readFileSync(join(migrationsDir, name), "utf8"))
      .join("\n");

    expect(sql).toContain("reservations_no_overlap_active");
    expect(sql).toContain("btree_gist");
    expect(sql).toContain("reservation_status_consumes_capacity");
  });

  it("enables RLS on sensitive tables", () => {
    const rlsSql = readFileSync(
      join(migrationsDir, "20251026120004_row_level_security.sql"),
      "utf8",
    );

    for (const table of [
      "profiles",
      "reservations",
      "payments",
      "audit_logs",
    ]) {
      expect(rlsSql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
    }
  });

  it("blocks privileged roles on public signup", () => {
    const sql = readFileSync(
      join(migrationsDir, "20251026120003_auth_helpers_and_triggers.sql"),
      "utf8",
    );
    expect(sql).toContain("Public signup cannot grant privileged roles");
  });
});
