-- 0150_engine_filter_options.sql
-- One engine per physical engine; the filter brand lives in the package.
-- (client 2026-09-30 — "why is there two filter options — we need only one
-- engine type and the filter type will happen in the package, only in some")
--
-- Until now an engine sold with two filter brands was TWO engine_types rows
-- ("Cat C12/3406 With Cat Filter" and "Cat C12/3406 With Fleetguard Filter"),
-- each with its own package link, filter set and manual price on every oil.
-- The Engine types page grouped them by name and called them "filter
-- variants". 13 engines are doubled up that way.
--
-- Now: engine_types holds the engine once, and engine_filter_options holds the
-- ways it is sold — one row per package, carrying the label ("With Cat
-- Filter") and, where the filter changes it, the oil capacity. Most engines
-- have no options and behave exactly as before (labour_package_id, 0130).
--
-- Everything that was keyed by engine alone gains engine_option_id, so an
-- engine with options still has one price per option:
--   engine_filters, engine_sell_prices, oil_price_lock_items — NULL for an
--     engine without options; for an engine with options every row belongs to
--     one of them.
--   sales_jobs — which option the job was sold with (NULL = none / unknown).
--
-- This migration changes NO price. Each doubled-up engine keeps both its sets
-- of manual prices, locks, filters and sales jobs — they are re-keyed to the
-- option, not recalculated. 0110 tried to de-duplicate these engines by
-- dropping one variant's prices and had to be reversed (0111); that is the
-- mistake this avoids.
--
-- Needs Postgres 15+ (UNIQUE ... NULLS NOT DISTINCT). Requires 0122 and 0130.
-- Safe to re-run: the fold at the end only acts on engines still doubled up.

-- ============================================================================
-- Table
-- ============================================================================
create table if not exists public.engine_filter_options (
  id uuid primary key default gen_random_uuid(),
  engine_type_id uuid not null references public.engine_types(id) on delete cascade,
  -- The package this option is: its filters, fuel, grease and labour charge.
  package_id uuid not null references public.part_packages(id) on delete restrict,
  -- Shown after the engine name on the price lists: "With Cat Filter".
  label text not null check (btrim(label) <> ''),
  -- Only when this filter changes the fill (C12/3406: 37 L Cat, 38 L
  -- Fleetguard). NULL = the engine's own capacity.
  oil_capacity_litres numeric(6,2)
    check (oil_capacity_litres is null or oil_capacity_litres > 0),
  sort_order smallint not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (engine_type_id, package_id)
);

comment on table public.engine_filter_options is
  'The filter brands an engine is sold with, one row per package. An engine with no rows here is sold one way and uses engine_types.labour_package_id.';

create unique index if not exists engine_filter_options_label_key
  on public.engine_filter_options (engine_type_id, lower(btrim(label)));
create index if not exists idx_engine_filter_options_package
  on public.engine_filter_options (package_id);

drop trigger if exists trg_engine_filter_options_updated_at on public.engine_filter_options;
create trigger trg_engine_filter_options_updated_at
  before update on public.engine_filter_options
  for each row execute function public.set_updated_at();

drop trigger if exists trg_engine_filter_options_audit on public.engine_filter_options;
create trigger trg_engine_filter_options_audit
  after insert or update or delete on public.engine_filter_options
  for each row execute function public.audit_row();

-- RLS: same as engine_types — everyone signed in reads (the sales form needs
-- them), owner / co_owner write.
alter table public.engine_filter_options enable row level security;

drop policy if exists engine_filter_options_select on public.engine_filter_options;
create policy engine_filter_options_select on public.engine_filter_options
  for select to authenticated using (true);

drop policy if exists engine_filter_options_write on public.engine_filter_options;
create policy engine_filter_options_write on public.engine_filter_options
  for all to authenticated
  using (private.is_owner())
  with check (private.is_owner());

-- ============================================================================
-- engine_option_id on everything that was keyed by engine alone
-- ============================================================================
alter table public.engine_filters
  add column if not exists engine_option_id uuid
    references public.engine_filter_options(id) on delete cascade;
alter table public.engine_sell_prices
  add column if not exists engine_option_id uuid
    references public.engine_filter_options(id) on delete cascade;
alter table public.oil_price_lock_items
  add column if not exists engine_option_id uuid
    references public.engine_filter_options(id) on delete cascade;
-- A job outlives the option it was sold with: it falls back to the engine.
alter table public.sales_jobs
  add column if not exists engine_option_id uuid
    references public.engine_filter_options(id) on delete set null;

comment on column public.sales_jobs.engine_option_id is
  'Filter option the oil change was sold with (engine_filter_options). NULL when the engine has none, or for jobs older than the option (0150).';

create index if not exists idx_ef_engine_option
  on public.engine_filters (engine_option_id) where engine_option_id is not null;
create index if not exists idx_engine_sell_prices_option
  on public.engine_sell_prices (engine_option_id) where engine_option_id is not null;
create index if not exists idx_oil_price_lock_items_option
  on public.oil_price_lock_items (engine_option_id) where engine_option_id is not null;
create index if not exists idx_sales_jobs_engine_option
  on public.sales_jobs (engine_option_id) where engine_option_id is not null;

-- The old uniques are one-row-per-engine, which two options of one engine
-- break. Drop whichever unique constraint covers engine_type_id without the
-- option (found by its columns, not its generated name) and replace it with
-- one that includes the option. NULLS NOT DISTINCT keeps an engine without
-- options to a single row, exactly as the old constraint did.
do $$
declare
  r record;
begin
  for r in
    select c.conrelid::regclass as tbl, c.conname
      from pg_constraint c
     where c.contype = 'u'
       and c.conrelid in (
         'public.engine_filters'::regclass,
         'public.engine_sell_prices'::regclass,
         'public.oil_price_lock_items'::regclass
       )
       and exists (
         select 1 from unnest(c.conkey) k
           join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k
          where a.attname = 'engine_type_id')
       and not exists (
         select 1 from unnest(c.conkey) k
           join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k
          where a.attname = 'engine_option_id')
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;

create unique index if not exists engine_filters_engine_part_option_key
  on public.engine_filters (engine_type_id, part_id, engine_option_id)
  nulls not distinct;
create unique index if not exists engine_sell_prices_engine_oil_container_option_key
  on public.engine_sell_prices (engine_type_id, oil_type_id, container, engine_option_id)
  nulls not distinct;
create unique index if not exists oil_price_lock_items_lock_engine_option_key
  on public.oil_price_lock_items (lock_id, engine_type_id, engine_option_id)
  nulls not distinct;

-- ============================================================================
-- Label for an option made out of an existing engine row: the "With … Filter"
-- already in the engine's model name, else the one in its package's name
-- ("Mercedes Benz 4000" is linked to "… With Fleetguard Filter"), else
-- "Standard".
-- ============================================================================
create or replace function private.engine_filter_option_label(p_model text, p_package_name text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(btrim(substring(p_model from '(?i)\s(with\s+.*filter)\s*$')), ''),
    nullif(btrim(substring(p_package_name from '(?i)(with\s+?.*?filter)')), ''),
    'Standard'
  );
$$;

-- ============================================================================
-- oil_change_price — takes the option.
--
-- Same precedence as 0122 (live lock, manual price, cost-up), each step now
-- matched on the option as well. An engine that has options returns NULL until
-- one is chosen: there is no price for "C12/3406" without knowing the filter.
-- The three-argument version is dropped rather than kept beside this one —
-- two candidates make the RPC call ambiguous.
-- ============================================================================
drop function if exists public.oil_change_price(uuid, uuid, text);

create or replace function public.oil_change_price(
  p_engine_id   uuid,
  p_oil_type_id uuid,
  p_container   text default 'bulk',
  p_option_id   uuid default null
)
returns numeric
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_option   uuid;
  v_option_capacity numeric(6,2);
  v_locked   numeric(10,2);
  v_override numeric(10,2);
  v_oil_capacity   numeric(6,2);
  v_cost_per_litre numeric(10,4);
  v_filter_cost    numeric(12,2) := 0;
  v_service_cost   numeric(12,2) := 0;
  v_tier_premium   numeric(10,2) := 0;
  v_sell numeric(12,2);
begin
  -- An option only counts on its own engine.
  if p_option_id is not null then
    select o.id, o.oil_capacity_litres into v_option, v_option_capacity
      from public.engine_filter_options o
     where o.id = p_option_id and o.engine_type_id = p_engine_id;
  end if;
  if v_option is null and exists (
    select 1 from public.engine_filter_options o where o.engine_type_id = p_engine_id
  ) then
    return null;
  end if;

  -- 0) A live price lock wins over everything.
  select li.locked_price into v_locked
    from public.oil_price_lock_items li
    join public.oil_price_locks l on l.id = li.lock_id
   where l.oil_type_id = p_oil_type_id
     and l.container   = p_container
     and l.lock_until >= (now() at time zone 'America/Toronto')::date
     and li.engine_type_id = p_engine_id
     and li.engine_option_id is not distinct from v_option;
  if v_locked is not null then
    return v_locked;
  end if;

  -- 1) Manual override.
  select sell_price into v_override
    from public.engine_sell_prices
   where engine_type_id = p_engine_id
     and oil_type_id    = p_oil_type_id
     and container      = p_container
     and engine_option_id is not distinct from v_option;
  if v_override is not null then
    return v_override;
  end if;

  -- 2) Cost-up fallback.
  select coalesce(v_option_capacity, oil_capacity_litres) into v_oil_capacity
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
   where ef.engine_type_id = p_engine_id
     and ef.engine_option_id is not distinct from v_option;

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

revoke all on function public.oil_change_price(uuid, uuid, text, uuid) from public;
grant execute on function public.oil_change_price(uuid, uuid, text, uuid) to authenticated;

-- ============================================================================
-- add_engine_filter_option — give an engine a(nother) filter option.
--
-- The first option added to an engine that is already set up must not orphan
-- that setup. If the engine has a package linked and the new option is a
-- different one, the existing setup becomes option 1 and keeps its prices,
-- locks and filters; the new option starts empty. Otherwise the new option
-- takes them over. Either way the engine's own package link is cleared — from
-- here on the options carry the packages. One transaction.
-- ============================================================================
create or replace function public.add_engine_filter_option(
  p_engine   uuid,
  p_package  uuid,
  p_label    text,
  p_capacity numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_engine  public.engine_types%rowtype;
  v_adopter uuid;
  v_new     uuid;
begin
  if not private.is_owner() then
    raise exception 'Not authorised to edit engine types' using errcode = '42501';
  end if;
  if coalesce(btrim(p_label), '') = '' then
    raise exception 'Give the filter option a name';
  end if;
  select * into v_engine from public.engine_types where id = p_engine for update;
  if not found then
    raise exception 'The engine was not found';
  end if;
  if not exists (select 1 from public.part_packages where id = p_package) then
    raise exception 'The package was not found';
  end if;

  begin
    if not exists (select 1 from public.engine_filter_options where engine_type_id = p_engine) then
      if v_engine.labour_package_id is not null and v_engine.labour_package_id <> p_package then
        insert into public.engine_filter_options (engine_type_id, package_id, label, sort_order)
        select p_engine, p.id, private.engine_filter_option_label(v_engine.model, p.name), 10
          from public.part_packages p
         where p.id = v_engine.labour_package_id
        returning id into v_adopter;
      end if;

      insert into public.engine_filter_options
        (engine_type_id, package_id, label, oil_capacity_litres, sort_order)
      values (p_engine, p_package, btrim(p_label), p_capacity, 20)
      returning id into v_new;

      v_adopter := coalesce(v_adopter, v_new);
      update public.engine_filters set engine_option_id = v_adopter
       where engine_type_id = p_engine and engine_option_id is null;
      update public.engine_sell_prices set engine_option_id = v_adopter
       where engine_type_id = p_engine and engine_option_id is null;
      update public.oil_price_lock_items set engine_option_id = v_adopter
       where engine_type_id = p_engine and engine_option_id is null;
      update public.engine_types set labour_package_id = null where id = p_engine;
    else
      insert into public.engine_filter_options
        (engine_type_id, package_id, label, oil_capacity_litres, sort_order)
      select p_engine, p_package, btrim(p_label), p_capacity, coalesce(max(o.sort_order), 0) + 10
        from public.engine_filter_options o
       where o.engine_type_id = p_engine
      returning id into v_new;
    end if;
  exception when unique_violation then
    raise exception 'This engine already has a filter option with that name or that package';
  end;

  return v_new;
end;
$$;

revoke all on function public.add_engine_filter_option(uuid, uuid, text, numeric) from public;
revoke all on function public.add_engine_filter_option(uuid, uuid, text, numeric) from anon;
grant execute on function public.add_engine_filter_option(uuid, uuid, text, numeric) to authenticated;

-- ============================================================================
-- remove_engine_filter_option — take an option away.
--
-- Removing one of several deletes that option's prices, locks and filters with
-- it; its sales jobs stay on the engine. Removing the LAST one hands its setup
-- back to the engine instead (package, capacity, prices, locks, filters), so
-- the engine goes back to being sold one way with nothing lost.
-- ============================================================================
create or replace function public.remove_engine_filter_option(p_option uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_opt public.engine_filter_options%rowtype;
begin
  if not private.is_owner() then
    raise exception 'Not authorised to edit engine types' using errcode = '42501';
  end if;
  select * into v_opt from public.engine_filter_options where id = p_option for update;
  if not found then
    raise exception 'The filter option was not found';
  end if;

  if not exists (
    select 1 from public.engine_filter_options
     where engine_type_id = v_opt.engine_type_id and id <> p_option
  ) then
    -- Anything still keyed to the bare engine is unreachable while it has
    -- options, and would collide with the rows coming back.
    delete from public.engine_filters
     where engine_type_id = v_opt.engine_type_id and engine_option_id is null;
    delete from public.engine_sell_prices
     where engine_type_id = v_opt.engine_type_id and engine_option_id is null;
    delete from public.oil_price_lock_items
     where engine_type_id = v_opt.engine_type_id and engine_option_id is null;

    update public.engine_filters set engine_option_id = null where engine_option_id = p_option;
    update public.engine_sell_prices set engine_option_id = null where engine_option_id = p_option;
    update public.oil_price_lock_items set engine_option_id = null where engine_option_id = p_option;
    update public.engine_types
       set labour_package_id = v_opt.package_id,
           oil_capacity_litres = coalesce(v_opt.oil_capacity_litres, oil_capacity_litres)
     where id = v_opt.engine_type_id;
  end if;

  delete from public.engine_filter_options where id = p_option;
end;
$$;

revoke all on function public.remove_engine_filter_option(uuid) from public;
revoke all on function public.remove_engine_filter_option(uuid) from anon;
grant execute on function public.remove_engine_filter_option(uuid) to authenticated;

-- ============================================================================
-- Fold the doubled-up engines.
--
-- A group is the ACTIVE engines of one manufacturer whose model is the same
-- once "With … Filter" is stripped. It is folded only when every row in it is
-- linked to a package and no two share one — the package is what tells the
-- options apart, so a group that fails that is left alone and named in a
-- notice for someone to link by hand (then re-run this file).
--
-- The engine kept is the one already carrying the bare name, else the one on
-- the most sales jobs. It is renamed to the bare model and every row in the
-- group (itself included) becomes one of its options, taking that row's
-- package, capacity, filters, manual prices, locks and sales jobs along. The
-- other rows are then deleted, as is an inactive leftover already holding the
-- bare name (its jobs move to the kept engine first).
--
-- The updated_at and audit triggers on the re-keyed tables are switched off
-- for the fold: nobody edited these prices or jobs, and a thousand sales jobs
-- reading "edited today" would bury the real history. The engines themselves
-- stay audited, so the log shows which rows were renamed and deleted. If a job fails a check
-- constraint on the way the whole migration rolls back — nothing half-folded.
-- ============================================================================
do $$
declare
  g record;
  v record;
  t record;
  v_keeper      uuid;
  v_keeper_cap  numeric(6,2);
  v_base        text;
  v_label       text;
  v_opt         uuid;
  v_stale       uuid;
  v_n           integer;
  v_pos         integer;
  v_folded      integer := 0;
  v_options     integer := 0;
  v_jobs        integer := 0;
  v_quieted     text[] := '{}';
  v_sql         text;
begin
  for t in
    select c.relname, tg.tgname
      from pg_trigger tg
      join pg_class c on c.oid = tg.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and not tg.tgisinternal
       and tg.tgenabled <> 'D'
       and c.relname in ('sales_jobs', 'engine_sell_prices', 'engine_filters',
                         'oil_price_lock_items')
       and (tg.tgname like '%updated_at' or tg.tgname like '%audit')
  loop
    execute format('alter table public.%I disable trigger %I', t.relname, t.tgname);
    v_quieted := v_quieted || format('alter table public.%I enable trigger %I', t.relname, t.tgname);
  end loop;

  for g in
    with e as (
      select id, manufacturer, model, labour_package_id,
             btrim(regexp_replace(model, '\s+with\s+.*filter\s*$', '', 'i')) as base
        from public.engine_types
       where active
    )
    select manufacturer,
           lower(base) as base_key,
           count(*) as n,
           count(labour_package_id) as linked,
           count(distinct labour_package_id) as distinct_packages
      from e
     group by manufacturer, lower(base)
    having count(*) >= 2
     order by manufacturer, lower(base)
  loop
    if g.linked <> g.n or g.distinct_packages <> g.n then
      raise notice '0150: % % left as it is — each of its % rows needs its own package linked before it can be folded',
        g.manufacturer, g.base_key, g.n;
      continue;
    end if;

    select e.id, e.oil_capacity_litres,
           btrim(regexp_replace(e.model, '\s+with\s+.*filter\s*$', '', 'i'))
      into v_keeper, v_keeper_cap, v_base
      from public.engine_types e
     where e.active
       and e.manufacturer = g.manufacturer
       and lower(btrim(regexp_replace(e.model, '\s+with\s+.*filter\s*$', '', 'i'))) = g.base_key
     order by (lower(btrim(e.model)) = g.base_key) desc,
              (select count(*) from public.sales_jobs j where j.engine_type_id = e.id) desc,
              e.model
     limit 1;

    v_pos := 0;
    for v in
      select e.id, e.model, e.oil_capacity_litres, e.labour_package_id, p.name as package_name
        from public.engine_types e
        join public.part_packages p on p.id = e.labour_package_id
       where e.active
         and e.manufacturer = g.manufacturer
         and lower(btrim(regexp_replace(e.model, '\s+with\s+.*filter\s*$', '', 'i'))) = g.base_key
       order by e.model
    loop
      v_pos := v_pos + 1;
      v_label := private.engine_filter_option_label(v.model, v.package_name);
      if exists (
        select 1 from public.engine_filter_options o
         where o.engine_type_id = v_keeper and lower(btrim(o.label)) = lower(v_label)
      ) then
        v_label := v_label || ' (' || v.package_name || ')';
      end if;

      insert into public.engine_filter_options
        (engine_type_id, package_id, label, oil_capacity_litres, sort_order)
      values (
        v_keeper, v.labour_package_id, v_label,
        case when v.oil_capacity_litres <> v_keeper_cap then v.oil_capacity_litres end,
        v_pos * 10
      )
      returning id into v_opt;
      v_options := v_options + 1;

      update public.engine_filters
         set engine_type_id = v_keeper, engine_option_id = v_opt
       where engine_type_id = v.id and engine_option_id is null;
      update public.engine_sell_prices
         set engine_type_id = v_keeper, engine_option_id = v_opt
       where engine_type_id = v.id and engine_option_id is null;
      update public.oil_price_lock_items
         set engine_type_id = v_keeper, engine_option_id = v_opt
       where engine_type_id = v.id and engine_option_id is null;
      update public.sales_jobs
         set engine_type_id = v_keeper, engine_option_id = v_opt
       where engine_type_id = v.id and engine_option_id is null;
      get diagnostics v_n = row_count;
      v_jobs := v_jobs + v_n;

      if v.id <> v_keeper then
        delete from public.engine_types where id = v.id;
      end if;
    end loop;

    -- An inactive leftover already called the bare name would block the rename.
    for v_stale in
      select e.id from public.engine_types e
       where e.manufacturer = g.manufacturer
         and lower(btrim(e.model)) = g.base_key
         and e.id <> v_keeper
    loop
      update public.sales_jobs set engine_type_id = v_keeper where engine_type_id = v_stale;
      delete from public.engine_types where id = v_stale;
    end loop;

    update public.engine_types
       set model = v_base, labour_package_id = null
     where id = v_keeper;
    v_folded := v_folded + 1;
  end loop;

  foreach v_sql in array v_quieted loop
    execute v_sql;
  end loop;

  raise notice '0150: folded % engine(s) into % filter option(s); % sales job(s) now carry their option',
    v_folded, v_options, v_jobs;
end $$;
