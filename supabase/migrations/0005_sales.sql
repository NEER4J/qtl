-- 0005_sales.sql
-- sales_jobs (the daily job/invoice record) and sales_payments (partial pay
-- log). paid_amount + payment_status are kept in sync by a trigger on
-- sales_payments.

-- ============================================================================
-- sales_jobs
-- ============================================================================
create table if not exists public.sales_jobs (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id),
  job_date date not null,

  -- bay / position
  bay_no smallint,
  upper_deck text,
  lower_deck text,

  -- customer + invoice
  invoice_no text not null,
  customer_id uuid references public.customers(id),
  billing_name text not null,
  license_plate text,
  contact_no text,
  email citext,
  odometer integer,

  -- service
  service_type_id uuid not null references public.service_types(id),
  carrier_name text,
  start_time timestamptz,
  end_time timestamptz,
  duration_minutes integer generated always as (
    case when start_time is not null and end_time is not null
         then greatest(0, (extract(epoch from (end_time - start_time))::int) / 60)
         else null end
  ) stored,
  comments text,

  -- money
  sub_total numeric(12,2) not null check (sub_total >= 0),
  hst numeric(12,2) not null check (hst >= 0),
  total numeric(12,2) not null check (total >= 0),
  paid_amount numeric(12,2) not null default 0 check (paid_amount >= 0),
  outstanding numeric(12,2) generated always as (total - paid_amount) stored,

  payment_mode payment_mode,
  payment_status payment_status not null default 'outstanding',

  batch_id uuid,

  -- soft delete
  deactivated_at timestamptz,
  deactivated_by uuid references auth.users(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),

  constraint sales_total_chk check (abs(total - (sub_total + hst)) < 0.02),
  constraint sales_paid_chk  check (paid_amount <= total + 0.01)
);

-- Unique invoice per location, active rows only
create unique index if not exists sales_invoice_active_uniq
  on public.sales_jobs (location_id, invoice_no) where deactivated_at is null;

create index if not exists sales_location_date_idx
  on public.sales_jobs (location_id, job_date desc);
create index if not exists sales_customer_idx
  on public.sales_jobs (customer_id);
create index if not exists sales_status_idx
  on public.sales_jobs (payment_status) where deactivated_at is null;
create index if not exists sales_batch_idx
  on public.sales_jobs (batch_id);
create index if not exists sales_service_type_idx
  on public.sales_jobs (service_type_id);

drop trigger if exists trg_sales_jobs_updated_at on public.sales_jobs;
create trigger trg_sales_jobs_updated_at
  before update on public.sales_jobs
  for each row execute function public.set_updated_at();

drop trigger if exists trg_sales_jobs_audit on public.sales_jobs;
create trigger trg_sales_jobs_audit
  after insert or update on public.sales_jobs
  for each row execute function public.audit_row();

alter table public.sales_jobs enable row level security;

-- ============================================================================
-- sales_payments (partial payment log)
-- ============================================================================
create table if not exists public.sales_payments (
  id uuid primary key default gen_random_uuid(),
  sales_job_id uuid not null references public.sales_jobs(id) on delete restrict,
  paid_on date not null default current_date,
  amount numeric(12,2) not null check (amount > 0),
  mode payment_mode not null,
  transaction_id text,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists sales_payments_job_idx
  on public.sales_payments (sales_job_id, paid_on);

drop trigger if exists trg_sales_payments_audit on public.sales_payments;
create trigger trg_sales_payments_audit
  after insert or update or delete on public.sales_payments
  for each row execute function public.audit_row();

alter table public.sales_payments enable row level security;

-- ============================================================================
-- Rollup trigger: keep sales_jobs.paid_amount + payment_status in sync with
-- the sum of sales_payments. Also covers DELETE (owner-only path).
-- ============================================================================
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
           when v_paid <= 0 then 'outstanding'::payment_status
           when v_paid < v_total then 'partial'::payment_status
           else 'paid'::payment_status
         end
   where id = v_job_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sales_payments_rollup on public.sales_payments;
create trigger trg_sales_payments_rollup
  after insert or update or delete on public.sales_payments
  for each row execute function public.sales_payments_rollup();

-- ============================================================================
-- Guard: only owner may toggle deactivated_at. RLS WITH CHECK can't reference
-- OLD, so enforce via trigger. Also blocks anyone from flipping created_by
-- out from under the audit log.
-- ============================================================================
create or replace function public.sales_jobs_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    if (old.deactivated_at is distinct from new.deactivated_at)
       and private.current_role() <> 'owner' then
      raise exception 'Only owner can deactivate or reactivate a sales job'
        using errcode = '42501';
    end if;
    if (old.created_by is distinct from new.created_by)
       or (old.created_at is distinct from new.created_at) then
      raise exception 'created_by / created_at are immutable';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sales_jobs_guard on public.sales_jobs;
create trigger trg_sales_jobs_guard
  before update on public.sales_jobs
  for each row execute function public.sales_jobs_guard();
