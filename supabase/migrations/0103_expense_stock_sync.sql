-- 0103_expense_stock_sync.sql
-- Recording an expense line for a catalogue part = buying that part into stock,
-- so the part's on-hand count at the expense's location should go UP
-- automatically. Until now nothing linked expenses → part_location_stock (stock
-- was only ever set by hand). (client 2026-06-30 — "inventory not adding item
-- from the expense automatically".)
--
-- Implemented as a trigger on expense_items so it stays correct through
-- updateExpense's delete-all-then-reinsert (INSERT adds, DELETE subtracts, and
-- the two net out on an edit). SECURITY DEFINER so an accountant/staff member
-- who records the expense still moves stock even though they can't edit
-- part_location_stock directly (RLS = owner/co_owner/manager only).
--
-- Notes / limits (v1, parts only):
--   * Only lines with a part_id move stock; custom / labour / promo lines skip.
--   * part_location_stock.qty is an integer, so fractional buy quantities
--     (e.g. 0.5 kg grease) are rounded to the nearest whole unit.
--   * qty is floored at 0 (never violates the >= 0 check).
--   * Location is read from the parent expense at trigger time; if an expense's
--     location is later changed the historical delta stays on the new location
--     (rare — accepted). Oils aren't handled (expense_items has no oil_type_id).

create or replace function public.sync_expense_item_stock()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_loc   uuid;
  v_delta integer;
begin
  -- Reverse the OLD line's stock (DELETE or UPDATE).
  if (tg_op in ('DELETE', 'UPDATE')) and old.part_id is not null then
    select location_id into v_loc from public.expenses where id = old.expense_id;
    v_delta := round(coalesce(old.quantity, 0))::integer;
    if v_loc is not null and v_delta <> 0 then
      update public.part_location_stock
         set qty = greatest(0, qty - v_delta)
       where part_id = old.part_id and location_id = v_loc;
    end if;
  end if;

  -- Apply the NEW line's stock (INSERT or UPDATE).
  if (tg_op in ('INSERT', 'UPDATE')) and new.part_id is not null then
    select location_id into v_loc from public.expenses where id = new.expense_id;
    v_delta := round(coalesce(new.quantity, 0))::integer;
    if v_loc is not null and v_delta <> 0 then
      insert into public.part_location_stock (part_id, location_id, qty)
      values (new.part_id, v_loc, v_delta)
      on conflict (part_id, location_id)
      do update set qty = greatest(0, public.part_location_stock.qty + v_delta);
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_expense_item_stock() from public;

drop trigger if exists trg_sync_expense_item_stock on public.expense_items;
create trigger trg_sync_expense_item_stock
  after insert or update or delete on public.expense_items
  for each row execute function public.sync_expense_item_stock();
