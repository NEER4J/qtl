-- 0149_sales_auto_lines.sql
-- Two charges the sales form now adds by itself, plus the oil-line container
-- they need (client 2026-09-15):
--
--   * Volume tier premium on oil — "Add oil" charged litres × rate with no
--     tier, although the oil-change price list adds one ($25 at 21 L+, …).
--     The job now carries ONE "Volume tier premium" line: for each oil on the
--     job, the premium for its total litres (volume_tiers, highest min_litres
--     that fits).
--   * Grease-only fee — a job that is only greasing (no oil, filters, fuel or
--     Trans & Diff) gets a fee set in Settings → Pricing defaults. Not charged
--     on a free-grease redemption.
--
-- sales_job_items.auto_fee marks those lines ('oil_tier_premium' /
-- 'grease_only_fee'). They carry no part_id and no oil_type_id, so the stock
-- trigger never touches them and the package-overlap check never matches them.
-- If staff edit or delete one, the job's *_waived flag is set and the form
-- leaves that charge alone from then on (they can add it back).
--
-- sales_job_items.oil_container — whether an oil line is bulk (litres) or
-- gallon (jugs). Until now it lived only in the browser, so a gallon line
-- reloaded as litres and the stock trigger deducted 3 L for 3 jugs. Existing
-- rows are NOT backfilled: NULL means "legacy, treated as litres", which is
-- exactly how their stock was deducted, so re-saving an old job reverses and
-- re-applies the same amount and stock never drifts.
--
-- The stock trigger (last defined in 0117) now scales a gallon line by that
-- oil's litres_per_gallon — mirroring 0132 for expenses — EXCEPT package oil
-- lines (package_group set), whose quantity is the package item count rather
-- than jugs. Everything else in 0117 (override, the 0 floor, returns,
-- customer-supplied) is unchanged.

-- ============================================================================
-- Columns
-- ============================================================================
alter table public.sales_job_items
  add column if not exists oil_container text,
  add column if not exists auto_fee text;

alter table public.sales_job_items
  drop constraint if exists sales_job_items_oil_container_check;
alter table public.sales_job_items
  add constraint sales_job_items_oil_container_check
  check (oil_container is null or oil_container in ('bulk', 'gallon'));

alter table public.sales_job_items
  drop constraint if exists sales_job_items_auto_fee_check;
alter table public.sales_job_items
  add constraint sales_job_items_auto_fee_check
  check (auto_fee is null or auto_fee in ('oil_tier_premium', 'grease_only_fee'));

comment on column public.sales_job_items.oil_container is
  'bulk (qty in litres) or gallon (qty in jugs) for an oil line. NULL = legacy row, treated as litres (0149).';
comment on column public.sales_job_items.auto_fee is
  'Set on a line the sales form adds and keeps up to date itself: oil_tier_premium / grease_only_fee (0149).';

alter table public.sales_jobs
  add column if not exists oil_tier_premium_waived boolean not null default false,
  add column if not exists grease_only_fee_waived boolean not null default false;

comment on column public.sales_jobs.oil_tier_premium_waived is
  'Staff edited or removed the automatic volume tier premium on this job, so the form no longer manages it (0149).';
comment on column public.sales_jobs.grease_only_fee_waived is
  'Staff edited or removed the automatic grease-only fee on this job, so the form no longer manages it (0149).';

alter table public.app_settings
  add column if not exists grease_only_fee numeric(10,2) not null default 0;

alter table public.app_settings
  drop constraint if exists app_settings_grease_only_fee_check;
alter table public.app_settings
  add constraint app_settings_grease_only_fee_check check (grease_only_fee >= 0);

comment on column public.app_settings.grease_only_fee is
  'Extra charge on a grease-only sales job (no oil, filters, fuel or Trans & Diff). 0 = off (0149).';

-- ============================================================================
-- Stock trigger: gallon oil lines deduct litres, not jugs
-- ============================================================================
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
  v_lpg       numeric;
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
      -- A standalone gallon line counts jugs: scale to litres by that oil's own
      -- jug size (0132's fallback: missing / zero / negative → 1).
      v_lpg := 1;
      if old.oil_container = 'gallon' and old.package_group is null then
        select litres_per_gallon into v_lpg from public.oil_types where id = old.oil_type_id;
        if v_lpg is null or v_lpg <= 0 then v_lpg := 1; end if;
      end if;
      v_oil_delta := coalesce(old.quantity, 0) * v_lpg;
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
      v_lpg := 1;
      if new.oil_container = 'gallon' and new.package_group is null then
        select litres_per_gallon into v_lpg from public.oil_types where id = new.oil_type_id;
        if v_lpg is null or v_lpg <= 0 then v_lpg := 1; end if;
      end if;
      v_oil_delta := coalesce(new.quantity, 0) * v_lpg;          -- a sale removes litres
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
