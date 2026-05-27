-- 0070_co_owner_functions_storage.sql
--
-- Completes co_owner parity for the two places the generic RLS bypass in
-- 0067 does NOT reach:
--
--   1. SECURITY DEFINER aggregate functions (public.my_dashboard etc.) that
--      filter rows by role *inside the function body*. RLS policies don't
--      apply there, so the `= 'owner'` checks silently excluded co_owner.
--      (These are legacy — the dashboard now queries tables directly — but we
--      keep them correct in case anything still calls them.)
--
--   2. storage.objects policies for the `invoices` bucket. Storage lives in
--      the `storage` schema, which 0067's public-schema loop skipped. PDF
--      upload/download in the app goes through the service-role admin client
--      (which bypasses RLS), so this is belt-and-suspenders, but a co_owner
--      using the Supabase client directly should still have owner parity.
--
-- All updates use private.is_owner(), which 0067 redefined to mean
-- "owner OR co_owner".

-- ----------------------------------------------------------------------------
-- 1. Dashboard aggregate functions
-- ----------------------------------------------------------------------------
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
     private.is_owner()
     or (private.current_role() = 'manager'
         and s.location_id = private.current_location())
     or (private.current_role() = 'accountant')
   );
$$;

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
       private.is_owner()
       or private.current_role() = 'accountant'
       or (private.current_role() in ('manager','staff')
           and s.location_id = private.current_location())
     )
   group by s.job_date, s.location_id
   order by day;
$$;

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
       private.is_owner()
       or private.current_role() = 'accountant'
       or (private.current_role() = 'manager'
           and e.location_id = private.current_location())
     )
   group by c.id, c.name
   order by c.sort_order, c.name;
$$;

-- ----------------------------------------------------------------------------
-- 2. Storage policies — co_owner parity on the invoices bucket.
--    Additive policies (OR'd with the existing owner/accountant ones).
-- ----------------------------------------------------------------------------
drop policy if exists invoices_select_co_owner on storage.objects;
create policy invoices_select_co_owner on storage.objects
  for select to authenticated
  using (bucket_id = 'invoices' and private.is_owner());

drop policy if exists invoices_insert_co_owner on storage.objects;
create policy invoices_insert_co_owner on storage.objects
  for insert to authenticated
  with check (bucket_id = 'invoices' and private.is_owner());

drop policy if exists invoices_delete_co_owner on storage.objects;
create policy invoices_delete_co_owner on storage.objects
  for delete to authenticated
  using (bucket_id = 'invoices' and private.is_owner());
