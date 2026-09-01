-- 0137_multi_location_access.sql
--
-- LOCATION ACCESS: All / Single / Multiple.
--
-- Until now location access was binary, spread across two columns:
--   profiles.location_id      -- the one shop this person belongs to
--   profiles.cross_location   -- true = every shop (added in 0061)
-- There was no way to say "Brampton and Milton, but not the other three".
--
-- This adds `profiles.location_ids uuid[]` — an explicit per-location
-- enable/disable list — and folds it into the existing access rules. The three
-- modes the Users screen offers map onto the columns like this:
--
--   All        cross_location = true,  location_ids = null
--   Single     cross_location = false, location_ids = null   (uses location_id)
--   Multiple   cross_location = false, location_ids = {a,b,…}
--
-- `location_id` keeps its old meaning in every mode: the person's HOME shop,
-- used as the default when they create a record and for reporting. In
-- Multiple mode the app writes the first ticked location there.
--
-- STRATEGY — same additive approach as 0061. The ~25 original location-scoped
-- policies are left untouched; 0061 already added one "bypass" policy per
-- (table, operation) they cover, and Postgres OR's permissive policies
-- together. So this migration only has to WIDEN those bypass policies, from
-- "…and has_cross_location()" to "…and (has_cross_location() or the row's
-- location is in my list)". Same policy names, so it is a clean replace.
--
-- Anyone with cross_location = true keeps byte-identical access: the new
-- predicate is a strict superset of the old one.
--
-- PERFORMANCE — READ BEFORE "SIMPLIFYING" THE PREDICATE. Every membership test
-- below is written in exactly this shape:
--
--     location_id = any (coalesce((select private.extra_locations()), array[]::uuid[]))
--
-- The obvious spelling, `= any (private.extra_locations())`, is WRONG for two
-- reasons and was measured, not guessed:
--
--   * it puts the helper inside the per-row filter, so the profiles lookup
--     runs once per scanned row — the exact regression 0119 existed to remove.
--     Verified on a 50k-row table: plain form = `Filter: (location_id = ANY
--     (private.extra_locations()))` with no InitPlan; coalesce form = the same
--     row count with `InitPlan 1 (returns $0)`, evaluated once per statement.
--   * `= any ((select private.extra_locations()))` does NOT fix it — Postgres
--     parses `ANY (SELECT …)` as the subquery form regardless of the extra
--     parens, and fails with `operator does not exist: uuid = uuid[]`. Wrapping
--     the sub-select in coalesce() is what makes it an ARRAY-valued expression,
--     and therefore an InitPlan.
--
-- The coalesce also carries real meaning: the scalar sub-select yields NULL
-- when the caller has no matching profile row (inactive, or a role outside the
-- list), and `x = any (NULL)` is NULL, not false. Coalescing to an empty array
-- makes "no grant" behave as a clean no-match.
--
-- Every other helper call is written as `(select private.x())` to match the
-- wrapping 0119 applied to the live policies; do not unwrap those either.

-- ----------------------------------------------------------------------------
-- 1. Column
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists location_ids uuid[];

comment on column public.profiles.location_ids is
  'Explicit multi-location grant. NULL = not in Multiple mode (fall back to location_id, or cross_location for all). Never an empty array — the app writes NULL instead.';

-- ----------------------------------------------------------------------------
-- 2. Guard: location_ids joins the owner-only column list.
--    Rewritten in full from 0066 + the new branch. Service-role / direct-DB
--    sessions still bypass (auth.uid() is null), as in 0018.
--    Uses private.is_owner() so co_owner passes too (0067).
-- ----------------------------------------------------------------------------
create or replace function public.profiles_guard()
returns trigger
language plpgsql
as $$
begin
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
    if (old.location_ids is distinct from new.location_ids) and not private.is_owner() then
      raise exception 'Only owner can change profile locations' using errcode = '42501';
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

-- ----------------------------------------------------------------------------
-- 3. Helpers
-- ----------------------------------------------------------------------------
-- 3a. has_cross_location() — unchanged meaning, but the role list was written
--     before 0074 added supervisor + technician. It reads profiles.role
--     DIRECTLY (not through the aliasing current_role()), so a supervisor with
--     the flag ticked was silently getting nothing. Both roles added.
create or replace function private.has_cross_location()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(cross_location, false)
    from public.profiles
   where id = auth.uid()
     and active = true
     and role in ('manager', 'supervisor', 'staff', 'technician', 'employee');
$$;
revoke all on function private.has_cross_location() from public;
grant execute on function private.has_cross_location() to authenticated;

-- 3b. extra_locations() — the explicitly ticked locations, or an empty array.
--     Returns an ARRAY rather than taking a location argument on purpose: a
--     zero-argument stable function can be hoisted into an InitPlan, so the
--     profiles lookup happens once per statement instead of once per row.
--     Always non-null so `x = any(...)` is never NULL.
create or replace function private.extra_locations()
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(location_ids, array[]::uuid[])
    from public.profiles
   where id = auth.uid()
     and active = true
     and role in ('manager', 'supervisor', 'staff', 'technician', 'employee');
$$;
revoke all on function private.extra_locations() from public;
grant execute on function private.extra_locations() to authenticated;

-- ----------------------------------------------------------------------------
-- 4. Widen the 0061 bypass policies.
--    Old predicate:  private.has_cross_location()
--    New predicate:  private.has_cross_location() OR <row location> = any(extra)
-- ----------------------------------------------------------------------------

-- profiles ------------------------------------------------------------------
drop policy if exists profiles_cross_loc_select on public.profiles;
create policy profiles_cross_loc_select on public.profiles
  for select to authenticated
  using (
    (select private.current_role()) = 'manager'
    and (
      (select private.has_cross_location())
      or location_id = any (coalesce((select private.extra_locations()), array[]::uuid[]))
    )
  );

-- customers -----------------------------------------------------------------
-- Customers are located by home_location_id, and are also reachable through a
-- job done at one of your shops (mirrors customers_select in 0007).
drop policy if exists customers_cross_loc_select on public.customers;
create policy customers_cross_loc_select on public.customers
  for select to authenticated
  using (
    (select private.current_role()) in ('manager', 'staff')
    and (
      (select private.has_cross_location())
      or home_location_id = any (coalesce((select private.extra_locations()), array[]::uuid[]))
      or exists (
        select 1 from public.sales_jobs sj
         where sj.customer_id = customers.id
           and sj.location_id = any (coalesce((select private.extra_locations()), array[]::uuid[]))
      )
    )
  );

drop policy if exists customers_cross_loc_update on public.customers;
create policy customers_cross_loc_update on public.customers
  for update to authenticated
  using (
    (select private.current_role()) = 'manager'
    and (
      (select private.has_cross_location())
      or home_location_id = any (coalesce((select private.extra_locations()), array[]::uuid[]))
    )
  )
  with check (
    (select private.current_role()) = 'manager'
    and (
      (select private.has_cross_location())
      or home_location_id = any (coalesce((select private.extra_locations()), array[]::uuid[]))
    )
  );

-- sales_jobs ----------------------------------------------------------------
drop policy if exists sales_jobs_cross_loc_select on public.sales_jobs;
create policy sales_jobs_cross_loc_select on public.sales_jobs
  for select to authenticated
  using (
    (select private.current_role()) in ('manager', 'staff')
    and (
      (select private.has_cross_location())
      or location_id = any (coalesce((select private.extra_locations()), array[]::uuid[]))
    )
  );

drop policy if exists sales_jobs_cross_loc_insert on public.sales_jobs;
create policy sales_jobs_cross_loc_insert on public.sales_jobs
  for insert to authenticated
  with check (
    (select private.current_role()) in ('manager', 'staff')
    and (
      (select private.has_cross_location())
      or location_id = any (coalesce((select private.extra_locations()), array[]::uuid[]))
    )
  );

drop policy if exists sales_jobs_cross_loc_update on public.sales_jobs;
create policy sales_jobs_cross_loc_update on public.sales_jobs
  for update to authenticated
  using (
    (select private.current_role()) = 'manager'
    and (
      (select private.has_cross_location())
      or location_id = any (coalesce((select private.extra_locations()), array[]::uuid[]))
    )
  )
  with check (
    (select private.current_role()) = 'manager'
    and (
      (select private.has_cross_location())
      or location_id = any (coalesce((select private.extra_locations()), array[]::uuid[]))
    )
  );

-- sales_payments ------------------------------------------------------------
drop policy if exists sales_payments_cross_loc_insert on public.sales_payments;
create policy sales_payments_cross_loc_insert on public.sales_payments
  for insert to authenticated
  with check (
    exists (
      select 1 from public.sales_jobs sj
       where sj.id = sales_payments.sales_job_id
         and (select private.current_role()) in ('manager', 'staff')
         and (
           (select private.has_cross_location())
           or sj.location_id = any (coalesce((select private.extra_locations()), array[]::uuid[]))
         )
    )
  );

-- expenses ------------------------------------------------------------------
drop policy if exists expenses_cross_loc_select on public.expenses;
create policy expenses_cross_loc_select on public.expenses
  for select to authenticated
  using (
    (
      (select private.current_role()) = 'manager'
      or (
        (select private.current_role()) = 'staff'
        and (select private.can_enter_expenses())
      )
    )
    and (
      (select private.has_cross_location())
      or location_id = any (coalesce((select private.extra_locations()), array[]::uuid[]))
    )
  );

drop policy if exists expenses_cross_loc_insert on public.expenses;
create policy expenses_cross_loc_insert on public.expenses
  for insert to authenticated
  with check (
    (
      (select private.current_role()) = 'manager'
      or (
        (select private.current_role()) = 'staff'
        and (select private.can_enter_expenses())
      )
    )
    and (
      (select private.has_cross_location())
      or location_id = any (coalesce((select private.extra_locations()), array[]::uuid[]))
    )
  );

drop policy if exists expenses_cross_loc_update on public.expenses;
create policy expenses_cross_loc_update on public.expenses
  for update to authenticated
  using (
    (select private.current_role()) = 'manager'
    and (
      (select private.has_cross_location())
      or location_id = any (coalesce((select private.extra_locations()), array[]::uuid[]))
    )
  )
  with check (
    (select private.current_role()) = 'manager'
    and (
      (select private.has_cross_location())
      or location_id = any (coalesce((select private.extra_locations()), array[]::uuid[]))
    )
  );

-- expense_payments ----------------------------------------------------------
drop policy if exists expense_payments_cross_loc_insert on public.expense_payments;
create policy expense_payments_cross_loc_insert on public.expense_payments
  for insert to authenticated
  with check (
    exists (
      select 1 from public.expenses e
       where e.id = expense_payments.expense_id
         and (select private.current_role()) = 'manager'
         and (
           (select private.has_cross_location())
           or e.location_id = any (coalesce((select private.extra_locations()), array[]::uuid[]))
         )
    )
  );

-- audit_log -----------------------------------------------------------------
drop policy if exists audit_log_cross_loc_select on public.audit_log;
create policy audit_log_cross_loc_select on public.audit_log
  for select to authenticated
  using (
    (select private.current_role()) = 'manager'
    and (
      (select private.has_cross_location())
      or location_id = any (coalesce((select private.extra_locations()), array[]::uuid[]))
    )
  );

-- payroll (0012) ------------------------------------------------------------
drop policy if exists employees_cross_loc_select on public.employees;
create policy employees_cross_loc_select on public.employees
  for select to authenticated
  using (
    (select private.current_role()) = 'manager'
    and (
      (select private.has_cross_location())
      or location_id = any (coalesce((select private.extra_locations()), array[]::uuid[]))
    )
  );

drop policy if exists payroll_weeks_cross_loc_select on public.payroll_weeks;
create policy payroll_weeks_cross_loc_select on public.payroll_weeks
  for select to authenticated
  using (
    (select private.current_role()) = 'manager'
    and (
      (select private.has_cross_location())
      or location_id = any (coalesce((select private.extra_locations()), array[]::uuid[]))
    )
  );

drop policy if exists payroll_weeks_cross_loc_write on public.payroll_weeks;
create policy payroll_weeks_cross_loc_write on public.payroll_weeks
  for all to authenticated
  using (
    (select private.current_role()) = 'manager'
    and (
      (select private.has_cross_location())
      or location_id = any (coalesce((select private.extra_locations()), array[]::uuid[]))
    )
  )
  with check (
    (select private.current_role()) = 'manager'
    and (
      (select private.has_cross_location())
      or location_id = any (coalesce((select private.extra_locations()), array[]::uuid[]))
    )
  );

-- recurring_expenses (0014) -------------------------------------------------
drop policy if exists recurring_expenses_cross_loc_select on public.recurring_expenses;
create policy recurring_expenses_cross_loc_select on public.recurring_expenses
  for select to authenticated
  using (
    (select private.current_role()) = 'manager'
    and (
      (select private.has_cross_location())
      or location_id = any (coalesce((select private.extra_locations()), array[]::uuid[]))
    )
  );

drop policy if exists recurring_expenses_cross_loc_write on public.recurring_expenses;
create policy recurring_expenses_cross_loc_write on public.recurring_expenses
  for all to authenticated
  using (
    (select private.current_role()) = 'manager'
    and (
      (select private.has_cross_location())
      or location_id = any (coalesce((select private.extra_locations()), array[]::uuid[]))
    )
  )
  with check (
    (select private.current_role()) = 'manager'
    and (
      (select private.has_cross_location())
      or location_id = any (coalesce((select private.extra_locations()), array[]::uuid[]))
    )
  );

-- vendor_locations (0038) ---------------------------------------------------
drop policy if exists vendor_locations_cross_loc_insert on public.vendor_locations;
create policy vendor_locations_cross_loc_insert on public.vendor_locations
  for insert to authenticated
  with check (
    (select private.current_role()) = 'manager'
    and (
      (select private.has_cross_location())
      or location_id = any (coalesce((select private.extra_locations()), array[]::uuid[]))
    )
  );

drop policy if exists vendor_locations_cross_loc_update on public.vendor_locations;
create policy vendor_locations_cross_loc_update on public.vendor_locations
  for update to authenticated
  using (
    (select private.current_role()) = 'manager'
    and (
      (select private.has_cross_location())
      or location_id = any (coalesce((select private.extra_locations()), array[]::uuid[]))
    )
  )
  with check (
    (select private.current_role()) = 'manager'
    and (
      (select private.has_cross_location())
      or location_id = any (coalesce((select private.extra_locations()), array[]::uuid[]))
    )
  );
