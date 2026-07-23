-- 0114_full_stock_sync.sql
--
-- Client (2026-07-23): "I simply want the inventory to be connected with
-- expense and sales... every item that is in inventory or catalog or oil or
-- filter — everything." Three gaps closed here:
--
--   1. Oil could never be BOUGHT into stock through an expense — expense_items
--      had no oil_type_id column at all (0103 only ever moved parts). Mirrors
--      the part_id path exactly, just adding instead of the sales side's
--      subtracting.
--   2. A customer-supplied part line (0048, is_customer_supplied = true) still
--      decremented the SHOP's stock even though the shop never actually
--      provided that physical item — the customer brought their own. Latent
--      bug in 0108/0113; guarded out here.
--   3. Data integrity: a line item should never carry BOTH part_id and
--      oil_type_id — added a check constraint on both tables so a bug can't
--      double-count a row against two stock tables at once.
--
-- The actual HARD BLOCK ("don't let the sale go through if stock is short")
-- is deliberately NOT a database constraint — it's enforced in the
-- application layer (lib/actions/inventory.ts + lib/actions/sales.ts) so a
-- shortfall can produce a friendly, itemised error instead of a raw
-- constraint-violation, and so an owner/co_owner/manager can consciously
-- override it. The stock tables' own `qty >= 0` check remains the last-resort
-- floor if that's ever bypassed (e.g. a direct API call).

-- ============================================================================
-- 1. Oil purchases → expense_items
-- ============================================================================
alter table public.expense_items
  add column if not exists oil_type_id uuid references public.oil_types(id) on delete restrict,
  add column if not exists oil_container text check (oil_container in ('bulk', 'gallon'));

create index if not exists expense_items_oil_idx
  on public.expense_items (oil_type_id) where oil_type_id is not null;

alter table public.expense_items
  drop constraint if exists expense_items_not_both_part_and_oil;
alter table public.expense_items
  add constraint expense_items_not_both_part_and_oil
  check (part_id is null or oil_type_id is null);

-- NOT VALID: oil_type_id (0072) and part_id (0027) have coexisted on this
-- table for a while, unlike expense_items' brand-new column above. Skipping
-- validation against existing rows means a historical outlier (if one exists)
-- can't fail this migration; the constraint still applies to every new write.
alter table public.sales_job_items
  drop constraint if exists sales_job_items_not_both_part_and_oil;
alter table public.sales_job_items
  add constraint sales_job_items_not_both_part_and_oil
  check (part_id is null or oil_type_id is null) not valid;

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
      v_oil_delta := coalesce(old.quantity, 0);
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
      v_oil_delta := coalesce(new.quantity, 0);
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

-- ============================================================================
-- 2. Customer-supplied parts must not touch the shop's own stock
-- ============================================================================
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
  if tg_op in ('DELETE', 'UPDATE') and not coalesce(old.is_customer_supplied, false) then
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
      v_oil_delta := coalesce(old.quantity, 0);
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
