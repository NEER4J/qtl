-- 0069_part_package_items_transmission_link.sql
-- A package item can now point at a Trans & Diff service (transmission_services)
-- as a third pricing source, alongside parts and oil types.
--
-- WHY: The owner wants Trans & Diff services usable inside packages so a bundle
-- can include e.g. a "Trans & Diff Oil Change". When expanded onto a job the
-- service becomes a (collapsed) line priced from transmission_services.sell_price
-- + labour. The line carries no part_id / oil_type_id.

alter table public.part_package_items
  add column if not exists transmission_service_id uuid
    references public.transmission_services(id) on delete restrict;

comment on column public.part_package_items.transmission_service_id is
  'When set, the package item is a Trans & Diff service; unit_price comes from transmission_services (sell_price + labour). part_id and oil_type_id are null.';

-- Replace the two-source check with a three-source "exactly one" rule.
alter table public.part_package_items
  drop constraint if exists part_package_items_one_source_chk;

alter table public.part_package_items
  add constraint part_package_items_one_source_chk
  check (
    (part_id is not null)::int
    + (oil_type_id is not null)::int
    + (transmission_service_id is not null)::int
    = 1
  );

create index if not exists part_package_items_trans_idx
  on public.part_package_items (transmission_service_id)
  where transmission_service_id is not null;
