-- 0071_fix_invoice_no_var_and_time_columns.sql
--
-- Two corrective fixes for sales-job creation failures:
--
-- 1) fill_sales_invoice_no() failed with 42702 "column reference year_month is
--    ambiguous": the PL/pgSQL variable `year_month` (0064) shares its name with
--    the invoice_counters.year_month column it inserts into. Rename the variable
--    to v_year_month so the reference is unambiguous. (CREATE OR REPLACE — the
--    trigger binding from 0019 is untouched.)
--
-- 2) sales_jobs.start_time / end_time were meant to become `time` in 0054 but
--    in some databases the conversion never landed and they are still
--    `timestamptz`, so inserting a "HH:mm:ss" value fails with 22007. Convert
--    them to `time` idempotently (only when not already `time`), recreating the
--    generated duration_minutes column that depends on them.

-- ----------------------------------------------------------------------------
-- 1) Invoice-number trigger function — rename the colliding variable.
-- ----------------------------------------------------------------------------
create or replace function public.fill_sales_invoice_no()
returns trigger
language plpgsql
as $$
declare
  loc_code     text;
  v_year_month text;
  date_str     text;
  counter      int;
begin
  -- User-typed invoice_no always wins (the form still allows manual entry).
  if NEW.invoice_no is not null and btrim(NEW.invoice_no) <> '' then
    return NEW;
  end if;

  select code into loc_code
    from public.locations
   where id = NEW.location_id;

  -- Fall back to the legacy INV-xxxxxx format when the location has no code.
  if loc_code is null or btrim(loc_code) = '' then
    NEW.invoice_no := 'INV-' || lpad(nextval('public.sales_invoice_seq')::text, 6, '0');
    return NEW;
  end if;

  v_year_month := to_char(NEW.job_date, 'YYYYMM');
  date_str     := to_char(NEW.job_date, 'YYYYMMDD');

  insert into public.invoice_counters (location_id, year_month, last_number)
    values (NEW.location_id, v_year_month, 1)
    on conflict (location_id, year_month)
      do update set last_number = public.invoice_counters.last_number + 1,
                    updated_at  = now()
    returning last_number into counter;

  NEW.invoice_no := upper(loc_code) || date_str || lpad(counter::text, 4, '0');
  return NEW;
end $$;

-- ----------------------------------------------------------------------------
-- 2) Ensure start_time / end_time are time-of-day, not timestamptz.
-- ----------------------------------------------------------------------------
do $$
declare
  v_type text;
begin
  select data_type into v_type
    from information_schema.columns
   where table_schema = 'public'
     and table_name   = 'sales_jobs'
     and column_name  = 'start_time';

  if v_type is distinct from 'time without time zone' then
    -- duration_minutes is generated over start/end, so drop it before retyping.
    alter table public.sales_jobs drop column if exists duration_minutes;

    alter table public.sales_jobs
      alter column start_time type time
      using (case when start_time is null then null
                  else (start_time at time zone 'America/Toronto')::time end);

    alter table public.sales_jobs
      alter column end_time type time
      using (case when end_time is null then null
                  else (end_time at time zone 'America/Toronto')::time end);
  end if;
end $$;

-- Recreate (or leave intact) the generated duration column over the time fields.
alter table public.sales_jobs
  add column if not exists duration_minutes integer generated always as (
    case
      when start_time is not null and end_time is not null
        then greatest(0, (extract(epoch from (end_time - start_time))::int) / 60)
      else null
    end
  ) stored;
