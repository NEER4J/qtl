-- 0121_customers_plates_text.sql
--
-- Supports server-side search on the customers list (which is now paginated,
-- so filtering in the browser would only ever search the page you are on).
--
-- Plates live in TWO places and neither is a superset of the other:
--
--   * public.vehicles          — the source of truth, and what the sales-form
--                                customer combobox searches.
--   * customers.license_plates — a legacy text[] kept from before 0035. It is
--                                still written by createCustomer /
--                                updateCustomer, but adding a vehicle from the
--                                vehicles page does NOT update it, and 0035
--                                installed no reverse-sync trigger.
--
-- So a plate typed into the customer form exists only in the array, and a
-- plate added from the vehicles page exists only in vehicles. The old
-- client-side filter searched the array with a substring match; dropping that
-- would have made those customers unfindable.
--
-- PostgREST cannot express a partial match against an array element
-- (`cs` is contains-whole-element, not substring), so this flattens the array
-- into a plain text column that ilike — and a trigram index — can work on.
-- It is GENERATED, so it cannot drift from the array the way a trigger-
-- maintained column could.
--
-- The list query ORs this together with a vehicles lookup, which is what makes
-- the search cover both sources.

alter table public.customers
  add column if not exists plates_text text
  generated always as (array_to_string(license_plates, ' ')) stored;

comment on column public.customers.plates_text is
  'Read-only flattening of license_plates for substring search. Generated — never write to it. See 0121.';

create index if not exists customers_plates_text_trgm
  on public.customers using gin (plates_text gin_trgm_ops);

analyze public.customers;
