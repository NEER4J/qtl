-- 0128_sales_job_items_staff_delete.sql
-- Editing a sales job as staff DOUBLED every saved line item (e.g. invoice
-- 326131). Cause: 0088 let staff UPDATE sales_jobs, but the item policies
-- from 0027 were never extended — staff could INSERT items yet not DELETE
-- them. The server replaces items with delete-all + insert-all; under RLS the
-- delete "succeeds" having removed nothing, then the insert lands the full
-- new set on top of the stale rows. Every old line shows twice and — via the
-- 0114 stock-sync trigger — its stock is deducted twice.
--
-- Fix in three parts:
--   1. delete/update policies mirror the INSERT policy exactly, so any role
--      that can add items can also replace them.
--   2. purge the stale duplicates this bug left behind. replaceJobItems is
--      the ONLY writer and assigns position 0..n-1 uniquely per save, so two
--      rows sharing (sales_job_id, position) can only be a stale set under a
--      newer one — keep the newest row per slot. Deleting the stale rows
--      fires the 0114 trigger, which also restores the double-deducted stock.
--   3. (app layer, lib/actions/sales.ts) the replace now verifies the delete
--      actually removed the expected rows and aborts loudly instead of
--      doubling if a future policy regresses.

drop policy if exists sales_job_items_delete on public.sales_job_items;
create policy sales_job_items_delete on public.sales_job_items
  for delete to authenticated
  using (
    exists (
      select 1 from public.sales_jobs sj
       where sj.id = sales_job_items.sales_job_id
         and (
           private.current_role() in ('owner','accountant')
           or (private.current_role() in ('manager','staff')
               and sj.location_id = private.current_location())
         )
    )
  );

drop policy if exists sales_job_items_update on public.sales_job_items;
create policy sales_job_items_update on public.sales_job_items
  for update to authenticated
  using (
    exists (
      select 1 from public.sales_jobs sj
       where sj.id = sales_job_items.sales_job_id
         and (
           private.current_role() in ('owner','accountant')
           or (private.current_role() in ('manager','staff')
               and sj.location_id = private.current_location())
         )
    )
  )
  with check (
    exists (
      select 1 from public.sales_jobs sj
       where sj.id = sales_job_items.sales_job_id
         and (
           private.current_role() in ('owner','accountant')
           or (private.current_role() in ('manager','staff')
               and sj.location_id = private.current_location())
         )
    )
  );

-- Purge the stale sets. Rows from the same save share created_at (statement
-- timestamp) but never a position; rows from different saves never share
-- created_at. So per (sales_job_id, position) the newest row is the live one
-- and everything older is a leftover from a blocked delete.
with ranked as (
  select id,
         row_number() over (
           partition by sales_job_id, position
           order by created_at desc, id desc
         ) as rn
    from public.sales_job_items
)
delete from public.sales_job_items i
 using ranked r
 where i.id = r.id
   and r.rn > 1;
