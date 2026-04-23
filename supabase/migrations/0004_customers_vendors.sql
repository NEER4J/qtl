-- 0004_customers_vendors.sql
-- Customers (referenced by sales_jobs) and vendors (referenced by expenses).
-- Soft-delete via `active`; name uniqueness partial on active rows.

-- ============================================================================
-- customers
-- ============================================================================
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  billing_name text not null,
  contact_no text,
  email citext,
  license_plates text[] not null default '{}',
  home_location_id uuid references public.locations(id),
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create unique index if not exists customers_billing_name_active_uniq
  on public.customers (lower(billing_name)) where active;
create index if not exists customers_home_location_idx
  on public.customers (home_location_id);
create index if not exists customers_plates_gin
  on public.customers using gin (license_plates);

drop trigger if exists trg_customers_updated_at on public.customers;
create trigger trg_customers_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

drop trigger if exists trg_customers_audit on public.customers;
create trigger trg_customers_audit
  after insert or update on public.customers
  for each row execute function public.audit_row();

alter table public.customers enable row level security;

-- ============================================================================
-- vendors
-- ============================================================================
create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_no text,
  email citext,
  account_no text,
  account_type text,
  category_id uuid references public.expense_categories(id),
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create unique index if not exists vendors_name_active_uniq
  on public.vendors (lower(name)) where active;
create index if not exists vendors_category_idx
  on public.vendors (category_id);

drop trigger if exists trg_vendors_updated_at on public.vendors;
create trigger trg_vendors_updated_at
  before update on public.vendors
  for each row execute function public.set_updated_at();

drop trigger if exists trg_vendors_audit on public.vendors;
create trigger trg_vendors_audit
  after insert or update on public.vendors
  for each row execute function public.audit_row();

alter table public.vendors enable row level security;
