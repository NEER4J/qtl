-- 0096_employees_profile_fk_to_profiles.sql
-- Fix: the payroll Employees page crashed. listAllEmployees embeds the linked
-- login via PostgREST (`profiles:profile_id(full_name, username)`), but
-- employees.profile_id's FK pointed at auth.users (migration 0012), so PostgREST
-- could not find an employees -> public.profiles relationship and threw
-- PGRST200 ("Could not find a relationship ... in the schema cache"). Repoint the
-- FK to public.profiles(id). Safe because profiles.id == auth.users.id (1:1).

-- Null out any orphaned links first so the new constraint can be added.
update public.employees e
  set profile_id = null
  where profile_id is not null
    and not exists (select 1 from public.profiles p where p.id = e.profile_id);

alter table public.employees
  drop constraint if exists employees_profile_id_fkey;

alter table public.employees
  add constraint employees_profile_id_fkey
  foreign key (profile_id) references public.profiles(id) on delete set null;

-- Make PostgREST pick up the new relationship immediately.
notify pgrst, 'reload schema';
