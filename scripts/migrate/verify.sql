-- scripts/migrate/verify.sql
-- Run this AFTER `npm run migrate -- --commit` to sanity-check the import.
-- Safe to run in any environment (read-only).
--
-- Expected Phase 1 volumes (per doc/QTL Plan.md §7):
--   sales_jobs:  ~935
--   expenses:    ~263
--   customers:   de-duped subset of the ~935 sales rows
--   vendors:     de-duped subset of the expense-sheet vendor columns
--   audit_log(action='insert'): >= sum of the above + payment backfills
--
-- Usage:
--   psql "$DATABASE_URL" -f scripts/migrate/verify.sql
-- or paste into Supabase SQL editor.

\echo '=============================================================='
\echo 'QTL — post-migration verification'
\echo '=============================================================='

\echo ''
\echo '--- Row counts (active) ---'
select 'sales_jobs'         as table, count(*) from public.sales_jobs          where deactivated_at is null
union all select 'expenses', count(*) from public.expenses                      where deactivated_at is null
union all select 'customers',        count(*) from public.customers            where active
union all select 'vendors',          count(*) from public.vendors              where active
union all select 'sales_payments',   count(*) from public.sales_payments
union all select 'expense_payments', count(*) from public.expense_payments
order by 1;

\echo ''
\echo '--- Audit coverage (must equal or exceed the counts above) ---'
select table_name, action, count(*)
  from public.audit_log
 where action = 'insert'
   and table_name in ('sales_jobs','expenses','customers','vendors','sales_payments','expense_payments')
 group by 1, 2
 order by 1, 2;

\echo ''
\echo '--- Orphaned actor_id in audit_log (must be 0 rows) ---'
select count(*) as null_actor_rows
  from public.audit_log
 where actor_id is null
   and action = 'insert';

\echo ''
\echo '--- migration_source tracking coverage ---'
select target_table, count(*)
  from public.migration_source
 group by 1
 order by 1;

\echo ''
\echo '--- Payment rollup consistency ---'
-- Any sales_job whose paid_amount does not equal sum(payments)?
select count(*) as sales_rollup_mismatches
  from public.sales_jobs sj
  left join lateral (
    select coalesce(sum(amount), 0) as paid
      from public.sales_payments sp
     where sp.sales_job_id = sj.id
  ) p on true
 where abs(sj.paid_amount - p.paid) > 0.005;

select count(*) as expense_rollup_mismatches
  from public.expenses e
  left join lateral (
    select coalesce(sum(amount), 0) as paid
      from public.expense_payments ep
     where ep.expense_id = e.id
  ) p on true
 where abs(e.paid_amount - p.paid) > 0.005;

\echo ''
\echo '--- Money invariant: total == sub_total + hst (within 2 cents) ---'
select count(*) as sales_total_violations
  from public.sales_jobs
 where abs(total - (sub_total + hst)) > 0.02;

select count(*) as expense_total_violations
  from public.expenses
 where abs(total - (sub_total + hst)) > 0.02;

\echo ''
\echo '--- payment_status distribution (sales) ---'
select payment_status, count(*)
  from public.sales_jobs
 where deactivated_at is null
 group by 1
 order by 1;

\echo ''
\echo '--- payment_status distribution (expenses) ---'
select payment_status, count(*)
  from public.expenses
 where deactivated_at is null
 group by 1
 order by 1;

\echo ''
\echo '--- Invoice collisions (should be 0 — unique index enforces) ---'
select location_id, invoice_no, count(*) as dupes
  from public.sales_jobs
 where deactivated_at is null
 group by 1, 2
having count(*) > 1;

\echo ''
\echo '--- Per-location totals (spot-check against Excel P&L) ---'
select l.code, l.name,
       (select count(*)  from public.sales_jobs s where s.location_id = l.id and s.deactivated_at is null) as sales_rows,
       (select sum(total) from public.sales_jobs s where s.location_id = l.id and s.deactivated_at is null) as sales_total,
       (select sum(total) from public.expenses   e where e.location_id = l.id and e.deactivated_at is null) as expense_total
  from public.locations l
 order by l.name;

\echo ''
\echo '=============================================================='
\echo 'Done. Anything with non-zero "violations" or "mismatches"'
\echo 'above warrants investigation before retiring the Excel files.'
\echo '=============================================================='
