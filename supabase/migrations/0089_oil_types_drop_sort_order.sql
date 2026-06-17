-- 0089_oil_types_drop_sort_order.sql
-- Oil types are now sorted alphabetically by name; the manual sort_order column
-- is no longer used. (engine_types / part_categories / part_brands etc. keep
-- their own sort_order — this only drops it from oil_types.)

alter table public.oil_types drop column if exists sort_order;
