-- 0016_profiles_signup_fix.sql
-- Two fixes to the profiles row shape:
--
-- 1. The CHECK from 0002 — `role in ('owner','accountant') or location_id is
--    not null` — rejected every non-owner signup, because the auth trigger
--    creates the profile with role='staff' and location_id=NULL (the owner
--    assigns location later). Symptom: Supabase returns "Database error
--    saving new user / unexpected_failure" on signup for every user after
--    the first. The fix is to admit the pending state (active=false), and
--    to admit 'portal_customer' (Phase 4) which is never tied to a shop.
--
-- 2. handle_new_auth_user() now creates non-bootstrap signups with
--    active=false, so the owner explicitly assigns a location and flips the
--    active flag before the new user can act. This matches the spec's "owner
--    approves new accounts" intent and keeps the CHECK happy.

alter table public.profiles
  drop constraint if exists profiles_role_location_chk;

alter table public.profiles
  add constraint profiles_role_location_chk
  check (
    role::text in ('owner', 'accountant', 'portal_customer')
    or location_id is not null
    or active = false
  );

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_full_name text;
  v_role user_role := 'staff';
  v_active boolean := false;
  v_bootstrap boolean := false;
begin
  v_full_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );

  if not exists (select 1 from public.profiles) then
    v_role := 'owner';
    v_active := true;
    v_bootstrap := true;
  end if;

  insert into public.profiles (id, email, full_name, role, active)
    values (new.id, new.email, v_full_name, v_role, v_active)
  on conflict (id) do update
    set email = excluded.email;

  return new;
end;
$$;
