-- 0107_merge_vendors_absorb_details.sql
-- Follow-up to 0106: the merge already MOVES the duplicate's expenses, invoices,
-- accounts, parts and non-overlapping locations onto the primary — nothing there
-- is deleted. But the duplicate's OWN vendor-row details (contact, email,
-- account #, account type, category, notes) were dropped with its row, so if the
-- real info lived on the duplicate it was lost. (client 2026-07-16 — "merge just
-- keeps the primary's name and removes all the data from the other ones".)
--
-- Fix: before deleting the duplicate, fill any EMPTY field on the primary from
-- the duplicate. The primary's NAME is always kept; a field the primary already
-- has is never overwritten.

create or replace function public.merge_vendors(p_target uuid, p_source uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if not private.is_owner() then
    raise exception 'Not authorised to merge vendors' using errcode = '42501';
  end if;
  if p_target is null or p_source is null or p_target = p_source then
    raise exception 'Choose two different vendors to merge';
  end if;
  if not exists (select 1 from public.vendors where id = p_target) then
    raise exception 'Primary vendor not found';
  end if;
  if not exists (select 1 from public.vendors where id = p_source) then
    raise exception 'Duplicate vendor not found';
  end if;

  -- Plain reassigns (no per-vendor uniqueness).
  update public.expenses           set vendor_id = p_target where vendor_id = p_source;
  update public.recurring_expenses set vendor_id = p_target where vendor_id = p_source;
  update public.vendor_invoices    set vendor_id = p_target where vendor_id = p_source;

  -- vendor_parts: move a source row only when the target has no ACTIVE row for
  -- that part; drop the remaining (duplicate) source rows.
  update public.vendor_parts s
     set vendor_id = p_target
   where s.vendor_id = p_source
     and not exists (
       select 1 from public.vendor_parts t
        where t.vendor_id = p_target
          and t.part_id = s.part_id
          and t.deactivated_at is null);
  delete from public.vendor_parts where vendor_id = p_source;

  -- vendor_locations: move locations the target lacks; drop overlaps.
  update public.vendor_locations s
     set vendor_id = p_target
   where s.vendor_id = p_source
     and not exists (
       select 1 from public.vendor_locations t
        where t.vendor_id = p_target and t.location_id = s.location_id);
  delete from public.vendor_locations where vendor_id = p_source;

  -- vendor_location_accounts: demote a moved default where the target already
  -- has an active default for that location, then move them all.
  update public.vendor_location_accounts s
     set is_default = false
   where s.vendor_id = p_source
     and s.is_default
     and exists (
       select 1 from public.vendor_location_accounts t
        where t.vendor_id = p_target
          and t.location_id = s.location_id
          and t.is_default
          and t.deactivated_at is null);
  update public.vendor_location_accounts set vendor_id = p_target where vendor_id = p_source;

  -- Absorb the duplicate's OWN details into any empty field on the primary
  -- (the primary's NAME is always kept; existing values are never overwritten).
  update public.vendors t set
    contact_no   = coalesce(nullif(trim(t.contact_no), ''), s.contact_no),
    email        = coalesce(nullif(trim(t.email::text), '')::citext, s.email),
    account_no   = coalesce(nullif(trim(t.account_no), ''), s.account_no),
    account_type = coalesce(nullif(trim(t.account_type), ''), s.account_type),
    category_id  = coalesce(t.category_id, s.category_id),
    notes        = coalesce(nullif(trim(t.notes), ''), s.notes),
    updated_at   = now()
  from public.vendors s
  where t.id = p_target and s.id = p_source;

  -- Remove the now-empty duplicate vendor.
  delete from public.vendors where id = p_source;
end;
$$;

revoke all on function public.merge_vendors(uuid, uuid) from public;
grant execute on function public.merge_vendors(uuid, uuid) to authenticated;
