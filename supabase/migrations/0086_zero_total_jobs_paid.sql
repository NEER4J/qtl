-- 0086_zero_total_jobs_paid.sql
-- A $0 job (e.g. free-grease only) is settled, not outstanding. The app-layer
-- deriveStatus() now returns 'paid' for total<=0, but two more places need it:
--   1. the sales_payments rollup trigger (would flip a $0 job back to
--      'outstanding' if payments ever churn), and
--   2. existing rows already saved as 'outstanding' before this fix.

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
begin
  v_job_id := coalesce(new.sales_job_id, old.sales_job_id);

  select coalesce(sum(amount), 0)
    into v_paid
    from public.sales_payments
   where sales_job_id = v_job_id;

  select total into v_total from public.sales_jobs where id = v_job_id;
  if v_total is null then
    -- parent row is gone; nothing to update
    return coalesce(new, old);
  end if;

  update public.sales_jobs
     set paid_amount = v_paid,
         payment_status = case
           when v_total <= 0.005 then 'paid'::payment_status
           when v_paid <= 0 then 'outstanding'::payment_status
           when v_paid < v_total then 'partial'::payment_status
           else 'paid'::payment_status
         end
   where id = v_job_id;

  return coalesce(new, old);
end;
$$;

-- Clean up existing $0 jobs that are wrongly flagged outstanding/partial.
update public.sales_jobs
set payment_status = 'paid'
where total <= 0.005
  and payment_status <> 'paid'
  and deactivated_at is null;
