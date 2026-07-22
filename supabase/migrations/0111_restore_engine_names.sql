-- 0111_restore_engine_names.sql  (collision-safe, idempotent — safe to re-run)
-- Reverse the mistaken 0110 engine de-dup and restore the full per-filter engine
-- names on oil-detail / oil-grid. Every rename is guarded so it only runs when
-- the target (manufacturer, model) is free — so it never trips the unique
-- constraint and can be re-run to converge.
--
-- Order matters: (1) un-park the variants that still carry their real name in the
-- "[merged <id>]" tag, (2) give any keeper left bare a filter name using one of
-- its wired filter-part brands whose slot is still FREE (this is why an engine
-- with two filters, e.g. Detroit DD8 with both Cat + Fleetguard, no longer
-- collides), (3) un-park the "[old <id>]" bare rows.
--
-- Best-effort: a kept variant whose original filter wording differs from its part
-- brand may need a one-off manual rename. For a perfectly clean restore, prefer a
-- Supabase point-in-time restore to just before 0110 was applied.

-- 1. Un-park + reactivate the "[merged <id>]" variants (their real name is in the tag).
update public.engine_types e
   set model = regexp_replace(e.model, '\s*\[merged [0-9a-f]{8}\]$', ''),
       active = true,
       updated_at = now()
 where e.model ~ '\[merged [0-9a-f]{8}\]$'
   and not exists (
     select 1 from public.engine_types o
      where o.manufacturer = e.manufacturer
        and o.id <> e.id
        and o.model = regexp_replace(e.model, '\s*\[merged [0-9a-f]{8}\]$', ''));

-- 2. Give any keeper still left bare a full filter name from one of its wired
--    filter-part brands whose "<model> With <brand> Filter" slot is still free.
--    Only bare engines that have a "<model> With ... Filter" sibling are touched
--    (so genuinely-bare engines like "Cummins ISX/X15" are never renamed).
update public.engine_types k
   set model = (
         select k.model || ' With ' || p.brand || ' Filter'
         from public.engine_filters ef
         join public.parts p on p.id = ef.part_id
         where ef.engine_type_id = k.id
           and coalesce(trim(p.brand), '') <> ''
           and not exists (
             select 1 from public.engine_types o
              where o.manufacturer = k.manufacturer
                and o.model = k.model || ' With ' || p.brand || ' Filter')
         order by p.brand
         limit 1
       ),
       updated_at = now()
 where k.active
   and k.model !~* 'with .* filter'
   and exists (
     select 1 from public.engine_types s
      where s.manufacturer = k.manufacturer
        and s.id <> k.id
        and s.model like k.model || ' With % Filter')
   -- guarantees the SET subquery returns a row (never sets model NULL)
   and exists (
     select 1 from public.engine_filters ef
     join public.parts p on p.id = ef.part_id
     where ef.engine_type_id = k.id
       and coalesce(trim(p.brand), '') <> ''
       and not exists (
         select 1 from public.engine_types o
          where o.manufacturer = k.manufacturer
            and o.model = k.model || ' With ' || p.brand || ' Filter'));

-- 3. Un-park the "[old <id>]" bare rows (were inactive before — leave them so).
update public.engine_types e
   set model = regexp_replace(e.model, '\s*\[old [0-9a-f]{8}\]$', ''),
       updated_at = now()
 where e.model ~ '\[old [0-9a-f]{8}\]$'
   and not exists (
     select 1 from public.engine_types o
      where o.manufacturer = e.manufacturer
        and o.id <> e.id
        and o.model = regexp_replace(e.model, '\s*\[old [0-9a-f]{8}\]$', ''));
