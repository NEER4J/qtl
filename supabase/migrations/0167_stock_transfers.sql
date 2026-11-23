-- 0167_stock_transfers.sql
--
-- Move parts or oil from one location to another (client call 2026-11-19:
-- "when we take parts from one location to another, record it as a transfer
-- at cost price"). Until now the only way was to edit both counts by hand,
-- which left no record of what moved, when, or at what cost.
--
-- One row per move. The AFTER INSERT trigger takes the quantity off the
-- sending location and adds it to the receiving one, in part_location_stock or
-- oil_location_stock (litres). Rows are never edited or deleted: a mistake is
-- undone by a transfer back, so the history stays true. unit_cost is the
-- catalogue cost at the time (parts.cost, or the oil's bulk cost per litre),
-- so the value moved can be reported.
--
-- Who: owner / co_owner / manager / supervisor — the roles that may edit
-- inventory counts (private.current_role() maps co_owner -> owner and
-- supervisor -> manager). The app also checks there is enough on hand.

create table if not exists public.stock_transfers (
  id               uuid primary key default gen_random_uuid(),
  transfer_date    date not null default current_date,
  from_location_id uuid not null references public.locations(id),
  to_location_id   uuid not null references public.locations(id),
  part_id          uuid references public.parts(id),
  oil_type_id      uuid references public.oil_types(id),
  quantity         numeric(12,2) not null check (quantity > 0),
  unit_cost        numeric(12,4) not null default 0,
  notes            text,
  created_at       timestamptz not null default now(),
  created_by       uuid references public.profiles(id) default auth.uid(),
  constraint stock_transfers_locations_differ check (from_location_id <> to_location_id),
  constraint stock_transfers_one_item check ((part_id is null) <> (oil_type_id is null)),
  -- Part stock is counted in whole units.
  constraint stock_transfers_part_whole check (part_id is null or quantity = round(quantity))
);

create index if not exists stock_transfers_date_idx on public.stock_transfers (transfer_date desc);
create index if not exists stock_transfers_part_idx on public.stock_transfers (part_id);
create index if not exists stock_transfers_oil_idx on public.stock_transfers (oil_type_id);

alter table public.stock_transfers enable row level security;

drop policy if exists stock_transfers_select on public.stock_transfers;
create policy stock_transfers_select on public.stock_transfers
  for select to authenticated using (true);

drop policy if exists stock_transfers_insert on public.stock_transfers;
create policy stock_transfers_insert on public.stock_transfers
  for insert to authenticated
  with check (private.current_role() in ('owner', 'manager'));

create or replace function public.apply_stock_transfer()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.part_id is not null then
    insert into public.part_location_stock (part_id, location_id, qty)
    values (new.part_id, new.from_location_id, -new.quantity::integer)
    on conflict (part_id, location_id)
    do update set qty = public.part_location_stock.qty - new.quantity::integer;

    insert into public.part_location_stock (part_id, location_id, qty)
    values (new.part_id, new.to_location_id, new.quantity::integer)
    on conflict (part_id, location_id)
    do update set qty = public.part_location_stock.qty + new.quantity::integer;
  else
    insert into public.oil_location_stock (oil_type_id, location_id, qty)
    values (new.oil_type_id, new.from_location_id, -new.quantity)
    on conflict (oil_type_id, location_id)
    do update set qty = public.oil_location_stock.qty - new.quantity;

    insert into public.oil_location_stock (oil_type_id, location_id, qty)
    values (new.oil_type_id, new.to_location_id, new.quantity)
    on conflict (oil_type_id, location_id)
    do update set qty = public.oil_location_stock.qty + new.quantity;
  end if;
  return new;
end;
$$;

revoke all on function public.apply_stock_transfer() from public;

drop trigger if exists trg_apply_stock_transfer on public.stock_transfers;
create trigger trg_apply_stock_transfer
  after insert on public.stock_transfers
  for each row execute function public.apply_stock_transfer();

drop trigger if exists trg_stock_transfers_audit on public.stock_transfers;
create trigger trg_stock_transfers_audit
  after insert or update or delete on public.stock_transfers
  for each row execute function public.audit_row();
