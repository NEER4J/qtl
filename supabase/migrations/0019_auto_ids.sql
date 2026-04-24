-- 0019_auto_ids.sql
-- Auto-generate human-readable identifiers when the user leaves them blank:
--   sales_jobs.invoice_no          -> INV-000001
--   expenses.invoice_no            -> EXP-000001
--   expenses.transaction_id        -> TXN-000001  (shared with payment tables)
--   sales_payments.transaction_id  -> TXN-000001
--   expense_payments.transaction_id-> TXN-000001
--   payroll_payments.transaction_id-> TXN-000001
--   customers.code                 -> CUST-000001  (new column)
--   vendors.code                   -> VEND-000001  (new column)
--   employees.code                 -> EMP-000001   (new column)
--
-- Manual entry is still permitted. Only NULL / empty values are filled.
-- Invoice / code columns have a UNIQUE index, so duplicates still fail loudly.

-- ============================================================================
-- Sequences
-- ============================================================================
create sequence if not exists public.sales_invoice_seq;
create sequence if not exists public.expense_invoice_seq;
create sequence if not exists public.txn_id_seq;
create sequence if not exists public.customer_code_seq;
create sequence if not exists public.vendor_code_seq;
create sequence if not exists public.employee_code_seq;

-- ============================================================================
-- New `code` columns on customers / vendors / employees
-- ============================================================================
alter table public.customers add column if not exists code text;
alter table public.vendors   add column if not exists code text;
alter table public.employees add column if not exists code text;

-- Unique indexes (partial on active rows so reactivated records can't collide).
create unique index if not exists customers_code_uniq
  on public.customers (code) where code is not null;
create unique index if not exists vendors_code_uniq
  on public.vendors (code) where code is not null;
create unique index if not exists employees_code_uniq
  on public.employees (code) where code is not null;

-- ============================================================================
-- Trigger functions. One per target column — dynamic SQL avoided so these
-- stay safe under SECURITY DEFINER and play nicely with the audit trigger.
-- ============================================================================

create or replace function public.fill_sales_invoice_no()
returns trigger language plpgsql as $$
begin
  if NEW.invoice_no is null or btrim(NEW.invoice_no) = '' then
    NEW.invoice_no := 'INV-' || lpad(nextval('public.sales_invoice_seq')::text, 6, '0');
  end if;
  return NEW;
end $$;

create or replace function public.fill_expense_invoice_no()
returns trigger language plpgsql as $$
begin
  if NEW.invoice_no is null or btrim(NEW.invoice_no) = '' then
    NEW.invoice_no := 'EXP-' || lpad(nextval('public.expense_invoice_seq')::text, 6, '0');
  end if;
  return NEW;
end $$;

create or replace function public.fill_transaction_id()
returns trigger language plpgsql as $$
begin
  if NEW.transaction_id is null or btrim(NEW.transaction_id) = '' then
    NEW.transaction_id := 'TXN-' || lpad(nextval('public.txn_id_seq')::text, 6, '0');
  end if;
  return NEW;
end $$;

create or replace function public.fill_customer_code()
returns trigger language plpgsql as $$
begin
  if NEW.code is null or btrim(NEW.code) = '' then
    NEW.code := 'CUST-' || lpad(nextval('public.customer_code_seq')::text, 6, '0');
  end if;
  return NEW;
end $$;

create or replace function public.fill_vendor_code()
returns trigger language plpgsql as $$
begin
  if NEW.code is null or btrim(NEW.code) = '' then
    NEW.code := 'VEND-' || lpad(nextval('public.vendor_code_seq')::text, 6, '0');
  end if;
  return NEW;
end $$;

create or replace function public.fill_employee_code()
returns trigger language plpgsql as $$
begin
  if NEW.code is null or btrim(NEW.code) = '' then
    NEW.code := 'EMP-' || lpad(nextval('public.employee_code_seq')::text, 6, '0');
  end if;
  return NEW;
end $$;

-- ============================================================================
-- Expense's transaction_id is special: the expenses table conditionally
-- records a payment reference inline. We only want to auto-fill when the
-- user actually picked a payment mode (otherwise an unpaid expense would
-- carry a meaningless TXN-... string).
-- ============================================================================
create or replace function public.fill_expense_transaction_id()
returns trigger language plpgsql as $$
begin
  if NEW.payment_mode is not null
     and (NEW.transaction_id is null or btrim(NEW.transaction_id) = '') then
    NEW.transaction_id := 'TXN-' || lpad(nextval('public.txn_id_seq')::text, 6, '0');
  end if;
  return NEW;
end $$;

-- ============================================================================
-- BEFORE INSERT triggers — run before audit_row() (which is AFTER INSERT)
-- so the audit log captures the filled value.
-- ============================================================================

-- sales_jobs.invoice_no
drop trigger if exists trg_sales_jobs_fill_invoice on public.sales_jobs;
create trigger trg_sales_jobs_fill_invoice
  before insert on public.sales_jobs
  for each row execute function public.fill_sales_invoice_no();

-- expenses.invoice_no + expenses.transaction_id (two separate triggers so
-- either can be replaced independently; order doesn't matter, both set
-- different columns).
drop trigger if exists trg_expenses_fill_invoice on public.expenses;
create trigger trg_expenses_fill_invoice
  before insert on public.expenses
  for each row execute function public.fill_expense_invoice_no();

drop trigger if exists trg_expenses_fill_txn on public.expenses;
create trigger trg_expenses_fill_txn
  before insert on public.expenses
  for each row execute function public.fill_expense_transaction_id();

-- payment tables — always fill when blank (user recorded a payment, so a
-- reference id is always meaningful).
drop trigger if exists trg_sales_payments_fill_txn on public.sales_payments;
create trigger trg_sales_payments_fill_txn
  before insert on public.sales_payments
  for each row execute function public.fill_transaction_id();

drop trigger if exists trg_expense_payments_fill_txn on public.expense_payments;
create trigger trg_expense_payments_fill_txn
  before insert on public.expense_payments
  for each row execute function public.fill_transaction_id();

drop trigger if exists trg_payroll_payments_fill_txn on public.payroll_payments;
create trigger trg_payroll_payments_fill_txn
  before insert on public.payroll_payments
  for each row execute function public.fill_transaction_id();

-- entity codes
drop trigger if exists trg_customers_fill_code on public.customers;
create trigger trg_customers_fill_code
  before insert on public.customers
  for each row execute function public.fill_customer_code();

drop trigger if exists trg_vendors_fill_code on public.vendors;
create trigger trg_vendors_fill_code
  before insert on public.vendors
  for each row execute function public.fill_vendor_code();

drop trigger if exists trg_employees_fill_code on public.employees;
create trigger trg_employees_fill_code
  before insert on public.employees
  for each row execute function public.fill_employee_code();

-- ============================================================================
-- Backfill codes for existing rows so downstream queries don't see NULLs.
-- Pre-existing manually-entered invoice_no values are left alone.
-- ============================================================================

do $$
declare
  r record;
begin
  for r in select id from public.customers where code is null order by created_at loop
    update public.customers
       set code = 'CUST-' || lpad(nextval('public.customer_code_seq')::text, 6, '0')
     where id = r.id;
  end loop;

  for r in select id from public.vendors where code is null order by created_at loop
    update public.vendors
       set code = 'VEND-' || lpad(nextval('public.vendor_code_seq')::text, 6, '0')
     where id = r.id;
  end loop;

  for r in select id from public.employees where code is null order by created_at loop
    update public.employees
       set code = 'EMP-' || lpad(nextval('public.employee_code_seq')::text, 6, '0')
     where id = r.id;
  end loop;
end $$;
