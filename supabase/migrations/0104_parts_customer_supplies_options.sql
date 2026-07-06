-- 0104_parts_customer_supplies_options.sql
-- Some filters can be customer-supplied at more than one labour price (e.g. a
-- couple of tiers). The single parts.customer_supplies_labour (0079) held one
-- value; add a LIST so the All-filter-sell-price page can show every option.
-- Empty/NULL list = fall back to the single value (0079) / global default.
-- (client 2026-06-30 — "multiple customer-supplies labour for all filter".)

alter table public.parts
  add column if not exists customer_supplies_labour_options numeric(10,2)[];

comment on column public.parts.customer_supplies_labour_options is
  'Optional list of customer-supplies labour prices for this filter. Empty/NULL = use customer_supplies_labour (or the global app_settings default).';
