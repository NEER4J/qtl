-- 0003_rls_helpers.sql
-- Security-definer helpers in a locked `private` schema.
-- RLS policies call these so they can read from public.profiles without
-- triggering recursive RLS.

create schema if not exists private;

-- Lock the schema down so it can't be browsed by anon/authenticated.
revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;
grant usage on schema private to authenticated;
grant usage on schema private to service_role;

-- ============================================================================
-- private.current_role() → user_role | null
-- ============================================================================
create or replace function private.current_role()
returns user_role
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select role
    from public.profiles
   where id = auth.uid() and active = true;
$$;

-- ============================================================================
-- private.current_location() → uuid | null
-- ============================================================================
create or replace function private.current_location()
returns uuid
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select location_id
    from public.profiles
   where id = auth.uid() and active = true;
$$;

-- ============================================================================
-- private.can_enter_expenses() → boolean
-- True for staff with the explicit flag set.
-- ============================================================================
create or replace function private.can_enter_expenses()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(can_enter_expenses, false)
    from public.profiles
   where id = auth.uid() and active = true;
$$;

-- ============================================================================
-- private.is_owner() → boolean convenience wrapper
-- ============================================================================
create or replace function private.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid() and active = true and role = 'owner'
  );
$$;

-- Grant execute strictly to authenticated role
grant execute on function private.current_role()      to authenticated;
grant execute on function private.current_location()  to authenticated;
grant execute on function private.can_enter_expenses() to authenticated;
grant execute on function private.is_owner()          to authenticated;
