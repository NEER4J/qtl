-- 0123_merge_customers.sql
-- Customer MERGE, modelled on merge_vendors (0106/0107): fold a duplicate
-- customer (source) into a primary (target) so that afterwards ONE customer
-- remains carrying all of the source's sales jobs (invoices), vehicles,
-- store-credit ledger entries and portal logins. Runs in a single transaction
-- (the function body) so it can never leave a half-merged state.
--
-- What is kept vs dropped (client 2026-08-07 — "history and other info like
-- invoices should stay; only the name and email should get deleted"):
--   * History — sales_jobs, vehicles, customer_credit_ledger: reassigned.
--   * customer_portal_access (unique profile_id, customer_id): move each
--     login the target doesn't already have; drop the overlaps.
--   * The duplicate's NAME (billing_name / salutation / first_name /
--     last_or_company) and EMAIL are discarded — the primary's identity wins
--     even where the primary's own email is blank.
--   * Every other detail on the duplicate's row (addresses, phones, cards,
--     notes, …) is absorbed into any EMPTY field on the primary — the 0107
--     lesson: real info often lives only on the duplicate. Existing values
--     on the primary are never overwritten.
--   * license_plates arrays are unioned so legacy array-only plates stay
--     searchable (plates_text regenerates from the array — see 0121).
--   * free grease / free oil-change offers: the later expiry wins.
--
-- SECURITY DEFINER so the reassign can cross location-scoped RLS, with an
-- owner/co_owner check inside for defence in depth (the action also gates it).

create or replace function public.merge_customers(p_target uuid, p_source uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if not private.is_owner() then
    raise exception 'Not authorised to merge customers' using errcode = '42501';
  end if;
  if p_target is null or p_source is null or p_target = p_source then
    raise exception 'Choose two different customers to merge';
  end if;
  if not exists (select 1 from public.customers where id = p_target) then
    raise exception 'Primary customer not found';
  end if;
  if not exists (select 1 from public.customers where id = p_source) then
    raise exception 'Duplicate customer not found';
  end if;

  -- Plain reassigns (no per-customer uniqueness). Vehicle plates are unique
  -- across ACTIVE rows globally (0035), not per customer, so moving vehicles
  -- cannot collide.
  update public.sales_jobs             set customer_id = p_target where customer_id = p_source;
  update public.vehicles               set customer_id = p_target where customer_id = p_source;
  update public.customer_credit_ledger set customer_id = p_target where customer_id = p_source;

  -- Portal logins: move each profile link the target lacks; drop overlaps
  -- (unique profile_id, customer_id).
  update public.customer_portal_access s
     set customer_id = p_target
   where s.customer_id = p_source
     and not exists (
       select 1 from public.customer_portal_access t
        where t.customer_id = p_target and t.profile_id = s.profile_id);
  delete from public.customer_portal_access where customer_id = p_source;

  -- Absorb the duplicate's OWN details into any empty field on the primary.
  -- Name and email are deliberately NOT absorbed. Columns with meaningful
  -- non-null defaults (country, discounts, flags, status) are left alone —
  -- "empty" cannot be told apart from "deliberately set to the default".
  update public.customers t set
    code                = coalesce(nullif(trim(t.code), ''), s.code),
    address_1           = coalesce(nullif(trim(t.address_1), ''), s.address_1),
    address_2           = coalesce(nullif(trim(t.address_2), ''), s.address_2),
    city                = coalesce(nullif(trim(t.city), ''), s.city),
    province            = coalesce(nullif(trim(t.province), ''), s.province),
    postal_code         = coalesce(nullif(trim(t.postal_code), ''), s.postal_code),
    mailing_address_1   = coalesce(nullif(trim(t.mailing_address_1), ''), s.mailing_address_1),
    mailing_address_2   = coalesce(nullif(trim(t.mailing_address_2), ''), s.mailing_address_2),
    mailing_city        = coalesce(nullif(trim(t.mailing_city), ''), s.mailing_city),
    mailing_province    = coalesce(nullif(trim(t.mailing_province), ''), s.mailing_province),
    mailing_postal_code = coalesce(nullif(trim(t.mailing_postal_code), ''), s.mailing_postal_code),
    contact_no          = coalesce(nullif(trim(t.contact_no), ''), s.contact_no),
    phone_home          = coalesce(nullif(trim(t.phone_home), ''), s.phone_home),
    phone_cell          = coalesce(nullif(trim(t.phone_cell), ''), s.phone_cell),
    phone_business      = coalesce(nullif(trim(t.phone_business), ''), s.phone_business),
    phone_business_ext  = coalesce(nullif(trim(t.phone_business_ext), ''), s.phone_business_ext),
    phone_fax           = coalesce(nullif(trim(t.phone_fax), ''), s.phone_fax),
    phone_alt_1         = coalesce(nullif(trim(t.phone_alt_1), ''), s.phone_alt_1),
    phone_alt_2         = coalesce(nullif(trim(t.phone_alt_2), ''), s.phone_alt_2),
    phone_notes         = case when t.phone_notes is null or t.phone_notes = '{}'::jsonb
                               then s.phone_notes else t.phone_notes end,
    other_contact       = coalesce(nullif(trim(t.other_contact), ''), s.other_contact),
    comments            = coalesce(nullif(trim(t.comments), ''), s.comments),
    notes               = coalesce(nullif(trim(t.notes), ''), s.notes),
    contact_method      = coalesce(t.contact_method, s.contact_method),
    customer_type       = coalesce(t.customer_type, s.customer_type),
    card_number         = coalesce(nullif(trim(t.card_number), ''), s.card_number),
    card_expiry         = coalesce(nullif(trim(t.card_expiry), ''), s.card_expiry),
    card_cvv            = coalesce(nullif(trim(t.card_cvv), ''), s.card_cvv),
    default_pay_method  = coalesce(t.default_pay_method, s.default_pay_method),
    calc_interest_from  = coalesce(t.calc_interest_from, s.calc_interest_from),
    special_hst_rate_pct = coalesce(t.special_hst_rate_pct, s.special_hst_rate_pct),
    home_location_id    = coalesce(t.home_location_id, s.home_location_id),
    -- greatest() ignores NULLs, so a one-sided offer carries over as-is.
    free_oil_change_until = greatest(t.free_oil_change_until, s.free_oil_change_until),
    free_grease_until     = greatest(t.free_grease_until, s.free_grease_until),
    -- Union of both plate arrays; plates_text (generated, 0121) follows.
    license_plates      = (
      select coalesce(array_agg(distinct p order by p), '{}')
        from unnest(coalesce(t.license_plates, '{}') || coalesce(s.license_plates, '{}')) as p
    ),
    updated_at          = now()
  from public.customers s
  where t.id = p_target and s.id = p_source;

  -- Remove the now-empty duplicate — its name and email go with it.
  delete from public.customers where id = p_source;
end;
$$;

revoke all on function public.merge_customers(uuid, uuid) from public;
grant execute on function public.merge_customers(uuid, uuid) to authenticated;
