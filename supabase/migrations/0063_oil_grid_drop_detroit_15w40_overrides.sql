-- 0063_oil_grid_drop_detroit_15w40_overrides.sql
--
-- Client feedback (2026-05-22):
--   "Detroit DD13/DD15/DD16 With Detroit Filter is showing Chevron pricing in
--    15W40"
--
-- ROOT CAUSE
--   may2026_mirror_sibling_oils.sql intentionally copied Delo 400 XLE's
--   engine_sell_prices rows into Shell T4 and Mobil 15W40 because the May 2026
--   Excel had one shared "15W40" tab. As a result every 15W40 brand on every
--   Detroit-filter engine quotes the same number — visually "Chevron's price"
--   since Delo (the Chevron 15W40) was the source row. Independently, the
--   stored override even for Delo itself is ~$69 higher than the cost-up
--   formula would compute, so the override isn't a faithful Excel mirror
--   either.
--
-- FIX
--   Delete every engine_sell_prices override row for ANY 15W40 oil on the
--   "Detroit … With Detroit Filter" engines. lib/actions/pricing.ts's
--   getOilChangeGrid falls back to the cost-up formula whenever no override
--   exists, so per-oil costs (bulk_cost_per_litre × capacity + filter +
--   service + tier) will drive each cell. Per-brand pricing differences then
--   show up correctly:
--     - Delo  (Chevron)  $346.99 / $426.99
--     - Shell T4         $327.99 / $386.99
--     - Mobil 15W40      $308.99 / — (Mobil has no gallon cost configured)
--
-- SCOPE
--   Only "Detroit … With Detroit Filter" engines (60 Series, DD8,
--   DD13/DD15/DD16). Fleetguard-filter variants are untouched — same seed
--   pattern probably affects them too, but the client only asked about
--   Detroit. Surface this in the next round if they confirm.

delete from public.engine_sell_prices
 where engine_type_id in (
   select id
     from public.engine_types
    where display_name ilike 'Detroit%With Detroit Filter%'
 )
 and oil_type_id in (
   select id
     from public.oil_types
    where code ilike '%15W40%' or name ilike '%15W40%'
 );
