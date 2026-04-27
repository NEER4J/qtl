-- 0023_oil_change_price_imperial_gallon.sql
-- oil_types.gallon_cost_per_litre actually stores price per Imperial gallon
-- (Canada). Divide by 4.54609 to convert to per-litre before multiplying by
-- engine capacity. Bulk path is unchanged.

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
  v_cost_per_litre numeric(10,4);
  v_filter_cost numeric(12,2) := 0;
  v_service_cost numeric(12,2) := 0;
  v_tier_premium numeric(10,2) := 0;
  v_sell numeric(12,2);
begin
  select oil_capacity_litres into v_oil_capacity
    from public.engine_types where id = p_engine_id;
  if v_oil_capacity is null then return null; end if;

  select case
           when p_container = 'gallon' then gallon_cost_per_litre / 4.54609
           else bulk_cost_per_litre
         end
    into v_cost_per_litre
    from public.oil_types where id = p_oil_type_id;
  if v_cost_per_litre is null then return null; end if;

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

  return ceil(v_sell)::numeric - 0.01;
end;
$$;
