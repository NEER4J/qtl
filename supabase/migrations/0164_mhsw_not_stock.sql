-- 0164_mhsw_not_stock.sql
--
-- MHSW is a fee, not stock (client call 2026-11-19). The shop charges it
-- through two catalogue parts in the "MHSW" category — QTL1010 ($1.50 per
-- filter) and QTL1011 ($0.06 per litre of oil) — and every sale drew them out
-- of part_location_stock, so Inventory showed them going negative (-211,
-- -1260) and the shortfall check could block a sale for "not enough MHSW".
--
-- 1. part_categories.track_stock — false = parts in this category are not
--    stock. Only MHSW is switched off here.
-- 2. A BEFORE trigger on part_location_stock drops any write for such a part.
--    Every stock path (sales trigger 0149, expense trigger 0132, the Inventory
--    page's manual edit) writes through this table, so one guard covers all of
--    them without copying those long trigger functions.
--    BEFORE INSERT returning NULL also skips an INSERT .. ON CONFLICT DO
--    UPDATE, because row triggers fire before the conflict check.
-- 3. The MHSW stock rows already there are deleted.
--
-- The app hides MHSW from Inventory and the shortfall check by category name
-- (lib/utils/mhsw.ts), so it behaves the same before this file is applied.

alter table public.part_categories
  add column if not exists track_stock boolean not null default true;

comment on column public.part_categories.track_stock is
  'false = parts in this category are not stock (MHSW): no on-hand, no inventory sync.';

update public.part_categories
   set track_stock = false
 where lower(btrim(name)) = 'mhsw';

create or replace function public.part_location_stock_skip_untracked()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if exists (
    select 1
      from public.parts p
      join public.part_categories c on c.id = p.category_id
     where p.id = new.part_id
       and not c.track_stock
  ) then
    return null;
  end if;
  return new;
end;
$$;

revoke all on function public.part_location_stock_skip_untracked() from public;

drop trigger if exists trg_part_location_stock_skip_untracked on public.part_location_stock;
create trigger trg_part_location_stock_skip_untracked
  before insert or update on public.part_location_stock
  for each row execute function public.part_location_stock_skip_untracked();

delete from public.part_location_stock s
 using public.parts p, public.part_categories c
 where s.part_id = p.id
   and c.id = p.category_id
   and not c.track_stock;
