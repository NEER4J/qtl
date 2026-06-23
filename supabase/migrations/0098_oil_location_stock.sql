-- 0098_oil_location_stock.sql
-- Per-location on-hand stock for OILS (in litres), mirroring part_location_stock
-- (0077). Oils previously had no inventory tracking at all — they lived only in
-- the pricing/sales layer. This adds the Oils tab on the Inventory page.
--   * One row per (oil_type, location); qty = on-hand litres (numeric, fractional).
--   * VIEW: any active authenticated user.
--   * EDIT: owner / co_owner / manager, via the existing
--     private.can_edit_inventory() gate (REAL role, supervisor view-only).

create table if not exists public.oil_location_stock (
  oil_type_id uuid not null references public.oil_types(id)  on delete cascade,
  location_id uuid not null references public.locations(id)  on delete cascade,
  qty         numeric(12,2) not null default 0 check (qty >= 0),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id),
  primary key (oil_type_id, location_id)
);

create index if not exists oil_location_stock_location_idx
  on public.oil_location_stock (location_id);

alter table public.oil_location_stock enable row level security;

drop policy if exists oil_location_stock_select on public.oil_location_stock;
create policy oil_location_stock_select on public.oil_location_stock
  for select to authenticated
  using (true);

-- can_edit_inventory() already covers owner / co_owner / manager.
drop policy if exists oil_location_stock_write on public.oil_location_stock;
create policy oil_location_stock_write on public.oil_location_stock
  for all to authenticated
  using (private.can_edit_inventory())
  with check (private.can_edit_inventory());

-- Keep updated_at fresh on every write.
drop trigger if exists trg_touch_oil_location_stock on public.oil_location_stock;
create trigger trg_touch_oil_location_stock
  before update on public.oil_location_stock
  for each row execute function public.set_updated_at();

-- Audit every change, like part_location_stock (0090).
drop trigger if exists trg_oil_location_stock_audit on public.oil_location_stock;
create trigger trg_oil_location_stock_audit
  after insert or update or delete on public.oil_location_stock
  for each row execute function public.audit_row();
