-- 0064_invoice_no_location_monthly.sql
--
-- Client feedback (2026-05-22): new sales-job invoice numbers follow
--   <LOC><YYYYMMDD><NNNN>
-- e.g. AYR202605250001 — Ayr location, May 25 2026, first invoice of the
-- month. The 4-digit counter resets on the 1st of each month and is scoped
-- per-location (AYR has its own running number, FE its own, NP its own).
--
-- Old INV-xxxxxx invoice numbers stay on existing rows. Users who manually
-- type their own invoice_no on the form still bypass the trigger.

-- ============================================================================
-- Counter table. One row per (location, YYYYMM). Atomic increment via
-- INSERT ... ON CONFLICT DO UPDATE RETURNING — safe under concurrent inserts
-- without an explicit advisory lock.
-- ============================================================================
create table if not exists public.invoice_counters (
  location_id uuid not null references public.locations(id),
  year_month  text not null check (year_month ~ '^[0-9]{6}$'),
  last_number integer not null default 0 check (last_number >= 0),
  updated_at  timestamptz not null default now(),
  primary key (location_id, year_month)
);

-- RLS off — this table is internal trigger plumbing, not user-facing data,
-- and the trigger runs in whatever role inserted the sales_job.
alter table public.invoice_counters disable row level security;

-- ============================================================================
-- Trigger function — replace the old sales_jobs invoice-no filler.
-- ============================================================================
create or replace function public.fill_sales_invoice_no()
returns trigger
language plpgsql
as $$
declare
  loc_code   text;
  year_month text;
  date_str   text;
  counter    int;
begin
  -- User-typed invoice_no always wins (the form still allows manual entry).
  if NEW.invoice_no is not null and btrim(NEW.invoice_no) <> '' then
    return NEW;
  end if;

  select code into loc_code
    from public.locations
   where id = NEW.location_id;

  -- Fall back to the legacy INV-xxxxxx format when the location has no code
  -- configured. Avoids generating a malformed number like '202605250001'.
  if loc_code is null or btrim(loc_code) = '' then
    NEW.invoice_no := 'INV-' || lpad(nextval('public.sales_invoice_seq')::text, 6, '0');
    return NEW;
  end if;

  year_month := to_char(NEW.job_date, 'YYYYMM');
  date_str   := to_char(NEW.job_date, 'YYYYMMDD');

  -- Atomic counter bump. Both branches of the upsert RETURN the post-write
  -- value, so we always get the freshly-assigned number even under
  -- concurrent inserts hitting the same (location, month).
  insert into public.invoice_counters (location_id, year_month, last_number)
    values (NEW.location_id, year_month, 1)
    on conflict (location_id, year_month)
      do update set last_number = public.invoice_counters.last_number + 1,
                    updated_at  = now()
    returning last_number into counter;

  NEW.invoice_no := upper(loc_code) || date_str || lpad(counter::text, 4, '0');
  return NEW;
end $$;

-- Trigger itself is already in place from migration 0019; CREATE OR REPLACE
-- on the function above is enough to swap behavior without touching the
-- trigger binding.
