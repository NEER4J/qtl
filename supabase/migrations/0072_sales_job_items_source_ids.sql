-- 0072_sales_job_items_source_ids.sql
-- Remember which oil type / Trans & Diff service a job line was expanded from,
-- alongside the existing part_id. This lets the line-item editor detect when a
-- newly added package overlaps an item already on the job (same part category,
-- same oil, or same service) and offer "Merge" (drop the duplicate) vs
-- "Add separately". Pure reference columns — nullable, no behavioural triggers.

alter table public.sales_job_items
  add column if not exists oil_type_id uuid references public.oil_types(id),
  add column if not exists transmission_service_id uuid
    references public.transmission_services(id);

comment on column public.sales_job_items.oil_type_id is
  'Oil type this line was expanded from (package oil item). NULL for non-oil lines.';
comment on column public.sales_job_items.transmission_service_id is
  'Trans & Diff service this line was expanded from (package service item). NULL otherwise.';
