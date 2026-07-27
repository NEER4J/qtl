-- 0118_sales_credits_returns.sql
--
-- Mixed sale + return invoices (scenario B): line items may be negative and
-- the job sub_total / hst / total may net negative. HST reverses on taxable
-- credit lines (computed in the app from the taxable subtotal).
--
-- Store credit: when a job nets negative the customer earns credit; on later
-- jobs credit_applied reduces what they owe. Ledger rows audit every movement.

-- ----------------------------------------------------------------------------
-- sales_jobs — allow signed totals; track credit applied + optional link-back
-- ----------------------------------------------------------------------------

alter table public.sales_jobs
  drop constraint if exists sales_jobs_sub_total_check;
alter table public.sales_jobs
  drop constraint if exists sales_jobs_hst_check;
alter table public.sales_jobs
  drop constraint if exists sales_jobs_total_check;
alter table public.sales_jobs
  drop constraint if exists sales_paid_chk;

alter table public.sales_jobs
  add column if not exists credit_applied numeric(12,2) not null default 0;

alter table public.sales_jobs
  drop constraint if exists sales_jobs_credit_applied_check;
alter table public.sales_jobs
  add constraint sales_jobs_credit_applied_check check (credit_applied >= 0);

alter table public.sales_jobs
  add column if not exists credited_from_job_id uuid
    references public.sales_jobs(id) on delete set null;

comment on column public.sales_jobs.credit_applied is
  'Store credit from the customer account applied to this invoice (reduces amount due).';
comment on column public.sales_jobs.credited_from_job_id is
  'Optional link to the original invoice when this job includes a return / credit.';

-- outstanding must include store credit applied alongside cash payments.
-- Preflight: existing rows must satisfy the new payment rule before we add it.
do $$
declare
  v_bad integer;
begin
  select count(*) into v_bad
    from public.sales_jobs
   where deactivated_at is null
     and (
       (total >= 0 and paid_amount + coalesce(credit_applied, 0) > total + 0.01)
       or (total < 0 and (paid_amount > 0.005 or coalesce(credit_applied, 0) > 0.005))
     );
  if v_bad > 0 then
    raise exception
      '0118 preflight failed: % active sales_jobs row(s) violate sales_paid_chk — fix paid_amount/total before migrating',
      v_bad;
  end if;
end $$;

alter table public.sales_jobs drop column if exists outstanding;
alter table public.sales_jobs
  add column outstanding numeric(12,2)
    generated always as (total - paid_amount - credit_applied) stored;

alter table public.sales_jobs
  add constraint sales_paid_chk check (
    paid_amount >= 0
    and credit_applied >= 0
    and (
      (total >= 0 and paid_amount + credit_applied <= total + 0.01)
      or (total < 0 and paid_amount <= 0.005 and credit_applied <= 0.005)
    )
  );

create index if not exists sales_jobs_credited_from_idx
  on public.sales_jobs (credited_from_job_id)
  where credited_from_job_id is not null;

-- ----------------------------------------------------------------------------
-- customer_credit_ledger — signed running log per customer
-- Positive amount = credit issued; negative = credit consumed on a job.
-- ----------------------------------------------------------------------------

create table if not exists public.customer_credit_ledger (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.customers(id),
  sales_job_id  uuid references public.sales_jobs(id) on delete set null,
  amount        numeric(12,2) not null check (amount <> 0),
  notes         text,
  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id)
);

create index if not exists customer_credit_ledger_customer_idx
  on public.customer_credit_ledger (customer_id, created_at desc);
create index if not exists customer_credit_ledger_job_idx
  on public.customer_credit_ledger (sales_job_id)
  where sales_job_id is not null;

comment on table public.customer_credit_ledger is
  'Audit log of store-credit movements. Sum(amount) per customer = available balance.';

alter table public.customer_credit_ledger enable row level security;

drop policy if exists customer_credit_ledger_select on public.customer_credit_ledger;
create policy customer_credit_ledger_select on public.customer_credit_ledger
  for select to authenticated
  using (true);

drop policy if exists customer_credit_ledger_insert on public.customer_credit_ledger;
create policy customer_credit_ledger_insert on public.customer_credit_ledger
  for insert to authenticated
  with check (
    private.current_role() in (
      'owner', 'co_owner', 'manager', 'supervisor', 'staff', 'accountant'
    )
  );

-- Needed when a job is edited and ledger rows are replaced for that job.
drop policy if exists customer_credit_ledger_delete on public.customer_credit_ledger;
create policy customer_credit_ledger_delete on public.customer_credit_ledger
  for delete to authenticated
  using (
    private.current_role() in (
      'owner', 'co_owner', 'manager', 'supervisor', 'staff', 'accountant'
    )
  );

-- ----------------------------------------------------------------------------
-- sales_payments_rollup — settle against total minus store credit applied
-- ----------------------------------------------------------------------------

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
     set paid_amount = v_paid,
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
