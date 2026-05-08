-- 0047_part_packages_labor.sql
-- Adds a labor charge to part_packages. The labor charge is added to the
-- final package price (its own line item when expanded onto a job). Internal
-- labor cost is not tracked here — labor is treated as pure margin in the
-- profit roll-up.

alter table public.part_packages
  add column if not exists labor_selling_price numeric(10,2) not null default 0
    check (labor_selling_price >= 0),
  add column if not exists labor_description text;

comment on column public.part_packages.labor_selling_price is
  'Labor charge added on top of the package parts. Billed as its own line when the package is expanded onto a job.';
comment on column public.part_packages.labor_description is
  'Description used for the labor line when expanded (defaults to "Labor").';
