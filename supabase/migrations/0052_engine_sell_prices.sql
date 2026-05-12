-- 0052_engine_sell_prices.sql
--
-- Per-engine + per-oil + per-container "anchor" sell prices.
--
-- WHY: The May 2026 Excel workbook uses a manually-anchored pricing model:
--   * 15W40 bulk price for each engine is a hand-tuned number with margin baked in
--   * Other oils are computed as `15W40 anchor + volume tier premium`
-- Our previous oil_change_price() function did pure cost-up, which gave near-
-- zero margins. This table lets the owner store the Excel's manual prices so
-- they survive the cost-up engine. The fallback (when no override is set) is
-- the existing cost-up formula — so a partial migration of prices still works.

create table if not exists public.engine_sell_prices (
  id uuid primary key default gen_random_uuid(),
  engine_type_id uuid not null references public.engine_types(id) on delete cascade,
  oil_type_id    uuid not null references public.oil_types(id)    on delete cascade,
  container text not null check (container in ('bulk','gallon')),
  sell_price numeric(10,2) not null check (sell_price > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  unique (engine_type_id, oil_type_id, container)
);

create index if not exists idx_engine_sell_prices_engine on public.engine_sell_prices(engine_type_id);
create index if not exists idx_engine_sell_prices_oil    on public.engine_sell_prices(oil_type_id);

drop trigger if exists trg_engine_sell_prices_updated_at on public.engine_sell_prices;
create trigger trg_engine_sell_prices_updated_at
  before update on public.engine_sell_prices
  for each row execute function public.set_updated_at();

drop trigger if exists trg_engine_sell_prices_audit on public.engine_sell_prices;
create trigger trg_engine_sell_prices_audit
  after insert or update or delete on public.engine_sell_prices
  for each row execute function public.audit_row();

alter table public.engine_sell_prices enable row level security;

drop policy if exists engine_sell_prices_select on public.engine_sell_prices;
create policy engine_sell_prices_select on public.engine_sell_prices
  for select to authenticated using (true);

drop policy if exists engine_sell_prices_write on public.engine_sell_prices;
create policy engine_sell_prices_write on public.engine_sell_prices
  for all to authenticated
  using (private.current_role() = 'owner')
  with check (private.current_role() = 'owner');

-- ============================================================================
-- oil_change_price — prefer override row, fall back to cost-up.
--
-- The lookup is cheap (UNIQUE index on engine + oil + container) so we hit it
-- first; only when there's no row do we run the original computation.
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
  v_override numeric(10,2);
  v_oil_capacity   numeric(6,2);
  v_cost_per_litre numeric(10,4);
  v_filter_cost    numeric(12,2) := 0;
  v_service_cost   numeric(12,2) := 0;
  v_tier_premium   numeric(10,2) := 0;
  v_sell numeric(12,2);
begin
  -- 1) Manual override wins.
  select sell_price into v_override
    from public.engine_sell_prices
   where engine_type_id = p_engine_id
     and oil_type_id    = p_oil_type_id
     and container      = p_container;
  if v_override is not null then
    return v_override;
  end if;

  -- 2) Fall back to cost-up (unchanged from previous version of the function).
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

  -- Guard: don't render "-$0.01" when the cost-up math sums to 0 (oil with no
  -- cost set, or engine with no filters and 15W40 base = 0). Return null so
  -- callers can show "—".
  if v_sell is null or v_sell <= 0 then return null; end if;

  return ceil(v_sell)::numeric - 0.01;
end;
$$;

revoke all on function public.oil_change_price(uuid, uuid, text) from public;
grant execute on function public.oil_change_price(uuid, uuid, text) to authenticated;
