-- 0028_part_packages.sql
-- Pre-defined bundles of parts the owner can drop onto a sales job in one click
-- (e.g. "Standard Oil Change" = 1× oil filter + 5× 5W30 + 1× drain plug washer).
-- The package only stores part_id + qty; unit_price is read from parts.list_price
-- at the moment a package is expanded onto a job, so catalog price changes flow
-- through automatically and existing job lines remain price-stable.

-- ============================================================================
-- part_packages — the package itself
-- ============================================================================
create table if not exists public.part_packages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

-- Case-insensitive uniqueness across active packages only — deactivated rows
-- can keep their old name without blocking re-use.
create unique index if not exists part_packages_name_uniq
  on public.part_packages (lower(name)) where active;

drop trigger if exists trg_part_packages_updated_at on public.part_packages;
create trigger trg_part_packages_updated_at
  before update on public.part_packages
  for each row execute function public.set_updated_at();

drop trigger if exists trg_part_packages_audit on public.part_packages;
create trigger trg_part_packages_audit
  after insert or update or delete on public.part_packages
  for each row execute function public.audit_row();

alter table public.part_packages enable row level security;

drop policy if exists part_packages_select on public.part_packages;
create policy part_packages_select on public.part_packages
  for select to authenticated using (true);

drop policy if exists part_packages_write on public.part_packages;
create policy part_packages_write on public.part_packages
  for all to authenticated
  using (private.current_role() = 'owner')
  with check (private.current_role() = 'owner');

-- ============================================================================
-- part_package_items — parts inside a package, with default quantity
-- ============================================================================
create table if not exists public.part_package_items (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.part_packages(id) on delete cascade,
  part_id uuid not null references public.parts(id) on delete restrict,
  quantity numeric(10,2) not null check (quantity > 0),
  -- Optional price override. NULL means "use parts.list_price at expansion
  -- time" (so catalog price changes flow through). A value here locks the
  -- price for this package — useful for promo bundles.
  unit_price numeric(12,2) check (unit_price is null or unit_price >= 0),
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  unique (package_id, part_id)
);

create index if not exists part_package_items_pkg_idx
  on public.part_package_items (package_id, position);

drop trigger if exists trg_part_package_items_audit on public.part_package_items;
create trigger trg_part_package_items_audit
  after insert or update or delete on public.part_package_items
  for each row execute function public.audit_row();

alter table public.part_package_items enable row level security;

drop policy if exists part_package_items_select on public.part_package_items;
create policy part_package_items_select on public.part_package_items
  for select to authenticated using (true);

drop policy if exists part_package_items_write on public.part_package_items;
create policy part_package_items_write on public.part_package_items
  for all to authenticated
  using (private.current_role() = 'owner')
  with check (private.current_role() = 'owner');
