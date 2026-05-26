-- 0067_co_owner_role.sql
--
-- Introduce a `co_owner` role that is a full functional equivalent of the
-- owner role. The owner remains the bootstrap / primary account; a co_owner
-- has the same capabilities (every page, every write, every owner-only
-- setting) so multiple humans can administer the shop without sharing the
-- owner account.
--
-- Strategy: ADDITIVE. We don't rewrite the ~40 existing role-keyed policies.
-- Instead:
--   1. Update `private.is_owner()` so it returns true for BOTH owner and
--      co_owner. Any place that already consults this helper auto-extends.
--   2. Add ONE permissive policy per RLS-enabled public table that grants
--      full access when `private.is_owner()` is true. PostgreSQL OR's
--      permissive policies for the same (table, op), so this is overlaid on
--      top of the existing matrix without disturbing it. Owner already had
--      these grants through other policies — the new policy doesn't widen
--      owner, it just brings co_owner up to parity.
--   3. Replace `profiles_guard` so every owner-only guard branch accepts
--      co_owner (via the helper).
--
-- Tables intentionally NOT covered by the generic policy:
--   * audit_log — read-only by convention (only the audit trigger writes,
--     via SECURITY DEFINER). Co_owner gets a SELECT-only policy.
--   * migration_source — same.

-- ----------------------------------------------------------------------------
-- 1. Enum
-- ----------------------------------------------------------------------------
alter type user_role add value if not exists 'co_owner';

-- ----------------------------------------------------------------------------
-- 2. Helper: is_owner() now means "owner or co_owner"
-- ----------------------------------------------------------------------------
create or replace function private.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid()
       and active = true
       and role::text in ('owner', 'co_owner')
  );
$$;

-- private.is_owner() is already granted to authenticated in 0003.

-- ----------------------------------------------------------------------------
-- 3. Generic co_owner full-access policies on every RLS public table except
--    the read-only ones. Done dynamically so future tables that turn on RLS
--    don't get silently missed — though a re-run of THIS migration would be
--    needed to pick them up; new migrations should add their own policy.
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  for t in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'r'
       and c.relrowsecurity = true
       and c.relname not in ('audit_log', 'migration_source')
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      t || '_co_owner_all', t
    );
    execute format(
      'create policy %I on public.%I for all to authenticated '
      'using (private.is_owner()) with check (private.is_owner())',
      t || '_co_owner_all', t
    );
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 4. Read-only tables: co_owner gets SELECT, not write.
-- ----------------------------------------------------------------------------
drop policy if exists audit_log_co_owner_select on public.audit_log;
create policy audit_log_co_owner_select on public.audit_log
  for select to authenticated
  using (private.is_owner());

drop policy if exists migration_source_co_owner_select on public.migration_source;
create policy migration_source_co_owner_select on public.migration_source
  for select to authenticated
  using (private.is_owner());

-- ----------------------------------------------------------------------------
-- 5. profiles_guard: co_owner can do everything owner can.
--    Uses private.is_owner() so the rule auto-extends.
-- ----------------------------------------------------------------------------
create or replace function public.profiles_guard()
returns trigger
language plpgsql
as $$
begin
  -- Service_role / direct-DB session — let it through (matches 0018).
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if (old.role is distinct from new.role) and not private.is_owner() then
      raise exception 'Only owner can change profile role' using errcode = '42501';
    end if;
    if (old.location_id is distinct from new.location_id) and not private.is_owner() then
      raise exception 'Only owner can change profile location' using errcode = '42501';
    end if;
    if (old.can_enter_expenses is distinct from new.can_enter_expenses) and not private.is_owner() then
      raise exception 'Only owner can toggle can_enter_expenses' using errcode = '42501';
    end if;
    if (old.active is distinct from new.active) and not private.is_owner() then
      raise exception 'Only owner can change profile active status' using errcode = '42501';
    end if;
    if (old.username is distinct from new.username) and not private.is_owner() then
      raise exception 'Only owner can change username' using errcode = '42501';
    end if;
    if (old.allowed_pages is distinct from new.allowed_pages
        or old.hidden_columns is distinct from new.hidden_columns)
       and not private.is_owner() then
      raise exception 'Only owner can change permission overrides' using errcode = '42501';
    end if;
    if (old.cross_location is distinct from new.cross_location) and not private.is_owner() then
      raise exception 'Only owner can change cross-location flag' using errcode = '42501';
    end if;
    if (old.email is distinct from new.email) and not private.is_owner() then
      raise exception 'Only owner can change profile email' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
