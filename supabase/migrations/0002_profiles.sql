-- 0002_profiles.sql
-- Profiles table mirroring auth.users. Role + location + active flag live here.
-- A trigger on auth.users auto-inserts a profile row on signup.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext not null unique,
  full_name text not null default '',
  role user_role not null default 'staff',
  location_id uuid references public.locations(id),
  can_enter_expenses boolean not null default false,
  active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_location_chk
    check (role in ('owner','accountant') or location_id is not null)
);

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_location on public.profiles(location_id);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Audit profile mutations
drop trigger if exists trg_profiles_audit on public.profiles;
create trigger trg_profiles_audit
  after insert or update on public.profiles
  for each row execute function public.audit_row();

alter table public.profiles enable row level security;

-- ============================================================================
-- Auto-create a profile row whenever a user signs up.
-- New signups default to role=staff, active=true, location=null (unassigned).
-- The Owner claims their account via the bootstrap step (seeded below).
-- ============================================================================
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_full_name text;
  v_role user_role := 'staff';
begin
  v_full_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );

  -- Bootstrap: the very first user becomes the Owner.
  if not exists (select 1 from public.profiles) then
    v_role := 'owner';
  end if;

  insert into public.profiles (id, email, full_name, role)
    values (new.id, new.email, v_full_name, v_role)
  on conflict (id) do update
    set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists trg_auth_user_created on auth.users;
create trigger trg_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ============================================================================
-- Touch last_login_at when a user's email_confirmed / session refreshes.
-- Supabase fires `auth.users` updates on session events; we just bump a field.
-- ============================================================================
create or replace function public.handle_auth_user_updated()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.last_sign_in_at is distinct from old.last_sign_in_at then
    update public.profiles
       set last_login_at = new.last_sign_in_at
     where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_auth_user_updated on auth.users;
create trigger trg_auth_user_updated
  after update on auth.users
  for each row execute function public.handle_auth_user_updated();
