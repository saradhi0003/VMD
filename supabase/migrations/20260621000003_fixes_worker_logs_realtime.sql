-- ─────────────────────────────────────────────────────────────────────
-- Vayumukhi Dairy — corrective migration 0003
-- 1. animal_health_events.farm_id (repairs broken RLS in 0001) + worker insert
-- 2. audit_log: block direct user inserts (audit is written via service role)
-- 3. activity_logs table (backs worker Log feed / Wash done)
-- 4. Enable Supabase Realtime on the live tables
--
-- Fully idempotent — safe to run whether or not 0001 applied cleanly.
-- Paste into Supabase Studio → SQL Editor → Run, or `supabase db push`.
-- ─────────────────────────────────────────────────────────────────────

-- ── 1. animal_health_events: farm scoping ────────────────────────────
alter table animal_health_events
  add column if not exists farm_id uuid references farms(id) on delete cascade;

-- backfill farm_id from the parent animal
update animal_health_events e
set farm_id = a.farm_id
from animals a
where e.animal_id = a.id and e.farm_id is null;

-- enforce NOT NULL once every row is populated
do $$
begin
  if not exists (select 1 from animal_health_events where farm_id is null) then
    alter table animal_health_events alter column farm_id set not null;
  end if;
end$$;

create index if not exists animal_health_events_farm_idx
  on animal_health_events(farm_id, occurred_at desc);

alter table animal_health_events enable row level security;

-- (re)create a correct farm-scoped read policy (0001's was broken)
drop policy if exists "animal_health_events_read_own_farm" on animal_health_events;
create policy "animal_health_events_read_own_farm" on animal_health_events
  for select using (farm_id = public.current_farm_id());

-- allow any farm member (incl. workers) to log a health event
drop policy if exists "animal_health_events_insert_own_farm" on animal_health_events;
create policy "animal_health_events_insert_own_farm" on animal_health_events
  for insert with check (farm_id = public.current_farm_id());

-- ── 2. audit_log: block direct user inserts (service role bypasses RLS) ──
alter table audit_log enable row level security;
drop policy if exists "audit_log_insert_blocked" on audit_log;
create policy "audit_log_insert_blocked" on audit_log
  for insert with check (false);

-- ── 3. activity_logs: feed / wash / misc quick worker logs ───────────
create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references farms(id) on delete cascade,
  user_id uuid references profiles(id),
  kind varchar(24) not null,            -- 'feed' | 'wash' | 'other'
  animal_id uuid references animals(id),
  note text,
  photo_url text,
  payload jsonb,
  created_at timestamptz not null default now()
);
create index if not exists activity_logs_farm_idx
  on activity_logs(farm_id, created_at desc);

alter table activity_logs enable row level security;

drop policy if exists "activity_logs_read_own_farm" on activity_logs;
create policy "activity_logs_read_own_farm" on activity_logs
  for select using (farm_id = public.current_farm_id());

drop policy if exists "activity_logs_insert_own_farm" on activity_logs;
create policy "activity_logs_insert_own_farm" on activity_logs
  for insert with check (farm_id = public.current_farm_id());

-- ── 3b. voice_entries: allow transcript-only entries (Web Speech API) ──
alter table voice_entries alter column audio_url drop not null;

-- ── 3c. update policies for new dashboard interactions ───────────────
-- owner can dismiss an AI finding within their farm
drop policy if exists "agent_findings_update_owner" on agent_findings;
create policy "agent_findings_update_owner" on agent_findings
  for update using (farm_id = public.current_farm_id() and public.current_role() = 'owner');

-- any farm member can update reminders (e.g. a worker marking one done)
drop policy if exists "reminders_update_own_farm" on reminders;
create policy "reminders_update_own_farm" on reminders
  for update using (farm_id = public.current_farm_id());

-- ── 4. Enable Supabase Realtime (RLS still applies to streamed rows) ──
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array[
      'milk_sessions', 'sales', 'expenses', 'reminders', 'agent_findings', 'activity_logs'
    ]
    loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end$$;
