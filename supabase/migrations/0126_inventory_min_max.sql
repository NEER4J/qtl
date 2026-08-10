-- 0126_inventory_min_max.sql
-- Min / max stock thresholds (client 2026-08-07): each part and oil can carry
-- a minimum and maximum on-hand level. The inventory page compares the TOTAL
-- across locations against them and flags rows that fall below the minimum
-- (low stock — time to reorder) or sit above the maximum (overstocked).
--
-- NULL = no threshold set. Thresholds live on the catalogue rows, so editing
-- them rides the existing parts_write / oil_types_write policies (owner +
-- co_owner via the 0124 alias) — managers keep editing counts, not policy.

alter table public.parts
  add column if not exists min_stock_qty integer check (min_stock_qty >= 0),
  add column if not exists max_stock_qty integer check (max_stock_qty >= 0);

alter table public.oil_types
  add column if not exists min_stock_litres numeric(12,2) check (min_stock_litres >= 0),
  add column if not exists max_stock_litres numeric(12,2) check (max_stock_litres >= 0);
