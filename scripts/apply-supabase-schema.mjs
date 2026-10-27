/**
 * Applies all SQL migrations + seed to your Supabase Postgres database.
 *
 * Requires DATABASE_URL in backend/.env.local (direct Postgres, not REST URL).
 *
 * Get it: Supabase Dashboard → Project Settings → Database → Connection string → URI
 * (use the database password you set when creating the project; Session pooler is fine)
 *
 * Run from backend/:  npm run db:apply
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { loadBackendEnv } from "./load-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirname, "..");
const supabaseRoot = path.join(backendRoot, "supabase");

loadBackendEnv(backendRoot);

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error(`
Missing DATABASE_URL in backend/.env.local

1. Open https://supabase.com/dashboard → your project
2. Project Settings (gear) → Database
3. Under "Connection string", choose URI
4. Copy the string and replace [YOUR-PASSWORD] with your database password
5. Add to backend/.env.local:

   DATABASE_URL=postgresql://postgres.xxxx:YOUR_PASSWORD@aws-0-eu-central-1.pooler.supabase.com:6543/postgres

Then run again:  npm run db:apply
`);
  process.exit(1);
}

function readSql(relativePath) {
  return readFileSync(path.join(supabaseRoot, relativePath), "utf8");
}

const migrationFiles = readdirSync(path.join(supabaseRoot, "migrations"))
  .filter((name) => name.endsWith(".sql"))
  .sort();

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  console.log("Connecting to Supabase Postgres…");
  await client.connect();

  for (const file of migrationFiles) {
    const sql = readSql(path.join("migrations", file));
    process.stdout.write(`  → ${file} … `);
    try {
      await client.query(sql);
      console.log("ok");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/already exists|duplicate key/i.test(message)) {
        console.log("skipped (already applied)");
      } else {
        console.log("FAILED");
        throw error;
      }
    }
  }

  process.stdout.write("  → seed.sql … ");
  try {
    await client.query(readSql("seed.sql"));
    console.log("ok");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/duplicate key|unique constraint/i.test(message)) {
      console.log("skipped (seed already present)");
    } else {
      console.log("FAILED");
      throw error;
    }
  }

  const { rows } = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name`,
  );
  console.log("\nPublic tables now:", rows.map((r) => r.table_name).join(", "));

  const { rows: policies } = await client.query(
    "SELECT count(*)::int AS n FROM public.booking_policies",
  );
  console.log(`booking_policies rows: ${policies[0]?.n ?? 0}`);
}

run()
  .then(() => {
    console.log("\nDone. Refresh Supabase Table Editor (schema: public).");
  })
  .catch((error) => {
    console.error("\nError:", error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => client.end());
