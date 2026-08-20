-- 0132_expense_oil_gallon_to_litres.sql
--
-- Buying oil on an expense already lands in Oils inventory (0114), but it
-- landed in the WRONG UNIT whenever the line was a gallon purchase.
--
--   oil_location_stock.qty is LITRES.
--   An expense oil line is entered the way the vendor bills it — a bulk line
--   is litres, a gallon line is JUGS ("3 x Duron 15W40 gallon @ $19.78").
--
-- 0114 added `quantity` straight onto the litre balance for both, so buying
-- 3 gallons of Duron (4.546 L/jug) credited 3 L instead of 13.638 L —
-- roughly a quarter of what actually arrived on the shelf. Verified against
-- the live DB on 2026-08-19: a 3-gallon test line moved stock by exactly 3.
--
-- Fixed here by scaling gallon lines through the oil's OWN litres_per_gallon
-- (Imperial 4.546 / US 3.785 / metric 4.0 all coexist in oil_types), in both
-- the apply and the reverse branch so edits and deletes still net to zero.
--
-- A missing / zero / negative litres_per_gallon falls back to 1.0 (treat the
-- line as litres) rather than collapsing the delta to nothing — the same
-- defensive read the pricing layer does in lib/actions/pricing.ts.
--
-- No backfill: expense_items has never held a single oil row (checked live),
-- so there is no historical stock to re-scale.

create or replace function public.sync_expense_item_stock()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_loc   uuid;
  v_delta integer;
  v_oil_delta numeric(12,2);
  v_lpg   numeric;
begin
  -- Reverse the OLD line's stock (DELETE or UPDATE).
  if tg_op in ('DELETE', 'UPDATE') then
    if old.part_id is not null then
      select location_id into v_loc from public.expenses where id = old.expense_id;
      v_delta := round(coalesce(old.quantity, 0))::integer;
      if v_loc is not null and v_delta <> 0 then
        update public.part_location_stock
           set qty = greatest(0, qty - v_delta)
         where part_id = old.part_id and location_id = v_loc;
      end if;
    elsif old.oil_type_id is not null then
      select location_id into v_loc from public.expenses where id = old.expense_id;
      v_lpg := 1;
      if old.oil_container = 'gallon' then
        select litres_per_gallon into v_lpg from public.oil_types where id = old.oil_type_id;
        if v_lpg is null or v_lpg <= 0 then v_lpg := 1; end if;
      end if;
      v_oil_delta := coalesce(old.quantity, 0) * v_lpg;
      if v_loc is not null and v_oil_delta <> 0 then
        update public.oil_location_stock
           set qty = greatest(0, qty - v_oil_delta)
         where oil_type_id = old.oil_type_id and location_id = v_loc;
      end if;
    end if;
  end if;

  -- Apply the NEW line's stock (INSERT or UPDATE).
  if tg_op in ('INSERT', 'UPDATE') then
    if new.part_id is not null then
      select location_id into v_loc from public.expenses where id = new.expense_id;
      v_delta := round(coalesce(new.quantity, 0))::integer;
      if v_loc is not null and v_delta <> 0 then
        insert into public.part_location_stock (part_id, location_id, qty)
        values (new.part_id, v_loc, v_delta)
        on conflict (part_id, location_id)
        do update set qty = greatest(0, public.part_location_stock.qty + v_delta);
      end if;
    elsif new.oil_type_id is not null then
      select location_id into v_loc from public.expenses where id = new.expense_id;
      v_lpg := 1;
      if new.oil_container = 'gallon' then
        select litres_per_gallon into v_lpg from public.oil_types where id = new.oil_type_id;
        if v_lpg is null or v_lpg <= 0 then v_lpg := 1; end if;
      end if;
      v_oil_delta := coalesce(new.quantity, 0) * v_lpg;
      if v_loc is not null and v_oil_delta <> 0 then
        insert into public.oil_location_stock (oil_type_id, location_id, qty)
        values (new.oil_type_id, v_loc, greatest(0, v_oil_delta))
        on conflict (oil_type_id, location_id)
        do update set qty = greatest(0, public.oil_location_stock.qty + v_oil_delta);
      end if;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_expense_item_stock() from public;

-- 0114 created the trigger; re-assert it so this file is self-sufficient if
-- it's ever pasted into a database that only got the column changes.
drop trigger if exists trg_sync_expense_item_stock on public.expense_items;
create trigger trg_sync_expense_item_stock
  after insert or update or delete on public.expense_items
  for each row execute function public.sync_expense_item_stock();
