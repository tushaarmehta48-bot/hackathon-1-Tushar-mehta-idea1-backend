# Supabase (backend)

SQL migrations, seed data, and RLS checks for the Cider House booking database.

## Easiest setup (recommended)

You only need your **database password** once (the one you chose when creating the Supabase project—not the anon or service_role JWT keys).

1. In [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Project Settings** → **Database**.
2. Under **Connection string**, pick **URI** (Session pooler is fine).
3. Copy the URI and replace `[YOUR-PASSWORD]` with your real database password.
4. Add to `backend/.env.local`:

   ```env
   DATABASE_URL=postgresql://postgres.xxxxx:YOUR_PASSWORD@....pooler.supabase.com:6543/postgres
   ```

   Keep your existing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as they are.

5. From the `backend` folder:

   ```bash
   npm install
   npm run db:apply
   ```

6. In the dashboard, open **Table Editor** → schema **`public`**. You should see `booking_policies`, `restaurant_tables`, `reservations`, etc., with sample rows from the seed.

For **admin news/blog** (`blog_posts` table and `blog-media` storage bucket), also apply `migrations/20251027170000_blog_posts.sql` via `db:apply` or the SQL Editor.

For **staff QR check-in (one scan per guest)**, apply `migrations/20251027180000_checked_in_guest_count.sql` in the SQL Editor:

```sql
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS checked_in_guest_count integer NOT NULL DEFAULT 0;
```

Without this column, check-in still works in **legacy mode** (one scan marks the whole party checked in).

If `npm run db:apply` fails, read the error text—it usually means a wrong password or a typo in `DATABASE_URL`.

## Alternative: SQL Editor (one paste)

If you cannot use `DATABASE_URL`, run SQL in the dashboard:

1. Open the **file in your editor** (e.g. `supabase/migrations/20251027140000_portal_profile_bootstrap.sql`).
2. Select **all SQL inside the file** (from `--` or `CREATE` through the last line). **Do not paste the file path** — Supabase only accepts SQL text.
3. Supabase → **SQL** → New query → paste → **Run**.

For a full fresh schema, generate and paste `full-bootstrap.sql`:

   ```bash
   cd backend
   node scripts/build-full-bootstrap.mjs
   ```

   Then copy the **contents** of `backend/supabase/full-bootstrap.sql` into the SQL editor.

## Alternative: Supabase CLI

```bash
cd backend
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
# then run seed.sql in SQL editor, or: supabase db seed
```

## Checks

```bash
cd backend
npm run test:db          # static migration tests (always)
npm run test:db:live     # overlap test (needs migrations applied)
```

## Migration order

| File | Purpose |
|------|---------|
| `20251026120000_extensions_and_enums.sql` | Extensions, enums, capacity helper |
| `20251026120001_profiles_and_venue.sql` | Profiles, venue, schedules, policies |
| `20251026120002_reservations_and_ops.sql` | Reservations, overlap constraint, ops tables |
| `20251026120003_auth_helpers_and_triggers.sql` | Auth signup profile, role guards |
| `20251026120004_row_level_security.sql` | RLS policies |
| `20251026120005_service_role_profile_bootstrap.sql` | Backend portal user profile bootstrap |
| `20251027120000_deposit_hold_minutes.sql` | Deposit hold window (Phase 8) |
| `20251027130000_iturrieta_public_hours.sql` | Thu–Sun lunch 13:00–16:00, year-end closures |
| `20251027140000_portal_profile_bootstrap.sql` | Portal admin/staff profile RPC |
| `20251027150000_restaurant_table_tier.sql` | Table tier (Standard / Premium / Group) for floor plan |
| `20251027160000_disable_deposit_until_payments.sql` | Turn off `deposit_required` until a gateway is enabled |

## Why the dashboard looked empty

Running `npm run dev` for Next.js/NestJS **does not** create tables. Until migrations (and seed) run against **your** project, Table Editor will not show `booking_policies`, `reservations`, etc.

## Customer sign-in

Guests use **email and password** on `/login`. **Create account** calls `POST /api/v1/auth/customer/sign-up` (service role, email pre-confirmed), then signs in. New users get a **CUSTOMER** profile via `syncProfileFromAuth`.

## Security notes

- **Service role** bypasses RLS — use only in NestJS, never in the browser.
- Do not commit `DATABASE_URL` or service role keys to git.
