# Supabase (backend)

SQL migrations, seed data, and RLS checks for the Cider House booking database.

## Apply to a dev project

1. Create a **development** project at [supabase.com](https://supabase.com).
2. Copy credentials into `backend/.env` (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
3. Either use the **Supabase CLI** (recommended):

   ```bash
   cd backend
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase db push
   supabase db seed   # or run seed.sql in SQL editor
   ```

   Or paste migration files in order from `migrations/` into the SQL editor (Dashboard → SQL).

4. Run checks:

   ```bash
   cd backend
   npm run test:db          # static migration tests (always)
   npm run test:db:live     # overlap test (needs .env Supabase vars + migrations applied)
   ```

5. Optional manual RLS steps: `tests/manual_rls_checklist.sql`

Runtime Supabase clients for NestJS will live in `src/supabase/` starting **Phase 4**.

## Migration order

| File | Purpose |
|------|---------|
| `20251026120000_extensions_and_enums.sql` | Extensions, enums, capacity helper |
| `20251026120001_profiles_and_venue.sql` | Profiles, venue, schedules, policies |
| `20251026120002_reservations_and_ops.sql` | Reservations, overlap constraint, ops tables |
| `20251026120003_auth_helpers_and_triggers.sql` | Auth signup profile, role guards |
| `20251026120004_row_level_security.sql` | RLS policies |

## Security notes

- **Service role** bypasses RLS — use only in NestJS, never in the browser.
- Customers must not insert/update reservations via PostgREST; the API uses the service role in later phases.
- New auth users get `CUSTOMER` only; privileged roles require an admin.
