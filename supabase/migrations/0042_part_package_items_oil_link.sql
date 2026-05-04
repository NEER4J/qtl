-- 0042_part_package_items_oil_link.sql
-- Item #18 — package items can be linked directly to oil_types so their unit
-- price flows from the oil_types catalogue (single source of truth) instead
-- of from parts.list_price. When oil_type_id IS NOT NULL, the package
-- expansion path computes unit_price from oil_types.bulk_cost_per_litre
-- (or gallon equivalent) × `litres`.

alter table public.part_package_items
  add column if not exists oil_type_id uuid references public.oil_types(id),
  add column if not exists litres numeric(8,2),
  add column if not exists oil_container text check (oil_container in ('bulk','gallon'));

comment on column public.part_package_items.oil_type_id is
  'When set, unit_price is computed from oil_types instead of parts.list_price. Item #18.';
comment on column public.part_package_items.litres is
  'Litres of oil for this package item. Required when oil_type_id is set.';
comment on column public.part_package_items.oil_container is
  'bulk or gallon — chooses which rate column on oil_types to multiply.';

-- An item must reference EITHER a part OR an oil_type, not both.
-- (We allow null part_id only when oil_type_id is set.)
alter table public.part_package_items
  alter column part_id drop not null;

alter table public.part_package_items
  add constraint part_package_items_one_source_chk
  check ((part_id is not null and oil_type_id is null) or (part_id is null and oil_type_id is not null));
