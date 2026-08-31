-- 0133_oil_groups.sql
-- Oil groups = multiple base prices instead of one. (client 2026-08-31)
--
-- Until now a single oil type carried is_base, and EVERY oil line on a sales
-- job was charged at that one grade's rate (see oilLineRate). One base price
-- for conventional 15W40 and full-synthetic 5W30 alike, so a $8.30/L synthetic
-- was offered at 15W40's $5.02/L — a $3.28/L loss the staff were correcting by
-- hand on nearly every line.
--
-- An oil group is a base price with a name; oils in the same group are charged
-- the same rate. Nothing else about oil pricing changes. The fallback chain is
-- group rate -> the single is_base grade -> the oil's own rate, so an oil with
-- no group, or a group with no rate set, behaves exactly as it does today.

create table if not exists public.oil_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  -- The two rates an oil line can be charged at, mirroring oil_types: bulk is
  -- per LITRE, gallon is per CONTAINER (not per litre).
  -- NULL means "not set" and falls back to today's behaviour. That is why these
  -- are nullable rather than defaulting to 0 — a real 0 would be a free line.
  bulk_price_per_litre       numeric(10,4) check (bulk_price_per_litre is null or bulk_price_per_litre >= 0),
  gallon_price_per_container numeric(10,4) check (gallon_price_per_container is null or gallon_price_per_container >= 0),
  active boolean not null default true,
  sort_order smallint not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

-- Case-insensitive uniqueness across active groups only — a deactivated group
-- keeps its old name without blocking re-use. Same rule as part_packages.
create unique index if not exists oil_groups_name_uniq
  on public.oil_groups (lower(name)) where active;

alter table public.oil_groups enable row level security;

-- owner / co_owner manage; everyone signed in reads (the sales oil picker
-- needs the rate to price a line).
drop policy if exists oil_groups_admin_all on public.oil_groups;
create policy oil_groups_admin_all on public.oil_groups
  for all to authenticated
  using (private.is_owner()) with check (private.is_owner());

drop policy if exists oil_groups_select on public.oil_groups;
create policy oil_groups_select on public.oil_groups
  for select to authenticated
  using (true);

drop trigger if exists trg_oil_groups_updated_at on public.oil_groups;
create trigger trg_oil_groups_updated_at
  before update on public.oil_groups
  for each row execute function public.set_updated_at();

drop trigger if exists trg_oil_groups_audit on public.oil_groups;
create trigger trg_oil_groups_audit
  after insert or update or delete on public.oil_groups
  for each row execute function public.audit_row();

-- ============================================================================
-- oil_types.oil_group_id — which base price this grade is charged at.
-- NULL keeps the old behaviour (fall back to the single is_base grade).
-- ============================================================================
alter table public.oil_types
  add column if not exists oil_group_id uuid references public.oil_groups(id) on delete set null;

create index if not exists idx_oil_types_group
  on public.oil_types (oil_group_id) where oil_group_id is not null;

comment on column public.oil_types.oil_group_id is
  'Oil group whose base price this grade is charged at on sales lines. NULL = fall back to the single is_base grade.';

-- ============================================================================
-- Seed: the groups the shop is already billing by hand.
--
-- Bulk rates are the MEDIAN unit price actually charged on the last 1,000 oil
-- lines in that viscosity band — what the staff type today, not a new price.
-- Only bands with a solid sample are seeded:
--     15W40           435 lines   $5.37/L
--     10W30           464 lines   $6.05/L
--     5W30 Synthetic   52 lines   $9.34/L
-- The rest are left NULL on purpose (5W40 had 4 lines, Gear & Trans 25 across
-- five very differently priced fluids, and every gallon band was under 10) —
-- NULL falls back to today's behaviour, so nothing moves until the owner sets
-- a rate in Settings -> Pricing -> Oil groups.
-- ============================================================================
insert into public.oil_groups (name, bulk_price_per_litre, gallon_price_per_container, sort_order)
values
  ('15W40',          5.37, null, 10),
  ('10W30',          6.05, null, 20),
  ('5W30 Synthetic', 9.34, null, 30),
  ('5W40 Synthetic', null, null, 40),
  ('Gear & Trans',   null, null, 50)
on conflict do nothing;

-- Assign every grade to its group. Matched on the viscosity in the NAME (the
-- codes are vendor part numbers and carry no viscosity).
--
-- ORDER MATTERS: '15W40' has to be tested before '5W40', because the string
-- "15W40" contains "5W40" and would otherwise land every conventional 15W40 in
-- the synthetic group. Same trap for 10W30 vs 0W30. Fluid types (75W90, gear,
-- trans) are tested first so "Delo Trans XV 75W80" never reaches the engine
-- viscosity tests.
update public.oil_types o
   set oil_group_id = g.id
  from public.oil_groups g
 where o.oil_group_id is null
   and g.name = case
         when o.name ~* '75W|80W|85W|Gear|Trans|IShift|DT12' then 'Gear & Trans'
         when o.name ~* '15W40' then '15W40'
         when o.name ~* '10W30' then '10W30'
         when o.name ~* '5W40'  then '5W40 Synthetic'
         when o.name ~* '5W30'  then '5W30 Synthetic'
         else null
       end;
