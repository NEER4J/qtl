-- 0117_sales_stock_qty_cap.sql
--
-- "Sell anyway" completes the sale and deducts the FULL sold quantity from
-- inventory, even when on-hand is 0 — stock may go negative so the shop can
-- see how far short they are. Normal sales (stock_override = false) still
-- floor at 0 in the trigger as a backstop if the app check is bypassed.

alter table public.sales_jobs
  add column if not exists stock_override boolean not null default false;

comment on column public.sales_jobs.stock_override is
  'Set when a privileged user bypassed a stock-shortfall block. Inventory sync deducts the full line quantity and may go negative.';

-- Drop the >= 0 floor so override sales can record negative on-hand.
alter table public.part_location_stock
  drop constraint if exists part_location_stock_qty_check;
alter table public.oil_location_stock
  drop constraint if exists oil_location_stock_qty_check;

-- In case an earlier draft of this migration added stock_qty, remove it.
alter table public.sales_job_items
  drop column if exists stock_qty;

create or replace function public.sync_sales_job_item_stock()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_loc       uuid;
  v_job_id    uuid;
  v_override  boolean := false;
  v_delta     integer;
  v_oil_delta numeric(12,2);
begin
  v_job_id := coalesce(new.sales_job_id, old.sales_job_id);
  select sj.location_id, coalesce(sj.stock_override, false)
    into v_loc, v_override
    from public.sales_jobs sj
   where sj.id = v_job_id;

  -- Reverse the OLD line (DELETE or UPDATE).
  if tg_op in ('DELETE', 'UPDATE') and not coalesce(old.is_customer_supplied, false) then
    if old.part_id is not null then
      v_delta := round(coalesce(old.quantity, 0))::integer;      -- undo a sale = add qty back
      if coalesce(old.unit_price, 0) < 0 then v_delta := -v_delta; end if; -- undo a return = remove
      if v_loc is not null and v_delta <> 0 then
        if v_override then
          insert into public.part_location_stock (part_id, location_id, qty)
          values (old.part_id, v_loc, v_delta)
          on conflict (part_id, location_id)
          do update set qty = public.part_location_stock.qty + v_delta;
        else
          insert into public.part_location_stock (part_id, location_id, qty)
          values (old.part_id, v_loc, greatest(0, v_delta))
          on conflict (part_id, location_id)
          do update set qty = greatest(0, public.part_location_stock.qty + v_delta);
        end if;
      end if;
    elsif old.oil_type_id is not null then
      v_oil_delta := coalesce(old.quantity, 0);
      if coalesce(old.unit_price, 0) < 0 then v_oil_delta := -v_oil_delta; end if;
      if v_loc is not null and v_oil_delta <> 0 then
        if v_override then
          insert into public.oil_location_stock (oil_type_id, location_id, qty)
          values (old.oil_type_id, v_loc, v_oil_delta)
          on conflict (oil_type_id, location_id)
          do update set qty = public.oil_location_stock.qty + v_oil_delta;
        else
          insert into public.oil_location_stock (oil_type_id, location_id, qty)
          values (old.oil_type_id, v_loc, greatest(0, v_oil_delta))
          on conflict (oil_type_id, location_id)
          do update set qty = greatest(0, public.oil_location_stock.qty + v_oil_delta);
        end if;
      end if;
    end if;
  end if;

  -- Apply the NEW line (INSERT or UPDATE).
  if tg_op in ('INSERT', 'UPDATE') and not coalesce(new.is_customer_supplied, false) then
    if new.part_id is not null then
      v_delta := round(coalesce(new.quantity, 0))::integer;      -- a sale removes qty
      if coalesce(new.unit_price, 0) >= 0 then v_delta := -v_delta; end if; -- return keeps +qty
      if v_loc is not null and v_delta <> 0 then
        if v_override then
          insert into public.part_location_stock (part_id, location_id, qty)
          values (new.part_id, v_loc, v_delta)
          on conflict (part_id, location_id)
          do update set qty = public.part_location_stock.qty + v_delta;
        else
          insert into public.part_location_stock (part_id, location_id, qty)
          values (new.part_id, v_loc, greatest(0, v_delta))
          on conflict (part_id, location_id)
          do update set qty = greatest(0, public.part_location_stock.qty + v_delta);
        end if;
      end if;
    elsif new.oil_type_id is not null then
      v_oil_delta := coalesce(new.quantity, 0);                  -- a sale removes litres
      if coalesce(new.unit_price, 0) >= 0 then v_oil_delta := -v_oil_delta; end if;
      if v_loc is not null and v_oil_delta <> 0 then
        if v_override then
          insert into public.oil_location_stock (oil_type_id, location_id, qty)
          values (new.oil_type_id, v_loc, v_oil_delta)
          on conflict (oil_type_id, location_id)
          do update set qty = public.oil_location_stock.qty + v_oil_delta;
        else
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
