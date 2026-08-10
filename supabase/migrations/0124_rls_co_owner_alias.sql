-- 0124_rls_co_owner_alias.sql
-- The dashboard and expense analytics always showed $0 for the co_owner
-- (Admin) account. Cause: expenses_select (0007) — and every other policy
-- written as current_role() in ('owner', ...) — was never taught about
-- co_owner when 0067 added the role. RLS filters silently, so the queries
-- "succeeded" and summed an empty list to 0 with no error anywhere.
--
-- co_owner is a full admin: at least owner's access everywhere at the data
-- layer (the owner-vs-Settings split is enforced in the app layer, not RLS).
-- So instead of chasing owner-only lists through dozens of policies, alias
-- co_owner -> owner inside the RLS role helper — the same trick 0074 used
-- for supervisor -> manager and technician -> staff.
--
-- Safe because nothing depends on current_role() RETURNING 'co_owner':
--   * check_ip_access (0112) reads profiles.role directly for its co_owner
--     escape hatch;
--   * private.is_owner() (0067) reads profiles.role directly;
--   * the 0118 policies that name 'co_owner' also name 'owner' in the same
--     in-list, so the aliased value still passes.

create or replace function private.current_role()
returns user_role
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select case role::text
           when 'co_owner'   then 'owner'::user_role
           when 'supervisor' then 'manager'::user_role
           when 'technician' then 'staff'::user_role
           else role
         end
    from public.profiles
   where id = auth.uid() and active = true;
$$;

-- Granted to authenticated in 0003; the grant survives create-or-replace.
