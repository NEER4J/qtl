-- 0125_dump_truck_surcharge.sql
-- Dump-truck surcharge (client 2026-08-07): dump trucks are harder to service,
-- so a flat extra amount is added to the job's sub total when the vehicle is
-- one.
--
--   * vehicles.is_dump_truck      — property of the truck; pre-ticks the box
--                                   on the sales form when the vehicle is picked.
--   * app_settings.dump_truck_surcharge
--                                 — the flat $ amount, editable on
--                                   Settings → Pricing catalogue → Pricing defaults.
--   * sales_jobs.is_dump_truck    — what was actually charged on THIS job.
--   * sales_jobs.dump_truck_surcharge
--                                 — snapshot of the $ amount baked into that
--                                   job's sub_total, so old invoices stay
--                                   correct (and can be un-ticked exactly)
--                                   after the setting changes.
--
-- The surcharge is folded INTO sub_total at save time — hst/total/outstanding
-- and every report keep their existing meaning with no downstream changes.

alter table public.vehicles
  add column if not exists is_dump_truck boolean not null default false;

alter table public.app_settings
  add column if not exists dump_truck_surcharge numeric(10,2) not null default 0;

alter table public.sales_jobs
  add column if not exists is_dump_truck boolean not null default false,
  add column if not exists dump_truck_surcharge numeric(10,2) not null default 0;
