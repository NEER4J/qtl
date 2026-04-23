-- 0008_dashboard_fn.sql
-- Aggregators used by dashboards. Security-definer so managers can see summary
-- totals across all locations without RLS broadening. Each returns pre-rolled
-- numbers — no row detail.

-- ============================================================================
-- public.location_summary(from, to)
-- ============================================================================
create or replace function public.location_summary(p_from date, p_to date)
returns table (
  location_id    uuid,
  location_code  text,
  location_name  text,
  sales_total    numeric,
  expense_total  numeric,
  outstanding    numeric,
  job_count      integer
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select l.id,
         l.code,
         l.name,
         coalesce(s.total, 0)        as sales_total,
         coalesce(e.total, 0)        as expense_total,
         coalesce(s.outstanding, 0)  as outstanding,
         coalesce(s.jobs, 0)::int    as job_count
    from public.locations l
    left join (
      select location_id,
             sum(total)       as total,
             sum(outstanding) as outstanding,
             count(*)         as jobs
        from public.sales_jobs
       where deactivated_at is null
         and job_date between p_from and p_to
       group by location_id
    ) s on s.location_id = l.id
    left join (
      select location_id,
             sum(total) as total
        from public.expenses
       where deactivated_at is null
         and expense_date between p_from and p_to
       group by location_id
    ) e on e.location_id = l.id
   where l.active = true
   order by l.name;
$$;

grant execute on function public.location_summary(date, date) to authenticated;

-- ============================================================================
-- public.my_dashboard(from, to)
-- Role-aware wrapper: Owner gets all 3 rows; manager gets own location only.
-- ============================================================================
create or replace function public.my_dashboard(p_from date, p_to date)
returns table (
  location_id    uuid,
  location_code  text,
  location_name  text,
  sales_total    numeric,
  expense_total  numeric,
  outstanding    numeric,
  job_count      integer
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select * from public.location_summary(p_from, p_to) s
   where (
     private.current_role() = 'owner'
     or (private.current_role() = 'manager'
         and s.location_id = private.current_location())
     or (private.current_role() = 'accountant')
   );
$$;

grant execute on function public.my_dashboard(date, date) to authenticated;

-- ============================================================================
-- public.daily_sales_trend(from, to, location_id?)
-- Bar/line chart data. Day-by-day totals.
-- ============================================================================
create or replace function public.daily_sales_trend(
  p_from date,
  p_to date,
  p_location uuid default null
)
returns table (
  day date,
  location_id uuid,
  sales_total numeric,
  job_count integer
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select s.job_date as day,
         s.location_id,
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
   group by s.job_date, s.location_id
   order by day;
$$;

grant execute on function public.daily_sales_trend(date, date, uuid) to authenticated;

-- ============================================================================
-- public.expense_breakdown_by_category(from, to, location_id?)
-- Donut chart data.
-- ============================================================================
create or replace function public.expense_breakdown_by_category(
  p_from date,
  p_to date,
  p_location uuid default null
)
returns table (
  category_id uuid,
  category_name text,
  total numeric
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select c.id,
         c.name,
         coalesce(sum(e.total), 0) as total
    from public.expense_categories c
    left join public.expenses e on e.category_id = c.id
     and e.deactivated_at is null
     and e.expense_date between p_from and p_to
     and (p_location is null or e.location_id = p_location)
     and (
       private.current_role() in ('owner','accountant')
       or (private.current_role() = 'manager'
           and e.location_id = private.current_location())
     )
   group by c.id, c.name
   order by c.sort_order, c.name;
$$;

grant execute on function public.expense_breakdown_by_category(date, date, uuid) to authenticated;
