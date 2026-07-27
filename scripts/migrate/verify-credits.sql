-- scripts/migrate/verify-credits.sql
-- Run AFTER applying migrations 0117 + 0118 (read-only).
--
-- Usage:
--   psql "$DATABASE_URL" -f scripts/migrate/verify-credits.sql

\echo '=============================================================='
\echo 'QTL — post 0117/0118 verification'
\echo '=============================================================='

\echo ''
\echo '--- New columns exist ---'
select
  exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'sales_jobs'
       and column_name = 'stock_override'
  ) as has_stock_override,
  exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'sales_jobs'
       and column_name = 'credit_applied'
  ) as has_credit_applied,
  exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'sales_jobs'
       and column_name = 'credited_from_job_id'
  ) as has_credited_from_job_id,
  exists (
    select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'customer_credit_ledger'
  ) as has_credit_ledger;

\echo ''
\echo '--- Outstanding formula (must be 0 mismatches) ---'
select count(*) as outstanding_formula_mismatches
  from public.sales_jobs
 where abs(outstanding - (total - paid_amount - credit_applied)) > 0.005;

\echo ''
\echo '--- sales_paid_chk violations (must be 0) ---'
select count(*) as sales_paid_chk_violations
  from public.sales_jobs
 where deactivated_at is null
   and (
     paid_amount < 0
     or credit_applied < 0
     or (total >= 0 and paid_amount + credit_applied > total + 0.01)
     or (total < 0 and (paid_amount > 0.005 or credit_applied > 0.005))
   );

\echo ''
\echo '--- Payment rollup vs sales_payments (must be 0 mismatches) ---'
select count(*) as sales_rollup_mismatches
  from public.sales_jobs sj
  left join lateral (
    select coalesce(sum(amount), 0) as paid
      from public.sales_payments sp
     where sp.sales_job_id = sj.id
  ) p on true
 where abs(sj.paid_amount - p.paid) > 0.005;

\echo ''
\echo '--- stock_qty column removed from sales_job_items (must be false) ---'
select exists (
  select 1 from information_schema.columns
   where table_schema = 'public' and table_name = 'sales_job_items'
     and column_name = 'stock_qty'
) as stock_qty_still_exists;

\echo ''
\echo '--- Negative stock allowed (constraints dropped) ---'
select
  exists (
    select 1 from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
     where n.nspname = 'public' and t.relname = 'part_location_stock'
       and c.conname = 'part_location_stock_qty_check'
  ) as part_qty_check_still_exists,
  exists (
    select 1 from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
     where n.nspname = 'public' and t.relname = 'oil_location_stock'
       and c.conname = 'oil_location_stock_qty_check'
  ) as oil_qty_check_still_exists;

\echo ''
\echo 'Done. All counts above should be 0 / false / true as labelled.'
\echo '=============================================================='
