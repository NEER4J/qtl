-- 0025_sales_pricing_link.sql
-- Phase 4 — Link a sales job back to the catalog so we can auto-fill the
-- subtotal from oil_change_price() and report revenue per oil/engine.

alter table public.sales_jobs
  add column if not exists engine_type_id uuid references public.engine_types(id),
  add column if not exists oil_type_id    uuid references public.oil_types(id),
  add column if not exists oil_container  text check (oil_container is null or oil_container in ('bulk', 'gallon')),
  add column if not exists auto_priced_at timestamptz;

create index if not exists idx_sales_jobs_engine on public.sales_jobs(engine_type_id) where engine_type_id is not null;
create index if not exists idx_sales_jobs_oil    on public.sales_jobs(oil_type_id)    where oil_type_id    is not null;
