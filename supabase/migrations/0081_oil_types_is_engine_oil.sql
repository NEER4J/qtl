-- 0081_oil_types_is_engine_oil.sql
-- The Oil-change price grid should list ONLY engine oils. Some rows in
-- oil_types are really coolants / transmission / differential fluids that are
-- consumed by transmission_services, not by oil-change jobs. They have no
-- engine pricing, so the Print List already hides them via a "drop columns with
-- no engine price" workaround. This makes that distinction explicit and
-- editable so the Oil-change grid can filter on it directly.

alter table public.oil_types
  add column if not exists is_engine_oil boolean not null default true;

comment on column public.oil_types.is_engine_oil is
  'When true, this grade is an engine oil and appears in the Oil-change price grid. Coolants / trans / diff fluids should be false.';

-- Seed: any oil that has never been priced for an engine (no engine_sell_prices
-- row) is treated as a non-engine fluid. Mirrors the existing Print List logic.
update public.oil_types o
set is_engine_oil = false
where not exists (
  select 1 from public.engine_sell_prices esp where esp.oil_type_id = o.id
);
