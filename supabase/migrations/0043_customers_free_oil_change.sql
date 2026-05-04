-- 0043_customers_free_oil_change.sql
-- Item #29 — 30-day free oil-change offer (mirrors the free-grease pattern).

alter table public.customers
  add column if not exists free_oil_change_until date;

comment on column public.customers.free_oil_change_until is
  'Date through which this customer is eligible for a free oil-change service. Item #29.';
