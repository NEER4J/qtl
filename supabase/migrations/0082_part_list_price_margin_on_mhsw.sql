-- 0082_part_list_price_margin_on_mhsw.sql
-- Sell MHSW now folds into the cost basis BEFORE the margin is applied. So a
-- percent margin marks up (cost + Sell MHSW) instead of cost alone. List price
-- is still (cost + Sell MHSW) + margin. Mirror of calculatePartListPrice() in
-- lib/utils/part-pricing.ts.

create or replace function public.set_part_list_price()
returns trigger
language plpgsql
as $$
declare
  cost_basis      numeric(12,2);
  computed_margin numeric(10,2);
begin
  new.margin_value := greatest(new.margin_value, 0);

  -- Sell MHSW is added into the cost basis first.
  cost_basis := new.cost + new.mhsw_fee;

  computed_margin :=
    case
      when new.margin_type = 'percent' then round((cost_basis * new.margin_value) / 100.0, 2)
      else new.margin_value
    end;

  new.list_price := round(cost_basis + computed_margin, 2);
  return new;
end;
$$;

-- Re-fire the trigger on every part so existing list prices reflect the new
-- basis. (For 'fixed' margins nothing changes; only 'percent' margins move.)
update public.parts set margin_value = margin_value;
