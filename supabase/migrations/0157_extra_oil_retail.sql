-- 0157_extra_oil_retail.sql
--
-- Extra oil is a retail sale (client 2026-10-20). An oil change is priced on
-- the engine's capacity: the group rate per litre plus the volume tier
-- premium for that many litres. Oil a customer takes on top of that is sold
-- at the group's retail price per litre instead, on its own line, and the
-- tier premium is not raised by it.

alter table public.oil_groups
  add column if not exists retail_price_per_litre numeric(10,4);

alter table public.oil_groups
  drop constraint if exists oil_groups_retail_price_per_litre_check;
alter table public.oil_groups
  add constraint oil_groups_retail_price_per_litre_check
  check (retail_price_per_litre is null or retail_price_per_litre >= 0);

comment on column public.oil_groups.retail_price_per_litre is
  'Price per litre for oil sold beyond an engine''s capacity (extra oil). Null = not set: extra oil stays at the group rate (0157).';

alter table public.sales_job_items
  add column if not exists is_extra_oil boolean not null default false;

comment on column public.sales_job_items.is_extra_oil is
  'Oil beyond the engine''s capacity, sold at the group''s retail price; not counted toward the volume tier premium (0157).';
