-- 0163_backfill_job_billing_address.sql
--
-- DATA FIX, one-off (client 2026-10-26 — "the invoice has the customer's name
-- but no address, though the customer has one"). A job started with the
-- customer already filled in ("Save & add new job", New job from a customer
-- page) never copied the billing address, so those invoices printed without
-- it. The form is fixed; this fills the address on the jobs already saved,
-- from the customer's address as it is now, in the form's own layout:
--   address 1 / address 2 / "City, Province" / postal code, one per line.
--
-- Only jobs with no address at all; a job whose address was typed or edited is
-- left alone. Safe to re-run.

update public.sales_jobs sj
   set billing_address = nullif(concat_ws(e'\n',
         nullif(btrim(c.address_1), ''),
         nullif(btrim(c.address_2), ''),
         nullif(concat_ws(', ', nullif(btrim(c.city), ''), nullif(btrim(c.province), '')), ''),
         nullif(btrim(c.postal_code), '')
       ), '')
  from public.customers c
 where c.id = sj.customer_id
   and nullif(btrim(sj.billing_address), '') is null
   and nullif(btrim(c.address_1), '') is not null;
