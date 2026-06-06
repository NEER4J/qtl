-- 0079_parts_per_part_pricing_fields.sql
--
-- Per-part pricing knobs requested in the 2026-06 client round:
--
--   * mhsw_buy — a SECOND MHSW value for the BUY/cost side. The existing
--     parts.mhsw_fee is the SELL-side MHSW (added into list_price). mhsw_buy is
--     reference-only for now (no formula change) — it is NOT folded into
--     list_price or the cost-up sell math. Stored + displayed on the part.
--
--   * counter_premium / customer_supplies_labour — these used to be single
--     GLOBAL values on app_settings. They are now ALSO available per-part:
--     NULL = fall back to the global app_settings value, a value = override for
--     this part. (The global columns on app_settings stay as the default.)
--
-- All three are nullable-or-defaulted and additive; existing rows are unaffected
-- (per-part counter/labour default NULL = keep using the global value).

alter table public.parts
  add column if not exists mhsw_buy numeric(10,2) not null default 0
    check (mhsw_buy >= 0),
  add column if not exists counter_premium numeric(10,2)
    check (counter_premium is null or counter_premium >= 0),
  add column if not exists customer_supplies_labour numeric(10,2)
    check (customer_supplies_labour is null or customer_supplies_labour >= 0);

comment on column public.parts.mhsw_buy is
  'Buy/cost-side MHSW. Reference-only — NOT added to list_price or sell math (client 2026-06).';
comment on column public.parts.counter_premium is
  'Per-part counter premium. NULL = fall back to app_settings.counter_premium.';
comment on column public.parts.customer_supplies_labour is
  'Per-part customer-supplies labour. NULL = fall back to app_settings.customer_supplies_labour.';
