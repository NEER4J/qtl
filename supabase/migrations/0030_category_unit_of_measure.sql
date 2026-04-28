-- 0030_category_unit_of_measure.sql
-- 1. Adds a unit-of-measure enum and column on part_categories so qty fields
--    can be displayed with the correct unit (e.g. "3 ltr" / "2 pcs") wherever
--    a category is referenced.
-- 2. Migrates parts.category (free-text) to a category_id FK so the unit and
--    name flow through the join automatically. Backfill matches by
--    case-insensitive name; any unmatched text creates a new category row, and
--    parts whose category is NULL/blank get bucketed under "Uncategorised".

-- ============================================================================
-- Enum
-- ============================================================================
do $$ begin
  create type unit_of_measure as enum ('ltr','gallon','kg','pcs','hours','each');
exception when duplicate_object then null; end $$;

-- ============================================================================
-- part_categories.unit_of_measure
-- ============================================================================
alter table public.part_categories
  add column if not exists unit_of_measure unit_of_measure not null default 'pcs';

-- ============================================================================
-- parts.category text → parts.category_id FK
-- ============================================================================
alter table public.parts
  add column if not exists category_id uuid references public.part_categories(id);

-- Insert any category names from parts that aren't yet in part_categories.
-- Match is case-insensitive so "Oil Filter" and "oil filter" don't both land.
insert into public.part_categories (name)
select distinct btrim(p.category)
  from public.parts p
 where p.category is not null
   and btrim(p.category) <> ''
   and not exists (
     select 1 from public.part_categories c
      where lower(c.name) = lower(btrim(p.category))
   )
on conflict (name) do nothing;

-- Backfill category_id by case-insensitive name match.
update public.parts p
   set category_id = c.id
  from public.part_categories c
 where p.category_id is null
   and p.category is not null
   and lower(c.name) = lower(btrim(p.category));

-- Catch-all for parts whose category was NULL/blank.
do $$
declare
  v_fallback uuid;
begin
  if exists (select 1 from public.parts where category_id is null) then
    insert into public.part_categories (name)
    values ('Uncategorised')
    on conflict (name) do nothing;

    select id into v_fallback
      from public.part_categories
     where name = 'Uncategorised'
     limit 1;

    update public.parts
       set category_id = v_fallback
     where category_id is null;
  end if;
end$$;

alter table public.parts
  alter column category_id set not null;

drop index if exists public.idx_parts_category;
create index if not exists idx_parts_category_id on public.parts(category_id);

alter table public.parts
  drop column if exists category;
