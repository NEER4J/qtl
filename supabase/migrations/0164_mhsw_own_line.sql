-- 0164_mhsw_own_line.sql
--
-- MHSW is charged on its own line, not inside prices (client 2026-11-25):
--   "Sell MHSW in Parts is being added to the list price — remove it. Then I
--    will enter each part's MHSW myself (oil, fuel, coolant filters, $1.50,
--    $2 …)." and "Bulk oil has its own MHSW, 6 cents a litre. One line for the
--    oil and one for the parts."
--
-- 1. Part list price = cost + margin. Sell MHSW no longer goes in, and a
--    percent margin is on cost alone (0082 put it on cost + Sell MHSW).
--    Every part is re-priced. Margins are kept, so a part's list price drops
--    by its Sell MHSW (more for a percent margin) — the job now charges the
--    MHSW on its own line, so what the customer pays is about the same.
--    Mirror of calculatePartListPrice() in lib/utils/part-pricing.ts.
--
-- 2. oil_change_price cost-up fallback: filters at cost, without Sell MHSW
--    (same reason). A live price lock and a manual sell price are typed prices
--    and are left exactly as they are. Otherwise identical to 0150.
--
-- 3. Two new automatic job lines (sales_job_items.auto_fee):
--      mhsw_parts — Sell MHSW × quantity of every part line on the job.
--      mhsw_oil   — bulk oil litres × app_settings.mhsw_oil_per_litre.
--    Same rules as the 0149 lines: staff can edit or remove them, which sets
--    the job's *_waived flag.
--
-- 4. Every job saved before this has its MHSW inside its part prices, so both
--    new charges start waived on those jobs: editing an old invoice never adds
--    an MHSW line on top of the MHSW it already charged. New jobs default to
--    not waived.

-- ============================================================================
-- 1. Part list price without Sell MHSW
-- ============================================================================
create or replace function public.set_part_list_price()
returns trigger
language plpgsql
as $$
declare
  computed_margin numeric(10,2);
begin
  new.margin_value := greatest(new.margin_value, 0);

  computed_margin :=
    case
      when new.margin_type = 'percent' then round((new.cost * new.margin_value) / 100.0, 2)
      else new.margin_value
    end;

  new.list_price := round(new.cost + computed_margin, 2);
  return new;
end;
$$;

-- Re-fire the trigger on every part so the stored list prices follow.
update public.parts set margin_value = margin_value;

-- ============================================================================
-- 2. oil_change_price — filters at cost, without Sell MHSW
-- ============================================================================
create or replace function public.oil_change_price(
  p_engine_id   uuid,
  p_oil_type_id uuid,
  p_container   text default 'bulk',
  p_option_id   uuid default null
)
returns numeric
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_option   uuid;
  v_option_capacity numeric(6,2);
  v_locked   numeric(10,2);
  v_override numeric(10,2);
  v_oil_capacity   numeric(6,2);
  v_cost_per_litre numeric(10,4);
  v_filter_cost    numeric(12,2) := 0;
  v_service_cost   numeric(12,2) := 0;
  v_tier_premium   numeric(10,2) := 0;
  v_sell numeric(12,2);
begin
  -- An option only counts on its own engine.
  if p_option_id is not null then
    select o.id, o.oil_capacity_litres into v_option, v_option_capacity
      from public.engine_filter_options o
     where o.id = p_option_id and o.engine_type_id = p_engine_id;
  end if;
  if v_option is null and exists (
    select 1 from public.engine_filter_options o where o.engine_type_id = p_engine_id
  ) then
    return null;
  end if;

  -- 0) A live price lock wins over everything.
  select li.locked_price into v_locked
    from public.oil_price_lock_items li
    join public.oil_price_locks l on l.id = li.lock_id
   where l.oil_type_id = p_oil_type_id
     and l.container   = p_container
     and l.lock_until >= (now() at time zone 'America/Toronto')::date
     and li.engine_type_id = p_engine_id
     and li.engine_option_id is not distinct from v_option;
  if v_locked is not null then
    return v_locked;
  end if;

  -- 1) Manual override.
  select sell_price into v_override
    from public.engine_sell_prices
   where engine_type_id = p_engine_id
     and oil_type_id    = p_oil_type_id
     and container      = p_container
     and engine_option_id is not distinct from v_option;
  if v_override is not null then
    return v_override;
  end if;

  -- 2) Cost-up fallback.
  select coalesce(v_option_capacity, oil_capacity_litres) into v_oil_capacity
    from public.engine_types where id = p_engine_id;
  if v_oil_capacity is null or v_oil_capacity <= 0 then return null; end if;

  select case when p_container = 'gallon' then gallon_cost_per_litre else bulk_cost_per_litre end
    into v_cost_per_litre
    from public.oil_types where id = p_oil_type_id;
  if v_cost_per_litre is null or v_cost_per_litre <= 0 then return null; end if;

  -- Filters at cost; MHSW is charged on its own job line (0164).
  select coalesce(sum(p.cost * ef.quantity), 0),
         coalesce(sum(coalesce(sc.cost, 0) * ef.quantity), 0)
    into v_filter_cost, v_service_cost
    from public.engine_filters ef
    join public.parts p on p.id = ef.part_id
    left join public.service_costs sc on sc.id = p.service_cost_id
   where ef.engine_type_id = p_engine_id
     and ef.engine_option_id is not distinct from v_option;

  select coalesce(premium, 0) into v_tier_premium
    from public.volume_tiers
   where oil_type_id = p_oil_type_id
     and min_litres <= v_oil_capacity
   order by min_litres desc
   limit 1;

  v_sell := (v_cost_per_litre * v_oil_capacity) + v_filter_cost + v_service_cost + coalesce(v_tier_premium, 0);

  -- Guard the .99 trick so we never return -$0.01 for empty cost data.
  if v_sell is null or v_sell <= 0 then return null; end if;

  return ceil(v_sell)::numeric - 0.01;
end;
$$;

revoke all on function public.oil_change_price(uuid, uuid, text, uuid) from public;
grant execute on function public.oil_change_price(uuid, uuid, text, uuid) to authenticated;

-- ============================================================================
-- 3. MHSW automatic lines
-- ============================================================================
alter table public.sales_job_items
  drop constraint if exists sales_job_items_auto_fee_check;
alter table public.sales_job_items
  add constraint sales_job_items_auto_fee_check
  check (auto_fee is null or auto_fee in ('oil_tier_premium', 'grease_only_fee', 'mhsw_parts', 'mhsw_oil'));

comment on column public.sales_job_items.auto_fee is
  'Set on a line the sales form adds and keeps up to date itself: oil_tier_premium / grease_only_fee (0149), mhsw_parts / mhsw_oil (0164).';

comment on column public.sales_job_items.mhsw_unit is
  'Per-unit Sell MHSW snapshot for the linked part. Before 0164 it was inside unit_price; from 0164 it is charged on the job''s "MHSW — parts" line instead. 0 for non-part lines.';

alter table public.app_settings
  add column if not exists mhsw_oil_per_litre numeric(10,4) not null default 0.06;

alter table public.app_settings
  drop constraint if exists app_settings_mhsw_oil_per_litre_check;
alter table public.app_settings
  add constraint app_settings_mhsw_oil_per_litre_check check (mhsw_oil_per_litre >= 0);

comment on column public.app_settings.mhsw_oil_per_litre is
  'MHSW charged per litre of bulk oil on a sales job ("MHSW — bulk oil" line). 0 = off (0164).';

-- ============================================================================
-- 4. Waivers — existing jobs start waived
-- ============================================================================
alter table public.sales_jobs
  add column if not exists mhsw_parts_waived boolean,
  add column if not exists mhsw_oil_waived boolean;

update public.sales_jobs set mhsw_parts_waived = true where mhsw_parts_waived is null;
update public.sales_jobs set mhsw_oil_waived = true where mhsw_oil_waived is null;

alter table public.sales_jobs
  alter column mhsw_parts_waived set default false,
  alter column mhsw_parts_waived set not null,
  alter column mhsw_oil_waived set default false,
  alter column mhsw_oil_waived set not null;

comment on column public.sales_jobs.mhsw_parts_waived is
  'The form no longer manages the "MHSW — parts" line: staff edited or removed it, or the job is from before 0164 (MHSW inside its part prices).';
comment on column public.sales_jobs.mhsw_oil_waived is
  'The form no longer manages the "MHSW — bulk oil" line: staff edited or removed it, or the job is from before 0164.';
