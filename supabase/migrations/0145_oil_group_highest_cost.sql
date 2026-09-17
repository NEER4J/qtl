-- 0145_oil_group_highest_cost.sql
-- Oil groups can price themselves from their most expensive oil.
-- (client 2026-09-15 — "highest pricing oil drives the group price, for bulk and
-- gallon, and updates whenever an oil price in the group changes")
--
-- Until now a group's Bulk $/L and Gallon $/container were typed in by hand, and
-- the owner was already setting them to the dearest member's cost (10W30 at
-- $5.12 = Delo 400XLE's cost). Profit on an oil line comes from the volume tier
-- premium, exactly as on the oil-change price list — so the group charges that
-- cost as-is, with no markup.
--
-- oil_groups.pricing_mode
--   'manual'       — today's behaviour; the two typed prices. The default, so
--                    nothing moves until the owner switches a group over.
--   'highest_cost' — prices are DERIVED from the group's active oils:
--       bulk_price_per_litre   = highest bulk_cost_per_litre           (> 0)
--       gallon_price_per_litre = highest gallon cost PER LITRE          (> 0)
--                                (gallon_cost_per_litre is the price of a whole
--                                container, so ÷ that oil's litres_per_gallon)
--   Gallons are compared per litre because jug sizes differ inside one group
--   (3.785 / 4.0 / 4.546 L): the dearest JUG isn't always the dearest OIL. A
--   gallon sales line then charges gallon_price_per_litre × that oil's own jug
--   size (oilLineRate). gallon_price_per_container is left alone in this mode,
--   so switching back to manual restores the typed price.
--   An oil with no cost entered (0 / NULL) is skipped; a group with no priced
--   oil gets NULL ("not set, fall back"), never 0, which would be a free line.
--   Inactive oils don't count. Mixed-fluid groups such as Gear & Trans ($5.92
--   to $13.07/L) should stay manual — the dearest would roughly double the
--   cheapest.
--
-- Kept current by two triggers:
--   * BEFORE INSERT/UPDATE on oil_groups — in highest_cost mode the prices are
--     assigned onto NEW, so a dialog save can never write stale numbers over them.
--   * AFTER INSERT/UPDATE/DELETE on oil_types (cost columns, jug size, group,
--     active) — recomputes the group the oil left AND the group it joined. It
--     only writes when the result actually changed, so unrelated oil edits add
--     no audit rows. Catches the UI, set_oil_group_members and raw-SQL cost
--     syncs (scripts/sync-may-2026-costs.py) alike.
--
-- Also: public.set_oil_group_members — the group dialog's "which oils" write in
-- ONE transaction. It used to be two requests (release, then add), so for a
-- moment the group could price from the wrong members, or stay wrong if the
-- second request failed.

-- ============================================================================
-- Columns
-- ============================================================================
alter table public.oil_groups
  add column if not exists pricing_mode text not null default 'manual',
  add column if not exists gallon_price_per_litre numeric(10,4);

alter table public.oil_groups
  drop constraint if exists oil_groups_pricing_mode_check;
alter table public.oil_groups
  add constraint oil_groups_pricing_mode_check
  check (pricing_mode in ('manual', 'highest_cost'));

alter table public.oil_groups
  drop constraint if exists oil_groups_gallon_price_per_litre_check;
alter table public.oil_groups
  add constraint oil_groups_gallon_price_per_litre_check
  check (gallon_price_per_litre is null or gallon_price_per_litre >= 0);

comment on column public.oil_groups.pricing_mode is
  'manual = the typed prices; highest_cost = derived from the most expensive active oil in the group (0145).';
comment on column public.oil_groups.gallon_price_per_litre is
  'highest_cost mode only: highest member gallon cost per LITRE. A gallon line charges this x the oil''s own litres_per_gallon.';

-- ============================================================================
-- The rule, in one place
-- ============================================================================
create or replace function private.oil_group_highest_costs(p_group uuid)
returns table (bulk numeric, gallon_per_litre numeric)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  -- Rounded to the column scale, so a recompute that lands on the stored value
  -- compares equal and writes nothing.
  select
    round(max(o.bulk_cost_per_litre) filter (where o.bulk_cost_per_litre > 0), 4),
    round(
      max(o.gallon_cost_per_litre / o.litres_per_gallon)
        filter (where o.gallon_cost_per_litre > 0 and o.litres_per_gallon > 0),
      4
    )
  from public.oil_types o
  where o.oil_group_id = p_group
    and o.active;
$$;

revoke all on function private.oil_group_highest_costs(uuid) from public;

-- ============================================================================
-- oil_groups: derive prices on write
-- ============================================================================
create or replace function public.oil_groups_apply_highest_cost()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v record;
begin
  if new.pricing_mode = 'highest_cost' then
    select * into v from private.oil_group_highest_costs(new.id);
    new.bulk_price_per_litre := v.bulk;
    new.gallon_price_per_litre := v.gallon_per_litre;
  end if;
  return new;
end;
$$;

revoke all on function public.oil_groups_apply_highest_cost() from public;

drop trigger if exists trg_oil_groups_highest_cost on public.oil_groups;
create trigger trg_oil_groups_highest_cost
  before insert or update on public.oil_groups
  for each row execute function public.oil_groups_apply_highest_cost();

-- ============================================================================
-- oil_types: an oil's cost, jug size, group or active flag changed
-- ============================================================================
create or replace function public.oil_types_refresh_group_price()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_groups uuid[] := '{}';
  v_id     uuid;
  v        record;
begin
  if tg_op = 'UPDATE'
     and old.bulk_cost_per_litre   is not distinct from new.bulk_cost_per_litre
     and old.gallon_cost_per_litre is not distinct from new.gallon_cost_per_litre
     and old.litres_per_gallon     is not distinct from new.litres_per_gallon
     and old.oil_group_id          is not distinct from new.oil_group_id
     and old.active                is not distinct from new.active then
    return null;
  end if;

  if tg_op in ('UPDATE', 'DELETE') and old.oil_group_id is not null then
    v_groups := v_groups || old.oil_group_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.oil_group_id is not null then
    v_groups := v_groups || new.oil_group_id;
  end if;

  for v_id in select distinct g from unnest(v_groups) as g loop
    select * into v from private.oil_group_highest_costs(v_id);
    -- The UPDATE re-fires trg_oil_groups_highest_cost, which assigns the same
    -- values; the WHERE keeps manual groups and unchanged prices untouched.
    update public.oil_groups
       set bulk_price_per_litre = v.bulk,
           gallon_price_per_litre = v.gallon_per_litre
     where id = v_id
       and pricing_mode = 'highest_cost'
       and (bulk_price_per_litre is distinct from v.bulk
            or gallon_price_per_litre is distinct from v.gallon_per_litre);
  end loop;

  return null;
end;
$$;

revoke all on function public.oil_types_refresh_group_price() from public;

drop trigger if exists trg_oil_types_group_price on public.oil_types;
create trigger trg_oil_types_group_price
  after insert or delete
     or update of bulk_cost_per_litre, gallon_cost_per_litre, litres_per_gallon, oil_group_id, active
  on public.oil_types
  for each row execute function public.oil_types_refresh_group_price();

-- ============================================================================
-- Group membership in one transaction
-- ============================================================================
create or replace function public.set_oil_group_members(p_group uuid, p_oil_type_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_ids uuid[] := coalesce(p_oil_type_ids, '{}');
begin
  if not private.is_owner() then
    raise exception 'Not authorised to change oil groups' using errcode = '42501';
  end if;
  if not exists (select 1 from public.oil_groups where id = p_group) then
    raise exception 'Oil group not found';
  end if;

  -- Released: in this group, not in the new list. Scoped to THIS group so it
  -- can't take grades that belong to another one.
  update public.oil_types
     set oil_group_id = null
   where oil_group_id = p_group
     and not (id = any (v_ids));

  -- Joined: ticked grades not already here (a grade in another group moves).
  update public.oil_types
     set oil_group_id = p_group
   where id = any (v_ids)
     and oil_group_id is distinct from p_group;

  return coalesce(array_length(v_ids, 1), 0);
end;
$$;

revoke all on function public.set_oil_group_members(uuid, uuid[]) from public;
revoke all on function public.set_oil_group_members(uuid, uuid[]) from anon;
grant execute on function public.set_oil_group_members(uuid, uuid[]) to authenticated;
