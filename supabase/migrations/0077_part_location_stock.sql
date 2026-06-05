-- 0077_part_location_stock.sql
--
-- Inventory: per-location stock count for each catalogue part.
--   * One row per (part, location); qty is the on-hand count at that location.
--   * VIEW: any active authenticated user can read counts (so staff can see
--     stock at every location).
--   * EDIT: only "high-level" roles — owner, co_owner (Admin), manager.
--     Supervisor is intentionally view-only. Because supervisor is aliased to
--     manager inside private.current_role() (0074), we must check the REAL
--     role here, so the edit helper reads profiles.role directly via a
--     SECURITY DEFINER function (no recursive RLS).

create table if not exists public.part_location_stock (
  part_id     uuid not null references public.parts(id)     on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  qty         integer not null default 0 check (qty >= 0),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id),
  primary key (part_id, location_id)
);

create index if not exists part_location_stock_location_idx
  on public.part_location_stock (location_id);

-- ----------------------------------------------------------------------------
-- Edit gate: owner / co_owner / manager, by REAL role (not the aliased one).
-- ----------------------------------------------------------------------------
create or replace function private.can_edit_inventory()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid()
       and active = true
       and role::text in ('owner', 'co_owner', 'manager')
  );
$$;

revoke all on function private.can_edit_inventory() from public;
grant execute on function private.can_edit_inventory() to authenticated;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.part_location_stock enable row level security;

drop policy if exists part_location_stock_select on public.part_location_stock;
create policy part_location_stock_select on public.part_location_stock
  for select to authenticated
  using (true);

drop policy if exists part_location_stock_write on public.part_location_stock;
create policy part_location_stock_write on public.part_location_stock
  for all to authenticated
  using (private.can_edit_inventory())
  with check (private.can_edit_inventory());

-- Keep updated_at fresh on every write.
create or replace function public.touch_part_location_stock()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_part_location_stock on public.part_location_stock;
create trigger trg_touch_part_location_stock
  before update on public.part_location_stock
  for each row execute function public.touch_part_location_stock();
