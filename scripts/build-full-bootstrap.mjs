/** Writes supabase/full-bootstrap.sql (all migrations + seed) for one-shot SQL Editor runs. */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "supabase");
const migrations = readdirSync(path.join(root, "migrations"))
  .filter((f) => f.endsWith(".sql"))
  .sort();

const parts = [
  "-- AUTO-GENERATED: run once in Supabase SQL Editor. Prefer: npm run db:apply",
  "",
];
for (const file of migrations) {
  parts.push(`-- === ${file} ===`, readFileSync(path.join(root, "migrations", file), "utf8"), "");
}
parts.push("-- === seed.sql ===", readFileSync(path.join(root, "seed.sql"), "utf8"));

const out = path.join(root, "full-bootstrap.sql");
writeFileSync(out, parts.join("\n"), "utf8");
console.log("Wrote", out);
