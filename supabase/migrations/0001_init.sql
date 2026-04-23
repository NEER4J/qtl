-- 0001_init.sql
-- Extensions, enums, reference tables, app_settings, audit_log, shared triggers.
-- Everything downstream depends on this migration.

-- ============================================================================
-- Extensions
-- ============================================================================
create extension if not exists pgcrypto;
create extension if not exists citext;

-- ============================================================================
-- Enums
-- ============================================================================
do $$ begin
  create type user_role as enum ('owner','manager','accountant','staff','employee');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_mode as enum (
    'visa','mastercard','debit','cash','cheque','etransfer','oc','credit_card'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status as enum ('paid','partial','outstanding');
exception when duplicate_object then null; end $$;

do $$ begin
  create type service_code as enum ('OC','PG','FG','MISC');
exception when duplicate_object then null; end $$;

do $$ begin
  create type audit_action as enum (
    'insert','update','delete','deactivate','reactivate','login','export'
  );
exception when duplicate_object then null; end $$;

-- ============================================================================
-- Shared trigger: set_updated_at()
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ============================================================================
-- Reference: locations
-- ============================================================================
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  address text,
  phone text,
  email citext,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_locations_updated_at on public.locations;
create trigger trg_locations_updated_at
  before update on public.locations
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Reference: service_types
-- ============================================================================
create table if not exists public.service_types (
  id uuid primary key default gen_random_uuid(),
  code service_code not null unique,
  name text not null,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_service_types_updated_at on public.service_types;
create trigger trg_service_types_updated_at
  before update on public.service_types
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Reference: expense_categories / expense_subcategories
-- ============================================================================
create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_expense_categories_updated_at on public.expense_categories;
create trigger trg_expense_categories_updated_at
  before update on public.expense_categories
  for each row execute function public.set_updated_at();

create table if not exists public.expense_subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.expense_categories(id) on delete restrict,
  name text not null,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, name)
);

drop trigger if exists trg_expense_subcategories_updated_at on public.expense_subcategories;
create trigger trg_expense_subcategories_updated_at
  before update on public.expense_subcategories
  for each row execute function public.set_updated_at();

create index if not exists idx_expense_subcategories_category
  on public.expense_subcategories(category_id);

-- ============================================================================
-- app_settings (singleton, id = 1)
-- ============================================================================
create table if not exists public.app_settings (
  id smallint primary key default 1 check (id = 1),
  company_name text not null default 'Quick Truck Lube & Oil Ltd.',
  hst_rate numeric(5,4) not null default 0.13,
  fiscal_year_start_month smallint not null default 1 check (fiscal_year_start_month between 1 and 12),
  pay_week_start smallint not null default 1 check (pay_week_start between 0 and 6),
  currency text not null default 'CAD',
  invoice_format text not null default 'manual' check (invoice_format in ('manual','auto')),
  min_margin_alert_pct numeric(5,4) not null default 0,
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_app_settings_updated_at on public.app_settings;
create trigger trg_app_settings_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

insert into public.app_settings (id) values (1) on conflict (id) do nothing;

-- ============================================================================
-- audit_log — written by a generic trigger attached in later migrations
-- ============================================================================
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_role user_role,
  location_id uuid,
  table_name text not null,
  record_id text not null,
  action audit_action not null,
  old_data jsonb,
  new_data jsonb,
  diff jsonb,
  ip_address inet,
  user_agent text,
  at timestamptz not null default now()
);

create index if not exists idx_audit_table on public.audit_log(table_name, record_id);
create index if not exists idx_audit_actor on public.audit_log(actor_id, at desc);
create index if not exists idx_audit_location on public.audit_log(location_id, at desc);

-- Generic audit_row trigger function. Attached to write tables in later
-- migrations via `create trigger ... execute function public.audit_row()`.
-- Reads the acting user's id from auth.uid() (null if service role) and
-- looks up role + location from public.profiles (created in 0002).
create or replace function public.audit_row()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_actor uuid := auth.uid();
  v_role  user_role;
  v_loc   uuid;
  v_old   jsonb;
  v_new   jsonb;
  v_diff  jsonb;
  v_action audit_action;
  v_record text;
begin
  if v_actor is not null then
    select role, location_id
      into v_role, v_loc
      from public.profiles
     where id = v_actor;
  end if;

  if tg_op = 'INSERT' then
    v_action := 'insert';
    v_new    := to_jsonb(new);
    v_record := coalesce(v_new->>'id', '');
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    -- Toggle deactivated_at counts as deactivate/reactivate
    if v_new ? 'deactivated_at' and v_old ? 'deactivated_at' then
      if (v_old->>'deactivated_at') is null and (v_new->>'deactivated_at') is not null then
        v_action := 'deactivate';
      elsif (v_old->>'deactivated_at') is not null and (v_new->>'deactivated_at') is null then
        v_action := 'reactivate';
      else
        v_action := 'update';
      end if;
    else
      v_action := 'update';
    end if;
    v_record := coalesce(v_new->>'id', v_old->>'id', '');
    v_diff := (
      select jsonb_object_agg(key, jsonb_build_object('old', v_old->key, 'new', v_new->key))
      from jsonb_object_keys(v_new) as key
      where v_new->key is distinct from v_old->key
    );
  elsif tg_op = 'DELETE' then
    v_action := 'delete';
    v_old := to_jsonb(old);
    v_record := coalesce(v_old->>'id', '');
  end if;

  -- Prefer row's own location_id if present; else caller's location
  if (tg_op <> 'DELETE' and (to_jsonb(new) ? 'location_id')) then
    v_loc := coalesce(nullif(to_jsonb(new)->>'location_id','')::uuid, v_loc);
  elsif (tg_op = 'DELETE' and (to_jsonb(old) ? 'location_id')) then
    v_loc := coalesce(nullif(to_jsonb(old)->>'location_id','')::uuid, v_loc);
  end if;

  insert into public.audit_log (
    actor_id, actor_role, location_id, table_name, record_id,
    action, old_data, new_data, diff
  ) values (
    v_actor, v_role, v_loc, tg_table_name, v_record,
    v_action, v_old, v_new, v_diff
  );

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

-- ============================================================================
-- Enable RLS on all tables created so far (policies added in 0007)
-- ============================================================================
alter table public.locations              enable row level security;
alter table public.service_types          enable row level security;
alter table public.expense_categories     enable row level security;
alter table public.expense_subcategories  enable row level security;
alter table public.app_settings           enable row level security;
alter table public.audit_log              enable row level security;
