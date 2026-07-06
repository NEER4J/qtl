-- 0105_transmission_services_two_oils_container.sql
-- Trans & Diff upgrades (client 2026-06-30):
--   * Some services use TWO oils, each with its own sell price + capacity;
--     a per-service flag marks which oil's price is the default when the
--     service is dropped onto a job.
--   * Container option — bulk / gallon / pail — like oils have.
--   (The sell price itself stays a stored number; the form now auto-fills it
--    from the oil's cost-rate × capacity, still editable.)
--
-- Oil 1 keeps the existing columns (oil_type_id, litres, sell_price). Oil 2 is
-- optional (oil_type_id_2, litres_2, sell_price_2). default_oil is 1 or 2.

alter table public.transmission_services
  add column if not exists oil_type_id_2 uuid references public.oil_types(id) on delete set null,
  add column if not exists litres_2 numeric(6,2) check (litres_2 is null or litres_2 > 0),
  add column if not exists sell_price_2 numeric(10,2) check (sell_price_2 is null or sell_price_2 >= 0),
  add column if not exists default_oil smallint not null default 1 check (default_oil in (1, 2)),
  add column if not exists container text check (container is null or container in ('bulk', 'gallon', 'pail'));

comment on column public.transmission_services.oil_type_id_2 is 'Optional second oil for services that use two fluids.';
comment on column public.transmission_services.sell_price_2 is 'Sell price for the second oil (>= 0). NULL when there is no second oil.';
comment on column public.transmission_services.default_oil is '1 or 2 — which oil''s sell price is used when the service is added to a job.';
comment on column public.transmission_services.container is 'Packaging: bulk / gallon / pail. NULL = unspecified.';
