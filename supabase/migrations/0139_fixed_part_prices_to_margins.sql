-- 0139_fixed_part_prices_to_margins.sql
-- Client 2026-09-01: "price is not getting updated when we change anything in
-- the part list."
--
-- WHY IT DOESN'T UPDATE
-- --------------------------------------------------------------------------
-- 103 active parts carry a fixed Over-the-counter price in
-- parts.over_counter_price, seeded from the May 2026 "All Filter Sell Price"
-- tab. computePartSellTiers gives that column priority over the calculation:
--
--     Over the Counter = over_counter_price ?? list_price
--     list_price       = cost + Sell MHSW + margin        (trigger, 0021)
--
-- So on those parts the sell price is a typed-in constant. Editing Cost or
-- Margin moves the List column on screen and changes nothing a customer is
-- charged - exactly what the client is seeing. 101 of the 103 sit at a price
-- the formula would not produce today, so the freeze is really biting:
-- 40 oil filters, 38 fuel filters, 10 air filters, 7 fuel separators,
-- 3 air dryers, 2 cab filters.
--
-- WHAT THIS DOES
-- --------------------------------------------------------------------------
-- Expresses each fixed price as a margin instead of a constant:
--
--     margin_value       := over_counter_price - cost - Sell MHSW
--     over_counter_price := NULL
--
-- The 0021 trigger then recomputes list_price = cost + Sell MHSW + margin,
-- which lands on exactly the old fixed price. Nothing moves today; from here a
-- change to Cost flows straight through to the sell price.
--
-- Checked against live data before writing this: all 103 convert with a
-- POSITIVE margin (range $6.51 to $70.01, median $11.62), all 103 are already
-- margin_type = 'fixed', and every row reproduces its old price to the cent.
-- Each row is verified individually after its update and the whole thing
-- rolls back if any price moves. A row that would need a negative margin is
-- skipped and named rather than clamped - clamping would silently reprice it.
--
-- DELIBERATELY NOT TOUCHED
-- --------------------------------------------------------------------------
--   * with_service_price (30 parts). With Service = cost + service charge, so
--     the equivalent move is the per-part counter_premium, not margin. 5 of
--     the 30 imply a NEGATIVE service charge, so it wants a look first.
--   * without_service_price (103 parts). Without Service = linked labour +
--     list price, and holding those prices would need 21 distinct labour
--     values ($0 to $27) where the catalogue has only $0/$10/$20/$30/$40. It
--     cannot be converted without new service-cost rows or moving prices, so
--     it stays pinned - and stays flagged in the parts list and on the
--     All-filter price page.
--
-- Sales jobs are unaffected either way: a part is always added through the
-- tier dialog, which prices it through computePartSellTiers, and that returns
-- the same number before and after this migration.

do $$
declare
  r            record;
  v_margin     numeric(10,2);
  v_new_list   numeric(12,2);
  v_total      int := 0;
  v_converted  int := 0;
  v_skipped    int := 0;
  v_skip_names text := '';
begin
  for r in
    select id, brand, part_number, cost, mhsw_fee, over_counter_price
      from public.parts
     where over_counter_price is not null
     order by brand, part_number
  loop
    v_total := v_total + 1;
    v_margin := round(r.over_counter_price - r.cost - r.mhsw_fee, 2);

    -- parts_margin_value_nonnegative (0021) forbids a negative margin, and a
    -- fixed price below cost + Sell MHSW is a data question, not something to
    -- round away. Leave it pinned and report it.
    if v_margin < 0 then
      v_skipped := v_skipped + 1;
      v_skip_names := v_skip_names
        || case when v_skip_names = '' then '' else ', ' end
        || r.brand || ' ' || r.part_number
        || format(' (fixed %s vs cost+MHSW %s)', r.over_counter_price, r.cost + r.mhsw_fee);
      continue;
    end if;

    -- margin_type is set explicitly: a percent margin would drift off the
    -- fixed price the moment cost changed, the opposite of the intent (hold
    -- today's price, follow cost from here).
    update public.parts
       set margin_type        = 'fixed',
           margin_value       = v_margin,
           over_counter_price = null
     where id = r.id;

    select list_price into v_new_list from public.parts where id = r.id;
    if abs(v_new_list - r.over_counter_price) >= 0.005 then
      raise exception
        '0139: % % would change price (% -> %) - rolling back, nothing was converted.',
        r.brand, r.part_number, r.over_counter_price, v_new_list;
    end if;

    v_converted := v_converted + 1;
  end loop;

  raise notice '0139: % part(s) carried a fixed Over-the-counter price.', v_total;
  raise notice '0139: converted %; every price is unchanged and now follows cost.', v_converted;
  if v_skipped > 0 then
    raise notice '0139: left % pinned because the fixed price is below cost + Sell MHSW: %',
      v_skipped, v_skip_names;
  end if;
end $$;

analyze public.parts;
