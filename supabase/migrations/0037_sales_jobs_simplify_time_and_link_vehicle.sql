-- 0037_sales_jobs_simplify_time_and_link_vehicle.sql
-- Sales-job changes:
--   * vehicle_id FK to the new vehicles table (item #4 multiple trucks)
--   * single job_time replacing start_time + end_time (item #6)
--   * advisor_name (item #7)
--   * free_grease_applied + override reason (item #15)
--
-- The old start_time / end_time / duration_minutes columns and carrier_name
-- are NOT dropped here — they remain populated by historical rows and the
-- analytics module. A follow-up migration (0040) drops them after PR3 lands
-- and the app stops writing them.

alter table public.sales_jobs
  add column if not exists vehicle_id uuid references public.vehicles(id),
  add column if not exists job_time time,
  add column if not exists advisor_name text,
  add column if not exists free_grease_applied boolean not null default false,
  add column if not exists free_grease_override_reason text;

create index if not exists sales_jobs_vehicle_idx
  on public.sales_jobs (vehicle_id) where vehicle_id is not null;
create index if not exists sales_jobs_advisor_idx
  on public.sales_jobs (advisor_name) where advisor_name is not null;
