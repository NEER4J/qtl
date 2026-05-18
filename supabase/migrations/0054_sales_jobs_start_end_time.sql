-- 0054_sales_jobs_start_end_time.sql
-- Re-introduce explicit start_time / end_time for jobs.
--
-- Migration 0037 collapsed start/end into a single `job_time`. The operator
-- wants the two-field model back so job duration is captured from real form
-- inputs (and the existing duration_minutes generated column / analytics
-- pipeline becomes a first-class feature, not a vestige of historical data).
--
-- Shape change on public.sales_jobs:
--   * start_time : timestamptz -> time   (time-of-day; same TZ as the shop)
--   * end_time   : timestamptz -> time
--   * job_time   : dropped (its value is migrated into start_time first)
--   * duration_minutes : generated column recreated over the new time columns
--
-- For any pre-0037 rows that still hold a timestamptz value, the time-of-day
-- portion is extracted in America/Toronto (the operator's local TZ) so the
-- visible time on screen does not shift.

-- The generated column depends on the old start_time/end_time types, so it has
-- to be dropped before we can alter their types.
alter table public.sales_jobs
  drop column if exists duration_minutes;

-- Convert the legacy timestamptz columns to time-of-day. NULLs stay NULL.
alter table public.sales_jobs
  alter column start_time type time
  using (case when start_time is null then null
              else (start_time at time zone 'America/Toronto')::time end);

alter table public.sales_jobs
  alter column end_time type time
  using (case when end_time is null then null
              else (end_time at time zone 'America/Toronto')::time end);

-- Carry forward the consolidated job_time into start_time where start_time was
-- empty (i.e. every row written between 0037 and now).
update public.sales_jobs
   set start_time = job_time
 where start_time is null
   and job_time is not null;

alter table public.sales_jobs
  drop column if exists job_time;

-- Re-create the generated duration column over the new time-of-day fields.
-- Same-day jobs only — a negative diff (end < start, i.e. data entry error)
-- clamps to 0 rather than wrapping.
alter table public.sales_jobs
  add column duration_minutes integer generated always as (
    case
      when start_time is not null and end_time is not null
        then greatest(0, (extract(epoch from (end_time - start_time))::int) / 60)
      else null
    end
  ) stored;
