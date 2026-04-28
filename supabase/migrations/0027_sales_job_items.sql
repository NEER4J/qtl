-- 0027_sales_job_items.sql
-- Line items per sales job. Each row is either a linked catalog part
-- (part_id set) or a free-text custom item. Sub-total on sales_jobs is
-- still the source of truth for analytics and stays denormalised — the
-- form/server sums items to derive it.

create table if not exists public.sales_job_items (
  id uuid primary key default gen_random_uuid(),
  sales_job_id uuid not null references public.sales_jobs(id) on delete cascade,
  part_id uuid references public.parts(id) on delete restrict,
  description text not null check (length(trim(description)) > 0),
  quantity numeric(10,2) not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  line_total numeric(14,2) generated always as ((quantity * unit_price)::numeric(14,2)) stored,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists sales_job_items_job_idx
  on public.sales_job_items (sales_job_id, position);
create index if not exists sales_job_items_part_idx
  on public.sales_job_items (part_id) where part_id is not null;

drop trigger if exists trg_sales_job_items_audit on public.sales_job_items;
create trigger trg_sales_job_items_audit
  after insert or update or delete on public.sales_job_items
  for each row execute function public.audit_row();

alter table public.sales_job_items enable row level security;

-- Visibility / write rights mirror the parent sales_job. We piggy-back on
-- sales_jobs RLS via an EXISTS clause — the parent's per-location filtering
-- transparently applies.
drop policy if exists sales_job_items_select on public.sales_job_items;
create policy sales_job_items_select on public.sales_job_items
  for select to authenticated
  using (
    exists (
      select 1 from public.sales_jobs sj
       where sj.id = sales_job_items.sales_job_id
    )
  );

drop policy if exists sales_job_items_insert on public.sales_job_items;
create policy sales_job_items_insert on public.sales_job_items
  for insert to authenticated
  with check (
    exists (
      select 1 from public.sales_jobs sj
       where sj.id = sales_job_items.sales_job_id
         and (
           private.current_role() in ('owner','accountant')
           or (private.current_role() in ('manager','staff')
               and sj.location_id = private.current_location())
         )
    )
  );

drop policy if exists sales_job_items_update on public.sales_job_items;
create policy sales_job_items_update on public.sales_job_items
  for update to authenticated
  using (
    exists (
      select 1 from public.sales_jobs sj
       where sj.id = sales_job_items.sales_job_id
         and (
           private.current_role() = 'owner'
           or (private.current_role() = 'manager'
               and sj.location_id = private.current_location())
         )
    )
  )
  with check (
    exists (
      select 1 from public.sales_jobs sj
       where sj.id = sales_job_items.sales_job_id
         and (
           private.current_role() = 'owner'
           or (private.current_role() = 'manager'
               and sj.location_id = private.current_location())
         )
    )
  );

drop policy if exists sales_job_items_delete on public.sales_job_items;
create policy sales_job_items_delete on public.sales_job_items
  for delete to authenticated
  using (
    exists (
      select 1 from public.sales_jobs sj
       where sj.id = sales_job_items.sales_job_id
         and (
           private.current_role() = 'owner'
           or (private.current_role() = 'manager'
               and sj.location_id = private.current_location())
         )
    )
  );
