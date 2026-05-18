-- 0055_parts_sell_price_overrides.sql
--
-- Per-part manual sell-price overrides for the "All Filter Sell Price" view.
--
-- WHY: The Excel "All Filter Sell Price" tab has three explicit sell-price
-- modes per filter (Without Service / With Service / Over Counter) that don't
-- always follow the cost-up formula (cost + mhsw + service + counter_premium).
-- For some parts: without = with = over (no premium); for others: each mode is
-- a distinct hand-set number. The cost-up formula in getAllFilterSellPrices()
-- can't represent those per-part differences using only one global
-- counter_premium.
--
-- These columns are nullable overrides. When set, the action layer prefers the
-- override; when null, it falls back to the existing cost-up computation.

alter table public.parts
  add column if not exists without_service_price numeric(10,2)
    check (without_service_price is null or without_service_price >= 0),
  add column if not exists with_service_price    numeric(10,2)
    check (with_service_price    is null or with_service_price    >= 0),
  add column if not exists over_counter_price    numeric(10,2)
    check (over_counter_price    is null or over_counter_price    >= 0);

comment on column public.parts.without_service_price is
  'Manual override for "Without Service" sell mode. NULL = compute from cost + mhsw + service + counter_premium.';
comment on column public.parts.with_service_price is
  'Manual override for "With Service" sell mode. NULL = compute from cost + mhsw + service.';
comment on column public.parts.over_counter_price is
  'Manual override for "Over Counter" sell mode. NULL = same as with_service.';
