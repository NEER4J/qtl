-- ----------------------------------------------------------------------------
-- 0140 — Pricing sub-page keys + the action permission axis
-- ----------------------------------------------------------------------------
-- Two related changes, both driven by the same request from the shop: certain
-- roles must stop seeing individual Pricing sheets, and staff must stop being
-- able to export the customer and inventory lists to a spreadsheet.
--
-- 1. `allowed_actions` — the third permission axis. Pages say what you can
--    open, hidden_columns says what you can read, allowed_actions says what you
--    can DO on a page you already have. NULL = fall back to the role default in
--    ACTION_REGISTRY (lib/permissions/registry.ts), exactly like allowed_pages.
--
-- 2. Backfill for the new Pricing sub-page keys. /pricing/oil-detail and its
--    siblings used to resolve to the single `pricing` registry key, so a stored
--    per-user allowlist can only ever contain `pricing`. Now that each sheet has
--    its own key, those overrides have to be topped up or every user with a
--    custom allowlist would lose the whole Pricing submenu on deploy.
--
-- The app also carries a runtime shim for this (applyLegacyPricingInheritance
-- in lib/permissions/check.ts) so the deploy is safe in either order; this
-- migration makes the stored data explicit so the shim stops firing.

-- ----------------------------------------------------------------------------
-- 1. Column
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists allowed_actions text[];

comment on column public.profiles.allowed_actions is
  'Explicit per-user action allowlist (ACTION_REGISTRY keys, e.g. customers.export). NULL = use the role default. An action is only ever permitted when the page it belongs to is permitted too.';

-- ----------------------------------------------------------------------------
-- 2. Backfill stored allowed_pages overrides with the Pricing sub-page keys
-- ----------------------------------------------------------------------------
-- Only rows that (a) have a stored override at all, (b) were granted Pricing,
-- and (c) name none of the new sub-keys yet — so re-running is a no-op and an
-- admin's later hand-edit in the matrix is never clobbered.
--
-- Oil detail is deliberately NOT handed to manager / accountant / staff: the
-- shop asked for it to be owner-only because it exposes per-oil cost, profit
-- and margin %. Everyone keeps the other six sheets they had before.
with subpages as (
  select
    array[
      'pricing_filters',
      'pricing_all_filter_price',
      'pricing_oil_grid',
      'pricing_print_list',
      'pricing_trans_diff'
    ]::text[] as shared,
    array['pricing_oil_detail']::text[] as owner_only
)
update public.profiles p
set allowed_pages = (
  select array(
    select distinct u
    from unnest(
      p.allowed_pages
      || s.shared
      || case when p.role in ('owner', 'co_owner') then s.owner_only else array[]::text[] end
    ) as u
  )
)
from subpages s
where p.allowed_pages is not null
  and 'pricing' = any(p.allowed_pages)
  and not (p.allowed_pages && (s.shared || s.owner_only));

-- ----------------------------------------------------------------------------
-- 3. Guard: allowed_actions joins the owner-only column list.
--    Rewritten in full from 0137 with the one new branch, same as 0137 did to
--    0066. Service-role / direct-DB sessions still bypass (auth.uid() is null),
--    as in 0018. Uses private.is_owner() so co_owner passes too (0067).
-- ----------------------------------------------------------------------------
create or replace function public.profiles_guard()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if (old.role is distinct from new.role) and not private.is_owner() then
      raise exception 'Only owner can change profile role' using errcode = '42501';
    end if;
    if (old.location_id is distinct from new.location_id) and not private.is_owner() then
      raise exception 'Only owner can change profile location' using errcode = '42501';
    end if;
    if (old.location_ids is distinct from new.location_ids) and not private.is_owner() then
      raise exception 'Only owner can change profile locations' using errcode = '42501';
    end if;
    if (old.can_enter_expenses is distinct from new.can_enter_expenses) and not private.is_owner() then
      raise exception 'Only owner can toggle can_enter_expenses' using errcode = '42501';
    end if;
    if (old.active is distinct from new.active) and not private.is_owner() then
      raise exception 'Only owner can change profile active status' using errcode = '42501';
    end if;
    if (old.username is distinct from new.username) and not private.is_owner() then
      raise exception 'Only owner can change username' using errcode = '42501';
    end if;
    if (old.allowed_pages is distinct from new.allowed_pages
        or old.hidden_columns is distinct from new.hidden_columns
        or old.allowed_actions is distinct from new.allowed_actions)
       and not private.is_owner() then
      raise exception 'Only owner can change permission overrides' using errcode = '42501';
    end if;
    if (old.cross_location is distinct from new.cross_location) and not private.is_owner() then
      raise exception 'Only owner can change cross-location flag' using errcode = '42501';
    end if;
    if (old.email is distinct from new.email) and not private.is_owner() then
      raise exception 'Only owner can change profile email' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
