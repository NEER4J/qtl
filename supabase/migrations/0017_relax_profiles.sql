-- 0017_relax_profiles.sql
-- Internal-tool mode: drop the approval gate.
-- New signups land immediately active. The CHECK that required staff/manager
-- to have a location is relaxed — owners can assign locations after signup
-- without the DB fighting them.

-- Drop the restrictive CHECK (last version was added in 0016).
alter table public.profiles
  drop constraint if exists profiles_role_location_chk;

-- Reactivate anyone 0016 created as pending. Also catch anything that
-- might have ended up inactive due to the earlier signup failures.
update public.profiles
   set active = true
 where active = false;

-- Signup trigger: every new user is active. First user still bootstraps as
-- owner; subsequent users default to 'staff' (so the role system still
-- works if you want it later), but they can sign in and act immediately.
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

  if not exists (select 1 from public.profiles) then
    v_role := 'owner';
  end if;

  insert into public.profiles (id, email, full_name, role, active)
    values (new.id, new.email, v_full_name, v_role, true)
  on conflict (id) do update
    set email = excluded.email,
        active = true;

  return new;
end;
$$;
