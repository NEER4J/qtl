-- 0117_sales_stock_qty_cap.sql
--
-- "Sell anyway" must complete the sale without driving inventory negative.
-- The invoice line still shows the full sold quantity; stock_qty records how
-- many units/litres actually left the shop's on-hand count (capped at what
-- was available when the job was saved). NULL = deduct the full quantity
-- (normal path). The trigger always floors at 0 as a belt-and-suspenders
-- guard.

alter table public.sales_job_items
  add column if not exists stock_qty numeric(10,2)
    check (stock_qty is null or (stock_qty >= 0 and stock_qty <= quantity));

comment on column public.sales_job_items.stock_qty is
  'Inventory units/litres actually drawn from shop stock for this line. NULL = use quantity. Set below quantity on a stock-shortfall override so on-hand never goes negative.';

create or replace function public.sync_sales_job_item_stock()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_loc       uuid;
  v_qty       numeric(12,2);
  v_delta     integer;
  v_oil_delta numeric(12,2);
  v_on_hand   numeric(12,2);
begin
  -- Reverse the OLD line (DELETE or UPDATE).
  if tg_op in ('DELETE', 'UPDATE') and not coalesce(old.is_customer_supplied, false) then
    if old.part_id is not null then
      select location_id into v_loc from public.sales_jobs where id = old.sales_job_id;
      v_qty := coalesce(old.stock_qty, old.quantity);
      v_delta := round(coalesce(v_qty, 0))::integer;               -- undo a sale = add qty back
      if coalesce(old.unit_price, 0) < 0 then v_delta := -v_delta; end if; -- undo a return = remove
      if v_loc is not null and v_delta <> 0 then
        insert into public.part_location_stock (part_id, location_id, qty)
        values (old.part_id, v_loc, greatest(0, v_delta))
        on conflict (part_id, location_id)
        do update set qty = greatest(0, public.part_location_stock.qty + v_delta);
      end if;
    elsif old.oil_type_id is not null then
      select location_id into v_loc from public.sales_jobs where id = old.sales_job_id;
      v_qty := coalesce(old.stock_qty, old.quantity);
      v_oil_delta := coalesce(v_qty, 0);
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
  if tg_op in ('INSERT', 'UPDATE') and not coalesce(new.is_customer_supplied, false) then
    if new.part_id is not null then
      select location_id into v_loc from public.sales_jobs where id = new.sales_job_id;
      v_qty := coalesce(new.stock_qty, new.quantity);
      v_delta := round(coalesce(v_qty, 0))::integer;               -- a sale removes qty
      if coalesce(new.unit_price, 0) >= 0 then v_delta := -v_delta; end if; -- return keeps +qty
      if v_loc is not null and v_delta <> 0 then
        -- Never draw more than is on hand (stock_qty should already cap this;
        -- the LEAST here is the hard floor for direct API calls / legacy rows).
        if v_delta < 0 then
          select coalesce(
            (select qty from public.part_location_stock
              where part_id = new.part_id and location_id = v_loc),
            0
          ) into v_on_hand;
          v_delta := -least(abs(v_delta), greatest(0, v_on_hand))::integer;
        end if;
        if v_delta <> 0 then
          insert into public.part_location_stock (part_id, location_id, qty)
          values (new.part_id, v_loc, greatest(0, v_delta))
          on conflict (part_id, location_id)
          do update set qty = greatest(0, public.part_location_stock.qty + v_delta);
        end if;
      end if;
    elsif new.oil_type_id is not null then
      select location_id into v_loc from public.sales_jobs where id = new.sales_job_id;
      v_qty := coalesce(new.stock_qty, new.quantity);
      v_oil_delta := coalesce(v_qty, 0);                           -- a sale removes litres
      if coalesce(new.unit_price, 0) >= 0 then v_oil_delta := -v_oil_delta; end if;
      if v_loc is not null and v_oil_delta <> 0 then
        if v_oil_delta < 0 then
          select coalesce(
            (select qty from public.oil_location_stock
              where oil_type_id = new.oil_type_id and location_id = v_loc),
            0
          ) into v_on_hand;
          v_oil_delta := -least(abs(v_oil_delta), greatest(0, v_on_hand));
        end if;
        if v_oil_delta <> 0 then
          insert into public.oil_location_stock (oil_type_id, location_id, qty)
          values (new.oil_type_id, v_loc, greatest(0, v_oil_delta))
          on conflict (oil_type_id, location_id)
          do update set qty = greatest(0, public.oil_location_stock.qty + v_oil_delta);
        end if;
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
