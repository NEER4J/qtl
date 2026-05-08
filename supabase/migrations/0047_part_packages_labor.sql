-- 0047_part_packages_labor.sql
-- Adds labor cost / labor selling price / labor description to part_packages.
-- Labor cost is for profit roll-up only; labor selling price becomes its own
-- line item when the package is expanded onto a job.

alter table public.part_packages
  add column if not exists labor_cost numeric(10,2) not null default 0
    check (labor_cost >= 0),
  add column if not exists labor_selling_price numeric(10,2) not null default 0
    check (labor_selling_price >= 0),
  add column if not exists labor_description text;

comment on column public.part_packages.labor_cost is
  'Owner-only labor cost used to compute package profit. Not billed.';
comment on column public.part_packages.labor_selling_price is
  'Labor amount billed to the customer when this package is expanded onto a job.';
comment on column public.part_packages.labor_description is
  'Description used for the labor line when expanded (defaults to "Labor").';
