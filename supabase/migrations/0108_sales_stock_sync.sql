-- 0108_sales_stock_sync.sql
-- Selling a catalogue part on a sales job = it leaves stock, so the part's
-- on-hand count at the job's location should go DOWN automatically. Mirror of
-- 0103 (expense→stock) but with the opposite sign. (client 2026-07-22 —
-- "inventory sync not working, update it live when parts are selling".)
--
-- Trigger on sales_job_items so it stays correct through replaceJobItems'
-- delete-all-then-reinsert (INSERT applies, DELETE reverses; edits net out).
-- SECURITY DEFINER so staff who can create a sale but can't edit
-- part_location_stock (RLS = owner/co_owner/manager) still move stock.
--
-- Sign: a normal sale line REMOVES qty from stock. A return / credit line
-- (unit_price < 0 — the part comes back) ADDS qty back. Promotion / discount
-- lines have no part_id and are skipped. qty is rounded to a whole unit and
-- floored at 0 (never violates the >= 0 check). Location is read from the
-- parent sales_jobs row.

create or replace function public.sync_sales_job_item_stock()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_loc   uuid;
  v_delta integer;
begin
  -- Reverse the OLD line (DELETE or UPDATE).
  if (tg_op in ('DELETE', 'UPDATE')) and old.part_id is not null then
    select location_id into v_loc from public.sales_jobs where id = old.sales_job_id;
    v_delta := round(coalesce(old.quantity, 0))::integer;      -- undo a sale = add qty back
    if coalesce(old.unit_price, 0) < 0 then v_delta := -v_delta; end if; -- undo a return = remove
    if v_loc is not null and v_delta <> 0 then
      insert into public.part_location_stock (part_id, location_id, qty)
      values (old.part_id, v_loc, greatest(0, v_delta))
      on conflict (part_id, location_id)
      do update set qty = greatest(0, public.part_location_stock.qty + v_delta);
    end if;
  end if;

  -- Apply the NEW line (INSERT or UPDATE).
  if (tg_op in ('INSERT', 'UPDATE')) and new.part_id is not null then
    select location_id into v_loc from public.sales_jobs where id = new.sales_job_id;
    v_delta := round(coalesce(new.quantity, 0))::integer;      -- a sale removes qty
    if coalesce(new.unit_price, 0) >= 0 then v_delta := -v_delta; end if; -- return keeps +qty
    if v_loc is not null and v_delta <> 0 then
      insert into public.part_location_stock (part_id, location_id, qty)
      values (new.part_id, v_loc, greatest(0, v_delta))
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

revoke all on function public.sync_sales_job_item_stock() from public;

drop trigger if exists trg_sync_sales_job_item_stock on public.sales_job_items;
create trigger trg_sync_sales_job_item_stock
  after insert or update or delete on public.sales_job_items
  for each row execute function public.sync_sales_job_item_stock();
