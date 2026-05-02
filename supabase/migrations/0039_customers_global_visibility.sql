-- 0039_customers_global_visibility.sql
-- Item #14: customers (and their vehicles) must be visible to all authed
-- users regardless of location. Sales/expense ROW visibility stays scoped.
--
-- Replaces the location-scoped customer SELECT policy from 0007_rls_policies.
-- Vehicles already get a global SELECT policy in 0035; this file is the
-- authoritative place for the customer change so future readers can find it.

drop policy if exists customers_select on public.customers;
create policy customers_select on public.customers
  for select to authenticated
  using (true);
