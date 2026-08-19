-- 0130_engine_labour_package.sql
-- The oil-detail "Labour" column is meant to show the labour charge of the
-- PACKAGE that covers this engine's oil change. Until now engine and package
-- were matched by NAME (engine "manufacturer model" == package name), which
-- only lined up for 27 of 69 active engines — the two name lists drifted apart:
--   engine "Cummins ISX/X15"          vs package "Cummins ISX / X15"
--   engine "Ford F250/F350/F550/F650" vs package "F250/350/550/650"
--   engine "Cat C7/C10/3126 …"        vs package "Cat C7/10/3126 …"
-- Every engine that missed silently fell back to the summed part service-costs,
-- so the page showed a labour figure that wasn't the package's. Matching on the
-- part composition is no better (9 engines match 2+ packages, 29 match none),
-- so the link has to be explicit.

alter table public.engine_types
  add column if not exists labour_package_id uuid
    references public.part_packages(id) on delete set null;

comment on column public.engine_types.labour_package_id is
  'Package whose labor_selling_price is the labour charge for this engine''s oil change (the oil-detail Labour column). NULL falls back to an exact name match, then to the summed part service-costs.';

create index if not exists engine_types_labour_package_idx
  on public.engine_types (labour_package_id);

-- Backfill the links the old name match already resolved, so those engines keep
-- the exact figure they show today. The rest are linked by hand in
-- Settings -> Pricing -> Engine types.
update public.engine_types e
   set labour_package_id = p.id
  from public.part_packages p
 where e.labour_package_id is null
   and p.active
   and lower(regexp_replace(btrim(e.manufacturer || ' ' || e.model), '\s+', ' ', 'g'))
     = lower(regexp_replace(btrim(p.name), '\s+', ' ', 'g'));
