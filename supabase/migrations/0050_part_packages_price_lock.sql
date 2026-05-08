-- 0050_part_packages_price_lock.sql
-- Per-package price lock with snapshotted unit prices. While locked
-- (lock_until > today), expansion uses locked_unit_price instead of the
-- live catalog. The merge dialog refreshes snapshots from the catalog.

alter table public.part_packages
  add column if not exists lock_until date,
  add column if not exists labor_locked_selling_price numeric(10,2)
    check (labor_locked_selling_price is null or labor_locked_selling_price >= 0);

comment on column public.part_packages.lock_until is
  'When set and >= today, the package uses snapshotted prices instead of live catalog.';
comment on column public.part_packages.labor_locked_selling_price is
  'Labor selling price snapshot at lock time. Cleared on unlock.';

alter table public.part_package_items
  add column if not exists locked_unit_price numeric(12,2)
    check (locked_unit_price is null or locked_unit_price >= 0);

comment on column public.part_package_items.locked_unit_price is
  'Effective unit price snapshot at lock time. NULL when package is unlocked.';
