-- 0151_stock_limits_per_location.sql
-- Min / max stock thresholds per LOCATION.
-- (client 2026-09-30 — "min max we need to make it location wise in the
-- inventory")
--
-- 0126 put one minimum and one maximum on each part and oil and compared them
-- with the TOTAL across every shop. That hides exactly the case the numbers
-- are for: Fort Erie down to 2 of a filter while Ayr holds 20 reads as "22 on
-- hand, fine". Each shop reorders for itself, so the thresholds belong to the
-- (item, location) pair, next to the count they are compared with.
--
-- They get their own tables rather than columns on part_location_stock /
-- oil_location_stock: managers may edit counts there, but thresholds are
-- policy and stay owner / co_owner only, which a table of their own can enforce
-- in RLS. NULL = no threshold on that side.
--
-- parts.min_stock_qty / max_stock_qty and oil_types.min_stock_litres /
-- max_stock_litres (0126) are no longer read by the app. They are left in
-- place, and the values already entered are copied to every active location —
-- the six parts that have them were given per-shop numbers (min 3, with 3–5 on
-- hand at each shop), so that is what they meant.

create table if not exists public.part_location_limits (
  part_id     uuid not null references public.parts(id)     on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  min_qty     integer check (min_qty >= 0),
  max_qty     integer check (max_qty >= 0),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id),
  primary key (part_id, location_id),
  constraint part_location_limits_min_le_max
    check (min_qty is null or max_qty is null or min_qty <= max_qty)
);

create index if not exists part_location_limits_location_idx
  on public.part_location_limits (location_id);

create table if not exists public.oil_location_limits (
  oil_type_id uuid not null references public.oil_types(id)  on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  min_litres  numeric(12,2) check (min_litres >= 0),
  max_litres  numeric(12,2) check (max_litres >= 0),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id),
  primary key (oil_type_id, location_id),
  constraint oil_location_limits_min_le_max
    check (min_litres is null or max_litres is null or min_litres <= max_litres)
);

create index if not exists oil_location_limits_location_idx
  on public.oil_location_limits (location_id);

drop trigger if exists trg_part_location_limits_updated_at on public.part_location_limits;
create trigger trg_part_location_limits_updated_at
  before update on public.part_location_limits
  for each row execute function public.set_updated_at();

drop trigger if exists trg_oil_location_limits_updated_at on public.oil_location_limits;
create trigger trg_oil_location_limits_updated_at
  before update on public.oil_location_limits
  for each row execute function public.set_updated_at();

-- RLS: everyone signed in reads (the inventory page flags low stock for all),
-- owner / co_owner write.
alter table public.part_location_limits enable row level security;
alter table public.oil_location_limits enable row level security;

drop policy if exists part_location_limits_select on public.part_location_limits;
create policy part_location_limits_select on public.part_location_limits
  for select to authenticated using (true);

drop policy if exists part_location_limits_write on public.part_location_limits;
create policy part_location_limits_write on public.part_location_limits
  for all to authenticated
  using (private.is_owner())
  with check (private.is_owner());

drop policy if exists oil_location_limits_select on public.oil_location_limits;
create policy oil_location_limits_select on public.oil_location_limits
  for select to authenticated using (true);

drop policy if exists oil_location_limits_write on public.oil_location_limits;
create policy oil_location_limits_write on public.oil_location_limits
  for all to authenticated
  using (private.is_owner())
  with check (private.is_owner());

-- Carry over what 0126 holds. Never overwrites a per-location value already
-- entered, so re-running this file is safe.
insert into public.part_location_limits (part_id, location_id, min_qty, max_qty)
select p.id, l.id, p.min_stock_qty, p.max_stock_qty
  from public.parts p
 cross join public.locations l
 where l.active
   and (p.min_stock_qty is not null or p.max_stock_qty is not null)
   and (p.min_stock_qty is null or p.max_stock_qty is null or p.min_stock_qty <= p.max_stock_qty)
on conflict (part_id, location_id) do nothing;

insert into public.oil_location_limits (oil_type_id, location_id, min_litres, max_litres)
select o.id, l.id, o.min_stock_litres, o.max_stock_litres
  from public.oil_types o
 cross join public.locations l
 where l.active
   and (o.min_stock_litres is not null or o.max_stock_litres is not null)
   and (o.min_stock_litres is null or o.max_stock_litres is null
        or o.min_stock_litres <= o.max_stock_litres)
on conflict (oil_type_id, location_id) do nothing;
