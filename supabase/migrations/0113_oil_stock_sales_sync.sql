-- 0113_oil_stock_sales_sync.sql
--
-- The client's original ask (0108, 2026-07-22 — "inventory sync not working,
-- update it live when parts are selling") was implemented for catalogue PARTS
-- only, keyed off sales_job_items.part_id. Oil never got the same treatment:
-- oil_location_stock (0098) has always been manual-only — no trigger reads
-- sales_job_items.oil_type_id at all. For a lube shop, oil litres are the
-- inventory that actually moves on almost every job (a standalone oil line
-- via addOil(), or the oil rows inside a package via buildPackageRows()), so
-- "sync isn't working" in practice meant exactly this gap. This migration
-- extends the SAME trigger function from 0108 (one trigger firing per row,
-- not two) with an oil branch, mirroring the part_id branch exactly.
--
-- sales_job_items.quantity IS the litre count for an oil row (both addOil()
-- and the package-oil branch of buildPackageRows() put litres there, unlike
-- catalogue parts quantity is always > 0 (DB check), so a
-- credit/return-style oil line would need a negative unit_price — not
-- exposed in the UI today, but handled the same way as parts for symmetry
-- and forward-compatibility, in case a "goodwill oil credit" line ever
-- reuses oil_type_id.

create or replace function public.sync_sales_job_item_stock()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_loc   uuid;
  v_delta integer;
  v_oil_delta numeric(12,2);
begin
  -- Reverse the OLD line (DELETE or UPDATE).
  if tg_op in ('DELETE', 'UPDATE') then
    if old.part_id is not null then
      select location_id into v_loc from public.sales_jobs where id = old.sales_job_id;
      v_delta := round(coalesce(old.quantity, 0))::integer;      -- undo a sale = add qty back
      if coalesce(old.unit_price, 0) < 0 then v_delta := -v_delta; end if; -- undo a return = remove
      if v_loc is not null and v_delta <> 0 then
        insert into public.part_location_stock (part_id, location_id, qty)
        values (old.part_id, v_loc, greatest(0, v_delta))
        on conflict (part_id, location_id)
        do update set qty = greatest(0, public.part_location_stock.qty + v_delta);
      end if;
    elsif old.oil_type_id is not null then
      select location_id into v_loc from public.sales_jobs where id = old.sales_job_id;
      v_oil_delta := coalesce(old.quantity, 0);                  -- undo a sale = add litres back
      if coalesce(old.unit_price, 0) < 0 then v_oil_delta := -v_oil_delta; end if;
      if v_loc is not null and v_oil_delta <> 0 then
        insert into public.oil_location_stock (oil_type_id, location_id, qty)
        values (old.oil_type_id, v_loc, greatest(0, v_oil_delta))
        on conflict (oil_type_id, location_id)
        do update set qty = greatest(0, public.oil_location_stock.qty + v_oil_delta);
      end if;
    end if;
  end if;

  -- Apply the NEW line (INSERT or UPDATE).
  if tg_op in ('INSERT', 'UPDATE') then
    if new.part_id is not null then
      select location_id into v_loc from public.sales_jobs where id = new.sales_job_id;
      v_delta := round(coalesce(new.quantity, 0))::integer;      -- a sale removes qty
      if coalesce(new.unit_price, 0) >= 0 then v_delta := -v_delta; end if; -- return keeps +qty
      if v_loc is not null and v_delta <> 0 then
        insert into public.part_location_stock (part_id, location_id, qty)
        values (new.part_id, v_loc, greatest(0, v_delta))
        on conflict (part_id, location_id)
        do update set qty = greatest(0, public.part_location_stock.qty + v_delta);
      end if;
    elsif new.oil_type_id is not null then
      select location_id into v_loc from public.sales_jobs where id = new.sales_job_id;
      v_oil_delta := coalesce(new.quantity, 0);                  -- a sale removes litres
      if coalesce(new.unit_price, 0) >= 0 then v_oil_delta := -v_oil_delta; end if;
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

revoke all on function public.sync_sales_job_item_stock() from public;
