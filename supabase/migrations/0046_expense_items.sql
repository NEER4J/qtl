-- 0046_expense_items.sql
-- Line items for an expense — what parts came in this bill from the vendor.
-- Mirrors the sales_job_items pattern. Optionally links to a vendor_part so
-- price-history can attribute changes to a specific vendor.
--
-- expenses.sub_total stays the source of truth (denormalised); the form
-- sums these rows to populate it.

create table if not exists public.expense_items (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  part_id uuid references public.parts(id) on delete restrict,
  vendor_part_id uuid references public.vendor_parts(id) on delete set null,
  description text not null check (length(trim(description)) > 0),
  quantity numeric(10,2) not null check (quantity > 0),
  unit_cost numeric(12,2) not null check (unit_cost >= 0),
  line_total numeric(14,2) generated always as ((quantity * unit_cost)::numeric(14,2)) stored,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists expense_items_expense_idx
  on public.expense_items (expense_id, position);
create index if not exists expense_items_part_idx
  on public.expense_items (part_id) where part_id is not null;
create index if not exists expense_items_vendor_part_idx
  on public.expense_items (vendor_part_id) where vendor_part_id is not null;

drop trigger if exists trg_expense_items_audit on public.expense_items;
create trigger trg_expense_items_audit
  after insert or update or delete on public.expense_items
  for each row execute function public.audit_row();

alter table public.expense_items enable row level security;

-- Visibility / write rights piggy-back on the parent expense's RLS. Same
-- pattern as sales_job_items.
drop policy if exists expense_items_select on public.expense_items;
create policy expense_items_select on public.expense_items
  for select to authenticated
  using (
    exists (
      select 1 from public.expenses e
       where e.id = expense_items.expense_id
    )
  );

drop policy if exists expense_items_insert on public.expense_items;
create policy expense_items_insert on public.expense_items
  for insert to authenticated
  with check (
    exists (
      select 1 from public.expenses e
       where e.id = expense_items.expense_id
         and (
           private.current_role() in ('owner','accountant')
           or (private.current_role() in ('manager','staff')
               and e.location_id = private.current_location())
         )
    )
  );

drop policy if exists expense_items_update on public.expense_items;
create policy expense_items_update on public.expense_items
  for update to authenticated
  using (
    exists (
      select 1 from public.expenses e
       where e.id = expense_items.expense_id
         and (
           private.current_role() in ('owner','accountant')
           or (private.current_role() in ('manager','staff')
               and e.location_id = private.current_location())
         )
    )
  )
  with check (
    exists (
      select 1 from public.expenses e
       where e.id = expense_items.expense_id
         and (
           private.current_role() in ('owner','accountant')
           or (private.current_role() in ('manager','staff')
               and e.location_id = private.current_location())
         )
    )
  );

drop policy if exists expense_items_delete on public.expense_items;
create policy expense_items_delete on public.expense_items
  for delete to authenticated
  using (
    exists (
      select 1 from public.expenses e
       where e.id = expense_items.expense_id
         and (
           private.current_role() in ('owner','accountant')
           or (private.current_role() in ('manager','staff')
               and e.location_id = private.current_location())
         )
    )
  );
