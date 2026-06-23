# Data model

Supabase Postgres, multi-tenant by `farm_id`, **RLS on every table**. Schema in `supabase/migrations/`.
Types are hand-rolled in `packages/supabase/src/types.ts` (must satisfy supabase-js `GenericSchema`).

## Migrations (apply in Studio SQL editor, in order)
1. `…_000001_init.sql` — base schema, enums, RLS, `handle_new_user` trigger, storage buckets.
2. `…_000002_seed.sql` — the farm + base animals/products.
3. `…_000003_fixes_worker_logs_realtime.sql` — `animal_health_events.farm_id` + worker insert; `audit_log`
   insert lockdown; `activity_logs` table; dismiss-finding + complete-reminder update policies;
   `voice_entries.audio_url` nullable; **realtime publication** for the live tables.

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
- Helpers `current_farm_id()` / `current_role()` (SECURITY DEFINER) read the caller's profile.
- Read: `farm_id = current_farm_id()` on all farm tables.
- Writes: books (sales/expenses/customers/products/reminders/animals) are **owner-only**; any farm member
  (incl. workers) can insert `milk_sessions`, `animal_health_events`, `activity_logs`, `voice_entries`,
  `scan_events`, complete reminders, and owners can dismiss findings.
- `audit_log` insert is **service-role only**. `notifications` are **user-scoped** with no user RLS policy
  → read/write them via the **service client** filtered by `user_id`.
- Service role bypasses RLS (jobs/webhooks/audit).

## Demo data
Seeded via the service key (PostgREST): ~34 animals, ~14 customers, hundreds of sales, expenses,
reminders, notifications, an `agent_run` + findings, activity logs. To reseed, run a Node script that
POSTs to `/rest/v1/<table>` with the secret key (see git history for the inline seed).
