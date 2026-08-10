-- 0129_monthly_sales_trend.sql
-- Month-bucketed companion to daily_sales_trend (0008) for the dashboard's
-- 3/6/12-month range views. A year of day×location rows would trip
-- PostgREST's 1000-row response cap, so bucket server-side instead.

create or replace function public.monthly_sales_trend(
  p_from date,
  p_to date,
  p_location uuid default null
)
returns table (
  month date,
  sales_total numeric,
  job_count integer
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select date_trunc('month', s.job_date)::date as month,
         sum(s.total) as sales_total,
         count(*)::int as job_count
    from public.sales_jobs s
   where s.deactivated_at is null
     and s.job_date between p_from and p_to
     and (p_location is null or s.location_id = p_location)
     and (
       private.current_role() in ('owner','accountant')
       or (private.current_role() in ('manager','staff')
           and s.location_id = private.current_location())
     )
   group by 1
   order by 1;
$$;

grant execute on function public.monthly_sales_trend(date, date, uuid) to authenticated;
