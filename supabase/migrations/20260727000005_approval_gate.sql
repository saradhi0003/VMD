-- ─────────────────────────────────────────────────────────────────────
-- Vayumukhi Dairy — migration 0005: admin approval gate
--
-- Ports FinTracker's approval gate (skills/mfa-totp/references/approval-gate.md)
-- onto VMD's *farm-scoped* RLS model.
--
-- The load-bearing idea: UI gates are UX, the real lock is in the database.
-- After this migration every data policy reads
--     farm_id = current_farm_id()  AND  is_approved()
-- so an authenticated-but-unapproved user reads ZERO rows — even via a raw curl
-- to the PostgREST API with a valid token.
--
-- RECONCILED, NOT COPIED — differences from FinTracker's 0004:
--   • FinTracker scopes rows by `user_id = auth.uid()`; VMD scopes by farm.
--     The approval predicate is ANDed onto the existing farm check.
--   • FinTracker's status enum is pending/approved/blocked. VMD already ships
--     invited/active/disabled (migration 0004) and the app reads those values,
--     so we ADD 'pending' rather than renaming. `is_approved()` == status 'active'.
--   • VMD's role enum is owner/worker/read_only — untouched. Approval is an
--     added dimension, not a replacement for the role model.
--
-- SAFE ROLLOUT: every pre-existing user is backfilled to 'active'. Only brand-new
-- self-signups land as 'pending'. Nobody currently working gets locked out.
--
-- Idempotent. Paste into Supabase Studio → SQL Editor → Run.
-- ─────────────────────────────────────────────────────────────────────

-- ---------------------------------------------------------------------------
-- 1. Status vocabulary: add 'pending' alongside the existing lifecycle values.
-- ---------------------------------------------------------------------------

alter table profiles drop constraint if exists profiles_status_check;
alter table profiles
  add constraint profiles_status_check
  check (status in ('pending', 'invited', 'active', 'disabled'));

-- Who to notify + when, so a failed notification can be retried (see Feature B).
alter table profiles add column if not exists approved_at  timestamptz;
alter table profiles add column if not exists notified_at  timestamptz;

-- Anyone already in the system keeps working. Only new signups are gated.
update profiles set status = 'active', approved_at = coalesce(approved_at, now())
where status not in ('pending', 'invited', 'active', 'disabled')
   or status is null;

update profiles set approved_at = coalesce(approved_at, created_at)
where status = 'active' and approved_at is null;

-- ---------------------------------------------------------------------------
-- 2. Predicates. SECURITY DEFINER so they read `profiles` without triggering
--    the caller's RLS (and without recursive policy evaluation).
-- ---------------------------------------------------------------------------

create or replace function public.is_approved()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'active'
  );
$$;

-- VMD has no global "admin" — the farm owner is the approver.
create or replace function public.is_farm_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'active' and role = 'owner'
  );
$$;

grant execute on function public.is_approved()    to authenticated;
grant execute on function public.is_farm_owner()  to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Signup trigger: self-signups land 'pending'. Invited users and workers
--    (created by an owner with explicit metadata) keep the existing behaviour.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_farm_id  uuid;
  resolved_farm_id uuid;
  resolved_role    role;
  resolved_name    varchar(120);
  resolved_status  text;
begin
  resolved_farm_id := (new.raw_user_meta_data->>'farm_id')::uuid;
  if resolved_farm_id is null then
    select id into default_farm_id from public.farms limit 2;
    if (select count(*) from public.farms) = 1 then
      resolved_farm_id := default_farm_id;
    end if;
  end if;

  resolved_role := coalesce((new.raw_user_meta_data->>'role')::role, 'worker');
  resolved_name := coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));

  -- An owner-provisioned account carries farm_id in its metadata and is
  -- pre-vetted → active. A cold self-signup has no metadata → pending.
  -- The bootstrap admin is always approved so you can never lock yourself out.
  resolved_status := case
    when lower(coalesce(new.email, '')) = 'saradhi.0003@gmail.com' then 'active'
    when new.raw_user_meta_data->>'farm_id' is not null then 'active'
    else 'pending'
  end;

  if resolved_farm_id is not null then
    insert into public.profiles (id, farm_id, name, role, email, status, approved_at)
    values (
      new.id, resolved_farm_id, resolved_name, resolved_role, new.email,
      resolved_status,
      case when resolved_status = 'active' then now() else null end
    )
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 4. Profiles policies. A pending user MUST still be able to read their own row
--    — otherwise the app can't tell them why they're locked out.
-- ---------------------------------------------------------------------------

drop policy if exists "profiles_self_read" on profiles;
create policy "profiles_self_read" on profiles
  for select using (id = auth.uid());

-- Farm-mates are visible to approved members only.
drop policy if exists "profiles_read_own_farm" on profiles;
create policy "profiles_read_own_farm" on profiles
  for select using (
    farm_id = public.current_farm_id() and public.is_approved()
  );

drop policy if exists "profiles_update_owner" on profiles;
create policy "profiles_update_owner" on profiles
  for update using (
    farm_id = public.current_farm_id() and public.is_farm_owner()
  );

-- ---------------------------------------------------------------------------
-- 5. THE GATE: recompile every data policy as farm-scope AND approval.
--    This is the part that makes approval a security control rather than a
--    suggestion. Mirrors the policy names created in migration 0001.
-- ---------------------------------------------------------------------------

-- 5a. farm-scoped reads.
--     NOTE: `notifications` is deliberately absent — it is keyed on user_id, not
--     farm_id, and is handled separately in 5e.
do $$
declare t text;
begin
  foreach t in array array[
    'animals', 'animal_health_events', 'milk_sessions', 'customers',
    'products', 'sales', 'expenses', 'reminders', 'whatsapp_messages',
    'agent_runs', 'agent_findings', 'audit_log', 'scan_events', 'voice_entries',
    'activity_logs'
  ]
  loop
    execute format('drop policy if exists %I on %I;', t || '_read_own_farm', t);
    execute format(
      'create policy %I on %I for select using (
         farm_id = public.current_farm_id() and public.is_approved()
       );',
      t || '_read_own_farm', t
    );
  end loop;
end$$;

-- 5b. worker-writable tables
do $$
declare t text;
begin
  foreach t in array array['milk_sessions', 'voice_entries', 'scan_events', 'activity_logs']
  loop
    execute format('drop policy if exists %I on %I;', t || '_insert_own_farm', t);
    execute format(
      'create policy %I on %I for insert with check (
         farm_id = public.current_farm_id() and public.is_approved()
       );',
      t || '_insert_own_farm', t
    );
  end loop;
end$$;

-- 5c. owner-only writes
do $$
declare t text;
begin
  foreach t in array array[
    'animals', 'animal_health_events', 'customers', 'products',
    'sales', 'expenses', 'reminders'
  ]
  loop
    execute format('drop policy if exists %I on %I;', t || '_insert_owner', t);
    execute format(
      'create policy %I on %I for insert with check (
         farm_id = public.current_farm_id()
         and public.current_role() = ''owner''
         and public.is_approved()
       );',
      t || '_insert_owner', t
    );

    execute format('drop policy if exists %I on %I;', t || '_update_owner', t);
    execute format(
      'create policy %I on %I for update using (
         farm_id = public.current_farm_id()
         and public.current_role() = ''owner''
         and public.is_approved()
       );',
      t || '_update_owner', t
    );
  end loop;
end$$;

-- 5d. farms
drop policy if exists "farms_read_own" on farms;
create policy "farms_read_own" on farms
  for select using (id = public.current_farm_id() and public.is_approved());

-- 5e. notifications — user-scoped, not farm-scoped.
--     Migration 0001 enabled RLS on this table but never added a policy, which
--     means it currently denies everything (RLS default-deny). Give it the
--     correct owner-of-the-row policy while we're compiling the gate.
drop policy if exists "notifications_read_own" on notifications;
create policy "notifications_read_own" on notifications
  for select using (user_id = auth.uid() and public.is_approved());

drop policy if exists "notifications_update_own" on notifications;
create policy "notifications_update_own" on notifications
  for update using (user_id = auth.uid() and public.is_approved());

-- ---------------------------------------------------------------------------
-- 6. Storage: uploads land in a per-farm folder no unapproved user can touch.
-- ---------------------------------------------------------------------------

do $$
declare b text;
begin
  foreach b in array array['photos', 'voice']
  loop
    execute format('drop policy if exists %I on storage.objects;', b || '_read_own_farm');
    execute format(
      'create policy %I on storage.objects for select using (
         bucket_id = %L
         and (storage.foldername(name))[1] = public.current_farm_id()::text
         and public.is_approved()
       );', b || '_read_own_farm', b
    );

    execute format('drop policy if exists %I on storage.objects;', b || '_write_own_farm');
    execute format(
      'create policy %I on storage.objects for insert with check (
         bucket_id = %L
         and (storage.foldername(name))[1] = public.current_farm_id()::text
         and public.is_approved()
       );', b || '_write_own_farm', b
    );
  end loop;
end$$;

-- ---------------------------------------------------------------------------
-- 7. Access requests the owner has not yet actioned (drives the admin panel
--    and the "someone requested access" notification).
-- ---------------------------------------------------------------------------

create index if not exists profiles_pending_idx
  on profiles (farm_id, status) where status = 'pending';
