-- 0074_supervisor_technician_roles.sql
--
-- Add two new team roles from doc/staff_permissions.xlsx (the "STAFF ACCESS
-- MATRIX"):
--
--   * supervisor  — in the matrix its access row is IDENTICAL to manager.
--   * technician  — in the matrix its access row is IDENTICAL to sales staff
--                   (our `staff` role).
--
-- Strategy: ADDITIVE, mirroring 0067_co_owner_role.sql. We do NOT touch the
-- ~40 role-keyed RLS policies in 0007/0008/0011/0012/0013/0014/0011-storage.
-- Instead we alias the new roles inside `private.current_role()` so every
-- existing policy that checks `current_role() in ('manager', ...)` /
-- `('staff', ...)` automatically extends to them:
--
--   supervisor → behaves as manager at the RLS layer
--   technician → behaves as staff   at the RLS layer
--
-- This is exactly the matrix's intent (the two new roles are clones of
-- manager / staff for data access). The real role is still stored verbatim in
-- profiles.role for display, the app-layer page registry, and reporting — only
-- the RLS authorization decision is aliased.
--
-- App-layer page/column access (lib/permissions/registry.ts) is updated
-- separately to match every cell of the matrix.

-- ----------------------------------------------------------------------------
-- 1. Enum
-- ----------------------------------------------------------------------------
alter type user_role add value if not exists 'supervisor';
alter type user_role add value if not exists 'technician';

-- ----------------------------------------------------------------------------
-- 2. Alias the new roles inside the RLS role helper.
--    Comparing on role::text avoids referencing the freshly-added enum labels
--    as literals (which Postgres forbids in the same transaction that added
--    them), so this is safe to run in one migration with the ALTER TYPEs above.
-- ----------------------------------------------------------------------------
create or replace function private.current_role()
returns user_role
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select case role::text
           when 'supervisor' then 'manager'::user_role
           when 'technician' then 'staff'::user_role
           else role
         end
    from public.profiles
   where id = auth.uid() and active = true;
$$;

-- private.current_role() is already granted to authenticated in 0003; the
-- grant survives create-or-replace.
