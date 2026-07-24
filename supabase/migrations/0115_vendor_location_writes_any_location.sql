-- 0115_vendor_location_writes_any_location.sql
--
-- Bug (client 2026-07-24, screenshot): creating a NEW vendor and filling in
-- per-location accounts for several shops fails with
--   "Vendor saved, but 3 location(s) could not be updated:
--    AYR: Not authorised: new row violates row-level security policy for table
--    vendor_location_accounts ... FE: ... NP: ..."
-- The vendor HEADER saves, but every per-location account/detail row is rejected.
--
-- Root cause: a vendor is a GLOBAL entity (not location-scoped). `vendors`
-- itself (0007) lets ANY manager insert/update with no location check. But its
-- child config tables `vendor_location_accounts` (0085/0097) and
-- `vendor_locations` (0038/0097) gate a manager to
--   location_id = private.current_location()   (unless has_cross_location()).
-- So a manager/supervisor doing exactly what the vendor form invites — enter
-- accounts for all shops, hit Create — is RLS-rejected for every location that
-- isn't their own home location, while the header they just created saved fine.
-- (Two aggravating factors: supervisors alias to 'manager' in current_role()
-- but has_cross_location() checks the RAW role in ('manager','staff','employee'),
-- so a supervisor's cross_location flag never takes effect here; and a manager
-- whose home location isn't among the shops fails ALL of them, matching the
-- "3 of 3 failed" screenshot.)
--
-- Fix: since the parent vendor is already globally writable by any manager, its
-- per-location config rows should be too. Drop the location constraint for
-- managers on these two tables' INSERT/UPDATE so a manager (hence supervisor)
-- can save any location's accounts/details — matching the `vendors` policy
-- exactly. owner/co_owner/accountant were already unrestricted here;
-- staff/technician remain excluded (absent from the role list). This is
-- low-sensitivity shared billing config, not per-location transactional data,
-- so widening manager write to all locations is consistent with the model.

-- vendor_location_accounts ---------------------------------------------------
drop policy if exists vendor_location_accounts_insert on public.vendor_location_accounts;
create policy vendor_location_accounts_insert on public.vendor_location_accounts
  for insert to authenticated
  with check (
    private.current_role() in ('owner','accountant','manager')
  );

drop policy if exists vendor_location_accounts_update on public.vendor_location_accounts;
create policy vendor_location_accounts_update on public.vendor_location_accounts
  for update to authenticated
  using (
    private.current_role() in ('owner','accountant','manager')
  )
  with check (
    private.current_role() in ('owner','accountant','manager')
  );

-- vendor_locations (same gap, same fix) --------------------------------------
drop policy if exists vendor_locations_insert on public.vendor_locations;
create policy vendor_locations_insert on public.vendor_locations
  for insert to authenticated
  with check (
    private.current_role() in ('owner','accountant','manager')
  );

drop policy if exists vendor_locations_update on public.vendor_locations;
create policy vendor_locations_update on public.vendor_locations
  for update to authenticated
  using (
    private.current_role() in ('owner','accountant','manager')
  )
  with check (
    private.current_role() in ('owner','accountant','manager')
  );
