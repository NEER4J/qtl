-- 0061_customers_mailing_card_type.sql
--
-- Client feedback round (2026-05-22):
--   - New mailing address (six columns mirroring the existing billing address).
--     The form has a "same as billing" checkbox; when checked, we still persist
--     a copy of the billing address to mailing_* so downstream rendering
--     (invoice PDFs, mail-merge) doesn't have to special-case it.
--   - Card details now live under Billing: add card expiry and CVV alongside
--     the existing card_number. WARNING: storing CVV is against PCI-DSS rules;
--     the client signed off on it explicitly.
--   - customer_type was a free-text field but the client wants a hard choice
--     between "fleet" and "single". Existing values are normalised in this
--     migration and a CHECK constraint locks the column down going forward.

alter table public.customers
  add column if not exists mailing_address_1 text,
  add column if not exists mailing_address_2 text,
  add column if not exists mailing_city      text,
  add column if not exists mailing_province  text,
  add column if not exists mailing_country   text not null default 'CA',
  add column if not exists mailing_postal_code text,
  add column if not exists card_expiry      text,
  add column if not exists card_cvv         text;

comment on column public.customers.card_cvv is
  'WARNING: storing CVV is against PCI-DSS. Kept by explicit client request (2026-05-22). Restrict access aggressively.';

-- Normalise existing customer_type values to the new fleet/single domain.
-- Anything we can't interpret falls back to NULL (treat as unknown so the
-- check constraint below doesn't trip on legacy rows).
update public.customers
   set customer_type = case
     when customer_type is null then null
     when lower(trim(customer_type)) in ('fleet', 'f') then 'fleet'
     when lower(trim(customer_type)) in ('single', 's', 'individual', 'personal') then 'single'
     else null
   end
 where customer_type is not null;

alter table public.customers
  drop constraint if exists customers_customer_type_check;
alter table public.customers
  add constraint customers_customer_type_check
    check (customer_type is null or customer_type in ('fleet', 'single'));
