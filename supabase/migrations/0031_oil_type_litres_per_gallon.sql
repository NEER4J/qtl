-- 0031_oil_type_litres_per_gallon.sql
-- Each oil type now defines its own gallon size in litres. Different oils ship
-- in different containers — Imperial 4.546 L, US 3.785 L, metric 4.0 L — so a
-- single hardcoded conversion factor was wrong for any oil whose "gallon" was
-- a different size.
--
-- This migration also fixes a latent bug in oil_change_price(): previously the
-- gallon path multiplied gallon_cost_per_litre (which actually stores price
-- per gallon, despite its name) directly by oil_capacity_litres without
-- converting, so the SQL function returned a per-litre quote ~4.5× too high
-- for gallons. The TypeScript price-grid path was already dividing by 4.54609.
-- Both paths now agree and use the per-oil litres_per_gallon.

alter table public.oil_types
  add column if not exists litres_per_gallon numeric(8,4) not null default 4.5460;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'oil_types_litres_per_gallon_check'
       and conrelid = 'public.oil_types'::regclass
  ) then
    alter table public.oil_types
      add constraint oil_types_litres_per_gallon_check
      check (litres_per_gallon > 0);
  end if;
end$$;

create or replace function public.oil_change_price(
  p_engine_id uuid,
  p_oil_type_id uuid,
  p_container text default 'bulk'
)
returns numeric
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_oil_capacity numeric(6,2);
  v_bulk numeric(10,4);
  v_per_gallon numeric(10,4);
  v_litres_per_gallon numeric(8,4);
  v_cost_per_litre numeric(12,6);
  v_filter_cost numeric(12,2) := 0;
  v_service_cost numeric(12,2) := 0;
  v_tier_premium numeric(10,2) := 0;
  v_sell numeric(12,2);
begin
  select oil_capacity_litres into v_oil_capacity
    from public.engine_types where id = p_engine_id;
  if v_oil_capacity is null then return null; end if;

  select bulk_cost_per_litre, gallon_cost_per_litre, litres_per_gallon
    into v_bulk, v_per_gallon, v_litres_per_gallon
    from public.oil_types where id = p_oil_type_id;
  if not found then return null; end if;

  if p_container = 'gallon' then
    if v_per_gallon is null or v_litres_per_gallon is null or v_litres_per_gallon <= 0 then
      return null;
    end if;
    v_cost_per_litre := v_per_gallon::numeric / v_litres_per_gallon::numeric;
  else
    if v_bulk is null then return null; end if;
    v_cost_per_litre := v_bulk;
  end if;

  select coalesce(sum((p.cost + p.mhsw_fee) * ef.quantity), 0),
         coalesce(sum(coalesce(sc.cost, 0) * ef.quantity), 0)
    into v_filter_cost, v_service_cost
    from public.engine_filters ef
    join public.parts p on p.id = ef.part_id
    left join public.service_costs sc on sc.id = p.service_cost_id
   where ef.engine_type_id = p_engine_id;

  select coalesce(premium, 0) into v_tier_premium
    from public.volume_tiers
   where oil_type_id = p_oil_type_id
     and min_litres <= v_oil_capacity
   order by min_litres desc
   limit 1;

  v_sell := (v_cost_per_litre * v_oil_capacity)
          + v_filter_cost + v_service_cost
          + coalesce(v_tier_premium, 0);

  -- ROUNDUP to nearest dollar, minus $0.01 — ends in .99 (spec §9.1)
  return ceil(v_sell)::numeric - 0.01;
end;
$$;

revoke all on function public.oil_change_price(uuid, uuid, text) from public;
grant execute on function public.oil_change_price(uuid, uuid, text) to authenticated;
