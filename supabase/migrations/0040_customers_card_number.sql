-- 0040_customers_card_number.sql
-- Item #23 — capture a card number on the customer record. This replaces
-- vehicles.cab_card_number for the surfaced UI; the vehicle column stays
-- in place but is no longer surfaced on the form (item #33).

alter table public.customers
  add column if not exists card_number text;

comment on column public.customers.card_number is
  'Carrier / customer-level card number (e.g. fleet card). Item #23.';
