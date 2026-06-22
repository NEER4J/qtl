-- 0092_technicians_drop_sort_order.sql
-- Technicians are now listed alphabetically by name; the manual sort_order
-- column is no longer used. Dropping the column also drops its dependent index
-- (technicians (sort_order, name)).

alter table public.technicians drop column if exists sort_order;
