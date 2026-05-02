-- 0036_customers_billing_address.sql
-- Customer field overhaul to mirror the legacy CARS Customer screen plus:
--   * structured address (item #2)
--   * billing options moved off sales_jobs (item #3)
--   * status enum new/regular/old (item #9)
--   * 30-day free-grease offer flag (item #15)
--   * digits-only phone_search column for fast phone-number lookup (item #8)
--
-- Credit-card fields from the legacy CARS form are intentionally NOT included
-- (PCI scope avoidance — see plan §10).

-- ============================================================================
-- Add new columns
-- ============================================================================
alter table public.customers
  add column if not exists salutation text,
  add column if not exists first_name text,
  add column if not exists last_or_company text,

  -- structured address (item #2)
  add column if not exists address_1 text,
  add column if not exists address_2 text,
  add column if not exists city text,
  add column if not exists province text,
  add column if not exists country char(2) not null default 'CA',
  add column if not exists postal_code text,

  -- phone fields (item #13 format applied client-side via libphonenumber-js)
  add column if not exists phone_home text,
  add column if not exists phone_cell text,
  add column if not exists phone_business text,
  add column if not exists phone_business_ext text,
  add column if not exists phone_fax text,
  add column if not exists phone_alt_1 text,
  add column if not exists phone_alt_2 text,
  add column if not exists phone_notes jsonb not null default '{}'::jsonb,

  -- contact / categorisation
  add column if not exists other_contact text,
  add column if not exists comments text,
  add column if not exists contact_method text default 'email',
  add column if not exists customer_type text,                                    -- CARS "Type"
  add column if not exists status text not null default 'new',                    -- item #9

  -- billing options (item #3 — moved from sales)
  add column if not exists default_pay_method payment_mode,
  add column if not exists cod_required boolean not null default false,
  add column if not exists labour_discount_pct numeric(5,2) not null default 0,
  add column if not exists parts_discount_pct numeric(5,2) not null default 0,
  add column if not exists late_payment_pct numeric(5,2) not null default 0,
  add column if not exists late_payment_days smallint not null default 0,
  add column if not exists calc_interest_from date,
  add column if not exists special_hst_rate_pct numeric(5,2),
  add column if not exists pays_hst boolean not null default true,

  -- free grease offer (item #15)
  add column if not exists free_grease_until date,
  add column if not exists free_grease_overridden_at timestamptz,
  add column if not exists free_grease_override_note text;

-- Range / enum-like checks (using CHECK rather than enum to keep the values
-- editable without a migration if the owner adds 'inactive' etc.)
do $$ begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'customers_status_chk' and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_status_chk
        check (status in ('new','regular','old'));
  end if;
  if not exists (
    select 1 from pg_constraint
     where conname = 'customers_contact_method_chk' and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_contact_method_chk
        check (contact_method is null or contact_method in ('mail','email','phone','sms'));
  end if;
  if not exists (
    select 1 from pg_constraint
     where conname = 'customers_country_chk' and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_country_chk
        check (country ~ '^[A-Z]{2}$');
  end if;
end $$;

-- ============================================================================
-- billing_name backfill / loosen
-- billing_name is the historical "for invoice" string. After this migration
-- it is derivable from first_name + last_or_company; we keep the column for
-- backward compatibility but allow it to be NULL.
--
-- For existing rows, copy billing_name into last_or_company if last_or_company
-- is null (so the new form has data to display).
-- ============================================================================
update public.customers
   set last_or_company = billing_name
 where last_or_company is null
   and billing_name is not null;

-- Ensure something is always identifiable for invoicing.
do $$ begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'customers_name_present_chk' and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_name_present_chk
        check (
          coalesce(nullif(trim(billing_name), ''), nullif(trim(last_or_company), ''),
                   nullif(trim(first_name), '')) is not null
        ) not valid;
  end if;
end $$;

-- ============================================================================
-- Free grease default: on insert, set free_grease_until = today + 30 days
-- unless caller already set it.
-- ============================================================================
create or replace function public.customers_set_free_grease()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' and new.free_grease_until is null then
    new.free_grease_until := (current_date + interval '30 days')::date;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_customers_free_grease on public.customers;
create trigger trg_customers_free_grease
  before insert on public.customers
  for each row execute function public.customers_set_free_grease();

-- Existing rows: backfill free_grease_until based on created_at where missing
-- (so already-imported customers also get a fair window from today).
update public.customers
   set free_grease_until = least(
     (created_at::date + interval '30 days')::date,
     (current_date + interval '30 days')::date  -- cap at today+30 for very old rows
   )
 where free_grease_until is null;

-- ============================================================================
-- phone_search: digits-only concatenation of every phone field (item #8).
-- Generated column, indexed, used by searchCustomers via ILIKE.
-- ============================================================================
alter table public.customers
  add column if not exists phone_search text generated always as (
    regexp_replace(
      coalesce(phone_home,'') ||
      coalesce(phone_cell,'') ||
      coalesce(phone_business,'') ||
      coalesce(phone_fax,'') ||
      coalesce(phone_alt_1,'') ||
      coalesce(phone_alt_2,'') ||
      coalesce(contact_no,''),
      '\D', '', 'g'
    )
  ) stored;

create index if not exists customers_phone_search_idx
  on public.customers using btree (phone_search text_pattern_ops);

create index if not exists customers_status_idx
  on public.customers (status) where active;
