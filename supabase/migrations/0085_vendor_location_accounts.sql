-- 0085_vendor_location_accounts.sql
-- Multiple accounts per (vendor, location). vendor_locations already carries a
-- single per-location account_no/account_type; this lets a vendor have several
-- accounts at the same location (e.g. parts account vs. tyre account), each
-- selectable on the expense form. Soft-delete only (no DELETE), per the repo
-- convention — "removing" an account sets deactivated_at.

create table if not exists public.vendor_location_accounts (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  location_id uuid not null references public.locations(id),

  label text,
  account_no text,
  account_type text,
  is_default boolean not null default false,

  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create index if not exists vendor_location_accounts_lookup_idx
  on public.vendor_location_accounts (vendor_id, location_id)
  where deactivated_at is null;

drop trigger if exists trg_vendor_location_accounts_updated_at on public.vendor_location_accounts;
create trigger trg_vendor_location_accounts_updated_at
  before update on public.vendor_location_accounts
  for each row execute function public.set_updated_at();

drop trigger if exists trg_vendor_location_accounts_audit on public.vendor_location_accounts;
create trigger trg_vendor_location_accounts_audit
  after insert or update on public.vendor_location_accounts
  for each row execute function public.audit_row();

alter table public.vendor_location_accounts enable row level security;

-- RLS — same shape as vendor_locations. NOTE: the generic co_owner full-access
-- policy from 0067 only covered tables that existed when 0067 ran, so a new
-- table must add its own co_owner policy (per the note in 0067 §3).
drop policy if exists vendor_location_accounts_co_owner_all on public.vendor_location_accounts;
create policy vendor_location_accounts_co_owner_all on public.vendor_location_accounts
  for all to authenticated
  using (private.is_owner()) with check (private.is_owner());

drop policy if exists vendor_location_accounts_select on public.vendor_location_accounts;
create policy vendor_location_accounts_select on public.vendor_location_accounts
  for select to authenticated
  using (
    private.current_role() in ('owner','accountant','manager','staff')
  );

drop policy if exists vendor_location_accounts_insert on public.vendor_location_accounts;
create policy vendor_location_accounts_insert on public.vendor_location_accounts
  for insert to authenticated
  with check (
    private.current_role() in ('owner','accountant')
    or (
      private.current_role() = 'manager'
      and location_id = private.current_location()
    )
  );

drop policy if exists vendor_location_accounts_update on public.vendor_location_accounts;
create policy vendor_location_accounts_update on public.vendor_location_accounts
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

-- Seed: carry each existing per-location account_no across as the default account.
insert into public.vendor_location_accounts
  (vendor_id, location_id, label, account_no, account_type, is_default)
select vl.vendor_id, vl.location_id, 'Primary', vl.account_no, vl.account_type, true
from public.vendor_locations vl
where coalesce(trim(vl.account_no), '') <> '';
