-- 0088_staff_edit_customers_sales.sql
-- Staff can now create + edit Sales jobs, Customers and Vehicles (within their
-- own location). Vehicles + the INSERT policies for customers/sales_jobs already
-- allow staff; this adds staff to the two UPDATE policies (location-scoped, same
-- shape as manager). Deactivation stays owner-only via the existing guards.

drop policy if exists customers_update on public.customers;
create policy customers_update on public.customers
  for update to authenticated
  using (
    private.current_role() = 'owner'
    or (
      private.current_role() in ('manager','staff')
      and (home_location_id is null
           or home_location_id = private.current_location())
    )
  )
  with check (
    private.current_role() = 'owner'
    or (
      private.current_role() in ('manager','staff')
      and (home_location_id is null
           or home_location_id = private.current_location())
    )
  );

drop policy if exists sales_jobs_update on public.sales_jobs;
create policy sales_jobs_update on public.sales_jobs
  for update to authenticated
  using (
    private.current_role() = 'owner'
    or (
      private.current_role() in ('manager','staff')
      and location_id = private.current_location()
    )
  )
  with check (
    private.current_role() = 'owner'
    or (
      private.current_role() in ('manager','staff')
      and location_id = private.current_location()
    )
  );
