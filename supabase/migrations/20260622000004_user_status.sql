-- ─────────────────────────────────────────────────────────────────────
-- Vayumukhi Dairy — migration 0004: user lifecycle status + owner management
-- Supports invite-only user creation and account enable/disable.
-- Idempotent. Paste into Supabase Studio → SQL Editor → Run.
-- ─────────────────────────────────────────────────────────────────────

-- account lifecycle: 'invited' (link sent, not onboarded) | 'active' | 'disabled'
alter table profiles
  add column if not exists status text not null default 'active';

create index if not exists profiles_status_idx on profiles(farm_id, status);

-- An owner may update role / status for members of their own farm.
-- (Admin actions also run via the service client, which bypasses RLS; this policy
--  is defense-in-depth and lets owner-scoped updates work through the user client.)
drop policy if exists "profiles_update_owner" on profiles;
create policy "profiles_update_owner" on profiles
  for update using (
    farm_id = public.current_farm_id() and public.current_role() = 'owner'
  );

-- New users created via invite/admin start as 'invited'; the handle_new_user trigger
-- sets the default ('active'). The onboarding flow flips them to 'active' on completion.
