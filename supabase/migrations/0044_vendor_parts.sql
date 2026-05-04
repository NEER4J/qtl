-- 0044_vendor_parts.sql
-- Item #24a — vendor ↔ part many-to-many with per-vendor cost. The existing
-- price_history table (migration 0024) tracks part-level cost changes; a
-- companion trigger here writes vendor-specific cost changes into the same
-- audit table so dashboards can show "this vendor raised filter cost by $X
-- last week".

create table if not exists public.vendor_parts (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id),
  part_id uuid not null references public.parts(id),
  vendor_part_number text,
  cost numeric(12,2) not null,
  is_preferred boolean not null default false,
  notes text,
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

-- One active row per (vendor, part) — the same vendor can re-list a part
-- after deactivation. Mirrors the soft-delete pattern used elsewhere.
create unique index if not exists vendor_parts_unique_active
  on public.vendor_parts(vendor_id, part_id)
  where deactivated_at is null;

create index if not exists vendor_parts_vendor_idx
  on public.vendor_parts(vendor_id)
  where deactivated_at is null;
create index if not exists vendor_parts_part_idx
  on public.vendor_parts(part_id)
  where deactivated_at is null;

-- updated_at trigger (shared helper from 0001_init).
drop trigger if exists trg_vendor_parts_updated_at on public.vendor_parts;
create trigger trg_vendor_parts_updated_at
  before update on public.vendor_parts
  for each row execute function public.set_updated_at();

-- Audit trigger (shared helper from 0001_init).
drop trigger if exists trg_vendor_parts_audit on public.vendor_parts;
create trigger trg_vendor_parts_audit
  after insert or update or delete on public.vendor_parts
  for each row execute function public.audit_row();

-- RLS: owner / manager / accountant read+write, staff read-only.
alter table public.vendor_parts enable row level security;

drop policy if exists vendor_parts_select on public.vendor_parts;
create policy vendor_parts_select on public.vendor_parts
  for select using (true);

drop policy if exists vendor_parts_insert on public.vendor_parts;
create policy vendor_parts_insert on public.vendor_parts
  for insert with check (private.current_role() in ('owner','manager','accountant'));

drop policy if exists vendor_parts_update on public.vendor_parts;
create policy vendor_parts_update on public.vendor_parts
  for update using (private.current_role() in ('owner','manager','accountant'))
  with check (private.current_role() in ('owner','manager','accountant'));

-- No DELETE policy — soft-delete only via deactivated_at (project convention).

-- ----------------------------------------------------------------------------
-- Item #24b — extend price_history to capture per-vendor cost changes.
-- price_history was added in 0024 with shape (entity_type, entity_id, field,
-- old_value, new_value, changed_by, changed_at). We add 'vendor_part' as a
-- valid entity_type so the existing dashboard widget surfaces these changes.
-- ----------------------------------------------------------------------------

-- Extend the price_history.entity_type check to include 'vendor_part'.
alter table public.price_history
  drop constraint if exists price_history_entity_type_check;
alter table public.price_history
  add constraint price_history_entity_type_check
  check (entity_type in ('part', 'oil_type', 'service_cost', 'vendor_part'));

create or replace function public.log_vendor_part_price_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare v_actor uuid := auth.uid();
begin
  if new.cost is distinct from old.cost then
    insert into public.price_history (entity_type, entity_id, field, old_value, new_value, changed_by)
    values ('vendor_part', new.id, 'cost', old.cost, new.cost, coalesce(new.updated_by, v_actor));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_vendor_parts_price_history on public.vendor_parts;
create trigger trg_vendor_parts_price_history
  after update on public.vendor_parts
  for each row execute function public.log_vendor_part_price_change();
