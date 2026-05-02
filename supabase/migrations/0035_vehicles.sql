-- 0035_vehicles.sql
-- Per-customer vehicle records, replacing the simpler customers.license_plates
-- text[] array. A customer can have many vehicles. Plate and VIN are
-- unique across active rows (item #10 — block duplicates).
--
-- The legacy customers.license_plates column is kept for one release as a
-- safety net; new code reads from this table. A later migration drops it.

-- ============================================================================
-- vehicles
-- ============================================================================
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,

  -- identifiers (uppercase enforced by client + zod transform)
  license_plate citext not null,
  vin citext,

  -- spec
  year smallint,
  make text,
  model text,
  engine_size text,
  engine_serial text,
  unit_number text,

  -- compliance / paperwork
  cab_card_number text,
  drive_clean_date date,
  colour text,
  expiry_date date,
  license_renewal_date date,

  -- ops
  follow_up_date date,
  mileage integer,
  last_contacted_at timestamptz,
  carrier_name text,                            -- item #5 (was on sales_jobs)

  -- notes
  comments text,
  printed_comments text,
  vehicle_comments text,

  -- soft-delete (matches sales_jobs pattern, not customers.active)
  deactivated_at timestamptz,
  deactivated_by uuid references auth.users(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),

  constraint vehicles_year_chk check (year is null or (year between 1900 and 2100)),
  constraint vehicles_mileage_chk check (mileage is null or mileage >= 0)
);

-- Plate unique across active rows. VIN unique across active rows when present.
create unique index if not exists vehicles_plate_active_uniq
  on public.vehicles (lower(license_plate)) where deactivated_at is null;
create unique index if not exists vehicles_vin_active_uniq
  on public.vehicles (lower(vin)) where deactivated_at is null and vin is not null;

create index if not exists vehicles_customer_idx on public.vehicles (customer_id);
create index if not exists vehicles_follow_up_idx on public.vehicles (follow_up_date)
  where deactivated_at is null and follow_up_date is not null;

-- ============================================================================
-- Triggers (reuse shared helpers from 0001)
-- ============================================================================
drop trigger if exists trg_vehicles_updated_at on public.vehicles;
create trigger trg_vehicles_updated_at
  before update on public.vehicles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_vehicles_audit on public.vehicles;
create trigger trg_vehicles_audit
  after insert or update on public.vehicles
  for each row execute function public.audit_row();

-- Owner-only deactivation guard (mirrors sales_jobs_guard pattern)
create or replace function public.vehicles_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    if (old.deactivated_at is distinct from new.deactivated_at)
       and private.current_role() <> 'owner' then
      raise exception 'Only owner can deactivate or reactivate a vehicle'
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

drop trigger if exists trg_vehicles_guard on public.vehicles;
create trigger trg_vehicles_guard
  before update on public.vehicles
  for each row execute function public.vehicles_guard();

alter table public.vehicles enable row level security;

-- ============================================================================
-- RLS policies for vehicles
-- SELECT is global (item #14 — vehicles visible everywhere).
-- INSERT/UPDATE follow the parent customer's writeable scope: owner anywhere,
-- manager/staff for any customer (since customers are now globally readable
-- the location scope on vehicles would just create friction; if we tighten
-- this later we can join customers.home_location_id).
-- ============================================================================
drop policy if exists vehicles_select on public.vehicles;
create policy vehicles_select on public.vehicles
  for select to authenticated
  using (true);

drop policy if exists vehicles_insert on public.vehicles;
create policy vehicles_insert on public.vehicles
  for insert to authenticated
  with check (
    private.current_role() in ('owner','manager','staff')
  );

drop policy if exists vehicles_update on public.vehicles;
create policy vehicles_update on public.vehicles
  for update to authenticated
  using (
    private.current_role() in ('owner','manager','staff')
  )
  with check (
    private.current_role() in ('owner','manager','staff')
  );

-- ============================================================================
-- Backfill from customers.license_plates -> vehicles
-- One row per plate. Other columns NULL. Skips rows that would collide on the
-- active-plate unique index (idempotent re-run safe).
-- ============================================================================
insert into public.vehicles (customer_id, license_plate, created_by, updated_by)
select c.id, upper(trim(plate)), c.created_by, c.updated_by
  from public.customers c
       cross join lateral unnest(c.license_plates) as plate
 where trim(coalesce(plate,'')) <> ''
   and not exists (
     select 1 from public.vehicles v
      where lower(v.license_plate) = lower(trim(plate))
        and v.deactivated_at is null
   )
on conflict do nothing;
