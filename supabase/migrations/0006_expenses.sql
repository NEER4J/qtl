-- 0006_expenses.sql
-- expenses + expense_payments. Mirrors sales: trigger keeps paid_amount +
-- payment_status in sync; a separate trigger enforces category/subcategory
-- match (CHECK can't do subquery).

-- ============================================================================
-- expenses
-- ============================================================================
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id),
  expense_date date not null,

  category_id uuid not null references public.expense_categories(id),
  subcategory_id uuid references public.expense_subcategories(id),

  vendor_id uuid references public.vendors(id),
  vendor_name_snapshot text,
  invoice_no text,

  account_type text,
  account_number text,
  contact_no text,
  email citext,

  sub_total numeric(12,2) not null check (sub_total >= 0),
  hst       numeric(12,2) not null check (hst >= 0),
  total     numeric(12,2) not null check (total >= 0),
  paid_amount numeric(12,2) not null default 0 check (paid_amount >= 0),
  balance numeric(12,2) generated always as (total - paid_amount) stored,

  payment_date date,
  payment_mode payment_mode,
  transaction_id text,
  payment_status payment_status not null default 'outstanding',

  notes text,
  batch_id uuid,

  deactivated_at timestamptz,
  deactivated_by uuid references auth.users(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),

  constraint expenses_total_chk check (abs(total - (sub_total + hst)) < 0.02),
  constraint expenses_paid_chk  check (paid_amount <= total + 0.01)
);

create unique index if not exists expenses_invoice_uniq_in_category
  on public.expenses (category_id, coalesce(vendor_id, '00000000-0000-0000-0000-000000000000'::uuid), invoice_no)
  where deactivated_at is null and invoice_no is not null;

create index if not exists expenses_location_date_idx
  on public.expenses (location_id, expense_date desc);
create index if not exists expenses_category_idx
  on public.expenses (category_id);
create index if not exists expenses_subcategory_idx
  on public.expenses (subcategory_id);
create index if not exists expenses_vendor_idx
  on public.expenses (vendor_id);
create index if not exists expenses_status_idx
  on public.expenses (payment_status) where deactivated_at is null;
create index if not exists expenses_batch_idx
  on public.expenses (batch_id);

drop trigger if exists trg_expenses_updated_at on public.expenses;
create trigger trg_expenses_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

drop trigger if exists trg_expenses_audit on public.expenses;
create trigger trg_expenses_audit
  after insert or update on public.expenses
  for each row execute function public.audit_row();

alter table public.expenses enable row level security;

-- ============================================================================
-- expense_payments
-- ============================================================================
create table if not exists public.expense_payments (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete restrict,
  paid_on date not null default current_date,
  amount numeric(12,2) not null check (amount > 0),
  mode payment_mode not null,
  transaction_id text,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists expense_payments_expense_idx
  on public.expense_payments (expense_id, paid_on);

drop trigger if exists trg_expense_payments_audit on public.expense_payments;
create trigger trg_expense_payments_audit
  after insert or update or delete on public.expense_payments
  for each row execute function public.audit_row();

alter table public.expense_payments enable row level security;

-- ============================================================================
-- Trigger: subcategory must belong to the row's category
-- ============================================================================
create or replace function public.expenses_check_subcategory()
returns trigger
language plpgsql
as $$
declare
  v_cat uuid;
begin
  if new.subcategory_id is null then
    return new;
  end if;

  select category_id into v_cat
    from public.expense_subcategories
   where id = new.subcategory_id;

  if v_cat is null then
    raise exception 'Unknown subcategory_id %', new.subcategory_id;
  end if;

  if v_cat <> new.category_id then
    raise exception 'subcategory_id % does not belong to category_id %',
      new.subcategory_id, new.category_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_expenses_check_subcategory on public.expenses;
create trigger trg_expenses_check_subcategory
  before insert or update on public.expenses
  for each row execute function public.expenses_check_subcategory();

-- ============================================================================
-- Rollup trigger for expense_payments → expenses.paid_amount + status
-- ============================================================================
create or replace function public.expense_payments_rollup()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_expense_id uuid;
  v_paid  numeric(12,2);
  v_total numeric(12,2);
begin
  v_expense_id := coalesce(new.expense_id, old.expense_id);

  select coalesce(sum(amount), 0)
    into v_paid
    from public.expense_payments
   where expense_id = v_expense_id;

  select total into v_total from public.expenses where id = v_expense_id;
  if v_total is null then
    return coalesce(new, old);
  end if;

  update public.expenses
     set paid_amount = v_paid,
         payment_status = case
           when v_paid <= 0 then 'outstanding'::payment_status
           when v_paid < v_total then 'partial'::payment_status
           else 'paid'::payment_status
         end
   where id = v_expense_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_expense_payments_rollup on public.expense_payments;
create trigger trg_expense_payments_rollup
  after insert or update or delete on public.expense_payments
  for each row execute function public.expense_payments_rollup();

-- ============================================================================
-- Guard: only owner may toggle deactivated_at.
-- ============================================================================
create or replace function public.expenses_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    if (old.deactivated_at is distinct from new.deactivated_at)
       and private.current_role() <> 'owner' then
      raise exception 'Only owner can deactivate or reactivate an expense'
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

drop trigger if exists trg_expenses_guard on public.expenses;
create trigger trg_expenses_guard
  before update on public.expenses
  for each row execute function public.expenses_guard();
