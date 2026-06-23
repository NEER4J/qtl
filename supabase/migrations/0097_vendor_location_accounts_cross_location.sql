-- 0097_vendor_location_accounts_cross_location.sql
-- Fix: a cross-location manager could not save a vendor's per-location accounts
-- (or details) for locations other than their home location — saving the vendor
-- form across all locations failed with
--   "new row violates row-level security policy for table vendor_location_accounts".
-- The vendor_location_accounts (0085) and vendor_locations (0038) insert/update
-- policies only allowed a manager when location_id = private.current_location(),
-- never checking private.has_cross_location(). owner / co_owner / accountant were
-- always fine. Add the has_cross_location() escape so a cross-location manager can
-- write every location, matching the rest of the app's cross-location model.

-- vendor_location_accounts ---------------------------------------------------
drop policy if exists vendor_location_accounts_insert on public.vendor_location_accounts;
create policy vendor_location_accounts_insert on public.vendor_location_accounts
  for insert to authenticated
  with check (
    private.current_role() in ('owner','accountant')
    or (
      private.current_role() = 'manager'
      and (private.has_cross_location() or location_id = private.current_location())
    )
  );

drop policy if exists vendor_location_accounts_update on public.vendor_location_accounts;
create policy vendor_location_accounts_update on public.vendor_location_accounts
  for update to authenticated
  using (
    private.current_role() in ('owner','accountant')
    or (
      private.current_role() = 'manager'
      and (private.has_cross_location() or location_id = private.current_location())
    )
  )
  with check (
    private.current_role() in ('owner','accountant')
    or (
      private.current_role() = 'manager'
      and (private.has_cross_location() or location_id = private.current_location())
    )
  );

-- vendor_locations (same gap; same fix) --------------------------------------
drop policy if exists vendor_locations_insert on public.vendor_locations;
create policy vendor_locations_insert on public.vendor_locations
  for insert to authenticated
  with check (
    private.current_role() in ('owner','accountant')
    or (
      private.current_role() = 'manager'
      and (private.has_cross_location() or location_id = private.current_location())
    )
  );

drop policy if exists vendor_locations_update on public.vendor_locations;
create policy vendor_locations_update on public.vendor_locations
  for update to authenticated
  using (
    private.current_role() in ('owner','accountant')
    or (
      private.current_role() = 'manager'
      and (private.has_cross_location() or location_id = private.current_location())
    )
  )
  with check (
    private.current_role() in ('owner','accountant')
    or (
      private.current_role() = 'manager'
      and (private.has_cross_location() or location_id = private.current_location())
    )
  );
