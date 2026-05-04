-- 0041_oil_types_is_taxable.sql
-- Item #21 — flag oil grades whose gallon-container sales attract HST. Grid
-- display shows pre- and post-tax for taxable rows; sales-job items pull this
-- through to sales_job_items.is_taxable when an oil_type-linked line is added.

alter table public.oil_types
  add column if not exists is_taxable boolean not null default true;

comment on column public.oil_types.is_taxable is
  'When true, gallon oil sales of this grade attract HST. Item #21.';
