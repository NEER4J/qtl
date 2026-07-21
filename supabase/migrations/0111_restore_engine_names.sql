-- 0111_restore_engine_names.sql
-- REVERSE 0110 (engine de-dup). 0110 changed the engine DATA, which wrongly
-- stripped the full names off the oil-detail / oil-grid pages (they must keep the
-- per-filter variants). Restore them:
--   1. Rebuild the KEPT variant's filter name from its wired filter part's brand
--      (0110 renamed it to the bare engine number and didn't record the suffix).
--      Only bare engines that have a "[merged <id>]" sibling are treated as
--      keepers, so genuinely-bare engines (e.g. "Cummins ISX/X15") are untouched.
--   2. Re-activate + un-park the variants 0110 parked as "... [merged <id>]".
--   3. Un-park the bare rows parked as "... [old <id>]".
-- Idempotent: on a DB where 0110 never ran there are no [merged]/[old] rows, so
-- this is a no-op. Best-effort — spot-check the rebuilt names; a filter whose part
-- brand differs from the original word may need a manual rename in the admin.

-- 1. Rebuild the kept variant's name BEFORE un-parking.
update public.engine_types k
   set model = k.model || ' With ' || kf.brand || ' Filter',
       updated_at = now()
  from (
    select distinct on (ef.engine_type_id) ef.engine_type_id, p.brand
    from public.engine_filters ef
    join public.parts p on p.id = ef.part_id
    order by ef.engine_type_id, p.brand
  ) kf
 where k.id = kf.engine_type_id
   and k.active
   and k.model !~* 'with .* filter'
   and exists (
     select 1 from public.engine_types m
      where m.manufacturer = k.manufacturer
        and m.model like '% [merged %]'
        and regexp_replace(m.model, '\s+[Ww]ith\s.*$', '') = k.model
   );

-- 2. Un-park + reactivate the "[merged <id>]" variants.
update public.engine_types
   set model = regexp_replace(model, '\s*\[merged [0-9a-f]{8}\]$', ''),
       active = true,
       updated_at = now()
 where model ~ '\[merged [0-9a-f]{8}\]$';

-- 3. Un-park the "[old <id>]" bare rows (they were inactive before — leave them).
update public.engine_types
   set model = regexp_replace(model, '\s*\[old [0-9a-f]{8}\]$', ''),
       updated_at = now()
 where model ~ '\[old [0-9a-f]{8}\]$';
