-- 0148_engine_filters_qty_from_package.sql
-- Filter quantities the May 2026 seed collapsed to 1.
--
-- The Excel Standard Job List says "two of this filter" by listing it in two
-- columns (Volvo With Fleetguard: LF17503, LF17503, LF17502, FF4212800 =
-- $86.95). The seed turned each column into an upsert on (engine, part) with
-- qty 1, so the second one overwrote the first instead of adding to it —
-- engine_filters holds LF17503 × 1 and the filter cost read $68.79. Seven
-- engine/filter pairs were hit (Volvo D12 ×2, Mack ×3, Detroit 60 ×2).
--
-- The Oil detail page now takes filter cost from the engine's package, which
-- already has the right quantities (LF17503 × 2). engine_filters still drives
-- the Oil-change grid, the Print list, sales auto-pricing and the fallback for
-- an engine with no package, so it is corrected here too.
--
-- Matched through the engine's linked package rather than by engine name —
-- several of those engines have been renamed since (e.g. "Volvo D12 / D13 With
-- Fleetguard Filter"), so a name match would silently fix nothing. Rule: where
-- an engine's linked package has the SAME part at a higher whole-number
-- quantity, engine_filters takes the package's quantity. Only ever raises a
-- quantity, only for whole numbers, capped at 20 (the column is a smallint).
-- Requires 0130 (engine_types.labour_package_id).

do $$
declare
  v_updated integer;
begin
  update public.engine_filters ef
     set quantity = ppi.quantity::smallint
    from public.engine_types e
    join public.part_package_items ppi on ppi.package_id = e.labour_package_id
   where ef.engine_type_id = e.id
     and ppi.part_id = ef.part_id
     and ppi.quantity = trunc(ppi.quantity)
     and ppi.quantity > ef.quantity
     and ppi.quantity <= 20;
  get diagnostics v_updated = row_count;
  raise notice '0148: % engine filter quantit% raised to match the linked package',
    v_updated, case when v_updated = 1 then 'y' else 'ies' end;
end $$;
