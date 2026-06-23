-- ─────────────────────────────────────────────────────────────────────
-- Vayumukhi Dairy — initial schema
-- Paste this into Supabase Studio → SQL Editor → Run.
-- Or run via the Supabase CLI: `supabase db push`.
-- ─────────────────────────────────────────────────────────────────────

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ──────────── enums ────────────
create type role as enum ('owner', 'worker', 'read_only');
create type animal_type as enum ('cow', 'buffalo', 'calf');
create type animal_status as enum ('milking', 'dry', 'pregnant', 'calf', 'sold', 'deceased');
create type health_status as enum ('healthy', 'observation', 'treatment', 'quarantine', 'recovered');
create type shift as enum ('morning', 'evening');
create type reminder_priority as enum ('low', 'medium', 'high');
create type reminder_type as enum ('doctor', 'fodder', 'feed', 'vaccination', 'delivery', 'other');
create type whatsapp_status as enum ('queued', 'sent', 'delivered', 'read', 'failed');
create type agent_finding_severity as enum ('info', 'warning', 'critical');

-- ──────────── farms / profiles ────────────
create table farms (
  id uuid primary key default gen_random_uuid(),
  name varchar(120) not null,
  timezone varchar(64) not null default 'Asia/Kolkata',
  owner_whatsapp varchar(24),
  created_at timestamptz not null default now()
);

-- profiles mirrors auth.users 1:1 (id == auth.users.id)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  farm_id uuid not null references farms(id) on delete cascade,
  name varchar(120) not null,
  role role not null default 'worker',
  email varchar(254),
  image text,
  created_at timestamptz not null default now()
);
create index on profiles(farm_id);
create index on profiles(name);

-- ──────────── animals ────────────
create table animals (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references farms(id) on delete cascade,
  tag varchar(32) not null,
  name varchar(64) not null,
  type animal_type not null,
  status animal_status not null default 'milking',
  health health_status not null default 'healthy',
  dob date,
  photo_url text,
  notes text,
  created_at timestamptz not null default now(),
  unique(farm_id, tag)
);
create index on animals(farm_id, status);

create table animal_health_events (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references farms(id) on delete cascade,
  animal_id uuid not null references animals(id) on delete cascade,
  occurred_at timestamptz not null,
  kind varchar(64) not null,
  details text,
  vet_name varchar(120),
  medication varchar(120),
  withdrawal_until date,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index on animal_health_events(animal_id, occurred_at desc);
create index on animal_health_events(farm_id, occurred_at desc);

-- ──────────── milk production (append-only) ────────────
create table milk_sessions (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references farms(id) on delete cascade,
  session_date date not null,
  shift shift not null,
  animal_id uuid references animals(id),
  litres numeric(8, 2) not null,
  fat_pct real,
  snf_pct real,
  milker_id uuid references profiles(id),
  photo_url text,
  reverses_id uuid references milk_sessions(id),
  source varchar(24) not null default 'manual',
  created_at timestamptz not null default now()
);
create index on milk_sessions(farm_id, session_date desc);
create index on milk_sessions(animal_id, session_date desc);

-- ──────────── customers / products / sales ────────────
create table customers (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references farms(id) on delete cascade,
  name varchar(120) not null,
  phone varchar(24),
  whatsapp varchar(24),
  address text,
  route varchar(64),
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on customers(farm_id, is_active);

create table products (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references farms(id) on delete cascade,
  slug varchar(64) not null,
  name varchar(120) not null,
  unit varchar(16) not null,
  price_minor int not null,
  is_active boolean not null default true,
  unique(farm_id, slug)
);

create table sales (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references farms(id) on delete cascade,
  customer_id uuid references customers(id),
  product_id uuid references products(id),
  occurred_at timestamptz not null,
  qty numeric(10, 2) not null,
  amount_minor int not null,
  reverses_id uuid references sales(id),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index on sales(farm_id, occurred_at desc);
create index on sales(customer_id, occurred_at desc);

-- ──────────── expenses ────────────
create table expenses (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references farms(id) on delete cascade,
  occurred_at timestamptz not null,
  category varchar(64) not null,
  description text,
  amount_minor int not null,
  receipt_url text,
  reverses_id uuid references expenses(id),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index on expenses(farm_id, occurred_at desc);

-- ──────────── reminders / notifications ────────────
create table reminders (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references farms(id) on delete cascade,
  due_at timestamptz not null,
  type reminder_type not null,
  title varchar(200) not null,
  owner_label varchar(120),
  priority reminder_priority not null default 'medium',
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index on reminders(farm_id, due_at);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title varchar(200) not null,
  body text not null,
  tone varchar(16) not null default 'info',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on notifications(user_id, read_at);

-- ──────────── WhatsApp outbox ────────────
create table whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references farms(id) on delete cascade,
  to_number varchar(24) not null,
  template varchar(64),
  body text not null,
  payload jsonb,
  status whatsapp_status not null default 'queued',
  provider_message_id varchar(128),
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failed_reason text,
  created_at timestamptz not null default now()
);
create index on whatsapp_messages(status);
create index on whatsapp_messages(provider_message_id);

-- ──────────── agent runs / findings ────────────
create table agent_runs (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references farms(id) on delete cascade,
  kind varchar(64) not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  model varchar(64),
  input_tokens int,
  output_tokens int,
  cost_usd numeric(10, 6),
  error text
);
create index on agent_runs(farm_id, started_at desc);

create table agent_findings (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references agent_runs(id) on delete cascade,
  farm_id uuid not null references farms(id) on delete cascade,
  severity agent_finding_severity not null default 'info',
  title varchar(200) not null,
  detail text not null,
  suggested_action text,
  related_entity varchar(64),
  related_entity_id uuid,
  confidence real,
  dismissed boolean not null default false,
  created_at timestamptz not null default now()
);
create index on agent_findings(farm_id, created_at desc);

-- ──────────── audit log ────────────
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid references farms(id) on delete set null,
  user_id uuid references profiles(id) on delete set null,
  action varchar(64) not null,
  entity varchar(64) not null,
  entity_id uuid,
  diff jsonb,
  ip varchar(64),
  user_agent text,
  created_at timestamptz not null default now()
);
create index on audit_log(farm_id, created_at desc);

-- ──────────── scan / voice ────────────
create table scan_events (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references farms(id) on delete cascade,
  user_id uuid references profiles(id),
  image_url text not null,
  ocr_text text,
  parsed jsonb,
  confidence real,
  applied_session_id uuid references milk_sessions(id),
  created_at timestamptz not null default now()
);

create table voice_entries (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references farms(id) on delete cascade,
  user_id uuid references profiles(id),
  audio_url text not null,
  language varchar(16),
  transcript text,
  parsed jsonb,
  confidence real,
  applied_session_id uuid references milk_sessions(id),
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────
-- profile auto-creation trigger
-- When a user signs up via Supabase Auth, we materialise a profile row.
-- The auth signup flow MUST set raw_user_meta_data.farm_id + name + role.
-- For workers, role='worker' and email is synthetic (e.g. ravi@vmd.local).
-- For owners, role='owner' and email is real.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_farm_id uuid;
  resolved_farm_id uuid;
  resolved_role role;
  resolved_name varchar(120);
begin
  -- pick farm: explicit in metadata, else the lone farm if exactly one exists
  resolved_farm_id := (new.raw_user_meta_data->>'farm_id')::uuid;
  if resolved_farm_id is null then
    select id into default_farm_id from public.farms limit 2;
    if (select count(*) from public.farms) = 1 then
      resolved_farm_id := default_farm_id;
    end if;
  end if;

  resolved_role := coalesce((new.raw_user_meta_data->>'role')::role, 'worker');
  resolved_name := coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));

  if resolved_farm_id is not null then
    insert into public.profiles (id, farm_id, name, role, email)
    values (new.id, resolved_farm_id, resolved_name, resolved_role, new.email);
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────
-- Row Level Security
-- Pattern: a row is visible only if the caller's profile.farm_id matches.
-- Server-side service_role bypasses RLS automatically.
-- ─────────────────────────────────────────────────────────────────────
alter table farms             enable row level security;
alter table profiles          enable row level security;
alter table animals           enable row level security;
alter table animal_health_events enable row level security;
alter table milk_sessions     enable row level security;
alter table customers         enable row level security;
alter table products          enable row level security;
alter table sales             enable row level security;
alter table expenses          enable row level security;
alter table reminders         enable row level security;
alter table notifications     enable row level security;
alter table whatsapp_messages enable row level security;
alter table agent_runs        enable row level security;
alter table agent_findings    enable row level security;
alter table audit_log         enable row level security;
alter table scan_events       enable row level security;
alter table voice_entries     enable row level security;

create or replace function public.current_farm_id()
returns uuid
language sql
security definer
stable
as $$
  select farm_id from public.profiles where id = auth.uid();
$$;

create or replace function public.current_role()
returns role
language sql
security definer
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- profiles: a user can read their own profile + everyone on their farm
create policy "profiles_read_own_farm" on profiles
  for select using (farm_id = public.current_farm_id());

-- farms: read your own farm
create policy "farms_read_own" on farms
  for select using (id = public.current_farm_id());

-- generic farm-scoped read for the rest
do $$
declare
  t text;
begin
  foreach t in array array[
    'animals', 'animal_health_events', 'milk_sessions', 'customers',
    'products', 'sales', 'expenses', 'reminders', 'whatsapp_messages',
    'agent_runs', 'agent_findings', 'audit_log', 'scan_events', 'voice_entries'
  ]
  loop
    execute format(
      'create policy %I on %I for select using (farm_id = public.current_farm_id());',
      t || '_read_own_farm', t
    );
  end loop;
end$$;

-- writes: workers can insert milk_sessions / voice_entries / scan_events for their farm;
-- owners can insert anywhere on their farm.
create policy "milk_sessions_insert_own_farm" on milk_sessions
  for insert with check (farm_id = public.current_farm_id());

create policy "voice_entries_insert_own_farm" on voice_entries
  for insert with check (farm_id = public.current_farm_id());

create policy "scan_events_insert_own_farm" on scan_events
  for insert with check (farm_id = public.current_farm_id());

-- owner-only writes everywhere else
do $$
declare
  t text;
begin
  foreach t in array array[
    'animals', 'animal_health_events', 'customers', 'products',
    'sales', 'expenses', 'reminders'
  ]
  loop
    execute format(
      $f$create policy %I on %I for insert with check (
        farm_id = public.current_farm_id()
        and public.current_role() = 'owner'
      );$f$,
      t || '_insert_owner', t
    );
    execute format(
      $f$create policy %I on %I for update using (
        farm_id = public.current_farm_id()
        and public.current_role() = 'owner'
      );$f$,
      t || '_update_owner', t
    );
  end loop;
end$$;

-- ─────────────────────────────────────────────────────────────────────
-- Storage buckets
-- ─────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false), ('voice', 'voice', false)
on conflict (id) do nothing;

create policy "photos_read_own_farm" on storage.objects for select
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = public.current_farm_id()::text);

create policy "photos_write_own_farm" on storage.objects for insert
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = public.current_farm_id()::text);

create policy "voice_read_own_farm" on storage.objects for select
  using (bucket_id = 'voice' and (storage.foldername(name))[1] = public.current_farm_id()::text);

create policy "voice_write_own_farm" on storage.objects for insert
  with check (bucket_id = 'voice' and (storage.foldername(name))[1] = public.current_farm_id()::text);
