-- 0038_vendor_locations.sql
-- Per-(vendor, location) account details (item #16). Each location can have
-- its own account number, contact, and sales rep with the same vendor.
-- Vendor.account_no / contact_no continue to act as the global default
-- when no row exists for a given location.

create table if not exists public.vendor_locations (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  location_id uuid not null references public.locations(id),

  account_no text,
  account_type text,
  contact_no text,
  email citext,
  sales_rep_name text,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),

  unique (vendor_id, location_id)
);

create index if not exists vendor_locations_vendor_idx
  on public.vendor_locations (vendor_id);
create index if not exists vendor_locations_location_idx
  on public.vendor_locations (location_id);

drop trigger if exists trg_vendor_locations_updated_at on public.vendor_locations;
create trigger trg_vendor_locations_updated_at
  before update on public.vendor_locations
  for each row execute function public.set_updated_at();

drop trigger if exists trg_vendor_locations_audit on public.vendor_locations;
create trigger trg_vendor_locations_audit
  after insert or update on public.vendor_locations
  for each row execute function public.audit_row();

alter table public.vendor_locations enable row level security;

-- ============================================================================
-- RLS policies — same shape as `vendors`. Owner + accountant + manager + staff
-- read; owner + accountant + manager write.
-- ============================================================================
drop policy if exists vendor_locations_select on public.vendor_locations;
create policy vendor_locations_select on public.vendor_locations
  for select to authenticated
  using (
    private.current_role() in ('owner','accountant','manager','staff')
  );

drop policy if exists vendor_locations_insert on public.vendor_locations;
create policy vendor_locations_insert on public.vendor_locations
  for insert to authenticated
  with check (
    private.current_role() in ('owner','accountant')
    or (
      private.current_role() = 'manager'
      and location_id = private.current_location()
    )
  );

drop policy if exists vendor_locations_update on public.vendor_locations;
create policy vendor_locations_update on public.vendor_locations
  for update to authenticated
  using (
    private.current_role() in ('owner','accountant')
    or (
      private.current_role() = 'manager'
      and location_id = private.current_location()
    )
  )
  with check (
    private.current_role() in ('owner','accountant')
    or (
      private.current_role() = 'manager'
      and location_id = private.current_location()
    )
  );
