-- 0106_merge_vendors.sql
-- Real vendor MERGE: fold a duplicate vendor (source) into a primary (target)
-- so that afterwards ONE vendor remains carrying all of the source's locations,
-- per-location accounts, vendor parts, expenses, recurring expenses and
-- invoices. Runs in a single transaction (the function body) so it can never
-- leave a half-merged state. (client 2026-06-30 — "after merging only one
-- vendor should be there with all the locations and stuff".)
--
-- Conflict rules when BOTH vendors already have the same thing:
--   * vendor_locations  (unique vendor_id, location_id): keep the target's row,
--     drop the source's overlapping location.
--   * vendor_parts      (unique active vendor_id, part_id): keep the target's
--     active row, drop the source's duplicate.
--   * vendor_location_accounts (no unique): move them all; demote a moved
--     "default" when the target already has a default for that location.
--   * expenses / recurring_expenses / vendor_invoices: plain reassign.
--
-- SECURITY DEFINER so the reassign can cross location-scoped RLS, with an
-- owner/co_owner check inside for defence in depth (the action also gates it).

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

  -- Remove the now-empty duplicate vendor.
  delete from public.vendors where id = p_source;
end;
$$;

revoke all on function public.merge_vendors(uuid, uuid) from public;
grant execute on function public.merge_vendors(uuid, uuid) to authenticated;
