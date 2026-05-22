-- 0061_cross_location.sql
--
-- All-or-nothing cross-location flag. A manager/staff/employee with
-- `profiles.cross_location = true` can act on EVERY location, the same way
-- owner + accountant already can. The flag is owner-managed.
--
-- Implementation strategy: ADDITIVE. We don't rewrite the ~25 existing
-- location-scoped policies — instead we add a new RLS policy per affected
-- operation that grants access when the flag is on. PostgreSQL OR's
-- permissive policies for the same (table, operation), so the effective
-- ruleset is "the old rule OR the cross-location bypass".
--
-- The bypass preserves role-specific add-on checks like `can_enter_expenses()`
-- for staff on the expenses tables.

-- ----------------------------------------------------------------------------
-- 1. Column
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists cross_location boolean not null default false;

-- Owner-only guard for the new flag. We append to the existing trigger
-- function rather than introduce a separate trigger.
create or replace function public.profiles_guard()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if (old.role is distinct from new.role)
       and private.current_role() is distinct from 'owner' then
      raise exception 'Only owner can change profile role' using errcode = '42501';
    end if;
    if (old.location_id is distinct from new.location_id)
       and private.current_role() is distinct from 'owner' then
      raise exception 'Only owner can change profile location' using errcode = '42501';
    end if;
    if (old.can_enter_expenses is distinct from new.can_enter_expenses)
       and private.current_role() is distinct from 'owner' then
      raise exception 'Only owner can toggle can_enter_expenses' using errcode = '42501';
    end if;
    if (old.active is distinct from new.active)
       and private.current_role() is distinct from 'owner' then
      raise exception 'Only owner can change profile active status' using errcode = '42501';
    end if;
    if (old.username is distinct from new.username)
       and private.current_role() is distinct from 'owner' then
      raise exception 'Only owner can change username' using errcode = '42501';
    end if;
    if (old.allowed_pages is distinct from new.allowed_pages
        or old.hidden_columns is distinct from new.hidden_columns)
       and private.current_role() is distinct from 'owner' then
      raise exception 'Only owner can change permission overrides' using errcode = '42501';
    end if;
    if (old.cross_location is distinct from new.cross_location)
       and private.current_role() is distinct from 'owner' then
      raise exception 'Only owner can change cross-location flag' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. Helper — does the caller have cross-location access?
--    Restricted to non-portal roles so flipping the flag on a portal_customer
--    has no effect.
-- ----------------------------------------------------------------------------
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
     and role in ('manager', 'staff', 'employee');
$$;
revoke all on function private.has_cross_location() from public;
grant execute on function private.has_cross_location() to authenticated;

-- ----------------------------------------------------------------------------
-- 3. Additive RLS policies — one bypass per (table, operation) that the
--    existing location-gated policy covers.
-- ----------------------------------------------------------------------------

-- profiles ------------------------------------------------------------------
drop policy if exists profiles_cross_loc_select on public.profiles;
create policy profiles_cross_loc_select on public.profiles
  for select to authenticated
  using (
    private.current_role() = 'manager' and private.has_cross_location()
  );

-- customers -----------------------------------------------------------------
drop policy if exists customers_cross_loc_select on public.customers;
create policy customers_cross_loc_select on public.customers
  for select to authenticated
  using (
    private.current_role() in ('manager', 'staff') and private.has_cross_location()
  );

drop policy if exists customers_cross_loc_update on public.customers;
create policy customers_cross_loc_update on public.customers
  for update to authenticated
  using (
    private.current_role() = 'manager' and private.has_cross_location()
  )
  with check (
    private.current_role() = 'manager' and private.has_cross_location()
  );

-- sales_jobs ----------------------------------------------------------------
drop policy if exists sales_jobs_cross_loc_select on public.sales_jobs;
create policy sales_jobs_cross_loc_select on public.sales_jobs
  for select to authenticated
  using (
    private.current_role() in ('manager', 'staff') and private.has_cross_location()
  );

drop policy if exists sales_jobs_cross_loc_insert on public.sales_jobs;
create policy sales_jobs_cross_loc_insert on public.sales_jobs
  for insert to authenticated
  with check (
    private.current_role() in ('manager', 'staff') and private.has_cross_location()
  );

drop policy if exists sales_jobs_cross_loc_update on public.sales_jobs;
create policy sales_jobs_cross_loc_update on public.sales_jobs
  for update to authenticated
  using (
    private.current_role() = 'manager' and private.has_cross_location()
  )
  with check (
    private.current_role() = 'manager' and private.has_cross_location()
  );

-- sales_payments ------------------------------------------------------------
drop policy if exists sales_payments_cross_loc_insert on public.sales_payments;
create policy sales_payments_cross_loc_insert on public.sales_payments
  for insert to authenticated
  with check (
    exists (
      select 1 from public.sales_jobs sj
       where sj.id = sales_payments.sales_job_id
         and private.current_role() in ('manager', 'staff')
         and private.has_cross_location()
    )
  );

-- expenses ------------------------------------------------------------------
drop policy if exists expenses_cross_loc_select on public.expenses;
create policy expenses_cross_loc_select on public.expenses
  for select to authenticated
  using (
    (private.current_role() = 'manager' and private.has_cross_location())
    or (
      private.current_role() = 'staff'
      and private.has_cross_location()
      and private.can_enter_expenses()
    )
  );

drop policy if exists expenses_cross_loc_insert on public.expenses;
create policy expenses_cross_loc_insert on public.expenses
  for insert to authenticated
  with check (
    (private.current_role() = 'manager' and private.has_cross_location())
    or (
      private.current_role() = 'staff'
      and private.has_cross_location()
      and private.can_enter_expenses()
    )
  );

drop policy if exists expenses_cross_loc_update on public.expenses;
create policy expenses_cross_loc_update on public.expenses
  for update to authenticated
  using (
    private.current_role() = 'manager' and private.has_cross_location()
  )
  with check (
    private.current_role() = 'manager' and private.has_cross_location()
  );

-- expense_payments ----------------------------------------------------------
drop policy if exists expense_payments_cross_loc_insert on public.expense_payments;
create policy expense_payments_cross_loc_insert on public.expense_payments
  for insert to authenticated
  with check (
    exists (
      select 1 from public.expenses e
       where e.id = expense_payments.expense_id
         and private.current_role() = 'manager'
         and private.has_cross_location()
    )
  );

-- audit_log -----------------------------------------------------------------
drop policy if exists audit_log_cross_loc_select on public.audit_log;
create policy audit_log_cross_loc_select on public.audit_log
  for select to authenticated
  using (
    private.current_role() = 'manager' and private.has_cross_location()
  );

-- payroll (0012) ------------------------------------------------------------
drop policy if exists employees_cross_loc_select on public.employees;
create policy employees_cross_loc_select on public.employees
  for select to authenticated
  using (
    private.current_role() = 'manager' and private.has_cross_location()
  );

drop policy if exists payroll_weeks_cross_loc_select on public.payroll_weeks;
create policy payroll_weeks_cross_loc_select on public.payroll_weeks
  for select to authenticated
  using (
    private.current_role() = 'manager' and private.has_cross_location()
  );

drop policy if exists payroll_weeks_cross_loc_write on public.payroll_weeks;
create policy payroll_weeks_cross_loc_write on public.payroll_weeks
  for all to authenticated
  using (
    private.current_role() = 'manager' and private.has_cross_location()
  )
  with check (
    private.current_role() = 'manager' and private.has_cross_location()
  );

-- recurring_expenses (0014) -------------------------------------------------
drop policy if exists recurring_expenses_cross_loc_select on public.recurring_expenses;
create policy recurring_expenses_cross_loc_select on public.recurring_expenses
  for select to authenticated
  using (
    private.current_role() = 'manager' and private.has_cross_location()
  );

drop policy if exists recurring_expenses_cross_loc_write on public.recurring_expenses;
create policy recurring_expenses_cross_loc_write on public.recurring_expenses
  for all to authenticated
  using (
    private.current_role() = 'manager' and private.has_cross_location()
  )
  with check (
    private.current_role() = 'manager' and private.has_cross_location()
  );

-- vendor_locations (0038) ---------------------------------------------------
-- vendor_locations_select is already role-only (no location check), no bypass needed.
drop policy if exists vendor_locations_cross_loc_insert on public.vendor_locations;
create policy vendor_locations_cross_loc_insert on public.vendor_locations
  for insert to authenticated
  with check (
    private.current_role() = 'manager' and private.has_cross_location()
  );

drop policy if exists vendor_locations_cross_loc_update on public.vendor_locations;
create policy vendor_locations_cross_loc_update on public.vendor_locations
  for update to authenticated
  using (
    private.current_role() = 'manager' and private.has_cross_location()
  )
  with check (
    private.current_role() = 'manager' and private.has_cross_location()
  );
