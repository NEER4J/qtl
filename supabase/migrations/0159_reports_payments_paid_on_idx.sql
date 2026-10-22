-- 0159_reports_payments_paid_on_idx.sql
--
-- PERFORMANCE ONLY. No change to who can see or write what.
--
-- The daily report now lists every payment taken on the report date, on any
-- invoice (client 2026-10-20 — "the whole day's data": the cash drawer view),
-- i.e. `sales_payments where paid_on = $date`. The only index on paid_on is
-- sales_payments_job_idx (sales_job_id, paid_on) from 0005, which leads with
-- the job, so that read scans the whole table (~9k rows today, growing ~1k a
-- month). The monthly customer statement reads payments through the
-- customer's jobs and is already served by sales_payments_job_idx.

create index if not exists sales_payments_paid_on_idx
  on public.sales_payments (paid_on);

analyze public.sales_payments;
