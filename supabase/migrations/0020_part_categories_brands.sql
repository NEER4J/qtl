-- 0020_part_categories_brands.sql
-- Turn parts.category and parts.brand (free-text today) into managed reference
-- lists. Both columns stay as text on `parts` — the oil_change_price() SQL
-- function and the existing filters don't care where the text came from.
-- The new tables exist so the owner can:
--   1. Rename a category/brand and have every part update automatically.
--   2. Pre-seed the dropdown with values that aren't in use yet.
--   3. Deactivate a category/brand without losing the historical value on parts.

-- ============================================================================
-- part_categories
-- ============================================================================
create table if not exists public.part_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order smallint not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_part_categories_updated_at on public.part_categories;
create trigger trg_part_categories_updated_at
  before update on public.part_categories
  for each row execute function public.set_updated_at();

alter table public.part_categories enable row level security;

drop policy if exists part_categories_select on public.part_categories;
create policy part_categories_select on public.part_categories for select to authenticated using (true);

drop policy if exists part_categories_write on public.part_categories;
create policy part_categories_write on public.part_categories for all to authenticated
  using (private.current_role() = 'owner')
  with check (private.current_role() = 'owner');

-- Backfill from distinct values already on parts.
insert into public.part_categories (name)
select distinct btrim(category)
  from public.parts
 where category is not null and btrim(category) <> ''
on conflict (name) do nothing;

-- ============================================================================
-- part_brands
-- ============================================================================
create table if not exists public.part_brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order smallint not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_part_brands_updated_at on public.part_brands;
create trigger trg_part_brands_updated_at
  before update on public.part_brands
  for each row execute function public.set_updated_at();

alter table public.part_brands enable row level security;

drop policy if exists part_brands_select on public.part_brands;
create policy part_brands_select on public.part_brands for select to authenticated using (true);

drop policy if exists part_brands_write on public.part_brands;
create policy part_brands_write on public.part_brands for all to authenticated
  using (private.current_role() = 'owner')
  with check (private.current_role() = 'owner');

-- Backfill from distinct values already on parts.
insert into public.part_brands (name)
select distinct btrim(brand)
  from public.parts
 where brand is not null and btrim(brand) <> ''
on conflict (name) do nothing;
