-- 0007_rls_policies.sql
-- Full RLS matrix for every public table. Permissions follow section 3 of
-- doc/QTL Plan.md. Helpers in `private` schema (see 0003).
--
-- Global rules:
--   * No DELETE policies anywhere. "Delete" is a soft deactivate (UPDATE of
--     deactivated_at, enforced owner-only by the `*_guard` triggers).
--   * Staff cannot edit their own submissions after the fact (matrix §3).
--   * RLS is the final authority; server-side guards are a second line.

-- ============================================================================
-- profiles
-- ============================================================================
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or private.current_role() = 'owner'
    or private.current_role() = 'accountant'
    or (
      private.current_role() = 'manager'
      and location_id is not distinct from private.current_location()
    )
  );

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (private.current_role() = 'owner');

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists profiles_update_owner on public.profiles;
create policy profiles_update_owner on public.profiles
  for update to authenticated
  using (private.current_role() = 'owner')
  with check (private.current_role() = 'owner');

-- ============================================================================
-- locations
-- ============================================================================
drop policy if exists locations_select on public.locations;
create policy locations_select on public.locations
  for select to authenticated
  using (true);

drop policy if exists locations_write_owner on public.locations;
create policy locations_write_owner on public.locations
  for all to authenticated
  using (private.current_role() = 'owner')
  with check (private.current_role() = 'owner');

-- ============================================================================
-- service_types
-- ============================================================================
drop policy if exists service_types_select on public.service_types;
create policy service_types_select on public.service_types
  for select to authenticated
  using (true);

drop policy if exists service_types_write_owner on public.service_types;
create policy service_types_write_owner on public.service_types
  for all to authenticated
  using (private.current_role() = 'owner')
  with check (private.current_role() = 'owner');

-- ============================================================================
-- expense_categories / expense_subcategories
-- ============================================================================
drop policy if exists expense_categories_select on public.expense_categories;
create policy expense_categories_select on public.expense_categories
  for select to authenticated
  using (true);

drop policy if exists expense_categories_write_owner on public.expense_categories;
create policy expense_categories_write_owner on public.expense_categories
  for all to authenticated
  using (private.current_role() = 'owner')
  with check (private.current_role() = 'owner');

drop policy if exists expense_subcategories_select on public.expense_subcategories;
create policy expense_subcategories_select on public.expense_subcategories
  for select to authenticated
  using (true);

drop policy if exists expense_subcategories_write_owner on public.expense_subcategories;
create policy expense_subcategories_write_owner on public.expense_subcategories
  for all to authenticated
  using (private.current_role() = 'owner')
  with check (private.current_role() = 'owner');

-- ============================================================================
-- app_settings
-- ============================================================================
drop policy if exists app_settings_select on public.app_settings;
create policy app_settings_select on public.app_settings
  for select to authenticated
  using (true);

drop policy if exists app_settings_write_owner on public.app_settings;
create policy app_settings_write_owner on public.app_settings
  for update to authenticated
  using (private.current_role() = 'owner')
  with check (private.current_role() = 'owner');

-- ============================================================================
-- customers
-- ============================================================================
drop policy if exists customers_select on public.customers;
create policy customers_select on public.customers
  for select to authenticated
  using (
    private.current_role() in ('owner','accountant')
    or (
      private.current_role() in ('manager','staff')
      and (
        home_location_id is null
        or home_location_id = private.current_location()
        or exists (
          select 1 from public.sales_jobs sj
           where sj.customer_id = customers.id
             and sj.location_id = private.current_location()
        )
      )
    )
  );

drop policy if exists customers_insert on public.customers;
create policy customers_insert on public.customers
  for insert to authenticated
  with check (
    private.current_role() in ('owner','manager','staff')
  );

drop policy if exists customers_update on public.customers;
create policy customers_update on public.customers
  for update to authenticated
  using (
    private.current_role() = 'owner'
    or (
      private.current_role() = 'manager'
      and (home_location_id is null
           or home_location_id = private.current_location())
    )
  )
  with check (
    private.current_role() = 'owner'
    or (
      private.current_role() = 'manager'
      and (home_location_id is null
           or home_location_id = private.current_location())
    )
  );

-- ============================================================================
-- vendors
-- ============================================================================
drop policy if exists vendors_select on public.vendors;
create policy vendors_select on public.vendors
  for select to authenticated
  using (
    private.current_role() in ('owner','accountant','manager','staff')
  );

drop policy if exists vendors_insert on public.vendors;
create policy vendors_insert on public.vendors
  for insert to authenticated
  with check (
    private.current_role() in ('owner','accountant','manager')
  );

drop policy if exists vendors_update on public.vendors;
create policy vendors_update on public.vendors
  for update to authenticated
  using (
    private.current_role() in ('owner','accountant','manager')
  )
  with check (
    private.current_role() in ('owner','accountant','manager')
  );

-- ============================================================================
-- sales_jobs
-- ============================================================================
drop policy if exists sales_jobs_select on public.sales_jobs;
create policy sales_jobs_select on public.sales_jobs
  for select to authenticated
  using (
    private.current_role() in ('owner','accountant')
    or (
      private.current_role() in ('manager','staff')
      and location_id = private.current_location()
    )
  );

drop policy if exists sales_jobs_insert on public.sales_jobs;
create policy sales_jobs_insert on public.sales_jobs
  for insert to authenticated
  with check (
    private.current_role() = 'owner'
    or (
      private.current_role() in ('manager','staff')
      and location_id = private.current_location()
    )
  );

-- Staff CANNOT update. Owner: any row. Manager: own location only.
drop policy if exists sales_jobs_update on public.sales_jobs;
create policy sales_jobs_update on public.sales_jobs
  for update to authenticated
  using (
    private.current_role() = 'owner'
    or (private.current_role() = 'manager'
        and location_id = private.current_location())
  )
  with check (
    private.current_role() = 'owner'
    or (private.current_role() = 'manager'
        and location_id = private.current_location())
  );

-- ============================================================================
-- sales_payments
-- ============================================================================
drop policy if exists sales_payments_select on public.sales_payments;
create policy sales_payments_select on public.sales_payments
  for select to authenticated
  using (
    exists (
      select 1 from public.sales_jobs sj
       where sj.id = sales_payments.sales_job_id
    )
    -- RLS on sales_jobs already filters; the EXISTS above just enforces FK view
  );

drop policy if exists sales_payments_insert on public.sales_payments;
create policy sales_payments_insert on public.sales_payments
  for insert to authenticated
  with check (
    exists (
      select 1 from public.sales_jobs sj
       where sj.id = sales_payments.sales_job_id
         and (
           private.current_role() in ('owner','accountant')
           or (private.current_role() in ('manager','staff')
               and sj.location_id = private.current_location())
         )
    )
  );

-- Only owner can mutate existing payment rows
drop policy if exists sales_payments_update_owner on public.sales_payments;
create policy sales_payments_update_owner on public.sales_payments
  for update to authenticated
  using (private.current_role() = 'owner')
  with check (private.current_role() = 'owner');

-- ============================================================================
-- expenses
-- ============================================================================
drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses
  for select to authenticated
  using (
    private.current_role() in ('owner','accountant')
    or (
      private.current_role() = 'manager'
      and location_id = private.current_location()
    )
    or (
      private.current_role() = 'staff'
      and location_id = private.current_location()
      and private.can_enter_expenses()
    )
  );

drop policy if exists expenses_insert on public.expenses;
create policy expenses_insert on public.expenses
  for insert to authenticated
  with check (
    private.current_role() in ('owner','accountant')
    or (
      private.current_role() = 'manager'
      and location_id = private.current_location()
    )
    or (
      private.current_role() = 'staff'
      and location_id = private.current_location()
      and private.can_enter_expenses()
    )
  );

drop policy if exists expenses_update on public.expenses;
create policy expenses_update on public.expenses
  for update to authenticated
  using (
    private.current_role() in ('owner','accountant')
    or (
      private.current_role() = 'manager'
      and location_id = private.current_location()
    )
  )
  with check (
    private.current_role() in ('owner','accountant')
    or (
      private.current_role() = 'manager'
      and location_id = private.current_location()
    )
  );

-- ============================================================================
-- expense_payments
-- ============================================================================
drop policy if exists expense_payments_select on public.expense_payments;
create policy expense_payments_select on public.expense_payments
  for select to authenticated
  using (
    exists (select 1 from public.expenses e where e.id = expense_payments.expense_id)
  );

drop policy if exists expense_payments_insert on public.expense_payments;
create policy expense_payments_insert on public.expense_payments
  for insert to authenticated
  with check (
    exists (
      select 1 from public.expenses e
       where e.id = expense_payments.expense_id
         and (
           private.current_role() in ('owner','accountant')
           or (private.current_role() = 'manager'
               and e.location_id = private.current_location())
         )
    )
  );

drop policy if exists expense_payments_update_owner on public.expense_payments;
create policy expense_payments_update_owner on public.expense_payments
  for update to authenticated
  using (private.current_role() = 'owner')
  with check (private.current_role() = 'owner');

-- ============================================================================
-- audit_log
-- Owner reads all. Manager reads own location. Accountant, staff, employee: no
-- direct access. INSERT goes through triggers only (no client policy).
-- ============================================================================
drop policy if exists audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log
  for select to authenticated
  using (
    private.current_role() = 'owner'
    or (
      private.current_role() = 'manager'
      and location_id = private.current_location()
    )
  );
