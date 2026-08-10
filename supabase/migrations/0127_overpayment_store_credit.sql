-- 0127_overpayment_store_credit.sql
-- Overpayment → store credit (client 2026-08-08, screenshot: Visa $617.87 on a
-- $595.28 invoice rejected with "Sum of payments cannot exceed amount due").
--
-- Shops sometimes take more than the invoice total (round card amounts,
-- customer pre-paying toward the account). The money is real, so:
--   * sales_payments keeps the FULL tendered amounts (card reconciliation
--     stays truthful);
--   * the JOB settles at exactly its amount due — paid_amount is capped so
--     sales_paid_chk (0118) still holds and outstanding never goes negative;
--   * the excess becomes a customer_credit_ledger entry (+$), posted by the
--     app layer (syncJobCreditLedger), visible as store credit on the
--     customer profile and applyable to any future invoice.
--
-- This migration only re-teaches the rollup trigger to cap: previously the
-- rolled-up paid_amount hit the check constraint and the whole payment insert
-- blew up, which is why overpaying was impossible even from the add-payment
-- dialog.

create or replace function public.sales_payments_rollup()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_job_id uuid;
  v_paid   numeric(12,2);
  v_total  numeric(12,2);
  v_credit numeric(12,2);
  v_due    numeric(12,2);
begin
  v_job_id := coalesce(new.sales_job_id, old.sales_job_id);

  select coalesce(sum(amount), 0)
    into v_paid
    from public.sales_payments
   where sales_job_id = v_job_id;

  select total, coalesce(credit_applied, 0)
    into v_total, v_credit
    from public.sales_jobs
   where id = v_job_id;

  if v_total is null then
    return coalesce(new, old);
  end if;

  v_due := v_total - v_credit;

  update public.sales_jobs
         -- Cap at amount due: the excess is store credit, not invoice payment.
     set paid_amount = least(v_paid, greatest(v_due, 0)),
         payment_status = case
           when v_due <= 0.005 then 'paid'::payment_status
           when v_paid <= 0 then 'outstanding'::payment_status
           when v_paid < v_due then 'partial'::payment_status
           else 'paid'::payment_status
         end
   where id = v_job_id;

  return coalesce(new, old);
end;
$$;
