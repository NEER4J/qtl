-- 0142_sales_job_items_cross_location.sql
--
-- FIX: an All-locations / Multiple-locations manager could not edit (or
-- create) an invoice at any shop other than their home one.
--
-- 0061 added a cross-location "bypass" policy for every location-scoped table
-- it knew about, and 0137 widened those to the Multiple mode. sales_job_items
-- was never on that list — its policies (0027, 0128) still gate every write on
-- `sj.location_id = private.current_location()`, i.e. the HOME shop only.
--
-- The result on edit (updateSalesJob): the sales_jobs UPDATE passes through
-- sales_jobs_cross_loc_update, then replaceJobItems' DELETE on the items is
-- silently filtered to zero rows by RLS, and the action aborts with "You don't
-- have permission to replace this job's line items". The header change sticks,
-- the lines don't, and the user sees an error. On create the INSERT of the
-- items is refused outright, leaving a header with no lines.
--
-- Same additive strategy as 0061 / 0137: leave the base policies alone and add
-- one permissive bypass policy per operation. Roles mirror the matching
-- sales_jobs bypass policies so the items can never be written where the job
-- itself can't:
--   insert  → manager, staff   (sales_jobs_cross_loc_insert)
--   update  → manager          (sales_jobs_cross_loc_update)
--   delete  → manager          (sales_jobs_cross_loc_update — delete is only
--                               ever issued as part of an edit)
--
-- Predicate shape is copied from 0137 on purpose — read the PERFORMANCE note
-- there before "simplifying" the coalesce / sub-select wrapping.
--
-- Idempotent — safe to run more than once.

drop policy if exists sales_job_items_cross_loc_insert on public.sales_job_items;
create policy sales_job_items_cross_loc_insert on public.sales_job_items
  for insert to authenticated
  with check (
    (select private.current_role()) in ('manager', 'staff')
    and exists (
      select 1 from public.sales_jobs sj
       where sj.id = sales_job_items.sales_job_id
         and (
           (select private.has_cross_location())
           or sj.location_id = any (coalesce((select private.extra_locations()), array[]::uuid[]))
         )
    )
  );

drop policy if exists sales_job_items_cross_loc_update on public.sales_job_items;
create policy sales_job_items_cross_loc_update on public.sales_job_items
  for update to authenticated
  using (
    (select private.current_role()) = 'manager'
    and exists (
      select 1 from public.sales_jobs sj
       where sj.id = sales_job_items.sales_job_id
         and (
           (select private.has_cross_location())
           or sj.location_id = any (coalesce((select private.extra_locations()), array[]::uuid[]))
         )
    )
  )
  with check (
    (select private.current_role()) = 'manager'
    and exists (
      select 1 from public.sales_jobs sj
       where sj.id = sales_job_items.sales_job_id
         and (
           (select private.has_cross_location())
           or sj.location_id = any (coalesce((select private.extra_locations()), array[]::uuid[]))
         )
    )
  );

drop policy if exists sales_job_items_cross_loc_delete on public.sales_job_items;
create policy sales_job_items_cross_loc_delete on public.sales_job_items
  for delete to authenticated
  using (
    (select private.current_role()) = 'manager'
    and exists (
      select 1 from public.sales_jobs sj
       where sj.id = sales_job_items.sales_job_id
         and (
           (select private.has_cross_location())
           or sj.location_id = any (coalesce((select private.extra_locations()), array[]::uuid[]))
         )
    )
  );
