-- 0110_dedup_engine_types.sql
-- Collapse the filter-variant engines to ONE engine per number, named by the
-- engine alone (drop " With <X> Filter"). (client 2026-07-22 — "I just need one
-- variant where we just have the engine name".)
--
-- Safety: engines are NEVER deleted (sales_jobs.engine_type_id has no ON DELETE
-- rule, so a delete could fail on referenced history). Instead we keep the
-- best-configured variant, RENAME it to the plain model, and DEACTIVATE the
-- rest. Fully reversible from the Engine types admin (reactivate / rename back).
-- The keeper is the active variant with the most wired filters (i.e. the one
-- that actually prices), tie-broken by id.

do $$
declare
  g      record;
  keeper uuid;
  base   text;
  strip  constant text := '\s+[Ww]ith\s+.*[Ff]ilter\s*$';
begin
  for g in
    select manufacturer, regexp_replace(model, strip, '') as base_model
    from public.engine_types
    where active
    group by manufacturer, regexp_replace(model, strip, '')
    having count(*) > 1
        or bool_or(model <> regexp_replace(model, strip, ''))
  loop
    base := g.base_model;

    select e.id into keeper
    from public.engine_types e
    left join public.engine_filters f on f.engine_type_id = e.id
    where e.active
      and e.manufacturer = g.manufacturer
      and regexp_replace(e.model, strip, '') = base
    group by e.id
    order by count(f.*) desc, e.id
    limit 1;

    if keeper is null then continue; end if;

    -- Park + deactivate the other active variants (free the plain name, keep
    -- their data intact for reactivation).
    update public.engine_types e
       set model = e.model || ' [merged ' || left(e.id::text, 8) || ']',
           active = false,
           updated_at = now()
     where e.active
       and e.id <> keeper
       and e.manufacturer = g.manufacturer
       and regexp_replace(e.model, strip, '') = base;

    -- Park any inactive engine already sitting on the plain name (empty bare row)
    -- so the keeper can take it without a unique(manufacturer, model) clash.
    update public.engine_types e
       set model = e.model || ' [old ' || left(e.id::text, 8) || ']',
           updated_at = now()
     where not e.active
       and e.id <> keeper
       and e.manufacturer = g.manufacturer
       and e.model = base;

    -- Rename the keeper to the plain engine number.
    update public.engine_types set model = base, updated_at = now()
     where id = keeper and model <> base;
  end loop;
end $$;
