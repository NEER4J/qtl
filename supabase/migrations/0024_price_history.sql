-- 0024_price_history.sql
-- Pricing audit log — append-only record of every change to monetary fields on
-- parts, oil_types, and service_costs. Required by Pricing Plan §7.

create table if not exists public.price_history (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('part', 'oil_type', 'service_cost')),
  entity_id uuid not null,
  field text not null,
  old_value numeric,
  new_value numeric,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now()
);

create index if not exists idx_price_history_entity
  on public.price_history (entity_type, entity_id, changed_at desc);

alter table public.price_history enable row level security;

drop policy if exists price_history_select on public.price_history;
create policy price_history_select on public.price_history
  for select to authenticated
  using (private.current_role() = 'owner');

-- Block direct writes; only the trigger functions (security definer) may insert.
drop policy if exists price_history_no_write on public.price_history;
create policy price_history_no_write on public.price_history
  for all to authenticated
  using (false)
  with check (false);

-- ============================================================================
-- Trigger functions — one per entity. Inserts one row per changed field.
-- ============================================================================
create or replace function public.log_part_price_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare v_actor uuid := auth.uid();
begin
  if new.cost is distinct from old.cost then
    insert into public.price_history (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('part', new.id, 'cost', old.cost, new.cost, v_actor);
  end if;
  if new.list_price is distinct from old.list_price then
    insert into public.price_history (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('part', new.id, 'list_price', old.list_price, new.list_price, v_actor);
  end if;
  if new.mhsw_fee is distinct from old.mhsw_fee then
    insert into public.price_history (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('part', new.id, 'mhsw_fee', old.mhsw_fee, new.mhsw_fee, v_actor);
  end if;
  return new;
end;
$$;

create or replace function public.log_oil_type_price_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare v_actor uuid := auth.uid();
begin
  if new.bulk_cost_per_litre is distinct from old.bulk_cost_per_litre then
    insert into public.price_history (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('oil_type', new.id, 'bulk_cost_per_litre', old.bulk_cost_per_litre, new.bulk_cost_per_litre, v_actor);
  end if;
  if new.gallon_cost_per_litre is distinct from old.gallon_cost_per_litre then
    insert into public.price_history (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('oil_type', new.id, 'gallon_cost_per_litre', old.gallon_cost_per_litre, new.gallon_cost_per_litre, v_actor);
  end if;
  return new;
end;
$$;

create or replace function public.log_service_cost_price_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare v_actor uuid := auth.uid();
begin
  if new.cost is distinct from old.cost then
    insert into public.price_history (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('service_cost', new.id, 'cost', old.cost, new.cost, v_actor);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_parts_price_history on public.parts;
create trigger trg_parts_price_history
  after update on public.parts
  for each row execute function public.log_part_price_change();

drop trigger if exists trg_oil_types_price_history on public.oil_types;
create trigger trg_oil_types_price_history
  after update on public.oil_types
  for each row execute function public.log_oil_type_price_change();

drop trigger if exists trg_service_costs_price_history on public.service_costs;
create trigger trg_service_costs_price_history
  after update on public.service_costs
  for each row execute function public.log_service_cost_price_change();
