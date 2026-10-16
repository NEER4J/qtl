-- 0154_performance_indexes.sql
--
-- PERFORMANCE ONLY. No change to who can see or write what.
--
-- 1. Finish 0119. Its regex looked for `private.current_role()`, but
--    pg_policies deparses that call as `private."current_role"()` (CURRENT_ROLE
--    is a reserved SQL keyword, so the name is quoted). The pattern never
--    matched it, and 0119's own check used the same pattern, so it reported
--    success. current_role() is still evaluated once per row in 88 policies.
--    0119 also did not know the later helpers (has_cross_location,
--    extra_locations, can_edit_inventory, portal_customer_ids). This block
--    re-runs the same catalogue-driven ALTER POLICY approach with a pattern
--    that handles both problems. A negative lookbehind skips calls that are
--    already wrapped, so the block is idempotent and never wraps a call twice.
-- 2. Wrap the same helpers inside the dashboard RPCs (bodies otherwise
--    identical to 0070 / 0129).
-- 3. Indexes: audit_log by time, an all-locations expenses list index,
--    trigram search on expenses, and unindexed foreign keys.

-- ----------------------------------------------------------------------------
-- 1. RLS: evaluate helpers once per statement (InitPlan), not once per row.
-- ----------------------------------------------------------------------------

-- 1a. The two portal policies (latest definition: 0013) compare against the
--     uuid[] returned by portal_customer_ids(). A bare `= any ((select f()))`
--     parses as the sub-query form of ANY (uuid = uuid[] -> error), so these
--     two are written by hand with an explicit array cast. Same semantics.
alter policy sales_jobs_portal_select on public.sales_jobs
  using (
    (select private.current_role())::text = 'portal_customer'
    and customer_id is not null
    and customer_id = any ((select private.portal_customer_ids())::uuid[])
    and deactivated_at is null
  );

alter policy sales_payments_portal_select on public.sales_payments
  using (
    (select private.current_role())::text = 'portal_customer'
    and exists (
      select 1 from public.sales_jobs sj
      where sj.id = sales_payments.sales_job_id
        and sj.customer_id = any ((select private.portal_customer_ids())::uuid[])
    )
  );

-- 1b. Everything else, rewritten from the live catalogue.
do $$
declare
  r           record;
  v_qual      text;
  v_check     text;
  v_sql       text;
  v_rewritten int := 0;
  v_failed    int := 0;
  -- Zero-argument STABLE helpers whose answer cannot change mid-statement.
  -- `"current_role"` is the quoted form the catalogue really emits.
  -- (?<!SELECT ) leaves a call alone if it is already the body of a scalar
  -- sub-select, i.e. `( SELECT private.is_owner() AS is_owner)`.
  c_pattern constant text :=
    '(?<!SELECT )(private\.(?:"current_role"|current_role|current_location|can_enter_expenses|is_owner|has_cross_location|extra_locations|can_edit_inventory|portal_customer_ids)\(\)|auth\.(?:uid|jwt|role)\(\))';
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
      from pg_policies
     where schemaname = 'public'
       and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ c_pattern
     order by tablename, policyname
  loop
    v_qual  := regexp_replace(r.qual,       c_pattern, '(select \1)', 'g');
    v_check := regexp_replace(r.with_check, c_pattern, '(select \1)', 'g');

    v_sql := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    if v_qual  is not null then v_sql := v_sql || format(' using (%s)', v_qual); end if;
    if v_check is not null then v_sql := v_sql || format(' with check (%s)', v_check); end if;

    begin
      execute v_sql;
      v_rewritten := v_rewritten + 1;
    exception when others then
      v_failed := v_failed + 1;
      raise warning 'rls initplan (0154): could not rewrite %.% policy % (%)',
        r.schemaname, r.tablename, r.policyname, sqlerrm;
    end;
  end loop;

  raise notice 'rls initplan (0154): % rewritten, % failed', v_rewritten, v_failed;
end $$;

-- Verification with the corrected pattern. Expected 0.
do $$
declare v_remaining int;
begin
  select count(*) into v_remaining
    from pg_policies
   where schemaname = 'public'
     and (coalesce(qual, '') || ' ' || coalesce(with_check, ''))
         ~ '(?<!SELECT )(private\.(?:"current_role"|current_role|current_location|can_enter_expenses|is_owner|has_cross_location|extra_locations|can_edit_inventory|portal_customer_ids)\(\)|auth\.(?:uid|jwt|role)\(\))';
  if v_remaining > 0 then
    raise warning 'rls initplan (0154): % policies still call a helper per row', v_remaining;
  else
    raise notice 'rls initplan (0154): no per-row helper calls left in public policies';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 2. Dashboard RPCs. These are SECURITY DEFINER, so RLS does not apply, but
--    their WHERE clauses call the same helpers per sales/expense row.
--    Bodies are the same as 0070 / 0129 except for the (select ...) wrapping.
--    CREATE OR REPLACE keeps the existing EXECUTE grants.
-- ----------------------------------------------------------------------------
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
       (select private.is_owner())
       or (select private.current_role()) = 'accountant'
       or ((select private.current_role()) in ('manager','staff')
           and s.location_id = (select private.current_location()))
     )
   group by s.job_date, s.location_id
   order by day;
$$;

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
       (select private.current_role()) in ('owner','accountant')
       or ((select private.current_role()) in ('manager','staff')
           and s.location_id = (select private.current_location()))
     )
   group by 1
   order by 1;
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
       (select private.is_owner())
       or (select private.current_role()) = 'accountant'
       or ((select private.current_role()) = 'manager'
           and e.location_id = (select private.current_location()))
     )
   group by c.id, c.name
   order by c.sort_order, c.name;
$$;

-- ----------------------------------------------------------------------------
-- 3. Indexes
-- ----------------------------------------------------------------------------

-- audit_log: listAuditLog() orders by `at desc` with optional gte/lte on `at`
-- (lib/actions/audit.ts:35-46). The existing indexes all lead with
-- actor_id / location_id / table_name, so an owner or accountant page
-- (no filter) sorted the whole table.
create index if not exists audit_log_at_idx
  on public.audit_log (at desc);
-- The same page filtered to one table (`.eq("table_name", ...)`).
create index if not exists audit_log_table_at_idx
  on public.audit_log (table_name, at desc);

-- expenses: listExpenses() (lib/actions/expenses.ts:52-60) mirrors the sales
-- list's order (expense_date desc, created_at desc, deactivated_at is null).
-- Sales has sales_jobs_date_created_idx; expenses only had
-- (location_id, expense_date), which does not help all-location viewers.
-- Also serves the date-range reads in reports.ts / analytics.ts and
-- expense_breakdown_by_category.
create index if not exists expenses_date_created_idx
  on public.expenses (expense_date desc, created_at desc)
  where deactivated_at is null;

-- expenses search: `.or(invoice_no.ilike.%q%, vendor_name_snapshot.ilike.%q%)`
-- (lib/actions/expenses.ts:72). Both columns are text, so trigram GIN works.
-- A BitmapOr needs an index on EVERY arm, so both are required.
-- The opclass is resolved by schema, the same way 0121 does, because pg_trgm
-- is in `extensions` on Supabase but may be in `public` where 0120's
-- unqualified CREATE EXTENSION ran first.
create extension if not exists pg_trgm with schema extensions;

do $$
declare v_schema text;
begin
  select n.nspname into v_schema
    from pg_opclass oc
    join pg_am am on am.oid = oc.opcmethod
    join pg_namespace n on n.oid = oc.opcnamespace
   where oc.opcname = 'gin_trgm_ops' and am.amname = 'gin'
   limit 1;

  if v_schema is null then
    raise exception 'pg_trgm opclass gin_trgm_ops not found';
  end if;

  execute format(
    'create index if not exists expenses_invoice_no_trgm '
    'on public.expenses using gin (invoice_no %I.gin_trgm_ops)', v_schema);
  execute format(
    'create index if not exists expenses_vendor_name_snapshot_trgm '
    'on public.expenses using gin (vendor_name_snapshot %I.gin_trgm_ops)', v_schema);
end $$;

-- Unindexed foreign keys on the largest child table. Every DELETE of an
-- oil_types or transmission_services row, and every merge that repoints
-- them, otherwise scans all of sales_job_items for the FK check.
-- Partial because most lines are parts, which leave both columns null.
create index if not exists sales_job_items_oil_type_idx
  on public.sales_job_items (oil_type_id)
  where oil_type_id is not null;
create index if not exists sales_job_items_transmission_service_idx
  on public.sales_job_items (transmission_service_id)
  where transmission_service_id is not null;

-- Smaller unindexed FKs (cheap to add, used by catalogue deletes and merges).
create index if not exists part_package_items_part_idx
  on public.part_package_items (part_id)
  where part_id is not null;
create index if not exists part_package_items_oil_type_idx
  on public.part_package_items (oil_type_id)
  where oil_type_id is not null;
create index if not exists engine_filters_part_idx
  on public.engine_filters (part_id);
create index if not exists vendor_invoice_items_vendor_part_idx
  on public.vendor_invoice_items (vendor_part_id)
  where vendor_part_id is not null;
-- get_my_pay() filters employees by profile_id = auth.uid() (0094).
create index if not exists employees_profile_idx
  on public.employees (profile_id)
  where profile_id is not null;

analyze public.audit_log;
analyze public.expenses;
analyze public.sales_job_items;
