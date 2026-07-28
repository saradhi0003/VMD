# Data model

Supabase Postgres, multi-tenant by `farm_id`, **RLS on every table**. Schema in `supabase/migrations/`.
Types are hand-rolled in `packages/supabase/src/types.ts` (must satisfy supabase-js `GenericSchema`).

## Migrations (apply in Studio SQL editor, in order)
1. `…_000001_init.sql` — base schema, enums, RLS, `handle_new_user` trigger, storage buckets.
2. `…_000002_seed.sql` — the farm + base animals/products.
3. `…_000003_fixes_worker_logs_realtime.sql` — `animal_health_events.farm_id` + worker insert; `audit_log`
   insert lockdown; `activity_logs` table; dismiss-finding + complete-reminder update policies;
   `voice_entries.audio_url` nullable; **realtime publication** for the live tables.
4. `…_000004_user_status.sql` — `profiles.status` lifecycle + owner-scoped update policy.
5. `…_000005_approval_gate.sql` — **the approval gate**: `is_approved()` / `is_farm_owner()` predicates,
   `pending` status, `approved_at`/`notified_at`, a rewritten `handle_new_user`, and a recompile of
   **every** data + storage policy to include `is_approved()`. Backfills all pre-existing users to
   `active` so nobody is locked out. Also gives `notifications` the user-scoped policy it never had.

I can't run DDL with the API keys — only the **Auth Admin API + PostgREST** (used to create demo users and
seed data). DDL must go through Studio or `supabase db push`.

## Tables
`farms · profiles · animals · animal_health_events · milk_sessions · customers · products · sales ·
expenses · reminders · notifications · whatsapp_messages · agent_runs · agent_findings · audit_log ·
scan_events · voice_entries · activity_logs`

Enums: `role · animal_type · animal_status · health_status · shift · reminder_priority · reminder_type ·
whatsapp_status · agent_finding_severity`.

Append-only ledgers: `milk_sessions`, `sales`, `expenses` (corrections via a reversing row, `reverses_id`).

## RLS model
- Helpers `current_farm_id()` / `current_role()` / **`is_approved()`** / **`is_farm_owner()`**
  (SECURITY DEFINER — definer avoids RLS recursion) read the caller's profile.
- Read: `farm_id = current_farm_id() and is_approved()` on all farm tables. **Both halves matter**: an
  authenticated user whose `status` isn't `active` reads zero rows even via raw PostgREST.
- `profiles` is the deliberate exception — a pending user can always read *their own* row, otherwise
  the app can't tell them why they're locked out.
- Writes: books (sales/expenses/customers/products/reminders/animals) are **owner-only**; any farm member
  (incl. workers) can insert `milk_sessions`, `animal_health_events`, `activity_logs`, `voice_entries`,
  `scan_events`, complete reminders, and owners can dismiss findings.
- `audit_log` insert is **service-role only**. `notifications` are **user-scoped**; migration 0005 gave
  them the `user_id = auth.uid() and is_approved()` policy they'd been missing (before that, RLS was on
  with no policy at all → default-deny, so they had to be read via the service client).
- Service role bypasses RLS (jobs/webhooks/audit) — which is exactly why `apps/web/src/lib/guard.ts`
  exists: any service-role path must re-verify the JWT and re-check approval itself. See
  [backend.md](backend.md#approval-gate-migration-0005).

## Demo data
Seeded via the service key (PostgREST): ~34 animals, ~14 customers, hundreds of sales, expenses,
reminders, notifications, an `agent_run` + findings, activity logs. To reseed, run a Node script that
POSTs to `/rest/v1/<table>` with the secret key (see git history for the inline seed).
