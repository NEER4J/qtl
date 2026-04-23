-- 0015_pricing.sql
-- Phase 4 — Product & Pricing module (schema only; read-only UI in Phase 4).
-- Replaces the 27-sheet Apl 2026 Standard.xlsx workbook with structured tables
-- and calculated views. The 17,500 formula chains become pg views / functions.

-- ============================================================================
-- oil_types — the 7 grades QTL sells
-- ============================================================================
create table if not exists public.oil_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,              -- '15W40', '5W30_T6' etc.
  name text not null,
  is_base boolean not null default false, -- 15W40 is the base grade (spec §9.7)
  bulk_cost_per_litre   numeric(10,4) not null default 0 check (bulk_cost_per_litre >= 0),
  gallon_cost_per_litre numeric(10,4) not null default 0 check (gallon_cost_per_litre >= 0),
  sort_order smallint not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_oil_types_updated_at on public.oil_types;
create trigger trg_oil_types_updated_at
  before update on public.oil_types
  for each row execute function public.set_updated_at();

alter table public.oil_types enable row level security;

-- ============================================================================
-- engine_types — ~45 engine configurations, each with oil capacity
-- ============================================================================
create table if not exists public.engine_types (
  id uuid primary key default gen_random_uuid(),
  manufacturer text not null,   -- 'Caterpillar', 'Cummins', ...
  model text not null,          -- 'C15', 'ISX/X15', ...
  oil_capacity_litres numeric(6,2) not null check (oil_capacity_litres > 0),
  display_name text generated always as (manufacturer || ' ' || model) stored,
  sort_order smallint not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (manufacturer, model)
);

drop trigger if exists trg_engine_types_updated_at on public.engine_types;
create trigger trg_engine_types_updated_at
  before update on public.engine_types
  for each row execute function public.set_updated_at();

alter table public.engine_types enable row level security;

-- ============================================================================
-- volume_tiers — flat premium based on oil-capacity brackets (spec §9.6).
-- Per oil type; resolved as MAX(min_litres) ≤ capacity.
-- ============================================================================
create table if not exists public.volume_tiers (
  id uuid primary key default gen_random_uuid(),
  oil_type_id uuid not null references public.oil_types(id) on delete cascade,
  min_litres numeric(6,2) not null check (min_litres >= 0),
  premium numeric(10,2) not null default 0 check (premium >= 0),
  unique (oil_type_id, min_litres)
);

create index if not exists idx_volume_tiers_oil on public.volume_tiers(oil_type_id, min_litres);
alter table public.volume_tiers enable row level security;

-- ============================================================================
-- service_costs — labour cost per filter type, etc.
-- ============================================================================
create table if not exists public.service_costs (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,           -- 'AIR_FILTER', 'OIL_FILTER', 'AIR_DRYER', etc.
  name text not null,
  cost numeric(10,2) not null default 0 check (cost >= 0),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_service_costs_updated_at on public.service_costs;
create trigger trg_service_costs_updated_at
  before update on public.service_costs
  for each row execute function public.set_updated_at();

alter table public.service_costs enable row level security;

-- ============================================================================
-- parts — the filter catalog (800+ rows from spec §3.1)
-- ============================================================================
create table if not exists public.parts (
  id uuid primary key default gen_random_uuid(),
  part_number text not null,
  brand text not null,            -- 'Cat', 'Fleetguard', 'Baldwin', 'Donaldson'
  category text not null,         -- 'Air Filter', 'Oil Filter', 'Fuel Filter', etc.
  description text,
  cost numeric(10,2) not null default 0 check (cost >= 0),
  list_price numeric(10,2) not null default 0 check (list_price >= 0),
  mhsw_fee numeric(10,2) not null default 0 check (mhsw_fee >= 0),
  service_cost_id uuid references public.service_costs(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (part_number, brand)
);

create index if not exists idx_parts_category on public.parts(category);
create index if not exists idx_parts_brand    on public.parts(brand);
create index if not exists idx_parts_active   on public.parts(active) where active;

drop trigger if exists trg_parts_updated_at on public.parts;
create trigger trg_parts_updated_at
  before update on public.parts
  for each row execute function public.set_updated_at();

alter table public.parts enable row level security;

-- ============================================================================
-- engine_filters — maps engine → filter set (the parts used in an oil change
-- on that engine). Many engines use multiple filters (oil + fuel + air).
-- ============================================================================
create table if not exists public.engine_filters (
  id uuid primary key default gen_random_uuid(),
  engine_type_id uuid not null references public.engine_types(id) on delete cascade,
  part_id uuid not null references public.parts(id) on delete restrict,
  quantity smallint not null default 1 check (quantity > 0),
  unique (engine_type_id, part_id)
);

create index if not exists idx_ef_engine on public.engine_filters(engine_type_id);

alter table public.engine_filters enable row level security;

-- ============================================================================
-- app_settings.min_margin_alert_pct already exists from Phase 1 — reused.
-- ============================================================================

-- ============================================================================
-- RLS — read is broad (all authenticated see sell prices).
-- Writes are restricted to owner (the "admin" in the P&P spec §2).
-- Cost columns are returned for all, but UI hides them from non-owners.
-- ============================================================================
drop policy if exists oil_types_select on public.oil_types;
create policy oil_types_select on public.oil_types for select to authenticated using (true);
drop policy if exists oil_types_write on public.oil_types;
create policy oil_types_write on public.oil_types for all to authenticated
  using (private.current_role() = 'owner')
  with check (private.current_role() = 'owner');

drop policy if exists engine_types_select on public.engine_types;
create policy engine_types_select on public.engine_types for select to authenticated using (true);
drop policy if exists engine_types_write on public.engine_types;
create policy engine_types_write on public.engine_types for all to authenticated
  using (private.current_role() = 'owner')
  with check (private.current_role() = 'owner');

drop policy if exists volume_tiers_select on public.volume_tiers;
create policy volume_tiers_select on public.volume_tiers for select to authenticated using (true);
drop policy if exists volume_tiers_write on public.volume_tiers;
create policy volume_tiers_write on public.volume_tiers for all to authenticated
  using (private.current_role() = 'owner')
  with check (private.current_role() = 'owner');

drop policy if exists service_costs_select on public.service_costs;
create policy service_costs_select on public.service_costs for select to authenticated using (true);
drop policy if exists service_costs_write on public.service_costs;
create policy service_costs_write on public.service_costs for all to authenticated
  using (private.current_role() = 'owner')
  with check (private.current_role() = 'owner');

drop policy if exists parts_select on public.parts;
create policy parts_select on public.parts for select to authenticated using (true);
drop policy if exists parts_write on public.parts;
create policy parts_write on public.parts for all to authenticated
  using (private.current_role() = 'owner')
  with check (private.current_role() = 'owner');

drop policy if exists engine_filters_select on public.engine_filters;
create policy engine_filters_select on public.engine_filters for select to authenticated using (true);
drop policy if exists engine_filters_write on public.engine_filters;
create policy engine_filters_write on public.engine_filters for all to authenticated
  using (private.current_role() = 'owner')
  with check (private.current_role() = 'owner');

-- ============================================================================
-- oil_change_price(engine_id, oil_type_id, container ∈ 'bulk'|'gallon')
-- Implements: Sell = Filter cost + Oil cost + Service + Volume Tier
-- Rounded up to nearest $, then .99 applied (spec §9.1).
-- ============================================================================
create or replace function public.oil_change_price(
  p_engine_id uuid,
  p_oil_type_id uuid,
  p_container text default 'bulk'
)
returns numeric
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_oil_capacity numeric(6,2);
  v_cost_per_litre numeric(10,4);
  v_filter_cost numeric(12,2) := 0;
  v_service_cost numeric(12,2) := 0;
  v_tier_premium numeric(10,2) := 0;
  v_sell numeric(12,2);
begin
  select oil_capacity_litres into v_oil_capacity
    from public.engine_types where id = p_engine_id;
  if v_oil_capacity is null then return null; end if;

  select case when p_container = 'gallon' then gallon_cost_per_litre else bulk_cost_per_litre end
    into v_cost_per_litre
    from public.oil_types where id = p_oil_type_id;
  if v_cost_per_litre is null then return null; end if;

  select coalesce(sum((p.cost + p.mhsw_fee) * ef.quantity), 0),
         coalesce(sum(coalesce(sc.cost, 0) * ef.quantity), 0)
    into v_filter_cost, v_service_cost
    from public.engine_filters ef
    join public.parts p on p.id = ef.part_id
    left join public.service_costs sc on sc.id = p.service_cost_id
   where ef.engine_type_id = p_engine_id;

  select coalesce(premium, 0) into v_tier_premium
    from public.volume_tiers
   where oil_type_id = p_oil_type_id
     and min_litres <= v_oil_capacity
   order by min_litres desc
   limit 1;

  v_sell := (v_cost_per_litre * v_oil_capacity) + v_filter_cost + v_service_cost + coalesce(v_tier_premium, 0);

  -- ROUNDUP to nearest dollar, minus $0.01 — ends in .99
  return ceil(v_sell)::numeric - 0.01;
end;
$$;

revoke all on function public.oil_change_price(uuid, uuid, text) from public;
grant execute on function public.oil_change_price(uuid, uuid, text) to authenticated;
