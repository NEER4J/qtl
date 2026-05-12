-- 0053_oil_change_price_guard_zero.sql
--
-- Follow-up to 0052: the oil_change_price() function returned `ceil(0) - 0.01`
-- = -$0.01 when the cost-up math summed to 0 (oil with no cost configured, or
-- engine with no filters). Guard with `if v_sell <= 0 then return null`.
--
-- This is a CREATE OR REPLACE so it's safe to run on any DB whether or not it
-- already has 0052 applied (or had its 0052 function patched in place).

create or replace function public.oil_change_price(
  p_engine_id   uuid,
  p_oil_type_id uuid,
  p_container   text default 'bulk'
)
returns numeric
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_override numeric(10,2);
  v_oil_capacity   numeric(6,2);
  v_cost_per_litre numeric(10,4);
  v_filter_cost    numeric(12,2) := 0;
  v_service_cost   numeric(12,2) := 0;
  v_tier_premium   numeric(10,2) := 0;
  v_sell numeric(12,2);
begin
  -- 1) Manual override wins.
  select sell_price into v_override
    from public.engine_sell_prices
   where engine_type_id = p_engine_id
     and oil_type_id    = p_oil_type_id
     and container      = p_container;
  if v_override is not null then
    return v_override;
  end if;

  -- 2) Cost-up fallback.
  select oil_capacity_litres into v_oil_capacity
    from public.engine_types where id = p_engine_id;
  if v_oil_capacity is null or v_oil_capacity <= 0 then return null; end if;

  select case when p_container = 'gallon' then gallon_cost_per_litre else bulk_cost_per_litre end
    into v_cost_per_litre
    from public.oil_types where id = p_oil_type_id;
  if v_cost_per_litre is null or v_cost_per_litre <= 0 then return null; end if;

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

  v_sell := (v_cost_per_litre * v_oil_capacity) + v_filter_cost + v_service_cost + coalesce(v_tier_premium, 0);

  -- Guard the .99 trick so we never return -$0.01 for empty cost data.
  if v_sell is null or v_sell <= 0 then return null; end if;

  return ceil(v_sell)::numeric - 0.01;
end;
$$;

revoke all on function public.oil_change_price(uuid, uuid, text) from public;
grant execute on function public.oil_change_price(uuid, uuid, text) to authenticated;
