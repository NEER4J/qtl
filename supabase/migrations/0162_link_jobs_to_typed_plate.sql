-- 0162_link_jobs_to_typed_plate.sql
--
-- DATA FIX, one-off (client 2026-10-22 — "the invoice is there but it shows
-- no vehicle"). Until the form started requiring a vehicle, a job could be
-- saved with the plate typed but no vehicle picked. Where that plate is one of
-- the same customer's own trucks, link the job to it, so it shows on the
-- truck's history and on the customer page.
--
-- Only exact (case-insensitive) plate matches on the job's own customer; a
-- plate on someone else's truck, or a job with no plate, is left for staff
-- (Sales → Vehicle: "No vehicle"). Linked 8 jobs when run live. Safe to re-run.

update public.sales_jobs sj
   set vehicle_id = v.id
  from public.vehicles v
 where sj.vehicle_id is null
   and sj.deactivated_at is null
   and nullif(btrim(sj.license_plate), '') is not null
   and v.customer_id = sj.customer_id
   and v.deactivated_at is null
   and lower(v.license_plate) = lower(btrim(sj.license_plate));
