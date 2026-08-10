-- 0122_oil_price_locks.sql
--
-- Price lock for the per-oil detail page (/pricing/oil-detail), modelled on the
-- part-package price lock (0050).
--
-- A lock covers ONE (oil type, container) pair — i.e. exactly one oil-detail
-- page — and snapshots the selling price of every engine row at lock time.
-- While the lock is live (lock_until >= today, Ontario local date) the
-- snapshotted price is what the shop charges, even if part costs, oil costs,
-- labour or volume tiers move underneath it.
--
-- Precedence for an oil-change price becomes:
--   1. live lock snapshot   (this migration)
--   2. engine_sell_prices   (manual anchor, 0052)
--   3. cost-up fallback     (filter + oil + labour + tier)

create table if not exists public.oil_price_locks (
  id uuid primary key default gen_random_uuid(),
  oil_type_id uuid not null references public.oil_types(id) on delete cascade,
  container text not null check (container in ('bulk','gallon')),
  lock_until date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  unique (oil_type_id, container)
);

comment on table public.oil_price_locks is
  'One row per locked (oil type, container). Live while lock_until >= today.';

create table if not exists public.oil_price_lock_items (
  id uuid primary key default gen_random_uuid(),
  lock_id uuid not null references public.oil_price_locks(id) on delete cascade,
  engine_type_id uuid not null references public.engine_types(id) on delete cascade,
  -- The selling price snapshotted at lock time.
  locked_price numeric(10,2) not null check (locked_price > 0),
  -- Components at lock time, kept for the "why is this the price" breakdown.
  filter_cost  numeric(12,2) not null default 0,
  oil_cost     numeric(12,2) not null default 0,
  labour       numeric(12,2) not null default 0,
  tier_premium numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (lock_id, engine_type_id)
);

create index if not exists idx_oil_price_lock_items_lock
  on public.oil_price_lock_items(lock_id);
create index if not exists idx_oil_price_lock_items_engine
  on public.oil_price_lock_items(engine_type_id);

drop trigger if exists trg_oil_price_locks_updated_at on public.oil_price_locks;
create trigger trg_oil_price_locks_updated_at
  before update on public.oil_price_locks
  for each row execute function public.set_updated_at();

drop trigger if exists trg_oil_price_locks_audit on public.oil_price_locks;
create trigger trg_oil_price_locks_audit
  after insert or update or delete on public.oil_price_locks
  for each row execute function public.audit_row();

-- ----------------------------------------------------------------------------
-- RLS. Everyone authenticated reads (prices are needed on the sales form);
-- owner writes via the explicit policy, co_owner via private.is_owner()
-- (0067 — new tables have to add their own, the generic loop only ran once).
-- ----------------------------------------------------------------------------
alter table public.oil_price_locks enable row level security;
alter table public.oil_price_lock_items enable row level security;

drop policy if exists oil_price_locks_select on public.oil_price_locks;
create policy oil_price_locks_select on public.oil_price_locks
  for select to authenticated using (true);

drop policy if exists oil_price_locks_write on public.oil_price_locks;
create policy oil_price_locks_write on public.oil_price_locks
  for all to authenticated
  using (private.current_role() = 'owner')
  with check (private.current_role() = 'owner');

drop policy if exists oil_price_locks_co_owner on public.oil_price_locks;
create policy oil_price_locks_co_owner on public.oil_price_locks
  for all to authenticated
  using (private.is_owner())
  with check (private.is_owner());

drop policy if exists oil_price_lock_items_select on public.oil_price_lock_items;
create policy oil_price_lock_items_select on public.oil_price_lock_items
  for select to authenticated using (true);

drop policy if exists oil_price_lock_items_write on public.oil_price_lock_items;
create policy oil_price_lock_items_write on public.oil_price_lock_items
  for all to authenticated
  using (private.current_role() = 'owner')
  with check (private.current_role() = 'owner');

drop policy if exists oil_price_lock_items_co_owner on public.oil_price_lock_items;
create policy oil_price_lock_items_co_owner on public.oil_price_lock_items
  for all to authenticated
  using (private.is_owner())
  with check (private.is_owner());

-- ============================================================================
-- oil_change_price — a live lock snapshot now wins over the manual anchor.
--
-- Body is otherwise identical to 0053. "Today" is the Ontario local date, not
-- UTC, so a lock expiring today doesn't lapse at 8pm the night before.
-- ============================================================================
create or replace function public.oil_change_price(
  p_engine_id   uuid,
  p_oil_type_id uuid,
  p_container   text default 'bulk'
)
returns numeric
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_locked   numeric(10,2);
  v_override numeric(10,2);
  v_oil_capacity   numeric(6,2);
  v_cost_per_litre numeric(10,4);
  v_filter_cost    numeric(12,2) := 0;
  v_service_cost   numeric(12,2) := 0;
  v_tier_premium   numeric(10,2) := 0;
  v_sell numeric(12,2);
begin
  -- 0) A live price lock wins over everything.
  select li.locked_price into v_locked
    from public.oil_price_lock_items li
    join public.oil_price_locks l on l.id = li.lock_id
   where l.oil_type_id = p_oil_type_id
     and l.container   = p_container
     and l.lock_until >= (now() at time zone 'America/Toronto')::date
     and li.engine_type_id = p_engine_id;
  if v_locked is not null then
    return v_locked;
  end if;

  -- 1) Manual override.
  select sell_price into v_override
    from public.engine_sell_prices
   where engine_type_id = p_engine_id
     and oil_type_id    = p_oil_type_id
     and container      = p_container;
  if v_override is not null then
    return v_override;
  end if;

  -- 2) Cost-up fallback.
  select oil_capacity_litres into v_oil_capacity
    from public.engine_types where id = p_engine_id;
  if v_oil_capacity is null or v_oil_capacity <= 0 then return null; end if;

  select case when p_container = 'gallon' then gallon_cost_per_litre else bulk_cost_per_litre end
    into v_cost_per_litre
    from public.oil_types where id = p_oil_type_id;
  if v_cost_per_litre is null or v_cost_per_litre <= 0 then return null; end if;

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

  -- Guard the .99 trick so we never return -$0.01 for empty cost data.
  if v_sell is null or v_sell <= 0 then return null; end if;

  return ceil(v_sell)::numeric - 0.01;
end;
$$;

revoke all on function public.oil_change_price(uuid, uuid, text) from public;
grant execute on function public.oil_change_price(uuid, uuid, text) to authenticated;
