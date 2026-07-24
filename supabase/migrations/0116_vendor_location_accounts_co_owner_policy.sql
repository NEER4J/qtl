-- 0116_vendor_location_accounts_co_owner_policy.sql
--
-- Follow-up to 0115. When we verified 0115 live (Puppeteer, logged in as the
-- "admin" = co_owner account), creating a vendor with per-location accounts
-- STILL failed for every location with
--   "new row violates row-level security policy for table vendor_location_accounts"
-- even though 0115 had already widened the insert/update policy to include
-- `manager`.
--
-- Root cause (found by dumping pg_policies on the live DB): the co_owner is not
-- a `manager` and their `private.current_role()` returns 'co_owner', which is
-- NOT in ('owner','accountant','manager'). co_owner was only ever meant to be
-- covered by the generic full-access policy `vendor_location_accounts_co_owner_all`
-- that 0085 created via `private.is_owner()` (is_owner() = owner OR co_owner).
-- On the live DB that policy is MISSING on vendor_location_accounts (schema
-- drift — vendor_locations still has its `vendor_locations_co_owner_all`, this
-- sibling table lost/never got its equivalent), so a co_owner had no policy at
-- all granting the write and every per-location account insert was rejected.
-- (This, not the manager location-gate, is almost certainly what the original
-- client screenshot was actually hitting, since the reporter uses the Admin
-- / co_owner login.)
--
-- Fix: (re)create the co_owner full-access policy on vendor_location_accounts
-- so it matches 0085's intent and its sibling vendor_locations. Idempotent
-- (drop-if-exists first). Combined with 0115 this table is now writable by
-- owner + co_owner (via is_owner) and accountant + manager (via the role list);
-- staff/technician remain excluded.

drop policy if exists vendor_location_accounts_co_owner_all on public.vendor_location_accounts;
create policy vendor_location_accounts_co_owner_all on public.vendor_location_accounts
  for all to authenticated
  using (private.is_owner())
  with check (private.is_owner());

-- Defensive: ensure the sibling policy exists too (it was present on the live
-- DB, but keep the pair in lock-step so a future clean rebuild can't drift).
drop policy if exists vendor_locations_co_owner_all on public.vendor_locations;
create policy vendor_locations_co_owner_all on public.vendor_locations
  for all to authenticated
  using (private.is_owner())
  with check (private.is_owner());
